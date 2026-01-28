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
            socket.emit('botUpdate', Object.keys(sessionBots[sid]));
            socket.emit('log', `[SİSTEM] ${botName} başarıyla bağlandı.`);
            
            const updatePlayers = () => {
                if(bot.players) {
                    socket.emit('playerList', { id: botName, players: Object.keys(bot.players) });
                }
            };
            bot.on('playerJoined', updatePlayers);
            bot.on('playerLeft', updatePlayers);
            updatePlayers();
        });

        bot.on('end', (reason) => {
            if (!manualStop[botKey]) {
                socket.emit('log', `[BAĞLANTI] ${botName} koptu: ${reason}. 10sn içinde tekrar deniyor...`);
                setTimeout(() => { 
                    if (!manualStop[botKey] && sessionBots[sid]) startBot(data); 
                }, 10000);
            } else {
                if(sessionBots[sid]) delete sessionBots[sid][botName];
                socket.emit('botUpdate', Object.keys(sessionBots[sid] || {}));
            }
        });

        bot.on('error', (err) => socket.emit('log', `[HATA] ${botName}: ${err.message}`));
    }

    socket.on('login', (data) => {
        if (sessionBots[sid][data.user]) return;
        startBot(data);
    });

    socket.on('stopBot', (botName) => {
        manualStop[`${sid}_${botName}`] = true;
        if (sessionBots[sid][botName]) {
            sessionBots[sid][botName].quit();
        }
    });

    socket.on('sendMessage', (d) => {
        const bot = sessionBots[sid][d.id];
        if (bot) bot.chat(d.msg);
    });

    socket.on('move', (d) => {
        const bot = sessionBots[sid][d.id];
        if (bot) bot.setControlState(d.dir, !bot.controlState[d.dir]);
    });

    socket.on('disconnect', () => {
        if (sessionBots[sid]) {
            Object.keys(sessionBots[sid]).forEach(name => {
                manualStop[`${sid}_${name}`] = true;
                sessionBots[sid][name].quit();
            });
            delete sessionBots[sid];
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Panel Hazır: ${PORT}`));
