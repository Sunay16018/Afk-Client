const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mineflayer = require('mineflayer');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" },
    allowEIO3: true
});

let sessionBots = {}; 
let manualStop = {};

app.use(express.static(__dirname));
app.get('/', (req, res) => res.sendFile(__dirname + '/index.html'));

io.on('connection', (socket) => {
    const sid = socket.id;
    sessionBots[sid] = {};

    socket.on('login', (data) => {
        const botName = data.user;
        const botKey = `${sid}_${botName}`;
        
        // Eğer aynı isimde bot varsa durdur
        if (sessionBots[sid][botName]) {
            sessionBots[sid][botName].quit();
        }

        manualStop[botKey] = false;

        console.log(`${botName} bağlanmaya çalışıyor: ${data.host}`);

        const botOptions = {
            host: data.host,
            port: parseInt(data.port) || 25565,
            username: botName,
            version: data.version === 'auto' ? false : data.version,
            hideErrors: false,
            checkTimeoutInterval: 60000 // 1 dakika zaman aşımı
        };

        try {
            const bot = mineflayer.createBot(botOptions);
            sessionBots[sid][botName] = bot;

            bot.on('login', () => {
                socket.emit('success', { id: botName });
                socket.emit('botUpdate', Object.keys(sessionBots[sid]));
            });

            bot.on('spawn', () => {
                socket.emit('log', { id: botName, msg: `[SİSTEM] ${botName} başarıyla bağlandı.` });
                
                // AFK Hareketleri
                const move = () => {
                    if(!sessionBots[sid] || !sessionBots[sid][botName]) return;
                    bot.setControlState('jump', true);
                    setTimeout(() => { if(bot.setControlState) bot.setControlState('jump', false) }, 200);
                    setTimeout(move, Math.random() * 20000 + 40000);
                };
                move();
            });

            bot.on('message', (jsonMsg) => {
                socket.emit('botLog', { id: botName, msg: jsonMsg.toAnsi() });
            });

            bot.on('error', (err) => {
                console.log("Bot Hatası:", err.message);
                socket.emit('error_msg', { id: botName, msg: err.message });
            });

            bot.on('end', (reason) => {
                socket.emit('log', { id: botName, msg: `Bağlantı koptu: ${reason}` });
                if (!manualStop[botKey]) {
                    setTimeout(() => { 
                        if (sessionBots[sid] && !manualStop[botKey]) socket.emit('login', data); 
                    }, 5000);
                }
            });

        } catch (err) {
            socket.emit('error_msg', { id: botName, msg: "Kurulum Hatası!" });
        }
    });

    socket.on('stopBot', (name) => {
        manualStop[`${sid}_${name}`] = true;
        if (sessionBots[sid][name]) sessionBots[sid][name].quit();
        delete sessionBots[sid][name];
        socket.emit('botUpdate', Object.keys(sessionBots[sid]));
    });

    socket.on('chat', (d) => {
        if (sessionBots[sid][d.id]) sessionBots[sid][d.id].chat(d.msg);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Sunucu portu: ${PORT}`));
