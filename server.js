const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const mineflayer = require('mineflayer');

app.use(express.static(__dirname));
let bots = {};

io.on('connection', (socket) => {
    socket.on('start-bot', (data) => {
        if (!data.host || !data.username || bots[data.username]) return;

        const bot = mineflayer.createBot({
            host: data.host.split(':')[0],
            port: parseInt(data.host.split(':')[1]) || 25565,
            username: data.username,
            version: false,
            hideErrors: true
        });

        bots[data.username] = {
            instance: bot,
            settings: { math: false, delay: 0, mine: false, pass: data.pass || "" }
        };

        bot.on('spawn', () => {
            socket.emit('status', { user: data.username, online: true });
            const b = bots[data.username];
            if (b.settings.pass) {
                setTimeout(() => bot.chat(`/login ${b.settings.pass}`), 2000);
                setTimeout(() => bot.chat(`/register ${b.settings.pass} ${b.settings.pass}`), 2500);
            }
        });

        bot.on('message', (json) => {
            socket.emit('log', { user: data.username, msg: json.toHTML() });
            const b = bots[data.username];
            if (b?.settings.math) {
                const txt = json.toString().replace(/x/g, '*').replace(/:/g, '/');
                const mathMatch = txt.match(/(\d+(?:\s*[\+\-\*\/]\s*\d+)+)/);
                if (mathMatch) {
                    try {
                        const res = eval(mathMatch[0]);
                        if (!isNaN(res)) setTimeout(() => bot.chat(res.toString()), b.settings.delay * 1000);
                    } catch (e) {}
                }
            }
        });

        bot.on('physicsTick', () => {
            const b = bots[data.username];
            if (b?.settings.mine) {
                const target = bot.blockAtCursor(4);
                if (target && !bot.targetDigBlock) bot.dig(target, true).catch(() => {});
            }
        });

        bot.on('end', () => {
            socket.emit('status', { user: data.username, online: false });
            delete bots[data.username];
        });
    });

    socket.on('chat', (d) => bots[d.user]?.instance.chat(d.msg));
    socket.on('quit', (u) => bots[u]?.instance.quit());
    socket.on('move', (d) => {
        const b = bots[d.user]?.instance;
        if (b) { b.setControlState(d.dir, true); setTimeout(() => b.setControlState(d.dir, false), 250); }
    });
    socket.on('update-config', (d) => { if(bots[d.user]) bots[d.user].settings = d.config; });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`AFK CLIENT Online: ${PORT}`));
