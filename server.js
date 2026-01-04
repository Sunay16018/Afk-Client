const mineflayer = require('mineflayer');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 10000;

// Oturum yönetimi
const sessions = new Map();

class BotSession {
    constructor(socketId) {
        this.socketId = socketId;
        this.bots = new Map();
        this.logs = new Map();
        this.configs = new Map();
        this.autoTasks = new Map();
    }

    addBot(username, bot) {
        this.bots.set(username, bot);
        this.logs.set(username, []);
        this.configs.set(username, {
            autoMessage: { enabled: false, message: '', interval: 5 },
            autoMine: { enabled: false, targetBlock: 'diamond_ore' }
        });
        this.autoTasks.set(username, { messageInterval: null, mineInterval: null });
        
        // İlk logu ekle
        this.addLog(username, '[SİSTEM] Bot oluşturuldu ve başlatılıyor...', 'info');
    }

    addLog(username, message, type = 'info') {
        if (!this.logs.has(username)) {
            this.logs.set(username, []);
        }
        
        const logs = this.logs.get(username);
        logs.push({
            message,
            type,
            timestamp: new Date().toLocaleTimeString('tr-TR')
        });
        
        if (logs.length > 200) logs.shift();
        
        // Socket'e gönder
        const socket = io.sockets.sockets.get(this.socketId);
        if (socket && socket.connected) {
            socket.emit('new_log', { 
                username, 
                log: logs[logs.length - 1] 
            });
        }
    }

    removeBot(username) {
        const bot = this.bots.get(username);
        if (bot) {
            try {
                bot.quit();
                this.addLog(username, '[SİSTEM] Bot durduruldu', 'warning');
            } catch (e) {}
        }
        
        const tasks = this.autoTasks.get(username);
        if (tasks) {
            clearInterval(tasks.messageInterval);
            clearInterval(tasks.mineInterval);
        }
        
        this.bots.delete(username);
        this.logs.delete(username);
        this.configs.delete(username);
        this.autoTasks.delete(username);
    }

    getBotData(username) {
        const bot = this.bots.get(username);
        if (!bot) return null;

        try {
            // Envanter verilerini al
            const inventory = [];
            if (bot.inventory && bot.inventory.slots) {
                bot.inventory.slots.forEach((item, index) => {
                    if (item && item.name) {
                        inventory.push({
                            name: item.name,
                            count: item.count || 1,
                            slot: index,
                            displayName: item.displayName || item.name
                        });
                    }
                });
            }

            return {
                hp: bot.health || 0,
                food: bot.food || 20,
                foodSaturation: bot.foodSaturation || 0,
                inventory: inventory,
                position: bot.entity ? {
                    x: Math.round(bot.entity.position.x * 100) / 100,
                    y: Math.round(bot.entity.position.y * 100) / 100,
                    z: Math.round(bot.entity.position.z * 100) / 100
                } : { x: 0, y: 0, z: 0 },
                config: this.configs.get(username) || {}
            };
        } catch (error) {
            console.error('Bot verisi alınırken hata:', error);
            return null;
        }
    }
}

// Socket.IO bağlantıları
io.on('connection', (socket) => {
    console.log('Yeni kullanıcı bağlandı:', socket.id);
    
    const session = new BotSession(socket.id);
    sessions.set(socket.id, session);

    // Aktif botları gönder
    socket.emit('init', { 
        message: 'AFK Client Pro\'ya hoş geldiniz!',
        timestamp: new Date().toISOString()
    });

    socket.on('start_bot', (data) => {
        console.log('Bot başlatma isteği:', data);
        startBot(socket, data.host, data.username, data.version);
    });

    socket.on('stop_bot', (username) => {
        console.log('Bot durdurma isteği:', username);
        const session = sessions.get(socket.id);
        if (session) {
            session.removeBot(username);
            socket.emit('bot_stopped', { username });
            
            // Bot listesini güncelle
            updateBotList(socket);
        }
    });

    socket.on('send_chat', (data) => {
        const session = sessions.get(socket.id);
        if (session && session.bots.has(data.username)) {
            const bot = session.bots.get(data.username);
            try {
                bot.chat(data.message);
                session.addLog(data.username, `[KONUŞMA] ${data.message}`, 'chat');
            } catch (e) {
                session.addLog(data.username, `[HATA] Mesaj gönderilemedi: ${e.message}`, 'error');
            }
        }
    });

    socket.on('drop_item', (data) => {
        const session = sessions.get(socket.id);
        if (session && session.bots.has(data.username)) {
            const bot = session.bots.get(data.username);
            try {
                const item = bot.inventory.slots[data.slot];
                if (item) {
                    bot.tossStack(item);
                    session.addLog(data.username, `[ENVANTER] ${item.displayName || item.name} atıldı`, 'info');
                }
            } catch (e) {
                session.addLog(data.username, `[HATA] Eşya atılamadı: ${e.message}`, 'error');
            }
        }
    });

    socket.on('request_bot_data', (data) => {
        const session = sessions.get(socket.id);
        if (session && data.username) {
            const botData = session.getBotData(data.username);
            if (botData) {
                socket.emit('bot_data', {
                    username: data.username,
                    data: botData
                });
            }
        }
    });

    socket.on('set_config', (data) => {
        const session = sessions.get(socket.id);
        if (session && session.configs.has(data.username)) {
            const config = session.configs.get(data.username);
            
            if (data.type === 'auto_message') {
                config.autoMessage = data.config;
                updateAutoMessage(socket, data.username, data.config);
            } else if (data.type === 'auto_mine') {
                config.autoMine = data.config;
                updateAutoMine(socket, data.username, data.config);
            }
            
            // Config güncellendiğinde verileri tekrar gönder
            const botData = session.getBotData(data.username);
            if (botData) {
                socket.emit('bot_data', {
                    username: data.username,
                    data: botData
                });
            }
        }
    });

    socket.on('get_bot_list', () => {
        updateBotList(socket);
    });

    socket.on('disconnect', () => {
        console.log('Kullanıcı ayrıldı:', socket.id);
        const session = sessions.get(socket.id);
        if (session) {
            // Tüm botları durdur
            for (const [username] of session.bots) {
                session.removeBot(username);
            }
            sessions.delete(socket.id);
        }
    });
});

function startBot(socket, host, username, version) {
    const [ip, portStr] = host.includes(':') ? host.split(':') : [host, '25565'];
    const port = parseInt(portStr) || 25565;
    
    const session = sessions.get(socket.id);
    
    if (session.bots.has(username)) {
        session.addLog(username, '[HATA] Bu isimle zaten bir bot aktif!', 'error');
        return;
    }

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

        session.addBot(username, bot);

        // Giriş başarılı
        bot.on('login', () => {
            session.addLog(username, '[BAŞARI] Oyuna giriş yapıldı!', 'success');
            updateBotList(socket);
            
            // Hemen verileri gönder
            setTimeout(() => {
                const botData = session.getBotData(username);
                if (botData) {
                    socket.emit('bot_data', {
                        username: username,
                        data: botData
                    });
                }
            }, 1000);
        });

        // Chat mesajları
        bot.on('message', (jsonMsg) => {
            try {
                const message = jsonMsg.toString();
                session.addLog(username, message, 'chat');
            } catch (e) {
                console.error('Mesaj parse hatası:', e);
            }
        });

        // Sunucu mesajları
        bot.on('whisper', (username, message) => {
            session.addLog(username, `[FISILTI] ${username}: ${message}`, 'chat');
        });

        // Action Bar
        bot.on('actionBar', (text) => {
            if (text && text.toString().trim()) {
                session.addLog(username, `[ACTION] ${text.toString()}`, 'action');
            }
        });

        // Title
        bot.on('title', (text) => {
            if (text && text.toString().trim()) {
                session.addLog(username, `[TITLE] ${text.toString()}`, 'title');
            }
        });

        // Envanter güncellemesi
        bot.on('windowUpdate', () => {
            const botData = session.getBotData(username);
            if (botData) {
                socket.emit('bot_data', {
                    username: username,
                    data: botData
                });
            }
        });

        // Sağlık güncellemesi
        bot.on('health', () => {
            const botData = session.getBotData(username);
            if (botData) {
                socket.emit('bot_data', {
                    username: username,
                    data: botData
                });
            }
        });

        // Açlık güncellemesi
        bot.on('food', () => {
            const botData = session.getBotData(username);
            if (botData) {
                socket.emit('bot_data', {
                    username: username,
                    data: botData
                });
            }
        });

        // Hata yönetimi
        bot.on('error', (err) => {
            console.error(`Bot ${username} hatası:`, err);
            session.addLog(username, `[HATA] ${err.message}`, 'error');
            session.removeBot(username);
            updateBotList(socket);
        });

        bot.on('kicked', (reason) => {
            console.log(`Bot ${username} atıldı:`, reason);
            session.addLog(username, `[ATILDI] ${reason}`, 'error');
            session.removeBot(username);
            updateBotList(socket);
        });

        bot.on('end', () => {
            console.log(`Bot ${username} bağlantısı kesildi`);
            session.addLog(username, "[BAĞLANTI] Bağlantı kesildi", 'warning');
            session.removeBot(username);
            updateBotList(socket);
        });

        // Periyodik veri gönderimi
        const dataInterval = setInterval(() => {
            if (!session.bots.has(username)) {
                clearInterval(dataInterval);
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

        bot.on('end', () => clearInterval(dataInterval));

    } catch (error) {
        console.error('Bot oluşturma hatası:', error);
        session.addLog(username, `[HATA] Bot oluşturulamadı: ${error.message}`, 'error');
    }
}

function updateBotList(socket) {
    const session = sessions.get(socket.id);
    if (!session) return;

    const activeBots = Array.from(session.bots.keys());
    socket.emit('bot_list', { 
        bots: activeBots.map(username => ({
            name: username,
            online: true,
            data: session.getBotData(username)
        }))
    });
}

function updateAutoMessage(socket, username, config) {
    const session = sessions.get(socket.id);
    if (!session) return;

    const tasks = session.autoTasks.get(username);
    const bot = session.bots.get(username);

    if (tasks && tasks.messageInterval) {
        clearInterval(tasks.messageInterval);
        tasks.messageInterval = null;
    }

    if (config.enabled && bot && config.message && config.interval > 0) {
        if (!tasks) return;
        
        tasks.messageInterval = setInterval(() => {
            if (bot && session.bots.has(username)) {
                try {
                    bot.chat(config.message);
                    session.addLog(username, `[OTOMESAJ] Gönderildi: ${config.message}`, 'info');
                } catch (e) {
                    session.addLog(username, `[OTOMESAJ] Hata: ${e.message}`, 'error');
                }
            }
        }, config.interval * 1000);
    }
}

function updateAutoMine(socket, username, config) {
    const session = sessions.get(socket.id);
    if (!session) return;

    const tasks = session.autoTasks.get(username);
    const bot = session.bots.get(username);

    if (tasks && tasks.mineInterval) {
        clearInterval(tasks.mineInterval);
        tasks.mineInterval = null;
    }

    if (config.enabled && bot) {
        if (!tasks) return;
        
        tasks.mineInterval = setInterval(async () => {
            if (!bot || !session.bots.has(username)) return;

            try {
                const block = bot.findBlock({
                    matching: (block) => block && block.name === config.targetBlock,
                    maxDistance: 16,
                    count: 1
                });

                if (block) {
                    const tool = bot.pathfinder.bestHarvestTool(block);
                    if (tool) {
                        await bot.equip(tool, 'hand');
                    }
                    
                    await bot.dig(block);
                    session.addLog(username, `[OTO-KAZMA] ${config.targetBlock} kazıldı`, 'success');
                }
            } catch (err) {
                session.addLog(username, `[OTO-KAZMA] Hata: ${err.message}`, 'error');
            }
        }, 2000);
    }
}

// Hata yakalama
process.on('uncaughtException', (err) => {
    console.error('Yakalanmamış Hata:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Yakalanmamış Red:', reason);
});

// Statik dosyalar
app.use(express.static(__dirname));

// Socket.io client için endpoint
app.get('/socket.io/socket.io.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'node_modules', 'socket.io', 'client-dist', 'socket.io.js'));
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

server.listen(PORT, () => {
    console.log(`✅ Sunucu ${PORT} portunda çalışıyor`);
    console.log(`✅ Socket.IO aktif`);
});
