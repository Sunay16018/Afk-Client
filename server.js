const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mineflayer = require('mineflayer');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let bots = {};
let manualStop = {};

app.get('/', (req, res) => res.sendFile(__dirname + '/index.html'));

function startBot(data) {
    const botId = data.user;
    manualStop[botId] = false;

    const bot = mineflayer.createBot({
        host: data.host,
        port: parseInt(data.port) || 25565,
        username: botId,
        version: data.version === 'auto' ? false : data.version,
        checkTimeoutInterval: 90000
    });

    bots[botId] = bot;

    bot.on('message', (jsonMsg) => {
        io.emit('botLog', { id: botId, msg: jsonMsg.toAnsi() });
    });

    bot.on('spawn', () => {
        io.emit('botUpdate', Object.keys(bots));
        io.emit('log', `[BAŞARILI] ${botId} girdi.`);
        
        // Oyuncu listesi değiştiğinde tarayıcıya haber ver
        const updatePlayers = () => {
            const players = Object.keys(bot.players);
            io.emit('playerList', { id: botId, players });
        };
        bot.on('playerJoined', updatePlayers);
        bot.on('playerLeft', updatePlayers);
        updatePlayers();
    });

    bot.on('end', (reason) => {
        if (!manualStop[botId]) {
            setTimeout(() => { if (!manualStop[botId]) startBot(data); }, 10000);
        } else {
            delete bots[botId];
            io.emit('botUpdate', Object.keys(bots));
        }
    });

    bot.on('error', (err) => io.emit('log', `[HATA] ${botId}: ${err.message}`));
}

io.on('connection', (socket) => {
    socket.on('login', (data) => startBot(data));
    socket.on('stopBot', (id) => { manualStop[id] = true; if (bots[id]) bots[id].quit(); });
    socket.on('sendMessage', (d) => { if (bots[d.id]) bots[d.id].chat(d.msg); });
    socket.on('move', (d) => { if (bots[d.id]) bots[d.id].setControlState(d.dir, !bots[d.id].controlState[d.dir]); });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Panel aktif port: ${PORT}`));
