const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mineflayer = require('mineflayer');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

let bots = {};

function createBot(data, socket) {
    if (bots[data.username]) return;

    const bot = mineflayer.createBot({
        host: data.host.split(':')[0],
        port: parseInt(data.host.split(':')[1]) || 25565,
        username: data.username,
        version: false, // OTOMATİK SÜRÜM ALGILAMA
        hideErrors: true,
        checkTimeoutInterval: 60000
    });

    bots[data.username] = { 
        instance: bot, 
        settings: { math: false, autoRevive: false, autoMsg: false, msgText: "", msgDelay: 30, lastMsg: 0, pass: data.pass || "" }
    };

    bot.on('spawn', () => {
        socket.emit('status', { user: data.username, online: true });
        socket.emit('log', { user: 'SİSTEM', msg: `<b style="color:#00ff00">✓ Giriş Yapıldı! Sürüm: ${bot.version}</b>` });
        
        // Anti-AFK: Hareket etme
        setInterval(() => { if(bot.entity) bot.look(bot.entity.yaw + 0.1, bot.entity.pitch); }, 20000);

        if (bots[data.username].settings.pass) {
            setTimeout(() => bot.chat(`/login ${bots[data.username].settings.pass}`), 2500);
        }
    });

    bot.on('message', (json) => {
        socket.emit('log', { user: data.username, msg: json.toHTML() });
        const text = json.toString();
        const b = bots[data.username];
        
        if (b?.settings.math) {
            const mathMatch = text.match(/(\d+[\+\-\*\/]\d+([\+\-\*\/]\d+)*)/);
            if (mathMatch) {
                try {
                    const res = new Function(`return ${mathMatch[0]}`)();
                    if(!isNaN(res)) setTimeout(() => bot.chat(res.toString()), 1000);
                } catch (e) {}
            }
        }
    });

    bot.on('error', (err) => socket.emit('log', { user: 'HATA', msg: err.message }));
    
    bot.on('end', () => {
        const b = bots[data.username];
        const reconnect = b?.settings.autoRevive;
        socket.emit('status', { user: data.username, online: false }); // HATA BURADAYDI, DÜZELTİLDİ
        delete bots[data.username];
        if (reconnect) {
            socket.emit('log', { user: 'SİSTEM', msg: 'Bağlantı bitti, 5sn sonra tekrar deneniyor...' });
            setTimeout(() => createBot(data, socket), 5000);
        }
    });
}

io.on('connection', (socket) => {
    socket.on('start-bot', (data) => createBot(data, socket));
    socket.on('chat', (d) => { if(bots[d.user]) bots[d.user].instance.chat(d.msg); });
    socket.on('quit', (u) => { if(bots[u]) { bots[u].settings.autoRevive = false; bots[u].instance.quit(); } });
    socket.on('update-config', (d) => { if(bots[d.user]) bots[d.user].settings = {...bots[d.user].settings, ...d.config}; });
});

server.listen(process.env.PORT || 3000);
