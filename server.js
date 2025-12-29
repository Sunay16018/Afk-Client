const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const mineflayer = require('mineflayer');

app.use(express.static(__dirname));
let bots = {};

io.on('connection', (socket) => {
    socket.on('start-bot', (data) => {
        if (!data.host || !data.username || bots[data.username]) return;

        const bot = mineflayer.createBot({
            host: data.host.split(':')[0],
            port: parseInt(data.host.split(':')[1]) || 25565,
            username: data.username,
            version: false,
            hideErrors: true
        });

        bots[data.username] = { 
            instance: bot, 
            settings: { math: false, mine: false, pass: data.pass || "" },
            isMining: false 
        };

        bot.on('spawn', () => {
            socket.emit('status', { user: data.username, online: true });
            if (bots[data.username].settings.pass) {
                setTimeout(() => bot.chat(`/login ${bots[data.username].settings.pass}`), 2000);
            }
        });

        // Mining Sistemi (Geliştirilmiş bekleme mantığı)
        bot.on('physicsTick', async () => {
            const b = bots[data.username];
            if (!b || !b.settings.mine || b.isMining) return;
            const block = bot.blockAtCursor(4);
            if (block && block.name !== 'air') {
                b.isMining = true;
                try {
                    bot.swingArm('right');
                    await bot.dig(block);
                } catch (e) {} finally { b.isMining = false; }
            }
        });

        bot.on('kicked', (reason) => {
            socket.emit('log', { user: 'SİSTEM', msg: `§cAtıldın: ${reason}` });
        });

        bot.on('end', () => {
            socket.emit('status', { user: data.username, online: false });
            delete bots[data.username];
        });

        bot.on('message', (json) => socket.emit('log', { user: data.username, msg: json.toHTML() }));
    });

    // Hareket Kontrolü (Aç/Kapat Mantığı)
    socket.on('move-toggle', (d) => {
        const bot = bots[d.user]?.instance;
        if (bot) {
            // d.state true ise yürür, false ise durur
            bot.setControlState(d.dir, d.state);
        }
    });

    socket.on('chat', (d) => { if(bots[d.user]) bots[d.user].instance.chat(d.msg); });

    // ANINDA KESME (Bağlantı Kes Fix)
    socket.on('quit', (u) => {
        if(bots[u]) {
            bots[u].instance.quit();
            delete bots[u];
            socket.emit('status', { user: u, online: false });
        }
    });

    socket.on('update-config', (d) => { if(bots[d.user]) bots[d.user].settings = d.config; });
});

http.listen(process.env.PORT || 3000);
