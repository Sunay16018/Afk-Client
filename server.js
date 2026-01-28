const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mineflayer = require('mineflayer');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- AYARLAR (Burayı sunucuna göre doldur) ---
const botOptions = {
    host: 'SUNUCU_IP_YAZ', 
    port: 25565,
    username: 'Web_Control_Bot'
};

let bot;
function createBot() {
    bot = mineflayer.createBot(botOptions);
    
    bot.on('chat', (u, m) => io.emit('log', `[Sohbet] ${u}: ${m}`));
    bot.on('spawn', () => io.emit('log', 'Bot sunucuya girdi!'));
    bot.on('kicked', (r) => io.emit('log', 'Atıldı: ' + r));
    bot.on('error', (e) => io.emit('log', 'Hata: ' + e.message));
}

createBot();

let autoMsgTimer = null;
const moves = { forward: false, back: false, left: false, right: false, jump: false };

app.get('/', (req, res) => res.sendFile(__dirname + '/index.html'));

io.on('connection', (socket) => {
    // Canlı veri (Koordinat)
    const update = setInterval(() => {
        if (bot.entity) {
            socket.emit('stats', {
                x: Math.round(bot.entity.position.x),
                y: Math.round(bot.entity.position.y),
                z: Math.round(bot.entity.position.z)
            });
        }
    }, 1000);

    socket.on('move', (dir) => {
        moves[dir] = !moves[dir];
        bot.setControlState(dir, moves[dir]);
    });

    socket.on('getInv', () => {
        const items = bot.inventory.items().map(i => `${i.name} (${i.count})`);
        socket.emit('invData', items.length > 0 ? items : ["Boş"]);
    });

    socket.on('toggleAuto', (msg) => {
        if (autoMsgTimer) {
            clearInterval(autoMsgTimer);
            autoMsgTimer = null;
            socket.emit('log', 'Oto-Mesaj: Durduruldu');
        } else {
            autoMsgTimer = setInterval(() => bot.chat(msg || "Bot aktif!"), 30000);
            socket.emit('log', 'Oto-Mesaj: 30sn aralıkla başladı');
        }
    });

    socket.on('disconnect', () => clearInterval(update));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Sunucu ${PORT} portunda hazır.`));
      
