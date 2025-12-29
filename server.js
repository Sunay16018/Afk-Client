const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const mineflayer = require('mineflayer');

app.use(express.static(__dirname));
let bots = {};

io.on('connection', (socket) => {
    socket.on('start-bot', (data) => {
        createBotInstance(data, socket);
    });

    function createBotInstance(data, socket) {
        const botId = data.username;
        if (bots[botId]) return;

        const bot = mineflayer.createBot({
            host: data.host.split(':')[0],
            port: parseInt(data.host.split(':')[1]) || 25565,
            username: data.username,
            hideErrors: true
        });

        bots[botId] = { 
            instance: bot, 
            settings: { math: false, delay: 0, recon: false, mining: false, msgs: [] },
            intervals: [], lastAns: "" 
        };

        bot.on('spawn', () => {
            socket.emit('status', { username: botId, connected: true });
            socket.emit('log', { username: botId, msg: '§a✔ Bağlantı kuruldu!' });
        });

        bot.on('message', (json) => {
            const b = bots[botId];
            const txt = json.toString();
            socket.emit('log', { username: botId, msg: json.toHTML() });

            if (b.settings.math) {
                if (b.lastAns && txt.includes(b.lastAns)) return;
                const match = txt.replace(/x/g, '*').replace(/:/g, '/').match(/(\d+[\s\+\-\*\/\^]*\d+)/);
                if (match) {
                    try {
                        const res = eval(match[0]);
                        if (!isNaN(res)) {
                            b.lastAns = res.toString();
                            setTimeout(() => bot.chat(res.toString()), b.settings.delay * 1000);
                        }
                    } catch (e) {}
                }
            }
        });

        bot.on('end', () => {
            const current = bots[botId];
            socket.emit('status', { username: botId, connected: false });
            if (current && current.settings.recon) {
                setTimeout(() => createBotInstance(data, socket), 5000);
            }
            delete bots[botId];
        });

        bot.on('error', (err) => socket.emit('log', { username: botId, msg: '§cHata: ' + err.message }));
    }

    socket.on('update-config', (d) => {
        const b = bots[d.user];
        if (!b) return;
        b.settings = d.config;

        // Maden Modu (Sol tık basılı tutma simülasyonu)
        if (b.settings.mining) {
            b.instance.activateItem(); 
            b.instance.swingArm('right');
        } else { b.instance.deactivateItem(); }

        // Oto Mesajlar
        b.intervals.forEach(clearInterval);
        b.intervals = [];
        b.settings.msgs.forEach(m => {
            if (m.text && m.time > 0) {
                b.intervals.push(setInterval(() => b.instance.chat(m.text), m.time * 1000));
            }
        });
    });

    socket.on('move-bot', (d) => {
        const b = bots[d.user]?.instance;
        if (!b) return;
        if (d.dir === 'jump') {
            b.setControlState('jump', true);
            setTimeout(() => b.setControlState('jump', false), 300);
        } else {
            b.setControlState(d.dir, true);
            setTimeout(() => b.setControlState(d.dir, false), 250);
        }
    });

    socket.on('send-chat', (d) => { if(bots[d.user]) bots[d.user].instance.chat(d.msg); });
});

http.listen(3000, () => console.log('Panel Hazır: http://localhost:3000'));
            
