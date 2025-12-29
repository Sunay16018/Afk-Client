const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mineflayer = require('mineflayer');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

let bot;
let isMining = false;

function createBot() {
    bot = mineflayer.createBot({
        host: 'SUNUCU_IP_ADRESI', // Burayı değiştirin
        port: 25565,
        username: 'AFK_Bot',
        version: '1.20.1' // Sunucu sürümünüze göre ayarlayın
    });

    bot.on('login', () => {
        sendLogs('✅ Bot sunucuya giriş yaptı!');
    });

    // MATEMATİK ÇÖZÜCÜ & SOHBET
    bot.on('chat', (username, message) => {
        if (username === bot.username) return;

        // Basit Matematik Regex: "5 + 5" veya "10 * 2" gibi kalıpları yakalar
        const mathMatch = message.match(/(\d+)\s*([\+\-\*\/])\s*(\d+)/);
        if (mathMatch) {
            const n1 = parseInt(mathMatch[1]);
            const op = mathMatch[2];
            const n2 = parseInt(mathMatch[3]);
            let res;
            if (op === '+') res = n1 + n2;
            if (op === '-') res = n1 - n2;
            if (op === '*') res = n1 * n2;
            if (op === '/') res = n1 / n2;
            bot.chat(`Cevap: ${res}`);
            sendLogs(`🧠 Soru Çözüldü: ${n1}${op}${n2}=${res}`);
        }
        sendLogs(`💬 [${username}]: ${message}`);
    });

    // HATASIZ MINING SİSTEMİ
    bot.on('physicsTick', async () => {
        if (!isMining) return;
        const target = bot.blockAtCursor(4);
        if (target && bot.canDigBlock(target)) {
            isMining = false; // İşlem bitene kadar kilitle
            try {
                sendLogs(`⛏️ Kırılıyor: ${target.name}`);
                await bot.dig(target);
            } catch (err) {
                console.log(err);
            }
            isMining = true;
        }
    });

    bot.on('kicked', (reason) => {
        const msg = JSON.parse(reason);
        sendLogs(`❌ ATILMA SEBEBİ: [${msg.text || reason}]`, 'error');
    });

    bot.on('end', () => {
        sendLogs('⚠️ Bağlantı kesildi, 5 saniye içinde yeniden denenecek...');
        setTimeout(createBot, 5000);
    });

    bot.on('error', (err) => sendLogs(`‼️ Hata: ${err.message}`, 'error'));
}

function sendLogs(msg, type = 'info') {
    io.emit('log', { msg, type, time: new Date().toLocaleTimeString() });
    console.log(`[${type.toUpperCase()}] ${msg}`);
}

io.on('connection', (socket) => {
    socket.on('command', (data) => {
        if (data.type === 'chat') bot.chat(data.val);
        if (data.type === 'move') {
            bot.clearControlStates();
            if (data.val !== 'stop') bot.setControlState(data.val, true);
            sendLogs(`🚶 Hareket: ${data.val.toUpperCase()}`);
        }
        if (data.type === 'mining') {
            isMining = data.val;
            sendLogs(isMining ? '⛏️ Mining Başlatıldı' : '🛑 Mining Durduruldu');
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    createBot();
});
