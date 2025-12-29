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
            // Sürüm belirtilmedi: Her sürüme otomatik uyum sağlar
            hideErrors: true
        });

        bots[botId] = { instance: bot, mathOn: false, mathSec: 0 };

        bot.on('login', () => {
            socket.emit('status', { username: botId, connected: true });
            socket.emit('log', { username: botId, msg: '§a✔ Bağlantı kuruldu, giriş yapılıyor...' });
        });

        bot.on('spawn', () => {
            socket.emit('log', { username: botId, msg: `§b§l✔ Bot hazır! Sürüm: ${bot.version}` });
            if (data.password) {
                setTimeout(() => bot.chat(`/login ${data.password}`), 1000);
                setTimeout(() => bot.chat(`/register ${data.password} ${data.password}`), 1500);
            }
        });

        bot.on('message', (jsonMsg) => {
            socket.emit('log', { username: botId, msg: jsonMsg.toHTML() });
            
            const bD = bots[botId];
            if (bD && bD.mathOn) {
                const text = jsonMsg.toString();
                // Gelişmiş Matematik Regex
                const match = text.replace(/x/g, '*').replace(/:/g, '/').match(/(\d+[\s\+\-\*\/\(\)\^]*\d+)/);
                if (match) {
                    try {
                        const result = eval(match[0]);
                        if (!isNaN(result) && !text.includes("=" + result)) {
                            setTimeout(() => bot.chat(result.toString()), bD.mathSec * 1000);
                        }
                    } catch(e) {}
                }
            }
        });

        bot.on('error', (err) => socket.emit('log', { username: botId, msg: `§cHata: ${err.message}` }));
        bot.on('end', () => {
            socket.emit('status', { username: botId, connected: false });
            delete bots[botId];
        });
    });

    socket.on('move-bot', (d) => {
        const b = bots[d.username]?.instance;
        if (!b || !b.entity) return;

        const keys = ['forward', 'back', 'left', 'right', 'jump', 'sprint'];
        if (d.dir === 'stop') {
            keys.forEach(k => b.setControlState(k, false));
        } else if (d.dir === 'jump') {
            b.setControlState('jump', true);
            setTimeout(() => b.setControlState('jump', false), 200);
        } else if (d.dir === 'left-turn') {
            b.look(b.entity.yaw + 0.5, b.entity.pitch, true);
        } else if (d.dir === 'right-turn') {
            b.look(b.entity.yaw - 0.5, b.entity.pitch, true);
        } else {
            keys.forEach(k => b.setControlState(k, false));
            b.setControlState(d.dir, true);
            b.setControlState('sprint', true);
        }
    });

    socket.on('send-chat', (d) => { if(bots[d.username]) bots[d.username].instance.chat(d.msg); });
    socket.on('update-settings', (d) => { if(bots[d.user]) { bots[d.user].mathOn = d.mathOn; bots[d.user].mathSec = d.mathSec; } });
    socket.on('stop-bot', (u) => { if(bots[u]) bots[u].instance.quit(); });
});

http.listen(3000);
