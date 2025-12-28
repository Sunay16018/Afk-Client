const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const mineflayer = require('mineflayer');

app.use(express.static(__dirname));

let bots = {};

io.on('connection', (socket) => {
    // BOT BAŞLATMA
    socket.on('start-bot', (data) => {
        const botId = data.username; // Her botu kullanıcı adıyla ayırıyoruz
        
        if (bots[botId]) return socket.emit('log', { msg: `§c[HATA] ${botId} zaten bağlı!` });

        const bot = mineflayer.createBot({
            host: data.host,
            port: parseInt(data.port) || 25565,
            username: data.username,
            version: false
        });

        bots[botId] = bot;

        bot.on('spawn', () => {
            socket.emit('status', { username: botId, connected: true });
            socket.emit('log', { msg: `§a[SİSTEM] ${botId} sunucuya girdi.` });
            
            // Otomatik Login
            if (data.password) {
                setTimeout(() => {
                    bot.chat(`/register ${data.password} ${data.password}`);
                    bot.chat(`/login ${data.password}`);
                }, 2000);
            }
        });

        bot.on('message', (jsonMsg) => {
            socket.emit('log', { username: botId, msg: jsonMsg.toHTML() });
        });

        bot.on('kicked', (reason) => {
            socket.emit('log', { msg: `§c[KİCK] ${botId} atıldı: ${reason}` });
        });

        bot.on('end', () => {
            socket.emit('status', { username: botId, connected: false });
            delete bots[botId];
            socket.emit('log', { msg: `§7[BİLGİ] ${botId} bağlantısı koptu.` });
        });

        bot.on('error', (err) => socket.emit('log', { msg: `§c[HATA] ${err.message}` }));
    });

    // MESAJ GÖNDERME (Hangi botla yazacağını seçer)
    socket.on('send-chat', (data) => {
        const bot = bots[data.username];
        if (bot) bot.chat(data.msg);
    });

    // BAĞLANTI KES
    socket.on('stop-bot', (username) => {
        if (bots[username]) {
            bots[username].quit();
            delete bots[username];
        }
    });
});

http.listen(process.env.PORT || 3000, () => console.log("7/24 Sistem Aktif."));
