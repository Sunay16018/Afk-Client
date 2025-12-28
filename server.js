const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mineflayer = require('mineflayer');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

let bot = null;

// Gelişmiş Matematik ve Kelime Yakalayıcı
function solveFast(message) {
    // 1. Temizleme: Minecraft renk kodlarını ve gereksiz boşlukları sil
    const cleanMsg = message.replace(/§[0-9a-fk-or]/gi, '').trim();

    // 2. Matematik Sorusu Yakalama (Örn: 937 * 73 veya 937x73)
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
        
        if (res !== undefined) return res.toString();
    }

    // 3. Kelime Oyunu Yakalama (Örn: "Kelimeyi ilk yazan kazanır: Elmas")
    // Genellikle ":" işaretinden sonraki tek kelime cevaptır
    const wordMatch = cleanMsg.match(/(?:yazan kazanır|kelime|yaz)\s*[:>-]\s*([a-zA-Z0-9ığüşöçİĞÜŞÖÇ]+)/i);
    if (wordMatch && wordMatch[1]) {
        return wordMatch[1];
    }

    return null;
}

io.on('connection', (socket) => {
    socket.on('start-bot', (c) => {
        if (bot) bot.quit();
        bot = mineflayer.createBot({ host: c.host, port: parseInt(c.port), username: c.username });

        bot.on('login', () => {
            socket.emit('status', { connected: true });
            if(bot.players) socket.emit('player-list', Object.keys(bot.players));
        });

        bot.on('messagestr', (msg) => {
            socket.emit('log', { text: msg });

            // HIZLI CEVAPLAYICI
            const answer = solveFast(msg);
            if (answer) {
                // Gecikmeyi minimuma indirmek için direkt gönderiyoruz
                bot.chat(answer); 
            }

            // Otomatik Login
            if ((msg.includes('/login') || msg.includes('/register')) && c.password) {
                bot.chat(`/login ${c.password}`);
            }
        });

        bot.on('playerJoined', () => socket.emit('player-list', Object.keys(bot.players)));
        bot.on('playerLeft', () => socket.emit('player-list', Object.keys(bot.players)));
        bot.on('kicked', (reason) => socket.emit('log', { text: `§cAtıldın: ${reason}` }));
        bot.on('end', () => socket.emit('status', { connected: false }));
    });

    socket.on('send-chat', (m) => { if(bot) bot.chat(m); });
    socket.on('move', (dir) => {
        if(bot) {
            bot.setControlState(dir === 'jump' ? 'jump' : dir, true);
            setTimeout(() => bot.setControlState(dir === 'jump' ? 'jump' : dir, false), 400);
        }
    });
    socket.on('stop-bot', () => { if(bot) bot.quit(); });
});

server.listen(process.env.PORT || 3000);
              
