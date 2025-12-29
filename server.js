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
            settings: { math: false, delay: 0, mine: false, pass: data.pass || "", autoMsg: "", autoMsgInterval: null } 
        };

        bot.on('spawn', () => {
            socket.emit('status', { user: data.username, online: true });
            const b = bots[data.username];
            if (b.settings.pass) {
                setTimeout(() => bot.chat(`/register ${b.settings.pass} ${b.settings.pass}`), 2000);
                setTimeout(() => bot.chat(`/login ${b.settings.pass}`), 3000);
            }
        });

        // ATILMA SEBEBİ BURADA YAKALANIYOR
        bot.on('kicked', (reason) => {
            const cleanReason = JSON.parse(reason).extra ? JSON.parse(reason).extra.map(e => e.text).join('') : reason;
            socket.emit('log', { user: 'SİSTEM', msg: `§c§lATILDIN! Sebep: §e${cleanReason}` });
        });

        bot.on('end', () => {
            socket.emit('status', { user: data.username, online: false });
            delete bots[data.username];
        });

        bot.on('message', (json) => {
            socket.emit('log', { user: data.username, msg: json.toHTML() });
            const b = bots[data.username];
            // Profesyonel Matematik Çözücü
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
                if (target && !bot.targetDigBlock) {
                    bot.swingArm('right');
                    bot.dig(target, true).catch(() => {});
                }
            }
        });
    });

    // CHAT GÖNDERME KODU
    socket.on('chat', (d) => {
        if(bots[d.user]) bots[d.user].instance.chat(d.msg);
    });

    socket.on('move', (d) => {
        const b = bots[d.user]?.instance;
        if (b) { b.setControlState(d.dir, true); setTimeout(() => b.setControlState(d.dir, false), 400); }
    });

    socket.on('update-config', (d) => {
        if(bots[d.user]) {
            bots[d.user].settings = d.config;
            // Oto Mesaj Döngüsü
            clearInterval(bots[d.user].settings.autoMsgInterval);
            if(d.config.autoMsg && d.config.autoMsg.trim() !== "") {
                bots[d.user].settings.autoMsgInterval = setInterval(() => {
                    bots[d.user].instance.chat(d.config.autoMsg);
                }, 30000); // Varsayılan 30 saniye
            }
        }
    });

    socket.on('quit', (u) => { if(bots[u]) bots[u].instance.quit(); });
});

http.listen(process.env.PORT || 3000);
