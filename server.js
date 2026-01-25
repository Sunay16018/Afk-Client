const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mineflayer = require('mineflayer');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

let sessions = {};

function stripColors(text) {
    return text ? text.replace(/§[0-9a-fk-or]/g, '') : '';
}

io.on('connection', (socket) => {
    const sid = socket.handshake.query.sessionId;
    
    if (sid && sessions[sid]) {
        sessions[sid].socketId = socket.id;
        updateClient(sid);
    } else {
        sessions[sid] = { socketId: socket.id, bots: {}, logs: {}, selectedBot: null };
    }

    socket.on('start-bot', (data) => {
        const session = sessions[sid];
        const { host, user, ver } = data;
        let [ip, port] = host.split(':');
        port = port ? parseInt(port) : 25565;

        try {
            const bot = mineflayer.createBot({
                host: ip, port: port, username: user, version: ver, auth: 'offline'
            });

            session.bots[user] = bot;
            if (!session.logs[user]) session.logs[user] = [];

            bot.on('message', (json) => {
                addLog(session, user, stripColors(json.toString()), 'chat');
                updateClient(sid);
            });

            bot.on('login', () => {
                addLog(session, user, "Sunucuya girildi.", 'system');
                updateClient(sid);
            });

            bot.on('kicked', (reason) => {
                addLog(session, user, `Atıldı: ${reason}`, 'error');
                updateClient(sid);
            });

            bot.on('error', (err) => {
                addLog(session, user, `Hata: ${err.message}`, 'error');
                updateClient(sid);
            });

        } catch (e) {
            socket.emit('error', e.message);
        }
    });

    socket.on('select-bot', (name) => {
        sessions[sid].selectedBot = name;
        updateClient(sid);
    });

    socket.on('stop-bot', (name) => {
        if (sessions[sid].bots[name]) {
            sessions[sid].bots[name].quit();
            delete sessions[sid].bots[name];
            updateClient(sid);
        }
    });

    socket.on('send-chat', (data) => {
        if (sessions[sid].bots[data.bot]) sessions[sid].bots[data.bot].chat(data.msg);
    });

    socket.on('control-move', (data) => {
        const bot = sessions[sid].bots[data.bot];
        if (!bot) return;
        const map = { 'ileri':'forward', 'geri':'back', 'sol':'left', 'sag':'right', 'zipla':'jump' };
        if (map[data.direction]) bot.setControlState(map[data.direction], data.state === 'down');
    });
});

function addLog(session, botName, text, type) {
    if (!session.logs[botName]) session.logs[botName] = [];
    session.logs[botName].push({ time: new Date().toLocaleTimeString(), text, type });
    if (session.logs[botName].length > 100) session.logs[botName].shift();
}

function updateClient(sid) {
    const s = sessions[sid];
    if (!s) return;
    const botData = {};
    Object.keys(s.bots).forEach(n => {
        const b = s.bots[n];
        botData[n] = {
            hp: b.health || 0,
            players: b.players ? Object.keys(b.players).map(p => ({ username: p, ping: b.players[p].ping })) : []
        };
    });
    io.to(s.socketId).emit('bot-update', { active: Object.keys(s.bots), logs: s.logs, botData, selectedBot: s.selectedBot });
}

server.listen(process.env.PORT || 10000);
