const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const mineflayer = require('mineflayer');

app.use(express.static(__dirname));

let bots = {};

io.on('connection', (socket) => {
    console.log('Bir kullanıcı panele bağlandı.');

    socket.on('start-bot', (data) => {
        const botId = data.username;
        
        if (!data.host || !data.username) {
            socket.emit('log', { username: 'SİSTEM', msg: '§cHata: IP ve Kullanıcı adı boş olamaz!' });
            return;
        }

        if (bots[botId]) {
            socket.emit('log', { username: 'SİSTEM', msg: '§cbu isimde bir bot zaten çalışıyor!' });
            return;
        }

        try {
            const bot = mineflayer.createBot({
                host: data.host.split(':')[0],
                port: parseInt(data.host.split(':')[1]) || 25565,
                username: data.username,
                version: false,
                hideErrors: true
            });

            bots[botId] = { instance: bot, pass: data.password, mathOn: false, mathSec: 1 };

            bot.on('login', () => {
                socket.emit('status', { username: botId, connected: true });
                socket.emit('log', { username: botId, msg: '§a✔ Sunucuya giriş yapıldı, spawn bekleniyor...' });
            });

            bot.on('spawn', () => {
                socket.emit('log', { username: botId, msg: '§b§l✔ BOT BAŞARIYLA SPAWN OLDU!' });
                if (bots[botId].pass) {
                    setTimeout(() => {
                        bot.chat(`/register ${bots[botId].pass} ${bots[botId].pass}`);
                        bot.chat(`/login ${bots[botId].pass}`);
                    }, 2000);
                }
            });

            bot.on('message', (jsonMsg) => {
                socket.emit('log', { username: botId, msg: jsonMsg.toHTML() });
                
                // Matematik Motoru
                const bD = bots[botId];
                if (bD && bD.mathOn) {
                    const text = jsonMsg.toString();
                    if (/[\+\-\*\/\^x\:]/.test(text)) {
                        let formula = text.replace(/x/g, '*').replace(/:/g, '/').replace(/√/g, 'Math.sqrt').replace(/\^/g, '**');
                        const match = formula.match(/(\(?\d+[\d\s\+\-\*\/\.\^\(\)Math\.sqrt\*\*]*\d+\)?)/);
                        if (match) {
                            try {
                                const res = eval(match[0]);
                                if (!isNaN(res) && !text.includes("= " + res)) {
                                    setTimeout(() => bot.chat(res.toString()), bD.mathSec * 1000);
                                }
                            } catch(e){}
                        }
                    }
                }
            });

            bot.on('error', (err) => {
                socket.emit('log', { username: botId, msg: `§cHata: ${err.message}` });
            });

            bot.on('end', () => {
                socket.emit('status', { username: botId, connected: false });
                delete bots[botId];
            });

        } catch (err) {
            socket.emit('log', { username: 'SİSTEM', msg: `§cBağlantı başlatılamadı: ${err.message}` });
        }
    });

    socket.on('move-bot', (d) => {
        const b = bots[d.username]?.instance;
        if (!b) return;
        if (d.dir === 'stop') {
            ['forward','back','left','right','jump'].forEach(s => b.setControlState(s, false));
        } else if (d.dir === 'jump') {
            b.setControlState('jump', true);
            setTimeout(() => b.setControlState('jump', false), 400);
        } else {
            ['forward','back','left','right'].forEach(s => b.setControlState(s, false));
            b.setControlState(d.dir, true);
        }
    });

    socket.on('send-chat', (d) => { if(bots[d.username]) bots[d.username].instance.chat(d.msg); });
    socket.on('update-settings', (d) => { if(bots[d.user]) { bots[d.user].mathOn = d.mathOn; bots[d.user].mathSec = d.mathSec; } });
    socket.on('stop-bot', (u) => { if(bots[u]) bots[u].instance.quit(); });
});

http.listen(3000, () => console.log('Panel http://localhost:3000 adresinde hazır!'));
