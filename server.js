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
            socket.emit('log', { username: botId, msg: '§b[SİSTEM] Bot bağlandı.' });
            const p = bots[botId].pass;
            if (p) {
                setTimeout(() => {
                    bot.chat(`/register ${p} ${p}`);
                    bot.chat(`/login ${p}`);
                }, 2000);
            }
        });

        // MESAJ KONTROL VE MATEMATİK FİLTRESİ
        bot.on('messagestr', (msg, position, jsonMsg) => {
            socket.emit('log', { username: botId, msg: msg });
            const bD = bots[botId];
            
            // 1. Kendi yazdığımız mesajları veya boş mesajları görmezden gel (Spam Engeli)
            if (!bD || !bD.mathOn || position === 'game_info') return;

            // 2. Matematiksel bir işlem mi kontrol et (En az bir operatör içermeli)
            const hasOperator = /[\+\-\*\/\^x\:]/.test(msg);
            if (!hasOperator) return;

            let formula = msg.replace(/x/g, '*').replace(/:/g, '/').replace(/√/g, 'Math.sqrt').replace(/\^/g, '**');
            const mathMatch = formula.match(/(\(?\d+[\d\s\+\-\*\/\.\^\(\)Math\.sqrt\*\*]*\d+\)?)/);
            
            if (mathMatch) {
                try {
                    const result = eval(mathMatch[0]);
                    // Sadece geçerli bir sayı ise ve bot o an meşgul değilse cevapla
                    if (typeof result === 'number' && !isNaN(result)) {
                        // Kendi cevabımızı tetiklememek için kısa bir cooldown (bekleme)
                        setTimeout(() => {
                            // Cevabı gönderirken tekrar tetiklenmemesi için kontrol
                            bot.chat(result.toString());
                        }, bD.mathSec * 1000);
                    }
                } catch (e) { /* İşlem hatasıysa sessiz kal */ }
            }
        });

        bot.on('end', () => { socket.emit('status', { username: botId, connected: false }); delete bots[botId]; });
    });

    socket.on('update-settings', (d) => { if (bots[d.user]) { bots[d.user].mathOn = d.mathOn; bots[d.user].mathSec = d.mathSec; } });
    socket.on('send-chat', (d) => { if (bots[d.username]) bots[d.username].instance.chat(d.msg); });
    socket.on('move-bot', (d) => {
        const b = bots[d.username]?.instance;
        if (!b || !b.entity) return;
        b.clearControlStates();
        if (d.dir === 'jump') { b.setControlState('jump', true); setTimeout(() => b.setControlState('jump', false), 400); }
        else if (d.dir === 'left-turn') b.look(b.entity.yaw + 0.8, 0);
        else if (d.dir === 'right-turn') b.look(b.entity.yaw - 0.8, 0);
        else if (d.dir === 'stop') b.clearControlStates();
        else b.setControlState(d.dir, true);
    });
    socket.on('stop-bot', (u) => { if (bots[u]) bots[u].instance.quit(); });
});
http.listen(3000);
                    
