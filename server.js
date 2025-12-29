const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const mineflayer = require('mineflayer');

app.use(express.static(__dirname));

let bots = {};

io.on('connection', (socket) => {
    socket.on('start-bot', (data) => {
        const botId = data.username;
        if (bots[botId]) return;

        // Bot bağlanmaya çalıştığı an listeye ekle
        socket.emit('status', { username: botId, connected: true });

        const bot = mineflayer.createBot({
            host: data.host.split(':')[0],
            port: parseInt(data.host.split(':')[1]) || 25565,
            username: data.username,
            version: false
        });

        bots[botId] = bot;

        bot.on('spawn', () => {
            socket.emit('log', { username: botId, msg: '§a[SİSTEM] Sunucuya giriş yapıldı!' });
            
            // Otomatik Login (Sunucunun hazır olması için 2 saniye bekler)
            setTimeout(() => {
                if (data.password) {
                    bot.chat(`/register ${data.password} ${data.password}`);
                    bot.chat(`/login ${data.password}`);
                    socket.emit('log', { username: botId, msg: '§e[SİSTEM] Login komutları gönderildi.' });
                }
            }, 2000);
        });

        bot.on('message', (jsonMsg) => {
            socket.emit('log', { username: botId, msg: jsonMsg.toHTML() });
        });

        bot.on('error', (err) => {
            socket.emit('log', { username: botId, msg: `§cHata: ${err.message}` });
        });

        bot.on('kicked', (reason) => {
            socket.emit('log', { username: botId, msg: `§cAtıldı: ${reason}` });
        });

        bot.on('end', () => {
            socket.emit('status', { username: botId, connected: false });
            delete bots[botId];
        });
    });

    socket.on('send-chat', (d) => {
        if (bots[d.username]) bots[d.username].chat(d.msg);
    });

    socket.on('stop-bot', (user) => {
        if (bots[user]) { bots[user].quit(); delete bots[user]; }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Sunucu ${PORT} portunda aktif.`));
