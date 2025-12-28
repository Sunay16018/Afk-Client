const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mineflayer = require('mineflayer');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

let bot = null;

io.on('connection', (socket) => {
    socket.on('start-bot', (c) => {
        if (bot) bot.quit();
        bot = mineflayer.createBot({ host: c.host, port: parseInt(c.port), username: c.username });

        bot.on('login', () => {
            socket.emit('status', { connected: true });
            setTimeout(() => { if(bot.players) socket.emit('player-list', Object.keys(bot.players)); }, 2000);
        });

        bot.on('messagestr', (msg) => socket.emit('log', { text: msg }));
        bot.on('kicked', (reason) => socket.emit('log', { text: `§cAtıldın: ${reason}` }));
        
        bot.on('playerJoined', () => socket.emit('player-list', Object.keys(bot.players)));
        bot.on('playerLeft', () => socket.emit('player-list', Object.keys(bot.players)));
        
        bot.on('end', () => socket.emit('status', { connected: false }));
    });

    socket.on('send-chat', (m) => { if(bot) bot.chat(m); });
    socket.on('get-players', () => { if(bot) socket.emit('player-list', Object.keys(bot.players)); });
    socket.on('stop-bot', () => { if(bot) bot.quit(); });
    socket.on('move', (dir) => {
        if(bot) {
            bot.setControlState(dir === 'jump' ? 'jump' : dir, true);
            setTimeout(() => bot.setControlState(dir === 'jump' ? 'jump' : dir, false), 500);
        }
    });
});

server.listen(process.env.PORT || 3000);
