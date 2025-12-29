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
            version: false
        });

        bots[data.username] = {
            instance: bot,
            settings: { math: false, delay: 0, recon: false, mine: false, msgs: [] },
            lastAns: ""
        };

        // Maden Modu Döngüsü (Her 100ms'de bir kontrol eder)
        bot.on('physicsTick', () => {
            const b = bots[data.username];
            if (b && b.settings.mine) {
                bot.swingArm('right'); // Sürekli kol sallar
                // Eğer bot bir bloğa bakıyorsa kırmaya çalışır
                const target = bot.blockAtCursor(4);
                if (target) {
                    bot.dig(target, true, 'ignore');
                }
            }
        });

        bot.on('message', (json) => {
            const b = bots[data.username];
            if (!b) return;
            const txt = json.toString();

            // Direkt toHTML() ile renklendirilmiş mesajı gönder
            socket.emit('log', { user: data.username, msg: json.toHTML() });

            // Matematik Sistemi (Geliştirilmiş - Çoklu işlem desteği)
            if (b.settings.math) {
                if (b.lastAns && txt.includes(b.lastAns)) return;
                
                // 1+1+1+1 gibi uzun işlemleri de kapsayan genişletilmiş regex
                const cleanTxt = txt.replace(/x/g, '*').replace(/:/g, '/');
                const mathMatch = cleanTxt.match(/(\d+(?:\s*[\+\-\*\/]\s*\d+)+)/);
                
                if (mathMatch) {
                    try {
                        const result = eval(mathMatch[0]);
                        if (!isNaN(result)) {
                            b.lastAns = result.toString();
                            setTimeout(() => bot.chat(result.toString()), b.settings.delay * 1000);
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
        if (bots[d.user]) bots[d.user].settings = d.config;
    });

    socket.on('move', (d) => {
        const b = bots[d.user]?.instance;
        if (!b) return;
        b.setControlState(d.dir, true);
        setTimeout(() => b.setControlState(d.dir, false), 200); // Stabil kısa adım
    });

    socket.on('chat', (d) => { if(bots[d.user]) bots[d.user].instance.chat(d.msg); });
});

http.listen(3000);
