const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { cors: { origin: "*" } });
const mineflayer = require('mineflayer');

app.use(express.static(__dirname));
let bots = {};

io.on('connection', (socket) => {
    console.log('Kullanıcı panele bağlandı.');

    socket.on('start-bot', (data) => {
        if (!data.host || !data.username) return;
        if (bots[data.username]) {
            socket.emit('log', { user: 'SİSTEM', msg: '§cBu bot zaten aktif!' });
            return;
        }

        try {
            socket.emit('log', { user: 'SİSTEM', msg: `§e${data.host} sunucusuna bağlanılıyor...` });
            
            const bot = mineflayer.createBot({
                host: data.host.split(':')[0],
                port: parseInt(data.host.split(':')[1]) || 25565,
                username: data.username,
                version: false,
                hideErrors: true
            });

            bots[data.username] = {
                instance: bot,
                settings: { math: false, delay: 0, recon: false, mine: false, msgs: [] },
                intervals: [],
                lastAns: ""
            };

            bot.on('login', () => {
                socket.emit('log', { user: data.username, msg: '§aGiriş yapıldı, harita yükleniyor...' });
            });

            bot.on('spawn', () => {
                socket.emit('status', { user: data.username, online: true });
                socket.emit('log', { user: data.username, msg: '§a✔ Bot başarıyla doğdu!' });
            });

            bot.on('error', (err) => {
                socket.emit('log', { user: data.username, msg: `§cHata: ${err.message}` });
            });

            bot.on('kicked', (reason) => {
                socket.emit('log', { user: data.username, msg: `§cAtıldı: ${reason}` });
            });

            bot.on('end', () => {
                const b = bots[data.username];
                socket.emit('status', { user: data.username, online: false });
                socket.emit('log', { user: data.username, msg: '§6Bağlantı kesildi.' });
                
                if (b && b.settings.recon) {
                    socket.emit('log', { user: data.username, msg: '§75 saniye içinde tekrar bağlanılacak...' });
                    setTimeout(() => socket.emit('start-bot', data), 5000);
                }
                delete bots[data.username];
            });

            // MADEN MODU (Fizik Tick - Gerçek Kazma)
            bot.on('physicsTick', () => {
                const b = bots[data.username];
                if (b && b.settings.mine) {
                    bot.swingArm('right');
                    const target = bot.blockAtCursor(4);
                    if (target && bot.canDigBlock(target) && !bot.targetDigBlock) {
                        bot.dig(target, true).catch(err => {});
                    }
                }
            });

            bot.on('message', (json) => {
                const b = bots[data.username];
                if (!b) return;
                const txt = json.toString();
                socket.emit('log', { user: data.username, msg: json.toHTML() });

                // MATEMATİK SİSTEMİ
                if (b.settings.math) {
                    if (b.lastAns && txt.includes(b.lastAns)) return;
                    const cleanTxt = txt.replace(/x/g, '*').replace(/:/g, '/').replace(/=/g, '');
                    const mathMatch = cleanTxt.match(/(\d+(?:\s*[\+\-\*\/]\s*\d+)+)/);
                    if (mathMatch) {
                        try {
                            const result = eval(mathMatch[0]);
                            if (typeof result === 'number' && !isNaN(result)) {
                                b.lastAns = result.toString();
                                setTimeout(() => bot.chat(result.toString()), b.settings.delay * 1000);
                            }
                        } catch (e) {}
                    }
                }
            });
        } catch (e) {
            socket.emit('log', { user: 'SİSTEM', msg: `§cBaşlatma hatası: ${e.message}` });
        }
    });

    socket.on('update-config', (d) => {
        const b = bots[d.user];
        if (!b) return;
        b.settings = d.config;
        
        b.intervals.forEach(clearInterval);
        b.intervals = [];
        b.settings.msgs.forEach(m => {
            if (m.txt && m.sec > 0) {
                b.intervals.push(setInterval(() => b.instance.chat(m.txt), m.sec * 1000));
            }
        });
        socket.emit('log', { user: d.user, msg: '§7Ayarlar güncellendi.' });
    });

    socket.on('move', (d) => {
        const b = bots[d.user]?.instance;
        if (b) {
            b.setControlState(d.dir, true);
            setTimeout(() => b.setControlState(d.dir, false), 300);
        }
    });

    socket.on('chat', (d) => { if(bots[d.user]) bots[d.user].instance.chat(d.msg); });
    socket.on('quit-bot', (u) => { if(bots[u]) bots[u].instance.quit(); });
});

// RENDER İÇİN KRİTİK AYAR: process.env.PORT
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server çalışıyor: Port ${PORT}`);
});
        
