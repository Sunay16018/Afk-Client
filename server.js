const mineflayer = require('mineflayer');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// ✅ RENDER.COM İÇİN GEREKLİ SOCKET.IO AYARI
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// ✅ RENDER'IN PORT'UNU KULLAN
const PORT = process.env.PORT || 10000;

// Bot oturumları
const sessions = new Map();

class BotSession {
    constructor(socketId) {
        this.socketId = socketId;
        this.bots = new Map();        // Aktif botlar
        this.logs = new Map();        // Bot logları
        this.dataTimers = new Map();  // Veri güncelleme timer'ları
    }

    // Log ekle ve socket'e gönder
    addLog(botName, message, type = 'info') {
        if (!this.logs.has(botName)) {
            this.logs.set(botName, []);
        }
        
        const logEntry = {
            message: message,
            type: type,
            timestamp: new Date().toLocaleTimeString('tr-TR')
        };
        
        this.logs.get(botName).push(logEntry);
        
        // 100 log'dan fazlasını saklama
        if (this.logs.get(botName).length > 100) {
            this.logs.get(botName).shift();
        }
        
        // Socket'e gönder
        const socket = io.sockets.sockets.get(this.socketId);
        if (socket) {
            socket.emit('new_log', { 
                username: botName, 
                log: logEntry 
            });
        }
    }

    // Bot verilerini al
    getBotData(botName) {
        const bot = this.bots.get(botName);
        if (!bot) return null;

        try {
            // Envanter verisi
            const inventory = [];
            if (bot.inventory && bot.inventory.slots) {
                bot.inventory.slots.forEach((item, slotIndex) => {
                    if (item && item.name) {
                        inventory.push({
                            name: item.name.replace('minecraft:', ''),
                            count: item.count || 1,
                            slot: slotIndex,
                            displayName: item.displayName || item.name
                        });
                    }
                });
            }

            return {
                hp: bot.health || 20,
                food: bot.food || 20,
                foodSaturation: bot.foodSaturation || 0,
                inventory: inventory,
                position: bot.entity ? {
                    x: Math.round(bot.entity.position.x * 100) / 100,
                    y: Math.round(bot.entity.position.y * 100) / 100,
                    z: Math.round(bot.entity.position.z * 100) / 100
                } : { x: 0, y: 0, z: 0 },
                online: true
            };
        } catch (error) {
            console.error('Bot verisi alınırken hata:', error);
            return null;
        }
    }

    // Botu durdur
    stopBot(botName) {
        const bot = this.bots.get(botName);
        if (bot) {
            try {
                bot.quit();
                bot.end();
            } catch (e) {}
        }
        
        // Timer'ı temizle
        const timer = this.dataTimers.get(botName);
        if (timer) {
            clearInterval(timer);
            this.dataTimers.delete(botName);
        }
        
        this.bots.delete(botName);
        this.logs.delete(botName);
    }
}

// ✅ SOCKET.IO OLAYLARI
io.on('connection', (socket) => {
    console.log('Yeni bağlantı:', socket.id);
    
    const session = new BotSession(socket.id);
    sessions.set(socket.id, session);

    // İlk bağlantı mesajı
    socket.emit('connected', { 
        message: 'AFK Client Pro bağlantısı kuruldu',
        timestamp: new Date().toISOString()
    });

    // Bot başlatma
    socket.on('start_bot', (data) => {
        console.log('Bot başlat:', data);
        startBot(socket, session, data);
    });

    // Bot durdurma
    socket.on('stop_bot', (botName) => {
        console.log('Bot durdur:', botName);
        session.stopBot(botName);
        socket.emit('bot_stopped', { username: botName });
        updateBotList(socket, session);
    });

    // Mesaj gönderme
    socket.on('send_chat', (data) => {
        const bot = session.bots.get(data.username);
        if (bot) {
            try {
                bot.chat(data.message);
                session.addLog(data.username, `[SİZ] ${data.message}`, 'chat');
            } catch (e) {
                session.addLog(data.username, `[HATA] Mesaj gönderilemedi: ${e.message}`, 'error');
            }
        }
    });

    // Bot verisi isteği
    socket.on('request_bot_data', (data) => {
        const botData = session.getBotData(data.username);
        if (botData) {
            socket.emit('bot_data', {
                username: data.username,
                data: botData
            });
        }
    });

    // Bot listesi isteği
    socket.on('get_bot_list', () => {
        updateBotList(socket, session);
    });

    // Eşya atma
    socket.on('drop_item', (data) => {
        const bot = session.bots.get(data.username);
        if (bot && bot.inventory && bot.inventory.slots[data.slot]) {
            try {
                const item = bot.inventory.slots[data.slot];
                bot.tossStack(item);
                session.addLog(data.username, `[ENVANTER] ${item.displayName || item.name} atıldı`, 'info');
            } catch (e) {
                session.addLog(data.username, `[HATA] Eşya atılamadı: ${e.message}`, 'error');
            }
        }
    });

    // Bağlantı kesilince
    socket.on('disconnect', () => {
        console.log('Bağlantı kesildi:', socket.id);
        
        // Tüm botları durdur
        for (const [botName] of session.bots) {
            session.stopBot(botName);
        }
        
        sessions.delete(socket.id);
    });
});

// ✅ BOT BAŞLATMA FONKSİYONU
function startBot(socket, session, data) {
    const { host, username, version } = data;
    
    if (!host || !username) {
        socket.emit('error', { message: 'Host ve kullanıcı adı gerekli!' });
        return;
    }

    if (session.bots.has(username)) {
        session.addLog(username, '[HATA] Bu isimle zaten bir bot var!', 'error');
        return;
    }

    const [ip, portStr] = host.includes(':') ? host.split(':') : [host, '25565'];
    const port = parseInt(portStr) || 25565;

    session.addLog(username, `[SİSTEM] ${ip}:${port} adresine bağlanılıyor...`, 'info');

    try {
        const bot = mineflayer.createBot({
            host: ip,
            port: port,
            username: username,
            version: version || '1.16.5',
            auth: 'offline',
            hideErrors: false
        });

        session.bots.set(username, bot);

        // ✅ GİRİŞ BAŞARILI
        bot.on('login', () => {
            console.log(`Bot ${username} giriş yaptı`);
            session.addLog(username, '[BAŞARI] Oyuna giriş yapıldı!', 'success');
            updateBotList(socket, session);
            
            // Hemen veri gönder
            const botData = session.getBotData(username);
            if (botData) {
                socket.emit('bot_data', {
                    username: username,
                    data: botData
                });
            }
        });

        // ✅ CHAT MESAJLARI
        bot.on('message', (jsonMsg) => {
            try {
                const message = jsonMsg.toString();
                if (message.trim()) {
                    session.addLog(username, message, 'chat');
                }
            } catch (e) {
                console.error('Mesaj parse hatası:', e);
            }
        });

        // ✅ SUNUCU MESAJLARI
        bot.on('whisper', (from, message) => {
            session.addLog(username, `[FISILTI] ${from}: ${message}`, 'chat');
        });

        // ✅ SAĞLIK DEĞİŞİMİ
        bot.on('health', () => {
            const botData = session.getBotData(username);
            if (botData) {
                socket.emit('bot_data', {
                    username: username,
                    data: botData
                });
            }
        });

        // ✅ ENVANTER DEĞİŞİMİ
        bot.on('windowUpdate', () => {
            const botData = session.getBotData(username);
            if (botData) {
                socket.emit('bot_data', {
                    username: username,
                    data: botData
                });
            }
        });

        // ✅ HATA YÖNETİMİ
        bot.on('error', (err) => {
            console.error(`Bot ${username} hatası:`, err);
            session.addLog(username, `[HATA] ${err.message}`, 'error');
            session.stopBot(username);
            updateBotList(socket, session);
        });

        bot.on('kicked', (reason) => {
            console.log(`Bot ${username} atıldı:`, reason);
            session.addLog(username, `[ATILDI] ${reason}`, 'error');
            session.stopBot(username);
            updateBotList(socket, session);
        });

        bot.on('end', () => {
            console.log(`Bot ${username} bağlantısı kesildi`);
            session.addLog(username, "[BAĞLANTI] Bağlantı kesildi", 'warning');
            session.stopBot(username);
            updateBotList(socket, session);
        });

        // ✅ PERİYODİK VERİ GÖNDERİMİ (SANIYEDE 1)
        const dataTimer = setInterval(() => {
            if (!session.bots.has(username)) {
                clearInterval(dataTimer);
                session.dataTimers.delete(username);
                return;
            }
            
            const botData = session.getBotData(username);
            if (botData) {
                socket.emit('bot_data', {
                    username: username,
                    data: botData
                });
            }
        }, 1000);
        
        session.dataTimers.set(username, dataTimer);

    } catch (error) {
        console.error('Bot oluşturma hatası:', error);
        session.addLog(username, `[HATA] Bot oluşturulamadı: ${error.message}`, 'error');
    }
}

// ✅ BOT LİSTESİ GÜNCELLE
function updateBotList(socket, session) {
    const botList = Array.from(session.bots.keys()).map(botName => ({
        name: botName,
        online: true,
        data: session.getBotData(botName)
    }));
    
    socket.emit('bot_list', { bots: botList });
}

// ✅ STATİK DOSYALARI SUN
app.use(express.static(__dirname));

// ✅ SOCKET.IO CLIENT DOSYASINI SUN
app.get('/socket.io/socket.io.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'node_modules', 'socket.io', 'client-dist', 'socket.io.js'));
});

// ✅ TÜM DİĞER İSTEKLER İÇİN INDEX.HTML
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ✅ SUNUCUYU BAŞLAT (RENDER İÇİN 0.0.0.0)
server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ AFK Client Pro ${PORT} portunda çalışıyor!`);
    console.log(`✅ Socket.IO aktif`);
    console.log(`✅ Render.com uyumlu`);
});
