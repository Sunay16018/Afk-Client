const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mineflayer = require('mineflayer');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

let bot = null;

function solveMath(message) {
    const match = message.match(/(\d+)\s*([\+\-\*\:])\s*(\d+)/);
    if (match) {
        const n1 = parseInt(match[1]);
        const op = match[2];
        const n2 = parseInt(match[3]);
        if (op === '+') return n1 + n2;
        if (op === '-') return n1 - n2;
        if (op === '*') return n1 * n2;
        if (op === ':') return n2 !== 0 ? Math.floor(n1 / n2) : "Err";
    }
    return null;
}

function createBot(config, socket) {
    if (bot) bot.quit();
    bot = mineflayer.createBot({ host: config.host, port: config.port, username: config.username, version: false });

    bot.on('login', () => {
        socket.emit('status', { connected: true });
        // Anti-AFK
        setInterval(() => { if(bot.entity) { bot.setControlState('jump', true); setTimeout(()=>bot.setControlState('jump', false), 500); }}, 20000);
    });

    bot.on('messagestr', (msg) => {
        socket.emit('log', { text: msg });
        const res = solveMath(msg);
        if (res !== null) setTimeout(() => bot.chat(res.toString()), 1000);
        if ((msg.includes('/login') || msg.includes('/register')) && config.password) bot.chat(`/login ${config.password}`);
    });

    bot.on('end', () => socket.emit('status', { connected: false }));
}

io.on('connection', (socket) => {
    socket.on('start-bot', (c) => createBot(c, socket));
    socket.on('stop-bot', () => bot?.quit());
    socket.on('move', (dir) => { if(bot) { bot.setControlState(dir, true); setTimeout(()=>bot.setControlState(dir, false), 1000); }});
    socket.on('send-chat', (m) => bot?.chat(m));
});

server.listen(process.env.PORT || 3000);
