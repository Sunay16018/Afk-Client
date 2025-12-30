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

    // Sürümü otomatik algıla (1.8'den 1.21.1'e kadar)
    const bot = mineflayer.createBot({
        host: data.host.split(':')[0],
        port: parseInt(data.host.split(':')[1]) || 25565,
        username: data.username,
        version: false, 
        hideErrors: true,
        checkTimeoutInterval: 60000
    });

    bots[data.username] = { 
        instance: bot, 
        settings: { math: false, autoRevive: false, autoMsg: false, msgText: "", msgDelay: 30, lastMsg: 0, pass: data.pass || "" }
    };

    bot.on('spawn', () => {
        socket.emit('status', { user: data.username, online: true });
        socket.emit('log', { user: 'SİSTEM', msg: `<span style="color:#00ff00">✓ Giriş Yapıldı! Sürüm: ${bot.version}</span>` });
        
        // Anti-AFK (Hareket Et)
        setInterval(() => { if(bot.entity) bot.look(bot.entity.yaw + 0.1, bot.entity.pitch); }, 20000);

        // Otomatik Login
        if (bots[data.username].settings.pass) {
            setTimeout(() => bot.chat(`/login ${bots[data.username].settings.pass}`), 2500);
        }
    });

    // SUNUCUDAN GELEN HER ŞEYİ OKU
    bot.on('message', (json) => {
        const text = json.toString();
        // Renkli mesajı terminale gönder
        socket.emit('log', { user: data.username, msg: json.toHTML() });

        // Matematik Çözücü
        const b = bots[data.username];
        if (b?.settings.math) {
            const mathMatch = text.match(/(\d+[\+\-\*\/]\d+([\+\-\*\/]\d+)*)/);
            if (mathMatch) {
                try {
                    const result = new Function(`return ${mathMatch[0]}`)();
                    if(!isNaN(result)) setTimeout(() => bot.chat(result.toString()), 1000);
                } catch (e) {}
            }
        }
    });

    // Otomatik Mesaj (Spam) Döngüsü
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

    bot.on('error', (err) => {
        socket.emit('log', { user: 'HATA', msg: `Hata: ${err.message}` });
    });

    bot.on('kicked', (reason) => {
        socket.emit('log', { user: 'SİSTEM', msg: `<span style="color:red">Kick: ${reason}</span>` });
    });

    bot.on('end', () => {
        const b = bots[data.username];
        const reconnect = b?.settings.autoRevive;
        socket.emit('status', { user: data.username, online: false });
        delete bots[data.username];
        if (reconnect) {
            socket.emit('log', { user: 'SİSTEM', msg: `Bağlantı koptu, 5sn sonra tekrar deneniyor...` });
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
