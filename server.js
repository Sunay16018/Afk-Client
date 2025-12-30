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

    // ViaVersion olan sunucular için 1.20.4 en stabil giriştir
    const bot = mineflayer.createBot({
        host: data.host.split(':')[0],
        port: parseInt(data.host.split(':')[1]) || 25565,
        username: data.username,
        version: "1.20.4", // 1.21.1 hatasını bu şekilde bypass ediyoruz
        hideErrors: true
    });

    bots[data.username] = { 
        instance: bot, 
        settings: { math: false, autoRevive: false, autoMsg: false, msgText: "", msgDelay: 30, lastMsg: 0, pass: data.pass || "" }
    };

    bot.on('spawn', () => {
        socket.emit('status', { user: data.username, online: true });
        socket.emit('log', { user: 'SİSTEM', msg: `<span style="color:#00ff00">✓ Minetruth Bağlantısı Başarılı!</span>` });
        
        // Anti-AFK (Düşmemek için)
        setInterval(() => { if(bot.entity) bot.look(bot.entity.yaw + 0.1, bot.entity.pitch); }, 20000);

        if (bots[data.username].settings.pass) {
            setTimeout(() => bot.chat(`/login ${bots[data.username].settings.pass}`), 2500);
        }
    });

    // Matematik ve Oto-Mesaj Analizi (Okuma Kapalı)
    bot.on('message', (json) => {
        const text = json.toString();
        const b = bots[data.username];
        if (b && b.settings.math) {
            // Zincirleme işlem (1+1+5*2 gibi)
            const mathMatch = text.match(/(\d+[\+\-\*\/]\d+([\+\-\*\/]\d+)*)/);
            if (mathMatch) {
                try {
                    const result = Function('"use strict"; return (' + mathMatch[0] + ')')();
                    if(!isNaN(result)) setTimeout(() => bot.chat(result.toString()), 1000);
                } catch (e) {}
            }
        }
    });

    // Oto-Mesaj Döngüsü
    setInterval(() => {
        const b = bots[data.username];
        if (b && b.settings.autoMsg && b.settings.msgText) {
            const now = Date.now();
            if (now - b.settings.lastMsg > b.settings.msgDelay * 1000) {
                bot.chat(b.settings.msgText);
                b.settings.lastMsg = now;
            }
        }
    }, 1000);

    bot.on('error', (err) => socket.emit('log', { user: 'HATA', msg: err.message }));
    bot.on('kicked', () => socket.emit('log', { user: 'SİSTEM', msg: 'Sunucudan atıldın veya bağlantı koptu.' }));

    bot.on('end', () => {
        const b = bots[data.username];
        const reconnect = b?.settings.autoRevive;
        socket.emit('status', { user: data.username, online: false });
        delete bots[data.username];
        if (reconnect) setTimeout(() => createBot(data, socket), 5000);
    });
}

io.on('connection', (socket) => {
    socket.on('start-bot', (data) => createBot(data, socket));
    socket.on('chat', (d) => { if(bots[d.user]) bots[d.user].instance.chat(d.msg); });
    socket.on('quit', (u) => { if(bots[u]) { bots[u].settings.autoRevive = false; bots[u].instance.quit(); } });
    socket.on('update-config', (d) => { if(bots[d.user]) bots[d.user].settings = {...bots[d.user].settings, ...d.config}; });
});

server.listen(process.env.PORT || 3000);
