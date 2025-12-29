const mineflayer = require('mineflayer');
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

// Tüm dosyalar ana dizinde olduğu için kök dizini servis ediyoruz
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/style.css', (req, res) => res.sendFile(path.join(__dirname, 'style.css')));
app.get('/script.js', (req, res) => res.sendFile(path.join(__dirname, 'script.js')));

let bot;

function createBot() {
    bot = mineflayer.createBot({
        host: 'SUNUCU_IP_ADRESI', // Burayı değiştirin
        port: 25565,
        username: 'CyberAFK_Bot',
        version: '1.19.2'
    });

    bot.on('spawn', () => io.emit('log', '🤖 Bot sunucuya giriş yaptı!'));

    bot.on('chat', (username, message) => {
        if (username === bot.username) return;
        // Matematik Çözücü
        const mathMatch = message.match(/(\d+)\s*([\+\-\*\/])\s*(\d+)/);
        if (mathMatch) {
            const num1 = parseInt(mathMatch[1]);
            const op = mathMatch[2];
            const num2 = parseInt(mathMatch[3]);
            let res = (op === '+') ? num1 + num2 : (op === '-') ? num1 - num2 : (op === '*') ? num1 * num2 : Math.floor(num1 / num2);
            bot.chat(`Cevap: ${res}`);
            io.emit('log', `🧠 Matematik: ${num1}${op}${num2}=${res}`);
        }
    });

    bot.on('kicked', (reason) => {
        console.log(`\x1b[31mATILMA SEBEBİ: [${reason}]\x1b[0m`);
        io.emit('log', `❌ ATILMA: ${reason}`);
    });

    bot.on('end', () => {
        io.emit('log', '⚠️ Bağlantı koptu, 5sn sonra reconnect...');
        setTimeout(createBot, 5000);
    });
}

io.on('connection', (socket) => {
    socket.on('send-chat', (msg) => bot?.chat(msg));
    socket.on('move', (dir) => {
        const state = !bot.getControlState(dir);
        bot.setControlState(dir, state);
        io.emit('log', `🚶 ${dir.toUpperCase()}: ${state ? 'AÇIK' : 'KAPALI'}`);
    });
    socket.on('stop', () => {
        bot.clearControlStates();
        io.emit('log', '🛑 DURDURULDU');
    });
    socket.on('mine', async () => {
        const block = bot.blockAtCursor(4);
        if (!block) return io.emit('log', '⛏️ Blok yok!');
        try {
            io.emit('log', `⛏️ Kırılıyor: ${block.name}`);
            await bot.dig(block); // %100 Asenkron kırma
            io.emit('log', `✅ Kırıldı!`);
        } catch (err) { io.emit('log', `❌ Hata: ${err.message}`); }
    });
});

server.listen(PORT, () => {
    console.log(`Bot Paneli http://localhost:${PORT} adresinde aktif.`);
    createBot();
});
