const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mineflayer = require('mineflayer');
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));
app.get('/', (req, res) => res.sendFile(__dirname + '/index.html'));

let sessions = {};

function clean(text) { return text ? text.replace(/§[0-9a-fk-or]/g, '') : ''; }

io.on('connection', (socket) => {
    const sid = socket.handshake.query.sessionId;
    if (!sessions[sid]) sessions[sid] = { socketId: socket.id, bots: {}, logs: {}, sel: null };
    else sessions[sid].socketId = socket.id;

    socket.on('start-bot', (data) => {
        const { host, user, ver } = data;
        let [ip, port] = host.split(':');
        try {
            const bot = mineflayer.createBot({ host: ip, port: port || 25565, username: user, version: ver, auth: 'offline' });
            sessions[sid].bots[user] = bot;
            if (!sessions[sid].logs[user]) sessions[sid].logs[user] = [];

            bot.on('login', () => addLog(sid, user, "Sistem bağlandı.", "system"));
            bot.on('message', (m) => addLog(sid, user, clean(m.toString()), "chat"));
            bot.on('kicked', (r) => addLog(sid, user, `Atıldı: ${r}`, "error"));
            bot.on('error', (e) => addLog(sid, user, `Hata: ${e.message}`, "error"));
            
            // Bot verilerini periyodik gönder
            setInterval(() => updateClient(sid), 2000);
        } catch (e) { socket.emit('err', e.message); }
    });

    socket.on('select-bot', (n) => { sessions[sid].sel = n; updateClient(sid); });
    socket.on('send-chat', (d) => { if(sessions[sid].bots[d.bot]) sessions[sid].bots[d.bot].chat(d.msg); });
    socket.on('control-move', (d) => {
        const b = sessions[sid].bots[d.bot];
        const m = { 'ileri':'forward', 'geri':'back', 'sol':'left', 'sag':'right', 'zipla':'jump' };
        if(b && m[d.direction]) b.setControlState(m[d.direction], d.state === 'down');
    });
});

function addLog(sid, name, text, type) {
    const s = sessions[sid];
    if(s && s.logs[name]) {
        s.logs[name].push({ time: new Date().toLocaleTimeString(), text, type });
        if(s.logs[name].length > 50) s.logs[name].shift();
        updateClient(sid);
    }
}

function updateClient(sid) {
    const s = sessions[sid];
    if(!s) return;
    const bData = {};
    Object.keys(s.bots).forEach(n => {
        const b = s.bots[n];
        bData[n] = { players: b.players ? Object.keys(b.players).map(p => ({ username: p, ping: b.players[p].ping })) : [] };
    });
    io.to(s.socketId).emit('update', { active: Object.keys(s.bots), logs: s.logs, bData, sel: s.sel });
}

server.listen(process.env.PORT || 10000);
