const express = require('express');
const app = express();
const http = require('server').createServer ? require('http').createServer(app) : require('http').Server(app);
const io = require('socket.io')(http);
const mineflayer = require('mineflayer');
const path = require('path');

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/style.css', (req, res) => res.sendFile(path.join(__dirname, 'style.css')));
app.get('/script.js', (req, res) => res.sendFile(path.join(__dirname, 'script.js')));

let bots = {};

function createBot(data, socket) {
    // Aynı isimde bot varsa eskisini zorla kapat
    if (bots[data.username]) {
        try { bots[data.username].instance.quit(); } catch(e) {}
        delete bots[data.username];
    }

    const bot = mineflayer.createBot({
        host: data.host.split(':')[0],
        port: parseInt(data.host.split(':')[1]) || 25565,
        username: data.username,
        version: false,
        checkTimeoutInterval: 60000 // Bağlantı zaman aşımı kontrolü
    });

    bots[data.username] = { 
        instance: bot, 
        settings: bots[data.username]?.settings || { mine: false, math: false, autoRevive: false, pass: data.pass || "" },
        isMining: false
    };

    bot.on('spawn', () => {
        socket.emit('status', { user: data.username, online: true });
        // Anti-AFK: 30 saniyede bir kafayı oynat
        const afk = setInterval(() => { if(bot.entity) bot.look(bot.entity.yaw + 0.1, bot.entity.pitch); }, 30000);
        bots[data.username].afkInterval = afk;

        if (bots[data.username].settings.pass) {
            setTimeout(() => bot.chat(`/register ${bots[data.username].settings.pass} ${bots[data.username].settings.pass}`), 2000);
            setTimeout(() => bot.chat(`/login ${bots[data.username].settings.pass}`), 3500);
        }
    });

    bot.on('message', (json) => {
        socket.emit('log', { user: data.username, msg: json.toHTML() });
        const b = bots[data.username];
        if (b?.settings.math) {
            const txt = json.toString().toLowerCase().replace(/x/g, '*');
            const mathMatch = txt.match(/(\d+(?:\s*[\+\-\*\/]\s*\d+)+)/);
            if (mathMatch) { try { const res = eval(mathMatch[0]); if (!isNaN(res)) bot.chat(res.toString()); } catch (e) {} }
        }
    });

    bot.on('kicked', (reason) => {
        let msg = "Atıldın";
        try {
            const p = JSON.parse(reason);
            msg = p.extra ? p.extra.map(e => e.text).join('') : (p.text || reason);
        } catch(e) { msg = reason.toString(); }
        socket.emit('log', { user: 'SİSTEM', msg: `<span style="color:#ff4444;font-weight:bold;">[KICK] ${msg}</span>` });
    });

    bot.on('end', () => {
        const b = bots[data.username];
        if(!b) return;
        const reconnect = b.settings.autoRevive;
        socket.emit('status', { user: data.username, online: false });
        clearInterval(b.afkInterval);
        delete bots[data.username];
        if (reconnect) setTimeout(() => createBot(data, socket), 5000);
    });

    bot.on('error', (err) => {
        socket.emit('log', { user: 'HATA', msg: err.message });
    });
}

// ZOMBİ BOT ÖNLEYİCİ: Render güncellenince botları oyundan çıkar
process.on('SIGTERM', () => { for (let u in bots) { bots[u].instance.quit(); } process.exit(0); });
process.on('SIGINT', () => { for (let u in bots) { bots[u].instance.quit(); } process.exit(0); });

io.on('connection', (socket) => {
    socket.on('start-bot', (data) => createBot(data, socket));
    socket.on('move-toggle', (d) => { if(bots[d.user]) bots[d.user].instance.setControlState(d.dir, d.state); });
    socket.on('chat', (d) => { if(bots[d.user]) bots[d.user].instance.chat(d.msg); });
    socket.on('quit', (u) => { 
        if(bots[u]) {
            bots[u].settings.autoRevive = false;
            bots[u].instance.quit();
            delete bots[u];
            socket.emit('status', { user: u, online: false });
        }
    });
    socket.on('update-config', (d) => { if(bots[d.user]) bots[d.user].settings = d.config; });
});

http.listen(process.env.PORT || 3000);
