const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mineflayer = require('mineflayer');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

// Dosyaları ana dizinden servis etme ayarı
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/style.css', (req, res) => res.sendFile(path.join(__dirname, 'style.css')));
app.get('/script.js', (req, res) => res.sendFile(path.join(__dirname, 'script.js')));

let bot;
let isMining = false;
let isDigging = false; // Çift kazmayı önlemek için kilit

function createBot() {
    bot = mineflayer.createBot({
        host: 'SUNUCU_IP_ADRESI', 
        port: 25565,
        username: 'CyberAFK_Bot',
        version: '1.20.1'
    });

    bot.on('login', () => sendLogs('✅ Bot sunucuya giriş yaptı!'));

    // SOHBET VE MATEMATİK ÇÖZÜCÜ (Regex)
    bot.on('chat', (username, message) => {
        if (username === bot.username) return;
        
        const mathMatch = message.match(/(\d+)\s*([\+\-\*\/])\s*(\d+)/);
        if (mathMatch) {
            const n1 = parseInt(mathMatch[1]), op = mathMatch[2], n2 = parseInt(mathMatch[3]);
            let res = op==='+' ? n1+n2 : op==='-' ? n1-n2 : op==='*' ? n1*n2 : n1/n2;
            bot.chat(`Cevap: ${res}`);
            sendLogs(`🧠 Matematik Çözüldü: ${n1}${op}${n2} = ${res}`);
        }
        sendLogs(`💬 [${username}]: ${message}`);
    });

    // HATASIZ ASENKRON MINING SİSTEMİ
    bot.on('physicsTick', async () => {
        if (!isMining || isDigging) return;
        const target = bot.blockAtCursor(4);
        if (target && bot.canDigBlock(target)) {
            isDigging = true;
            try {
                sendLogs(`⛏️ Kırılıyor: ${target.name}`);
                await bot.dig(target);
            } catch (err) { /* Sessizce geç */ }
            isDigging = false;
        }
    });

    bot.on('kicked', (reason) => {
        const cleanReason = reason.toString();
        sendLogs(`❌ ATILMA SEBEBİ: [${cleanReason}]`, 'error');
    });

    bot.on('end', () => {
        sendLogs('⚠️ Bağlantı koptu, 5 saniye sonra otomatik restart...');
        setTimeout(createBot, 5000);
    });
}

function sendLogs(msg, type = 'info') {
    io.emit('log', { msg, type, time: new Date().toLocaleTimeString() });
}

io.on('connection', (socket) => {
    socket.on('command', (data) => {
        if (data.type === 'chat') bot.chat(data.val);
        if (data.type === 'move') {
            bot.clearControlStates();
            if (data.val !== 'stop') bot.setControlState(data.val, true);
        }
        if (data.type === 'mining') isMining = data.val;
    });
});

server.listen(PORT, () => console.log(`Dashboard aktif: Port ${PORT}`));
createBot();
