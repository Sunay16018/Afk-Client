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

// Renk kodlarını temizleme ve okunabilir yapma
function stripColors(text) {
    if (!text) return '';
    return text.replace(/§[0-9a-fk-or]/g, '');
}

io.on('connection', (socket) => {
    const sessionId = socket.handshake.query.sessionId;
    
    if (sessionId && sessions[sessionId]) {
        sessions[sessionId].socketId = socket.id;
        updateClient(sessionId);
    } else {
        const newId = sessionId || Math.random().toString(36).substring(7);
        sessions[newId] = { socketId: socket.id, bots: {}, logs: {}, selectedBot: null };
    }

    socket.on('start-bot', (data) => {
        const session = sessions[socket.handshake.query.sessionId];
        if (!session) return;

        const { host, user, ver } = data;
        const sId = socket.handshake.query.sessionId;

        if (session.bots[user]) {
            socket.emit('error', 'Bu bot zaten listede!');
            return;
        }

        let [ip, port] = host.split(':');
        port = port ? parseInt(port) : 25565;

        logToBot(session, user, `[SİSTEM] ${host} adresine bağlanılıyor...`);
        updateClient(sId);

        try {
            const bot = mineflayer.createBot({
                host: ip,
                port: port,
                username: user,
                version: ver,
                auth: 'offline'
            });

            session.bots[user] = bot;

            // BOT OLAYLARI (EVENTS)
            bot.on('login', () => {
                logToBot(session, user, `✅ BAŞARILI: ${user} sunucuya giriş yaptı!`);
                updateClient(sId);
            });

            bot.on('spawn', () => {
                logToBot(session, user, `🌍 Bot dünyada doğdu.`);
                updateClient(sId);
            });

            bot.on('message', (jsonMsg) => {
                const msg = stripColors(jsonMsg.toString());
                logToBot(session, user, msg);
                updateClient(sId);
            });

            bot.on('kicked', (reason) => {
                const kickReason = JSON.parse(reason).text || reason;
                logToBot(session, user, `❌ ATILDI: Sunucudan atıldın! Sebep: ${kickReason}`);
                updateClient(sId);
            });

            bot.on('error', (err) => {
                logToBot(session, user, `⚠️ HATA: ${err.message}`);
                updateClient(sId);
            });

            bot.on('end', () => {
                logToBot(session, user, `🔌 Bağlantı tamamen kesildi.`);
                updateClient(sId);
            });

        } catch (e) {
            socket.emit('error', 'Bot başlatılamadı: ' + e.message);
        }
    });

    socket.on('select-bot', (name) => {
        const session = sessions[socket.handshake.query.sessionId];
        if (session) {
            session.selectedBot = name;
            updateClient(socket.handshake.query.sessionId);
        }
    });

    socket.on('stop-bot', (name) => {
        const session = sessions[socket.handshake.query.sessionId];
        if (session && session.bots[name]) {
            session.bots[name].quit();
            delete session.bots[name];
            updateClient(socket.handshake.query.sessionId);
        }
    });

    socket.on('send-chat', (data) => {
        const session = sessions[socket.handshake.query.sessionId];
        if (session && session.bots[data.bot]) {
            session.bots[data.bot].chat(data.msg);
        }
    });
});

function logToBot(session, botName, msg) {
    if (!session.logs[botName]) session.logs[botName] = [];
    const time = new Date().toLocaleTimeString();
    session.logs[botName].push(`[${time}] ${msg}`);
    if (session.logs[botName].length > 50) session.logs[botName].shift();
}

function updateClient(sId) {
    const session = sessions[sId];
    if (!session) return;

    const botData = {};
    Object.keys(session.bots).forEach(name => {
        const b = session.bots[name];
        botData[name] = {
            hp: b.health || 0,
            players: b.players ? Object.keys(b.players).map(p => ({
                username: p,
                ping: b.players[p].ping
            })) : []
        };
    });

    io.to(session.socketId).emit('bot-update', {
        active: Object.keys(session.bots),
        logs: session.logs,
        botData: botData,
        selectedBot: session.selectedBot
    });
}

server.listen(process.env.PORT || 10000, () => console.log("Server Hazır"));
