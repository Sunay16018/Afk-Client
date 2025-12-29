const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const mineflayer = require('mineflayer');

app.use(express.static(__dirname));
let bots = {};

io.on('connection', (socket) => {
    socket.on('start-bot', (data) => {
        setupBot(data, socket);
    });

    function setupBot(data, socket) {
        const botId = data.username;
        if (bots[botId] && bots[botId].instance) return;

        const bot = mineflayer.createBot({
            host: data.host.split(':')[0],
            port: parseInt(data.host.split(':')[1]) || 25565,
            username: data.username,
            hideErrors: true
        });

        // Bot Veri Yapısı
        bots[botId] = { 
            instance: bot, 
            config: {
                mathOn: false, mathSec: 0, 
                autoRecon: false, mineMode: false,
                autoMsgs: [], lastMathAnswer: ""
            },
            intervals: [] 
        };

        bot.on('spawn', () => {
            socket.emit('status', { username: botId, connected: true });
            socket.emit('log', { username: botId, msg: '§a✔ Bağlantı Aktif!' });
        });

        // Matematik & Mesaj Yakalama
        bot.on('message', (jsonMsg) => {
            const bD = bots[botId];
            const text = jsonMsg.toString();
            socket.emit('log', { username: botId, msg: jsonMsg.toHTML() });

            if (bD.config.mathOn) {
                if (bD.config.lastMathAnswer && text.includes(bD.config.lastMathAnswer)) return;
                const match = text.replace(/x/g, '*').replace(/:/g, '/').match(/(\d+[\s\+\-\*\/\^]*\d+)/);
                if (match) {
                    try {
                        const res = eval(match[0]);
                        if (!isNaN(res)) {
                            bD.config.lastMathAnswer = res.toString();
                            setTimeout(() => bot.chat(res.toString()), bD.config.mathSec * 1000);
                        }
                    } catch (e) {}
                }
            }
        });

        // Otomatik Yeniden Bağlanma
        bot.on('end', () => {
            const bD = bots[botId];
            socket.emit('status', { username: botId, connected: false });
            if (bD && bD.config.autoRecon) {
                socket.emit('log', { username: botId, msg: '§6Bağlantı koptu, 5sn sonra tekrar deneniyor...' });
                setTimeout(() => setupBot(data, socket), 5000);
            }
            delete bots[botId];
        });

        bot.on('error', (err) => socket.emit('log', { username: botId, msg: `§cHata: ${err.message}` }));
    }

    // Ayarları Güncelle (Oto Mesaj, Kazma vb.)
    socket.on('update-config', (d) => {
        const bD = bots[d.user];
        if (!bD) return;
        bD.config = { ...bD.config, ...d.settings };

        // Kazma (Mine) Modu Kontrolü
        if (bD.config.mineMode) {
            bD.instance.activateItem(); // Sol tık basılı tutma simülasyonu
            bD.instance.swingArm('right');
        } else {
            bD.instance.deactivateItem();
        }

        // Otomatik Mesaj Temizliği ve Yeniden Başlatma
        bD.intervals.forEach(clearInterval);
        bD.intervals = [];
        bD.config.autoMsgs.forEach(m => {
            if (m.text && m.time > 0) {
                let int = setInterval(() => bD.instance.chat(m.text), m.time * 1000);
                bD.intervals.push(int);
            }
        });
    });

    // Hareket Sistemi (Tek Tık)
    socket.on('move-bot', (d) => {
        const b = bots[d.username]?.instance;
        if (!b) return;
        if (d.dir === 'jump') {
            b.setControlState('jump', true);
            setTimeout(() => b.setControlState('jump', false), 300);
        } else {
            b.setControlState(d.dir, true);
            setTimeout(() => b.setControlState(d.dir, false), 250); // Bir adım atar
        }
    });

    socket.on('send-chat', (d) => { if(bots[d.username]) bots[d.username].instance.chat(d.msg); });
    socket.on('stop-bot', (u) => { if(bots[u]) bots[u].instance.quit(); });
});

http.listen(3000);
