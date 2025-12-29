const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const mineflayer = require('mineflayer');

app.use(express.static(__dirname));
let bots = {};

io.on('connection', (socket) => {
    socket.on('start-bot', (data) => {
        const botId = data.username;
        if (bots[botId]) return;

        const bot = mineflayer.createBot({
            host: data.host.split(':')[0],
            port: parseInt(data.host.split(':')[1]) || 25565,
            username: data.username,
            version: false,
            hideErrors: true
        });

        bots[botId] = { instance: bot, pass: data.password, mathOn: false, mathSec: 1 };
        socket.emit('status', { username: botId, connected: true });

        bot.on('spawn', () => {
            socket.emit('log', { username: botId, msg: '§b[SİSTEM] 1.21+ Fizik motoru yüklendi.' });
            // Hareket sistemini aktif tutmak için fizik ayarı
            bot.physics.enabled = true;

            const p = bots[botId].pass;
            if (p) {
                setTimeout(() => {
                    bot.chat(`/register ${p} ${p}`);
                    bot.chat(`/login ${p}`);
                }, 2000);
            }
        });

        // SPAM KORUMALI MATEMATİK
        bot.on('messagestr', (msg, position) => {
            socket.emit('log', { username: botId, msg: msg });
            const bD = bots[botId];
            if (!bD || !bD.mathOn || position === 'game_info') return;

            const hasOperator = /[\+\-\*\/\^x\:]/.test(msg);
            if (!hasOperator) return;

            let formula = msg.replace(/x/g, '*').replace(/:/g, '/').replace(/√/g, 'Math.sqrt').replace(/\^/g, '**');
            const mathMatch = formula.match(/(\(?\d+[\d\s\+\-\*\/\.\^\(\)Math\.sqrt\*\*]*\d+\)?)/);
            
            if (mathMatch) {
                try {
                    const result = eval(mathMatch[0]);
                    if (typeof result === 'number' && !isNaN(result)) {
                        // Kendi mesajını tekrar okumasını engellemek için cooldown
                        if (msg.includes(result.toString()) && msg.length < 10) return; 
                        
                        setTimeout(() => {
                            bot.chat(result.toString());
                        }, bD.mathSec * 1000);
                    }
                } catch (e) {}
            }
        });

        bot.on('end', () => { socket.emit('status', { username: botId, connected: false }); delete bots[botId]; });
    });

    socket.on('update-settings', (d) => { if (bots[d.user]) { bots[d.user].mathOn = d.mathOn; bots[d.user].mathSec = d.mathSec; } });
    socket.on('send-chat', (d) => { if (bots[d.username]) bots[d.username].instance.chat(d.msg); });

    // YENİLENMİŞ HAREKET SİSTEMİ
    socket.on('move-bot', (d) => {
        const b = bots[d.username]?.instance;
        if (!b || !b.entity) return;

        // Her komutta önceki hareketleri temizle (Çakışmayı önler)
        const states = ['forward', 'back', 'left', 'right', 'jump', 'sprint'];
        
        if (d.dir === 'stop') {
            states.forEach(s => b.setControlState(s, false));
        } else if (d.dir === 'jump') {
            b.setControlState('jump', true);
            setTimeout(() => b.setControlState('jump', false), 400);
        } else if (d.dir === 'left-turn') {
            b.look(b.entity.yaw + 0.8, b.entity.pitch);
        } else if (d.dir === 'right-turn') {
            b.look(b.entity.yaw - 0.8, b.entity.pitch);
        } else {
            // Yürüme komutu gelirse önce her şeyi durdur sonra yeni yöne yürü
            states.forEach(s => b.setControlState(s, false));
            b.setControlState(d.dir, true);
            // 1.21'de hareket paketini zorlamak için ufak bir zıplama veya bakış tetiklenebilir
            b.look(b.entity.yaw, b.entity.pitch); 
        }
    });

    socket.on('stop-bot', (u) => { if (bots[u]) bots[u].instance.quit(); });
});
http.listen(3000);
        
