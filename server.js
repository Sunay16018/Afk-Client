const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mineflayer = require('mineflayer');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let bot = null;
let autoMsgTimer = null;
const moves = { forward: false, back: false, left: false, right: false, jump: false };

app.use(express.static(__dirname));
app.get('/', (req, res) => res.sendFile(__dirname + '/index.html'));

io.on('connection', (socket) => {
    // SUNUCUYA BOT SOKMA
    socket.on('login', (data) => {
        if (bot) { bot.quit(); }
        
        io.emit('log', `${data.host} adresine bağlanılıyor...`);
        
        bot = mineflayer.createBot({
            host: data.host,
            port: parseInt(data.port) || 25565,
            username: data.user || 'PanelBot'
        });

        bot.on('spawn', () => io.emit('log', 'Bot sunucuya girdi!'));
        bot.on('chat', (u, m) => io.emit('log', `[Chat] ${u}: ${m}`));
        bot.on('kicked', (r) => io.emit('log', 'Atıldı: ' + r));
        bot.on('error', (e) => io.emit('log', 'Hata: ' + e.message));

        // Veri gönderimi
        setInterval(() => {
            if (bot && bot.entity) {
                socket.emit('stats', {
                    x: Math.round(bot.entity.position.x),
                    y: Math.round(bot.entity.position.y),
                    z: Math.round(bot.entity.position.z)
                });
            }
        }, 1000);
    });

    // HAREKET
    socket.on('move', (dir) => {
        if (!bot) return;
        moves[dir] = !moves[dir];
        bot.setControlState(dir, moves[dir]);
    });

    // ENVANTER
    socket.on('getInv', () => {
        if (!bot) return;
        const items = bot.inventory.items().map(i => `${i.name} x${i.count}`);
        socket.emit('invData', items);
    });

    // OTO MESAJ
    socket.on('toggleAuto', (msg) => {
        if (!bot) return;
        if (autoMsgTimer) {
            clearInterval(autoMsgTimer);
            autoMsgTimer = null;
            socket.emit('log', 'Oto-mesaj durdu.');
        } else {
            autoMsgTimer = setInterval(() => bot.chat(msg || "Aktif!"), 30000);
            socket.emit('log', 'Oto-mesaj başladı.');
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`http://localhost:${PORT}`));
