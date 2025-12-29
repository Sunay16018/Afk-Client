const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const mineflayer = require('mineflayer');

app.use(express.static(__dirname));
let bots = {};

io.on('connection', (socket) => {
    socket.on('start-bot', (data) => {
        // Eğer çoklu bot istenmişse döngüye sok
        const count = data.isMulti ? 10 : 1;
        
        for (let i = 0; i < count; i++) {
            let username = data.username;
            if (data.isMulti) {
                username = data.username + "_" + Math.floor(Math.random() * 9999);
            }

            if (bots[username]) continue;

            const bot = mineflayer.createBot({
                host: data.host.split(':')[0],
                port: parseInt(data.host.split(':')[1]) || 25565,
                username: username,
                hideErrors: true
            });

            bots[username] = { 
                instance: bot, 
                mathOn: false, 
                mathSec: 0,
                lastAnswer: "" // Kendi cevabını hatırlaması için
            };

            bot.on('login', () => {
                socket.emit('status', { username: username, connected: true });
            });

            bot.on('message', (jsonMsg) => {
                const bD = bots[username];
                if (!bD) return;

                const text = jsonMsg.toString();
                socket.emit('log', { username: username, msg: jsonMsg.toHTML() });

                // MATEMATİK SPAM ENGELLEYİCİ
                if (bD.mathOn) {
                    // Eğer sohbetteki mesaj bizim son verdiğimiz cevapsa, tepki verme
                    if (bD.lastAnswer !== "" && text.includes(bD.lastAnswer)) return;

                    const match = text.replace(/x/g, '*').replace(/:/g, '/').match(/(\d+[\s\+\-\*\/\^]*\d+)/);
                    if (match) {
                        try {
                            const res = eval(match[0]);
                            if (!isNaN(res)) {
                                bD.lastAnswer = res.toString(); // Cevabı hafızaya al
                                setTimeout(() => bot.chat(res.toString()), bD.mathSec * 1000);
                            }
                        } catch (e) {}
                    }
                }
            });

            bot.on('end', () => {
                socket.emit('status', { username: username, connected: false });
                delete bots[username];
            });
        }
    });

    socket.on('move-bot', (d) => {
        const b = bots[d.username]?.instance;
        if (!b) return;
        
        if (d.type === 'start') {
            b.setControlState(d.dir, true);
        } else if (d.type === 'stop') {
            b.setControlState(d.dir, false);
        } else if (d.type === 'single') {
            // Bir kere tıklandığında kısa süre yürü ve dur
            b.setControlState(d.dir, true);
            setTimeout(() => b.setControlState(d.dir, false), 200);
        }
    });

    socket.on('send-chat', (d) => { if(bots[d.username]) bots[d.username].instance.chat(d.msg); });
    socket.on('update-settings', (d) => { if(bots[d.user]) { bots[d.user].mathOn = d.mathOn; bots[d.user].mathSec = d.mathSec; } });
    socket.on('stop-bot', (u) => { if(bots[u]) bots[u].instance.quit(); });
});

http.listen(3000);
