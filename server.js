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

        const bot = mineflayer.createBot({
            host: data.host.split(':')[0],
            port: parseInt(data.host.split(':')[1]) || 25565,
            username: data.username,
            version: false
        });

        bots[botId] = bot;
        socket.emit('status', { username: botId, connected: true });

        bot.on('spawn', () => {
            socket.emit('log', { username: botId, msg: '§a✔ Bağlantı başarılı.' });
            if (data.password) {
                setTimeout(() => {
                    bot.chat(`/register ${data.password} ${data.password}`);
                    bot.chat(`/login ${data.password}`);
                }, 2000);
            }
        });

        bot.on('message', (jsonMsg) => socket.emit('log', { username: botId, msg: jsonMsg.toHTML() }));

        const cleanup = () => {
            if (bots[botId]) {
                socket.emit('status', { username: botId, connected: false });
                delete bots[botId];
            }
        };

        bot.on('kicked', (r) => { socket.emit('log', { username: botId, msg: `§c✘ Atıldı.` }); cleanup(); });
        bot.on('end', cleanup);
        bot.on('error', cleanup);
    });

    socket.on('move-bot', (d) => {
        const bot = bots[d.username];
        if (!bot || !bot.entity) return;
        if (d.dir === 'jump') {
            bot.setControlState('jump', true);
            setTimeout(() => bot.setControlState('jump', false), 400);
        } else if (d.dir === 'left-turn') { bot.look(bot.entity.yaw + 0.8, 0); }
        else if (d.dir === 'right-turn') { bot.look(bot.entity.yaw - 0.8, 0); }
        else if (d.dir === 'stop') { bot.clearControlStates(); }
        else { bot.clearControlStates(); bot.setControlState(d.dir, true); }
    });

    socket.on('send-chat', (d) => { if (bots[d.username]) bots[d.username].chat(d.msg); });
    socket.on('stop-bot', (user) => { if (bots[user]) { bots[user].quit(); } });
});

http.listen(3000);
