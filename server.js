const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mineflayer = require('mineflayer');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

let bot = null;

// Gelişmiş Çözücü
function solveSmart(message) {
    const cleanMsg = message.replace(/§[0-9a-fk-or]/gi, '').trim();
    const mathMatch = cleanMsg.match(/(\d+)\s*([\+\-\*x\/])\s*(\d+)/);
    if (mathMatch) {
        const n1 = parseInt(mathMatch[1]);
        const op = mathMatch[2];
        const n2 = parseInt(mathMatch[3]);
        let res;
        if (op === '+') res = n1 + n2;
        else if (op === '-') res = n1 - n2;
        else if (op === '*' || op === 'x') res = n1 * n2;
        else if (op === '/' || op === ':') res = n2 !== 0 ? Math.floor(n1 / n2) : null;
        if (res !== null) return { answer: res.toString(), delay: 1100 };
    }
    const codeMatch = cleanMsg.match(/(?:yazın|kod|yaz|ilk)\s*[:>-]?\s*([A-Za-z0-9]{5,10})/i);
    if (codeMatch && codeMatch[1]) return { answer: codeMatch[1], delay: 1000 };
    return null;
}

io.on('connection', (socket) => {
    socket.on('start-bot', (c) => {
        if (bot) { try { bot.quit(); } catch(e){} }
        bot = mineflayer.createBot({ host: c.host, port: parseInt(c.port) || 25565, username: c.username });

        bot.on('message', (jsonMsg) => {
            // toMotd metodu § kodlarını koruyarak tam satırı (isim dahil) verir
            socket.emit('log', { text: jsonMsg.toMotd() });
            
            const result = solveSmart(jsonMsg.toString());
            if (result) {
                setTimeout(() => { if (bot) bot.chat(result.answer); }, result.delay);
            }
        });

        bot.on('login', () => {
            socket.emit('status', { connected: true });
            setTimeout(() => { if(bot.players) socket.emit('player-list', Object.keys(bot.players)); }, 2000);
        });
        bot.on('end', () => socket.emit('status', { connected: false }));
        bot.on('kicked', (reason) => socket.emit('log', { text: `§cAtıldın: ${reason}` }));
    });

    socket.on('send-chat', (m) => { if(bot) bot.chat(m); });
    socket.on('move', (dir) => {
        if(bot) {
            bot.setControlState(dir === 'jump' ? 'jump' : dir, true);
            setTimeout(() => bot.setControlState(dir === 'jump' ? 'jump' : dir, false), 500);
        }
    });
    socket.on('get-players', () => { if(bot) socket.emit('player-list', Object.keys(bot.players)); });
    socket.on('stop-bot', () => { if(bot) bot.quit(); });
});

server.listen(process.env.PORT || 3000, () => console.log("AFK Client Aktif!"));
