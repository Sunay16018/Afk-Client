const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mineflayer = require('mineflayer');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let sessionBots = {}; 
let manualStop = {};

app.get('/', (req, res) => res.sendFile(__dirname + '/index.html'));

io.on('connection', (socket) => {
    const sid = socket.id;
    sessionBots[sid] = {};

    function startBot(data) {
        const botName = data.user;
        const botKey = `${sid}_${botName}`;
        manualStop[botKey] = false;

        const bot = mineflayer.createBot({
            host: data.host,
            port: parseInt(data.port) || 25565,
            username: botName,
            version: data.version === 'auto' ? false : data.version,
            checkTimeoutInterval: 90000 
        });

        sessionBots[sid][botName] = bot;

        bot.on('message', (jsonMsg) => {
            socket.emit('botLog', { id: botName, msg: jsonMsg.toAnsi() });
        });

        bot.on('spawn', () => {
            socket.emit('log', { id: botName, msg: `[BAŞARILI] ${botName} oyunda.` });
            const afk = () => {
                if(!sessionBots[sid] || !sessionBots[sid][botName]) return;
                bot.setControlState('jump', true);
                setTimeout(() => bot.setControlState('jump', false), 150);
                setTimeout(afk, Math.random() * 30000 + 40000); 
            };
            afk();
        });

        bot.on('end', (reason) => {
            if (!manualStop[botKey]) {
                socket.emit('log', { id: botName, msg: `[SİSTEM] Bağlantı koptu, 15sn sonra tekrar...` });
                setTimeout(() => { if (!manualStop[botKey] && sessionBots[sid]) startBot(data); }, 15000);
            } else {
                delete sessionBots[sid][botName];
                socket.emit('botUpdate', Object.keys(sessionBots[sid]));
            }
        });

        bot.on('error', (err) => socket.emit('log', { id: botName, msg: `[HATA] ${err.message}` }));
    }

    socket.on('login', (data) => { if (!sessionBots[sid][data.user]) startBot(data); });
    socket.on('stopBot', (name) => { 
        manualStop[`${sid}_${name}`] = true; 
        if (sessionBots[sid][name]) sessionBots[sid][name].quit(); 
    });
    socket.on('chat', (d) => { if (sessionBots[sid][d.id]) sessionBots[sid][d.id].chat(d.msg); });
});

server.listen(process.env.PORT || 3000);
