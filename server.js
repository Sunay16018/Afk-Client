const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mineflayer = require('mineflayer');
const path = require('path');
const fetch = require('node-fetch');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let bot = null;
let autoMsgInterval = null;

// --- RENDER.COM UYKU KORUMASI (7/24) ---
setInterval(() => {
    // Render URL'nizi buraya yazmalısınız (Örn: https://projeniz.onrender.com)
    // Kendi kendine ping atarak uyku moduna girmesini engeller.
    fetch(`http://localhost:${process.env.PORT || 3000}`).catch(() => {});
}, 300000); // 5 dakikada bir

io.on('connection', (socket) => {
    socket.emit('log', 'Sistem: Panele bağlanıldı.');

    socket.on('bot-baslat', (data) => {
        if (bot) return socket.emit('log', 'Bot zaten çalışıyor.');
        
        createBot(data, socket);
    });

    socket.on('bot-durdur', () => {
        if (bot) {
            bot.quit();
            bot = null;
            socket.emit('log', 'Bot bağlantısı kesildi.');
        }
    });
});

function createBot(data, socket) {
    bot = mineflayer.createBot({
        host: data.host,
        port: parseInt(data.port),
        username: data.username,
        version: false,
        checkTimeoutInterval: 90000
    });

    // --- GELİŞMİŞ ANTI-AFK SİSTEMİ ---
    setInterval(() => {
        if (bot && bot.entity) {
            const actions = ['forward', 'back', 'left', 'right', 'jump'];
            const randomAction = actions[Math.floor(Math.random() * actions.length)];
            
            bot.setControlState(randomAction, true);
            setTimeout(() => bot.setControlState(randomAction, false), 500);
            
            // Rastgele sağa sola bakış
            bot.look(Math.random() * Math.PI * 2, 0);
            socket.emit('log', 'Sistem: Anti-AFK hareketi yapıldı.');
        }
    }, 20000);

    // --- OTOMATİK GİRİŞ VE CHAT ---
    bot.on('chat', (username, message) => {
        if (username === bot.username) return;
        
        if (message.includes('/register') || message.includes('/login')) {
            bot.chat(`/login ${data.password} || /register ${data.password} ${data.password}`);
            socket.emit('log', 'Bot: Otomatik giriş yapıldı.');
        }
        socket.emit('log', `[Chat] ${username}: ${message}`);
    });

    // --- OTO MESAJ ---
    if (data.autoMsg && data.autoMsgTime > 0) {
        if(autoMsgInterval) clearInterval(autoMsgInterval);
        autoMsgInterval = setInterval(() => {
            if(bot) bot.chat(data.autoMsg);
        }, data.autoMsgTime * 1000);
    }

    // --- HATA YÖNETİMİ ---
    bot.on('kicked', (reason) => {
        socket.emit('log', `UYARI: Sunucudan atıldı: ${reason}`);
        bot = null;
    });

    bot.on('error', (err) => {
        socket.emit('log', `HATA: ${err.message}`);
        bot = null;
    });

    bot.on('end', () => {
        socket.emit('log', 'Bot bağlantısı sonlandı.');
        bot = null;
    });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server ${PORT} üzerinde aktif.`));
