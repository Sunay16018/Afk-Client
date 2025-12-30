const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Render.com için Statik Dosya Sunumu (Root Dizini)
app.use(express.static(__dirname));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

let bot;
let botOptions = {};

io.on('connection', (socket) => {
    console.log('Arayüz bağlantısı başarılı.');

    socket.on('join-bot', (data) => {
        botOptions = data;
        createBot();
    });

    function createBot() {
        bot = mineflayer.createBot({
            host: botOptions.host,
            port: parseInt(botOptions.port) || 25565,
            username: botOptions.username,
            version: false // Otomatik versiyon tespiti
        });

        bot.loadPlugin(pathfinder);

        bot.on('login', () => {
            io.emit('status', 'Bağlandı! Giriş yapılıyor...');
            if(botOptions.password) {
                setTimeout(() => bot.chat(`/login ${botOptions.password}`), 2000);
            }
        });

        bot.on('chat', (username, message) => {
            io.emit('chat-msg', { username, message });
            
            // Matematik Çözücü (Örnek: 12 + 5 nedir?)
            const mathRegex = /(\d+)\s*([\+\-\*\/])\s*(\d+)/;
            const match = message.match(mathRegex);
            if (match) {
                const res = eval(`${match[1]}${match[2]}${match[3]}`);
                setTimeout(() => bot.chat(res.toString()), 2000);
            }
        });

        // Gelişmiş Savunma Sistemi
        bot.on('physicsTick', () => {
            const entity = bot.nearestEntity(e => e.type === 'mob' || e.type === 'player');
            if (entity && bot.entity.position.distanceTo(entity.position) < 4) {
                bot.lookAt(entity.position.offset(0, entity.height, 0));
                bot.attack(entity);
            }
        });

        // Radar & Envanter Verisi
        setInterval(() => {
            if (!bot) return;
            const entities = Object.values(bot.entities)
                .filter(e => e.type === 'player' || e.type === 'mob')
                .map(e => ({ name: e.username || e.name, dist: bot.entity.position.distanceTo(e.position).toFixed(1) }));
            
            const inventory = bot.inventory.items().map(i => `${i.name} x${i.count}`);
            io.emit('update-data', { entities, inventory });
        }, 2000);

        bot.on('error', (err) => io.emit('status', `Hata: ${err.message}`));
        bot.on('end', () => io.emit('status', 'Bağlantı Kesildi.'));
    }

    socket.on('bot-action', async (action) => {
        if(!bot) return;
        if(action === 'mine') {
            const block = bot.blockAtCursor(4);
            if(block) {
                io.emit('status', `Kırılıyor: ${block.name}`);
                await bot.dig(block); // Asenkron Kırma
                io.emit('status', 'Kırma bitti.');
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Sunucu ${PORT} portunda aktif.`));
        
