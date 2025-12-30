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

    try {
        const bot = mineflayer.createBot({
            host: data.host.split(':')[0],
            port: parseInt(data.host.split(':')[1]) || 25565,
            username: data.username,
            version: "1.21.1", // Sürümü burada zorla tanımladık
            hideErrors: true
        });

        bots[data.username] = { 
            instance: bot, 
            settings: { math: false, autoRevive: false, autoMsg: false, msgText: "", msgDelay: 30, lastMsg: 0, pass: data.pass || "" }
        };

        bot.on('spawn', () => {
            socket.emit('status', { user: data.username, online: true });
            socket.emit('log', { user: 'SİSTEM', msg: `<span style="color:#00ff41">Giriş Başarılı (1.21.1)</span>` });
        });

        bot.on('message', (json) => {
            socket.emit('log', { user: data.username, msg: json.toHTML() });
            const b = bots[data.username];
            if (b?.settings.math) {
                const plainText = json.toString();
                const mathMatch = plainText.match(/(\d+[\+\-\*\/]\d+([\+\-\*\/]\d+)*)/);
                if (mathMatch) {
                    try {
                        const result = eval(mathMatch[0]); // Zincirleme işlem için
                        if(!isNaN(result)) setTimeout(() => bot.chat(result.toString()), 1000);
                    } catch (e) {}
                }
            }
        });

        bot.on('error', (err) => {
            socket.emit('log', { user: 'HATA', msg: `<span style="color:red">${err.message}</span>` });
        });

        bot.on('kicked', (reason) => {
            socket.emit('log', { user: 'SİSTEM', msg: `<span style="color:orange">Atıldın: ${reason}</span>` });
        });

        bot.on('end', () => {
            const b = bots[data.username];
            const reconnect = b?.settings.autoRevive;
            socket.emit('status', { user: data.username, online: false });
            delete bots[data.username];
            if (reconnect) setTimeout(() => createBot(data, socket), 5000);
        });

    } catch (error) {
        socket.emit('log', { user: 'SİSTEM', msg: 'Bot başlatılamadı.' });
    }
}

io.on('connection', (socket) => {
    socket.on('start-bot', (data) => createBot(data, socket));
    socket.on('chat', (d) => { if(bots[d.user]) bots[d.user].instance.chat(d.msg); });
    socket.on('quit', (u) => { if(bots[u]) { bots[u].settings.autoRevive = false; bots[u].instance.quit(); } });
    socket.on('update-config', (d) => { if(bots[d.user]) bots[d.user].settings = {...bots[d.user].settings, ...d.config}; });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
