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
            settings: { math: false, delay: 0, mine: false, pass: data.pass || "" },
            isMining: false 
        };

        bot.on('spawn', () => {
            socket.emit('status', { user: data.username, online: true });
            if (bots[data.username].settings.pass) {
                setTimeout(() => bot.chat(`/login ${bots[data.username].settings.pass}`), 2000);
            }
        });

        // GELİŞMİŞ MİNİNG SİSTEMİ (FIX)
        bot.on('physicsTick', async () => {
            const b = bots[data.username];
            if (!b || !b.settings.mine || b.isMining) return;

            const block = bot.blockAtCursor(4);
            if (block && block.name !== 'air') {
                b.isMining = true;
                try {
                    bot.swingArm('right');
                    await bot.dig(block); // Blok kırılana kadar bekler
                } catch (err) {
                    // Blok kırılamazsa veya iptal olursa buraya düşer
                } finally {
                    b.isMining = false;
                }
            }
        });

        bot.on('message', (json) => {
            socket.emit('log', { user: data.username, msg: json.toHTML() });
            // Matematik çözücü aktif...
        });

        bot.on('kicked', (reason) => {
            socket.emit('log', { user: 'SİSTEM', msg: `§cAtıldın: ${reason}` });
        });

        bot.on('end', () => {
            socket.emit('status', { user: data.username, online: false });
            delete bots[data.username];
        });
    });

    // HAREKET SİSTEMİ (GELİŞMİŞ)
    socket.on('move-start', (d) => {
        if(bots[d.user]) bots[d.user].instance.setControlState(d.dir, true);
    });

    socket.on('move-stop', (d) => {
        if(bots[d.user]) bots[d.user].instance.setControlState(d.dir, false);
    });

    socket.on('chat', (d) => { if(bots[d.user]) bots[d.user].instance.chat(d.msg); });
    socket.on('quit', (u) => { if(bots[u]) bots[u].instance.quit(); });
    socket.on('update-config', (d) => { if(bots[d.user]) bots[d.user].settings = d.config; });
});

http.listen(process.env.PORT || 3000);
