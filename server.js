const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mineflayer = require('mineflayer');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const bot = mineflayer.createBot({
    host: 'localhost', // Burayı değiştir
    port: 25565,       // Burayı değiştir
    username: 'Yonetici_Bot'
});

let autoMsgActive = false;
let autoMsgTimer = null;
const activeMoves = { forward: false, back: false, left: false, right: false, jump: false };

app.get('/', (req, res) => res.sendFile(__dirname + '/index.html'));

io.on('connection', (socket) => {
    // Canlı Veri Akışı
    const ticker = setInterval(() => {
        if (bot.entity) {
            socket.emit('stats', {
                x: Math.floor(bot.entity.position.x),
                y: Math.floor(bot.entity.position.y),
                z: Math.floor(bot.entity.position.z),
                autoMsg: autoMsgActive
            });
        }
    }, 500);

    // Hareket Kontrolü
    socket.on('move', (dir) => {
        activeMoves[dir] = !activeMoves[dir];
        bot.setControlState(dir, activeMoves[dir]);
    });

    // Sohbet Mesajı Gönderme
    socket.on('sendChat', (msg) => { if(msg) bot.chat(msg); });

    // Oto Mesaj Sistemi
    socket.on('toggleAuto', () => {
        autoMsgActive = !autoMsgActive;
        if (autoMsgActive) {
            autoMsgTimer = setInterval(() => bot.chat("Bot hala aktif!"), 60000);
        } else {
            clearInterval(autoMsgTimer);
        }
    });

    // Envanter Sorgusu
    socket.on('getInv', () => {
        const items = bot.inventory.items().map(i => ({ name: i.name, count: i.count }));
        socket.emit('invData', items);
    });

    // Yeniden Doğma
    socket.on('respawn', () => { bot.respawn(); io.emit('log', 'Yeniden doğma komutu gönderildi.'); });

    socket.on('disconnect', () => clearInterval(ticker));
});

// Bot Olaylarını Konsola Bas
bot.on('chat', (u, m) => io.emit('log', `<b>${u}:</b> ${m}`));
bot.on('spawn', () => io.emit('log', '<span style="color:cyan">Bot sunucuya giriş yaptı!</span>'));
bot.on('death', () => io.emit('log', '<span style="color:red">Bot öldü!</span>'));
bot.on('kicked', (r) => io.emit('log', 'Atıldı: ' + r));

server.listen(3000, () => console.log('Panel: http://localhost:3000'));
