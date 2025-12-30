const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mineflayer = require('mineflayer');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

let bots = {};

function createBot(data, socket) {
    if (bots[data.username]) return;

    // HATA ÇÖZÜMÜ: Sürümü 1.21.1 olarak zorla veya desteklenen en yakın sürümü seç
    const bot = mineflayer.createBot({
        host: data.host.split(':')[0],
        port: parseInt(data.host.split(':')[1]) || 25565,
        username: data.username,
        // Eğer 1.21.1 desteklenmiyor diyorsa otomatik seçimi kapatıp 
        // manuel olarak sürümü buraya yazabiliriz ama 'auto' en iyisidir.
        // Burayı '1.21.1' yapıyorum senin için.
        version: "1.21.1", 
        hideErrors: false // Hatayı görmek için false yaptık
    });

    bots[data.username] = { 
        instance: bot, 
        settings: { math: false, autoRevive: false, autoMsg: false, msgText: "", msgDelay: 30, lastMsg: 0, pass: data.pass || "" }
    };

    bot.on('inject_allowed', () => {
        socket.emit('log', { user: 'SİSTEM', msg: 'Sürüm kontrolü geçildi, bağlanılıyor...' });
    });

    bot.on('spawn', () => {
        socket.emit('status', { user: data.username, online: true });
        socket.emit('log', { user: 'SİSTEM', msg: `<b style="color:#00ff41">Başarıyla giriş yapıldı! Sürüm: ${bot.version}</b>` });
    });

    bot.on('message', (json) => {
        socket.emit('log', { user: data.username, msg: json.toHTML() });
        const b = bots[data.username];
        if (b?.settings.math) {
            const mathMatch = json.toString().match(/(\d+[\+\-\*\/]\d+([\+\-\*\/]\d+)*)/);
            if (mathMatch) {
                try {
                    const result = new Function(`return ${mathMatch[0]}`)();
                    if(!isNaN(result)) setTimeout(() => bot.chat(result.toString()), 1000);
                } catch (e) {}
            }
        }
    });

    bot.on('error', (err) => {
        socket.emit('log', { user: 'HATA', msg: `<span style="color:red">Bağlantı Hatası: ${err.message}</span>` });
    });

    bot.on('kicked', (reason) => {
        socket.emit('log', { user: 'SİSTEM', msg: `<span style="color:red">Kick: ${reason}</span>` });
    });

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
