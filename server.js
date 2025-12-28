const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const mineflayer = require('mineflayer');

app.use(express.static(__dirname));

let bots = {};

io.on('connection', (socket) => {
    // BOTU BAŞLATMA
    socket.on('start-bot', (data) => {
        const botId = "default_bot"; // Karmaşayı önlemek için sabit ID
        if (bots[botId]) { bots[botId].quit(); delete bots[botId]; }

        const bot = mineflayer.createBot({
            host: data.host.split(':')[0],
            port: parseInt(data.host.split(':')[1]) || 25565,
            username: data.username,
            version: false
        });

        bots[botId] = bot;

        bot.on('spawn', () => {
            socket.emit('status', { connected: true });
            socket.emit('log', { msg: '§a[SİSTEM] Bot başarıyla giriş yaptı.' });

            // OTOMATİK ŞİFRE GİRİŞİ (Burayı garantiledik)
            if (data.password) {
                setTimeout(() => {
                    bot.chat(`/register ${data.password} ${data.password}`);
                    bot.chat(`/login ${data.password}`);
                    socket.emit('log', { msg: '§e[SİSTEM] Şifre otomatik olarak yazıldı.' });
                }, 1500);
            }
        });

        bot.on('message', (jsonMsg) => {
            socket.emit('log', { msg: jsonMsg.toHTML() });
        });

        bot.on('error', (err) => {
            socket.emit('log', { msg: `§cHata: ${err.message}` });
        });

        bot.on('kicked', (reason) => {
            socket.emit('log', { msg: `§cAtıldı: ${reason}` });
        });

        bot.on('end', () => {
            socket.emit('status', { connected: false });
            socket.emit('log', { msg: '§7Bağlantı kesildi.' });
        });
    });

    // MESAJ/KOMUT GÖNDERME (Hatasız yönlendirme)
    socket.on('send-chat', (data) => {
        const bot = bots["default_bot"];
        if (bot && bot.entity) {
            bot.chat(data.msg);
        } else {
            socket.emit('log', { msg: '§c[HATA] Bot bağlı değil!' });
        }
    });

    socket.on('stop-bot', () => {
        if (bots["default_bot"]) {
            bots["default_bot"].quit();
            delete bots["default_bot"];
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Sunucu ${PORT} portunda aktif.`));
