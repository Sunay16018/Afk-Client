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

app.get('/', (req, res) => res.sendFile(__dirname + '/index.html'));

io.on('connection', (socket) => {
    socket.on('login', (data) => {
        if (bot) { bot.quit(); }
        io.emit('log', `[SİSTEM] ${data.host} adresine ${data.version} sürümü ile bağlanılıyor...`);
        
        bot = mineflayer.createBot({
            host: data.host,
            port: parseInt(data.port) || 25565,
            username: data.user || 'SüperBot',
            version: data.version === 'auto' ? false : data.version // Sürüm ayarı burada
        });

        bot.on('message', (jsonMsg) => {
            const message = jsonMsg.toString();
            io.emit('log', message);
        });

        bot.on('spawn', () => io.emit('log', '[BİLGİ] Bot sunucuya başarıyla girdi!'));
        bot.on('error', (e) => io.emit('log', '[HATA] ' + e.message));
        bot.on('kicked', (r) => io.emit('log', '[SİSTEM] Atıldı: ' + r));
    });

    socket.on('sendMessage', (msg) => {
        if (bot) bot.chat(msg);
        else socket.emit('log', '[HATA] Bot bağlı değil!');
    });

    socket.on('move', (dir) => {
        if (bot) {
            moves[dir] = !moves[dir];
            bot.setControlState(dir, moves[dir]);
        }
    });

    socket.on('getInv', () => {
        if (bot) {
            const items = bot.inventory.items().map(i => `${i.name} x${i.count}`);
            socket.emit('invData', items);
        }
    });

    socket.on('toggleAuto', (data) => {
        if (!bot) return;
        if (autoMsgTimer) {
            clearInterval(autoMsgTimer);
            autoMsgTimer = null;
            io.emit('log', '[SİSTEM] Oto-mesaj durduruldu.');
        } else {
            autoMsgTimer = setInterval(() => bot.chat(data.text), data.time * 1000);
            io.emit('log', `[SİSTEM] Başlatıldı.`);
        }
    });

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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Panel aktif: ${PORT}`));
