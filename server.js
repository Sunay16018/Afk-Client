const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const mineflayer = require('mineflayer');

app.use(express.static(__dirname));
let bots = {};

io.on('connection', (socket) => {
    socket.on('start-bot', (data) => {
        if (bots[data.username]) return;

        const bot = mineflayer.createBot({
            host: data.host.split(':')[0],
            port: parseInt(data.host.split(':')[1]) || 25565,
            username: data.username,
            version: false,
            hideErrors: true
        });

        bots[data.username] = {
            instance: bot,
            settings: { math: false, delay: 0, recon: false, mine: false, msgs: [] },
            intervals: [],
            lastAns: ""
        };

        // GERÇEK MADEN KIRMA MODU
        bot.on('physicsTick', () => {
            const b = bots[data.username];
            if (b && b.settings.mine) {
                const target = bot.blockAtCursor(4);
                if (target && bot.canDigBlock(target)) {
                    if (!bot.targetDigBlock) {
                        bot.dig(target, true).catch(() => {});
                    }
                }
            }
        });

        bot.on('message', (json) => {
            const b = bots[data.username];
            if (!b) return;
            const txt = json.toString();
            socket.emit('log', { user: data.username, msg: json.toHTML() });

            // GELİŞMİŞ MATEMATİK (Çoklu işlem destekli)
            if (b.settings.math) {
                if (b.lastAns && txt.includes(b.lastAns)) return;
                const mathMatch = txt.replace(/x/g, '*').replace(/:/g, '/').match(/(\d+(?:\s*[\+\-\*\/]\s*\d+)+)/);
                if (mathMatch) {
                    try {
                        const res = eval(mathMatch[0]);
                        if (!isNaN(res)) {
                            b.lastAns = res.toString();
                            setTimeout(() => bot.chat(res.toString()), b.settings.delay * 1000);
                        }
                    } catch (e) {}
                }
            }
        });

        bot.on('spawn', () => socket.emit('status', { user: data.username, online: true }));
        bot.on('end', () => {
            const b = bots[data.username];
            socket.emit('status', { user: data.username, online: false });
            if (b && b.settings.recon) setTimeout(() => socket.emit('start-bot', data), 5000);
            delete bots[data.username];
        });
    });

    socket.on('update-config', (d) => {
        const b = bots[d.user];
        if (!b) return;
        b.settings = d.config;
        b.intervals.forEach(clearInterval);
        b.intervals = [];
        b.settings.msgs.forEach(m => {
            if (m.txt && m.sec > 0) {
                b.intervals.push(setInterval(() => b.instance.chat(m.txt), m.sec * 1000));
            }
        });
    });

    socket.on('move', (d) => {
        const b = bots[d.user]?.instance;
        if (b) {
            b.setControlState(d.dir, true);
            setTimeout(() => b.setControlState(d.dir, false), 250);
        }
    });

    socket.on('chat', (d) => { if(bots[d.user]) bots[d.user].instance.chat(d.msg); });
    socket.on('quit-bot', (u) => { if(bots[u]) bots[u].instance.quit(); });
});

http.listen(3000, () => console.log('AFK CLIENT: http://localhost:3000'));
