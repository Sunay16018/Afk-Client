const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mineflayer = require('mineflayer');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

let bot = null;

// Gelişmiş Hızlı Cevaplayıcı
function solveFast(message) {
    const cleanMsg = message.replace(/§[0-9a-fk-or]/gi, '').trim();
    
    // Matematik Yakalayıcı (Örn: 50 + 20, 100*2 vb.)
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
        if (res !== null) return res.toString();
    }

    // Kelime Oyunu Yakalayıcı
    const wordMatch = cleanMsg.match(/(?:kazanır|kelime|yaz)\s*[:>-]?\s*([a-zA-Z0-9ığüşöçİĞÜŞÖÇ]{3,})/i);
    if (wordMatch && wordMatch[1]) return wordMatch[1];

    return null;
}

io.on('connection', (socket) => {
    socket.on('start-bot', (c) => {
        if (bot) { try { bot.quit(); } catch(e){} }
        
        bot = mineflayer.createBot({
            host: c.host,
            port: parseInt(c.port) || 25565,
            username: c.username,
            version: false,
            hideErrors: true
        });

        bot.on('login', () => {
            socket.emit('status', { connected: true });
            setTimeout(() => { if(bot.players) socket.emit('player-list', Object.keys(bot.players)); }, 2000);
        });

        bot.on('messagestr', (msg) => {
            socket.emit('log', { text: msg });
            const answer = solveFast(msg);
            if (answer) bot.chat(answer);
            if ((msg.includes('/login') || msg.includes('/register')) && c.password) {
                bot.chat(`/login ${c.password}`);
            }
        });

        bot.on('playerJoined', () => socket.emit('player-list', Object.keys(bot.players)));
        bot.on('playerLeft', () => socket.emit('player-list', Object.keys(bot.players)));
        bot.on('kicked', (reason) => socket.emit('log', { text: `§cAtıldın: ${reason}` }));
        bot.on('error', (err) => socket.emit('log', { text: `§4Hata: ${err.message}` }));
        bot.on('end', () => socket.emit('status', { connected: false }));
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

server.listen(process.env.PORT || 3000);
