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

        // Anında listede gözükmesi için sinyal gönder
        socket.emit('status', { username: botId, connected: true });

        const bot = mineflayer.createBot({
            host: data.host.split(':')[0],
            port: parseInt(data.host.split(':')[1]) || 25565,
            username: data.username,
            version: false
        });

        bots[botId] = bot;

        bot.on('spawn', () => {
            socket.emit('log', { username: botId, msg: '§a[SİSTEM] Sunucuya girildi.' });
            setTimeout(() => {
                if (data.password) {
                    bot.chat(`/register ${data.password} ${data.password}`);
                    bot.chat(`/login ${data.password}`);
                    socket.emit('log', { username: botId, msg: '§e[SİSTEM] Login gönderildi.' });
                }
            }, 2000);
        });

        bot.on('message', (jsonMsg) => {
            socket.emit('log', { username: botId, msg: jsonMsg.toHTML() });
        });

        bot.on('error', (err) => {
            socket.emit('log', { username: botId, msg: `§cHata: ${err.message}` });
            socket.emit('status', { username: botId, connected: false });
            delete bots[botId];
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

http.listen(process.env.PORT || 3000, () => console.log("Server Aktif"));
            
