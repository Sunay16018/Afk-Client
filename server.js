const mineflayer = require('mineflayer');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const PORT = process.env.PORT || 10000;

let bot = null;
let logs = [];

app.use(express.static(__dirname));

io.on('connection', (socket) => {
    console.log('Kullanıcı bağlandı');
    
    // Eski logları gönder
    socket.emit('init_logs', logs);
    
    socket.on('start_bot', (data) => {
        const { host, username, version } = data;
        if (bot) {
            socket.emit('log', { text: '⚠️ Zaten bir bot aktif!', type: 'warning' });
            return;
        }
        
        logs.push({ text: `📡 ${host} adresine bağlanılıyor...`, type: 'info' });
        socket.emit('log', { text: `📡 ${host} adresine bağlanılıyor...`, type: 'info' });
        
        const [ip, port] = host.split(':');
        
        try {
            bot = mineflayer.createBot({
                host: ip,
                port: parseInt(port) || 25565,
                username: username,
                version: version || '1.16.5',
                auth: 'offline'
            });
            
            bot.on('login', () => {
                const msg = `✅ ${username} bağlandı!`;
                logs.push({ text: msg, type: 'success' });
                socket.emit('log', { text: msg, type: 'success' });
                sendBotData(socket);
            });
            
            bot.on('message', (jsonMsg) => {
                const msg = jsonMsg.toString();
                logs.push({ text: msg, type: 'chat' });
                socket.emit('log', { text: msg, type: 'chat' });
            });
            
            bot.on('health', () => {
                sendBotData(socket);
            });
            
            bot.on('end', () => {
                logs.push({ text: '❌ Bağlantı kesildi', type: 'error' });
                socket.emit('log', { text: '❌ Bağlantı kesildi', type: 'error' });
                bot = null;
            });
            
            bot.on('error', (err) => {
                logs.push({ text: `❌ Hata: ${err.message}`, type: 'error' });
                socket.emit('log', { text: `❌ Hata: ${err.message}`, type: 'error' });
                bot = null;
            });
            
            // Veri gönderme interval'i
            setInterval(() => {
                if (bot) sendBotData(socket);
            }, 1000);
            
        } catch (err) {
            socket.emit('log', { text: `❌ Bot oluşturulamadı: ${err.message}`, type: 'error' });
        }
    });
    
    socket.on('send_chat', (data) => {
        if (bot) {
            bot.chat(data.message);
            // "[SİZ]" öneki koymuyoruz
            logs.push({ text: data.message, type: 'chat' });
            socket.emit('log', { text: data.message, type: 'chat' });
        }
    });
    
    socket.on('stop_bot', () => {
        if (bot) {
            bot.end();
            logs.push({ text: '🛑 Bot durduruldu', type: 'warning' });
            socket.emit('log', { text: '🛑 Bot durduruldu', type: 'warning' });
            bot = null;
        }
    });
    
    socket.on('drop_item', (slot) => {
        if (bot && bot.inventory.slots[slot]) {
            bot.tossStack(bot.inventory.slots[slot]);
            logs.push({ text: `📦 ${slot}. slot eşyası atıldı`, type: 'info' });
            socket.emit('log', { text: `📦 ${slot}. slot eşyası atıldı`, type: 'info' });
        }
    });
});

function sendBotData(socket) {
    if (!bot) return;
    
    const inventory = [];
    if (bot.inventory && bot.inventory.slots) {
        bot.inventory.slots.forEach((item, idx) => {
            if (item && item.name) {
                inventory.push({
                    name: item.name.replace('minecraft:', ''),
                    count: item.count || 1,
                    slot: idx
                });
            }
        });
    }
    
    socket.emit('bot_data', {
        hp: bot.health || 20,
        food: bot.food || 20,
        inventory: inventory
    });
}

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

server.listen(PORT, () => {
    console.log(`✅ Sunucu ${PORT} portunda çalışıyor`);
});
