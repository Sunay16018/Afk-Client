const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mineflayer = require('mineflayer');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let bot = null;
let afkInterval = null;
let autoMessageInterval = null;

// Render 7/24 Uyku Koruması (Anti-Sleep)
const RENDER_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 3000}`;
setInterval(() => {
    fetch(RENDER_URL).catch(() => {});
}, 300000); // 5 dakikada bir ping

function createBot(config, socket) {
    if (bot) {
        bot.quit();
        clearInterval(afkInterval);
        clearInterval(autoMessageInterval);
    }

    bot = mineflayer.createBot({
        host: config.host,
        port: parseInt(config.port) || 25565,
        username: config.username,
        version: config.version || false,
        checkTimeoutInterval: 90000
    });

    socket.emit('log', { type: 'system', text: '§eBağlantı başlatılıyor...' });

    bot.on('login', () => {
        socket.emit('log', { type: 'system', text: '§aSunucuya giriş yapıldı!' });
        socket.emit('status', { connected: true });
        startAntiAFK();
    });

    bot.on('chat', (username, message) => {
        socket.emit('log', { type: 'chat', user: username, text: message });
        
        // Auto-Auth (Otomatik Giriş/Kayıt)
        const msg = message.toLowerCase();
        if (msg.includes('/register') || msg.includes('/login')) {
            bot.chat(`/login ${config.password}`);
            bot.chat(`/register ${config.password} ${config.password}`);
            socket.emit('log', { type: 'system', text: '§bOtomatik giriş komutu gönderildi.' });
        }
    });

    bot.on('kicked', (reason) => {
        socket.emit('log', { type: 'error', text: `§cAtıldınız: ${reason}` });
        socket.emit('status', { connected: false });
    });

    bot.on('error', (err) => {
        socket.emit('log', { type: 'error', text: `§cHata: ${err.message}` });
    });

    bot.on('end', () => {
        socket.emit('log', { type: 'system', text: '§6Bağlantı kesildi.' });
        socket.emit('status', { connected: false });
        clearInterval(afkInterval);
    });

    function startAntiAFK() {
        afkInterval = setInterval(() => {
            if (!bot) return;
            const actions = ['jump', 'forward', 'back', 'left', 'right'];
            const randomAction = actions[Math.floor(Math.random() * actions.length)];
            
            bot.setControlState(randomAction, true);
            setTimeout(() => bot.setControlState(randomAction, false), 500);
            
            // Rastgele bakış
            const yaw = (Math.random() - 0.5) * 2;
            const pitch = (Math.random() - 0.5) * 2;
            bot.look(bot.entity.yaw + yaw, bot.entity.pitch + pitch);
            
        }, 20000); // 20 saniyede bir
    }
}

io.on('connection', (socket) => {
    socket.on('start-bot', (config) => createBot(config, socket));
    
    socket.on('stop-bot', () => {
        if (bot) bot.quit();
    });

    socket.on('set-auto-msg', (data) => {
        clearInterval(autoMessageInterval);
        if (data.enabled && bot) {
            autoMessageInterval = setInterval(() => {
                bot.chat(data.message);
            }, data.interval * 1000);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Sunucu ${PORT} üzerinde aktif.`));