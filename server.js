const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mineflayer = require('mineflayer');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/style.css', (req, res) => res.sendFile(path.join(__dirname, 'style.css')));
app.get('/script.js', (req, res) => res.sendFile(path.join(__dirname, 'script.js')));

let bots = {};

function createBot(data, socket) {
    if (bots[data.username]) {
        try { bots[data.username].instance.quit(); } catch(e) {}
        delete bots[data.username];
    }

    const bot = mineflayer.createBot({
        host: data.host.split(':')[0],
        port: parseInt(data.host.split(':')[1]) || 25565,
        username: data.username,
        version: false
    });

    bots[data.username] = { 
        instance: bot, 
        settings: { mine: false, math: false, autoRevive: false, pass: data.pass || "" },
        afkInterval: null
    };

    bot.on('spawn', () => {
        socket.emit('status', { user: data.username, online: true });
        const afk = setInterval(() => { if(bot.entity) bot.look(bot.entity.yaw + 0.1, bot.entity.pitch); }, 30000);
        bots[data.username].afkInterval = afk;

        if (bots[data.username].settings.pass) {
            setTimeout(() => bot.chat(`/register ${bots[data.username].settings.pass} ${bots[data.username].settings.pass}`), 2000);
            setTimeout(() => bot.chat(`/login ${bots[data.username].settings.pass}`), 3500);
        }
    });

    bot.on('message', (json) => { socket.emit('log', { user: data.username, msg: json.toHTML() }); });

    bot.on('kicked', (reason) => {
        let cleanReason = "";
        try {
            const parsed = typeof reason === 'string' ? JSON.parse(reason) : reason;
            cleanReason = parsed.extra ? parsed.extra.map(e => e.text).join('') : (parsed.text || JSON.stringify(reason));
        } catch (e) { cleanReason = reason.toString(); }
        socket.emit('log', { user: 'SİSTEM', msg: `<span style="color:#ff4444;">[KICK] ${cleanReason}</span>` });
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
}

process.on('SIGTERM', () => { for (let u in bots) bots[u].instance.quit(); process.exit(0); });

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

server.listen(process.env.PORT || 3000);
