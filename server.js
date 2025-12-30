const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mineflayer = require('mineflayer');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

let bots = {};

function createBot(data, socket) {
    if (bots[data.username]) return;

    // 1.21.1 Hata Çözümü: Sürümü zorla ama "false" yaparak başla
    const bot = mineflayer.createBot({
        host: data.host.split(':')[0],
        port: parseInt(data.host.split(':')[1]) || 25565,
        username: data.username,
        // EĞER 1.21.1 HATASI ALIRSAN: Burayı "1.20.4" yaparsan sunucu 
        // destekliyorsa (ViaVersion varsa) girebilir. Ama önce '1.21.1' deniyoruz.
        version: "1.21.1", 
        hideErrors: true,
        checkTimeoutInterval: 60000
    });

    bots[data.username] = { 
        instance: bot, 
        settings: { math: false, autoRevive: false, autoMsg: false, msgText: "", msgDelay: 30, lastMsg: 0, pass: data.pass || "" }
    };

    bot.on('spawn', () => {
        socket.emit('status', { user: data.username, online: true });
        socket.emit('log', { user: 'SİSTEM', msg: `✓ 1.21.1 Sunucusuna Başarıyla Girildi!` });
        
        // 7/24 Aktiflik
        setInterval(() => { if(bot.entity) bot.look(bot.entity.yaw + 0.1, bot.entity.pitch); }, 25000);

        if (bots[data.username].settings.pass) {
            setTimeout(() => bot.chat(`/login ${bots[data.username].settings.pass}`), 2500);
        }
    });

    // Otomatik Matematik & Mesaj
    bot.on('message', (json) => {
        const text = json.toString();
        const b = bots[data.username];
        if (b?.settings.math) {
            const mathMatch = text.match(/(\d+[\+\-\*\/]\d+([\+\-\*\/]\d+)*)/);
            if (mathMatch) {
                try {
                    const result = eval(mathMatch[0]);
                    if(!isNaN(result)) setTimeout(() => bot.chat(result.toString()), 1000);
                } catch (e) {}
            }
        }
    });

    bot.on('error', (err) => {
        // Eğer 1.21.1 protokol hatası gelirse terminale yaz
        if(err.message.includes('supported')) {
            socket.emit('log', { user: 'HATA', msg: 'Sunucu 1.21.1 sürümünü bu kütüphane ile kabul etmiyor. Sürüm düşürmeyi deneyin.' });
        } else {
            socket.emit('log', { user: 'HATA', msg: `Hata: ${err.message}` });
        }
    });

    bot.on('end', () => {
        const b = bots[data.username];
        const reconnect = b?.settings.autoRevive;
        socket.emit('status', { user: data.username, online: false });
        delete bots[data.username];
        if (reconnect) setTimeout(() => createBot(data, socket), 5000);
    });
}

io.on('connection', (socket) => {
    socket.on('start-bot', (data) => createBot(data, socket));
    socket.on('chat', (d) => { if(bots[d.user]) bots[d.user].instance.chat(d.msg); });
    socket.on('quit', (u) => { if(bots[u]) { bots[u].settings.autoRevive = false; bots[u].instance.quit(); } });
    socket.on('update-config', (d) => { if(bots[d.user]) bots[d.user].settings = {...bots[d.user].settings, ...d.config}; });
});

server.listen(process.env.PORT || 3000);
