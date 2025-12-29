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

        bots[botId] = { instance: bot, pass: data.password, mathOn: false, mathSec: 1 };
        socket.emit('status', { username: botId, connected: true });

        // 1.21 Hareket Paketlerini Canlı Tutma
        bot.on('physicsTick', () => {
            if (!bot.entity) return;
            // Botun hareket etmesi için paketlerin akışını sağlar
        });

        bot.on('message', (jsonMsg) => {
            // Renkli mesajı (ANSI/HTML uyumlu) gönderiyoruz
            socket.emit('log', { username: botId, msg: jsonMsg.toHTML() });

            const bD = bots[botId];
            if (!bD || !bD.mathOn) return;

            const fullText = jsonMsg.toString();
            const hasOperator = /[\+\-\*\/\^x\:]/.test(fullText);
            
            if (hasOperator) {
                let formula = fullText.replace(/x/g, '*').replace(/:/g, '/').replace(/√/g, 'Math.sqrt').replace(/\^/g, '**');
                const mathMatch = formula.match(/(\(?\d+[\d\s\+\-\*\/\.\^\(\)Math\.sqrt\*\*]*\d+\)?)/);
                
                if (mathMatch) {
                    try {
                        const result = eval(mathMatch[0]);
                        if (typeof result === 'number' && !isNaN(result)) {
                            // Kendi yazdığını okuma döngüsünü engelle
                            if (fullText.includes("= " + result)) return;
                            setTimeout(() => bot.chat(result.toString()), bD.mathSec * 1000);
                        }
                    } catch (e) {}
                }
            }
        });

        bot.on('spawn', () => {
            socket.emit('log', { username: botId, msg: '<span style="color:#55ff55">✔ Bot spawn oldu!</span>' });
            if (bots[botId].pass) {
                setTimeout(() => {
                    bot.chat(`/register ${bots[botId].pass} ${bots[botId].pass}`);
                    bot.chat(`/login ${bots[botId].pass}`);
                }, 2000);
            }
        });

        bot.on('end', () => { socket.emit('status', { username: botId, connected: false }); delete bots[botId]; });
    });

    socket.on('update-settings', (d) => { if (bots[d.user]) { bots[d.user].mathOn = d.mathOn; bots[d.user].mathSec = d.mathSec; } });
    socket.on('send-chat', (d) => { if (bots[d.username]) bots[d.username].instance.chat(d.msg); });
    
    socket.on('move-bot', (d) => {
        const b = bots[d.username]?.instance;
        if (!b) return;
        const states = ['forward', 'back', 'left', 'right', 'jump'];
        if (d.dir === 'stop') {
            states.forEach(s => b.setControlState(s, false));
        } else if (d.dir === 'jump') {
            b.setControlState('jump', true);
            setTimeout(() => b.setControlState('jump', false), 400);
        } else if (d.dir === 'left-turn') {
            b.look(b.entity.yaw + 0.5, 0);
        } else if (d.dir === 'right-turn') {
            b.look(b.entity.yaw - 0.5, 0);
        } else {
            states.forEach(s => b.setControlState(s, false));
            b.setControlState(d.dir, true);
        }
    });

    socket.on('stop-bot', (u) => { if (bots[u]) bots[u].instance.quit(); });
});
http.listen(3000);
