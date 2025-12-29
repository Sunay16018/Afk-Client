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
            version: false, // 1.21 ve üstü için otomatik algılama
            hideErrors: true
        });

        bots[botId] = { instance: bot, pass: data.password, mathOn: false, mathSec: 1 };
        socket.emit('status', { username: botId, connected: true });

        bot.on('spawn', () => {
            socket.emit('log', { username: botId, msg: '§a✔ Bot 1.21+ Sunucuya Girdi.' });
            const p = bots[botId].pass;
            if (p) {
                setTimeout(() => {
                    bot.chat(`/register ${p} ${p}`);
                    bot.chat(`/login ${p}`);
                }, 2000);
            }
        });

        // GELİŞMİŞ MATEMATİK MOTORU
        bot.on('messagestr', (msg) => {
            socket.emit('log', { username: botId, msg: msg });
            const botData = bots[botId];
            if (botData && botData.mathOn) {
                // Karakterleri temizle ve JavaScript diline çevir
                let formula = msg.replace(/x/g, '*').replace(/:/g, '/').replace(/√/g, 'Math.sqrt').replace(/\^/g, '**');
                // Sadece matematiksel karakterleri içeren kısmı ayıkla
                const mathMatch = formula.match(/(\(?\d+[\d\s\+\-\*\/\.\^\(\)Math\.sqrt\*\*]*\d+\)?)/);
                
                if (mathMatch) {
                    try {
                        const result = eval(mathMatch[0]);
                        if (typeof result === 'number' && !isNaN(result)) {
                            setTimeout(() => {
                                bot.chat(result.toString());
                            }, botData.mathSec * 1000);
                        }
                    } catch (e) {}
                }
            }
        });

        bot.on('end', () => {
            socket.emit('status', { username: botId, connected: false });
            delete bots[botId];
        });
    });

    socket.on('update-settings', (d) => {
        if (bots[d.user]) {
            bots[d.user].mathOn = d.mathOn;
            bots[d.user].mathSec = d.mathSec;
        }
    });

    // 1.21 HAREKET SİSTEMİ
    socket.on('move-bot', (d) => {
        const b = bots[d.username]?.instance;
        if (!b || !b.entity) return;

        if (d.dir === 'stop') {
            b.clearControlStates();
        } else if (d.dir === 'jump') {
            b.setControlState('jump', true);
            setTimeout(() => b.setControlState('jump', false), 400);
        } else if (d.dir === 'left-turn') {
            b.look(b.entity.yaw + 0.8, 0);
        } else if (d.dir === 'right-turn') {
            b.look(b.entity.yaw - 0.8, 0);
        } else {
            b.clearControlStates();
            b.setControlState(d.dir, true);
        }
    });

    socket.on('send-chat', (d) => { if (bots[d.username]) bots[d.username].instance.chat(d.msg); });
    socket.on('stop-bot', (u) => { if (bots[u]) bots[u].instance.quit(); });
});

http.listen(3000);
