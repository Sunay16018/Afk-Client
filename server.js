const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mineflayer = require('mineflayer');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

let bots = {};

function createBot(data, socket) {
    if (bots[data.username]) return;

    const bot = mineflayer.createBot({
        host: data.host.split(':')[0],
        port: parseInt(data.host.split(':')[1]) || 25565,
        username: data.username,
        version: false,
        hideErrors: true
    });

    bots[data.username] = { 
        instance: bot, 
        settings: { math: false, autoRevive: false, autoMsg: false, msgText: "", msgDelay: 30, lastMsg: 0, pass: data.pass || "" }
    };

    bot.on('spawn', () => {
        socket.emit('status', { user: data.username, online: true });
        // 7/24 Aktiflik: Rastgele kafayı oynat (Daha insansı)
        setInterval(() => { 
            if(bot.entity) bot.look(bot.entity.yaw + (Math.random() * 0.2 - 0.1), bot.entity.pitch); 
        }, 20000);
        
        if (bots[data.username].settings.pass) {
            setTimeout(() => bot.chat(`/login ${bots[data.username].settings.pass}`), 2500);
        }
    });

    // SUNUCUDAN GELEN HER ŞEYİ OKUYAN ANA EVENT
    bot.on('message', (json, position) => {
        // json.toHTML() sayesinde sunucudaki tüm renkli yazıları terminale basar
        const htmlMsg = json.toHTML();
        const plainText = json.toString();

        // Terminale anında gönder
        socket.emit('log', { user: data.username, msg: htmlMsg });

        // Matematik Çözücü Analizi (Zincirleme: 1+2*5-4/2)
        const b = bots[data.username];
        if (b?.settings.math) {
            const mathMatch = plainText.match(/(\d+[\+\-\*\/]\d+([\+\-\*\/]\d+)*)/);
            if (mathMatch) {
                try {
                    // Güvenli hesaplama (eval yerine Function constructor)
                    const result = new Function(`return ${mathMatch[0]}`)();
                    if(result !== undefined && !isNaN(result)) {
                        setTimeout(() => bot.chat(result.toString()), 1500);
                    }
                } catch (e) {}
            }
        }
    });

    // Ekstra Duyurular (Actionbar gibi yerleri de yakalamaya çalışır)
    bot.on('actionBar', (json) => {
        socket.emit('log', { user: data.username, msg: `<small>[Actionbar] ${json.toHTML()}</small>` });
    });

    // Oto Mesaj Döngüsü
    setInterval(() => {
        const b = bots[data.username];
        if (b && b.settings.autoMsg && b.settings.msgText) {
            const now = Date.now();
            if (now - b.settings.lastMsg > b.settings.msgDelay * 1000) {
                bot.chat(b.settings.msgText);
                b.settings.lastMsg = now;
            }
        }
    }, 1000);

    bot.on('kicked', (reason) => {
        let kickText = "Bilinmeyen sebep";
        try { kickText = JSON.parse(reason).text || reason; } catch(e) { kickText = reason; }
        socket.emit('log', { user: 'SİSTEM', msg: `<b style="color:red">[ATILDIN] ${kickText}</b>` });
    });

    bot.on('end', () => {
        const b = bots[data.username];
        const reconnect = b?.settings.autoRevive;
        socket.emit('status', { user: data.username, online: false });
        delete bots[data.username];
        if (reconnect) {
            socket.emit('log', { user: 'SİSTEM', msg: '<i style="color:orange">5 saniye içinde otomatik tekrar bağlanılıyor...</i>' });
            setTimeout(() => createBot(data, socket), 5000);
        }
    });

    bot.on('error', (err) => {
        socket.emit('log', { user: 'HATA', msg: err.message });
    });
}

io.on('connection', (socket) => {
    socket.on('start-bot', (data) => createBot(data, socket));
    socket.on('chat', (d) => { if(bots[d.user]) bots[d.user].instance.chat(d.msg); });
    socket.on('quit', (u) => { if(bots[u]) { bots[u].settings.autoRevive = false; bots[u].instance.quit(); } });
    socket.on('update-config', (d) => { if(bots[d.user]) bots[d.user].settings = {...bots[d.user].settings, ...d.config}; });
});

server.listen(process.env.PORT || 3000, () => console.log("7/24 Bot Sistemi Hazır!"));
