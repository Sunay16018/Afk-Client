const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const mineflayer = require('mineflayer');
const path = require('path');

// Klasör zorunluluğunu kaldırıyoruz, her şeyi ana dizinden okuyor
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/style.css', (req, res) => res.sendFile(path.join(__dirname, 'style.css')));
app.get('/script.js', (req, res) => res.sendFile(path.join(__dirname, 'script.js')));

let bots = {};

io.on('connection', (socket) => {
    socket.on('start-bot', (data) => {
        if (!data.host || !data.username || bots[data.username]) return;

        const bot = mineflayer.createBot({
            host: data.host.split(':')[0],
            port: parseInt(data.host.split(':')[1]) || 25565,
            username: data.username,
            version: false
        });

        bots[data.username] = { 
            instance: bot, 
            settings: { mine: false, math: false, pass: data.pass || "" },
            isMining: false 
        };

        bot.on('spawn', () => {
            socket.emit('status', { user: data.username, online: true });
            const b = bots[data.username];
            if (b.settings.pass) {
                setTimeout(() => bot.chat(`/register ${b.settings.pass} ${b.settings.pass}`), 2000);
                setTimeout(() => bot.chat(`/login ${b.settings.pass}`), 3500);
            }
        });

        // GELİŞMİŞ MİNİNG SİSTEMİ
        bot.on('physicsTick', async () => {
            const b = bots[data.username];
            if (!b || !b.settings.mine || b.isMining) return;
            const block = bot.blockAtCursor(4);
            if (block && block.name !== 'air') {
                b.isMining = true;
                try {
                    bot.swingArm('right');
                    await bot.dig(block);
                } catch (e) {} finally { b.isMining = false; }
            }
        });

        bot.on('message', (json) => {
            socket.emit('log', { user: data.username, msg: json.toHTML() });
            // Matematik Çözücü
            const b = bots[data.username];
            if (b?.settings.math) {
                const txt = json.toString().toLowerCase().replace(/x/g, '*');
                const mathMatch = txt.match(/(\d+(?:\s*[\+\-\*\/]\s*\d+)+)/);
                if (mathMatch) {
                    try {
                        const res = eval(mathMatch[0]);
                        if (!isNaN(res)) bot.chat(res.toString());
                    } catch (e) {}
                }
            }
        });

        bot.on('kicked', (reason) => {
            socket.emit('log', { user: 'SİSTEM', msg: `<span style="color:#ff5555">KICK: ${reason}</span>` });
        });

        bot.on('end', () => {
            socket.emit('status', { user: data.username, online: false });
            delete bots[data.username];
        });
    });

    socket.on('move-toggle', (d) => { if (bots[d.user]) bots[d.user].instance.setControlState(d.dir, d.state); });
    socket.on('chat', (d) => { if (bots[d.user]) bots[d.user].instance.chat(d.msg); });
    socket.on('quit', (u) => { if (bots[u]) bots[u].instance.quit(); });
    socket.on('update-config', (d) => { if (bots[d.user]) bots[d.user].settings = d.config; });
});

http.listen(process.env.PORT || 3000, () => console.log('Sistem Aktif!'));
