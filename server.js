const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mineflayer = require('mineflayer');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

let sessionBots = {}; 
let manualStop = {};

app.get('/', (req, res) => res.sendFile(__dirname + '/index.html'));

io.on('connection', (socket) => {
    const sid = socket.id;
    sessionBots[sid] = {};
    console.log(`[BAĞLANTI] Yeni kullanıcı: ${sid}`);

    socket.on('login', (data) => {
        const botName = data.user;
        if (!botName || !data.host) return;
        
        console.log(`[GİRİŞ] ${botName} -> ${data.host} bağlanıyor...`);
        const botKey = `${sid}_${botName}`;
        manualStop[botKey] = false;

        try {
            const bot = mineflayer.createBot({
                host: data.host,
                port: parseInt(data.port) || 25565,
                username: botName,
                version: data.version === 'auto' ? false : data.version,
                checkTimeoutInterval: 60000
            });

            sessionBots[sid][botName] = bot;

            bot.on('login', () => {
                socket.emit('botUpdate', Object.keys(sessionBots[sid]));
            });

            bot.on('message', (jsonMsg) => {
                socket.emit('botLog', { id: botName, msg: jsonMsg.toAnsi() });
            });

            bot.on('spawn', () => {
                socket.emit('log', { id: botName, msg: `[SİSTEM] ${botName} başarıyla spawn oldu.` });
                socket.emit('botUpdate', Object.keys(sessionBots[sid]));
            });

            bot.on('end', (reason) => {
                if (!manualStop[botKey]) {
                    socket.emit('log', { id: botName, msg: `[UYARI] Düştü: ${reason}. Tekrar deneniyor...` });
                    setTimeout(() => { if (!manualStop[botKey] && sessionBots[sid]) startBot(data); }, 10000);
                } else {
                    delete sessionBots[sid][botName];
                    socket.emit('botUpdate', Object.keys(sessionBots[sid]));
                }
            });

            bot.on('error', (err) => {
                console.error(err);
                socket.emit('log', { id: botName, msg: `[HATA] ${err.message}` });
            });

        } catch (e) {
            socket.emit('log', { id: botName, msg: `[KRİTİK HATA] ${e.message}` });
        }
    });

    socket.on('stopBot', (name) => {
        manualStop[`${sid}_${name}`] = true;
        if (sessionBots[sid][name]) sessionBots[sid][name].quit();
    });

    socket.on('chat', (d) => {
        if (sessionBots[sid] && sessionBots[sid][d.id]) sessionBots[sid][d.id].chat(d.msg);
    });

    socket.on('disconnect', () => {
        if (sessionBots[sid]) {
            Object.keys(sessionBots[sid]).forEach(n => {
                manualStop[`${sid}_${n}`] = true;
                sessionBots[sid][n].quit();
            });
            delete sessionBots[sid];
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Sunucu ${PORT} portunda aktif.`));
