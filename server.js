const mineflayer = require('mineflayer');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

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
    }

    removeBot(username) {
        const bot = this.bots.get(username);
        if (bot) bot.end();
        
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
}

// Socket.IO bağlantıları
io.on('connection', (socket) => {
    console.log('Yeni kullanıcı bağlandı:', socket.id);
    
    const session = new BotSession(socket.id);
    sessions.set(socket.id, session);

    socket.on('start_bot', (data) => {
        const { host, username, version } = data;
        startBot(socket, host, username, version);
    });

    socket.on('stop_bot', (username) => {
        const session = sessions.get(socket.id);
        if (session) {
            session.removeBot(username);
            socket.emit('bot_stopped', { username });
        }
    });

    socket.on('send_chat', (data) => {
        const session = sessions.get(socket.id);
        if (session && session.bots.has(data.username)) {
            session.bots.get(data.username).chat(data.message);
        }
    });

    socket.on('drop_item', (data) => {
        const session = sessions.get(socket.id);
        if (session && session.bots.has(data.username)) {
            const bot = session.bots.get(data.username);
            const item = bot.inventory.slots[data.slot];
            if (item) bot.tossStack(item);
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
        }
    });

    socket.on('shift_right_click', (data) => {
        const session = sessions.get(socket.id);
        if (session && session.bots.has(data.username)) {
            const bot = session.bots.get(data.username);
            performShiftRightClick(bot, data.position);
        }
    });

    socket.on('disconnect', () => {
        const session = sessions.get(socket.id);
        if (session) {
            for (const [username] of session.bots) {
                session.removeBot(username);
            }
            sessions.delete(socket.id);
        }
    });
});

function startBot(socket, host, username, version) {
    const [ip, port] = host.split(':');
    const session = sessions.get(socket.id);
    
    if (session.bots.has(username)) {
        socket.emit('log', { 
            username, 
            message: "[HATA] Bu isimle zaten bir bot aktif!" 
        });
        return;
    }

    session.logs.set(username, []);
    session.logs.get(username).push("[SİSTEM] Bot başlatılıyor...");

    const bot = mineflayer.createBot({
        host: ip,
        port: parseInt(port) || 25565,
        username: username,
        version: version || '1.16.5',
        auth: 'offline'
    });

    session.addBot(username, bot);

    // Giriş başarılı
    bot.on('login', () => {
        addLog(socket, username, "[BAŞARI] Oyuna giriş yapıldı!", "success");
    });

    // Mesajları yakala
    bot.on('message', (jsonMsg) => {
        const message = jsonMsg.toString();
        addLog(socket, username, message, "chat");
    });

    // Action Bar
    bot.on('actionBar', (text) => {
        addLog(socket, username, `[ACTION] ${text.toString()}`, "action");
    });

    // Title
    bot.on('title', (text) => {
        if (text) addLog(socket, username, `[TITLE] ${text.toString()}`, "title");
    });

    // Boss Bar
    bot.on('bossBarUpdate', (bossBar) => {
        addLog(socket, username, `[BOSS] ${bossBar.title}: ${bossBar.health}/${bossBar.maxHealth}`, "boss");
    });

    // Envanter güncellemesi
    bot.on('windowUpdate', () => {
        sendBotData(socket, username);
    });

    // Sağlık ve açlık güncellemesi
    bot.on('health', () => {
        sendBotData(socket, username);
    });

    // Can ve yemek değişimi
    bot.on('food', () => {
        sendBotData(socket, username);
    });

    // Hata yönetimi
    bot.on('error', (err) => {
        addLog(socket, username, `[HATA] ${err.message}`, "error");
        session.removeBot(username);
    });

    bot.on('kicked', (reason) => {
        addLog(socket, username, `[ATILDI] ${reason}`, "error");
        session.removeBot(username);
    });

    bot.on('end', () => {
        addLog(socket, username, "[BAĞLANTI] Bağlantı kesildi", "warning");
        session.removeBot(username);
    });

    // Periyodik veri gönderimi
    const dataInterval = setInterval(() => {
        if (!session.bots.has(username)) {
            clearInterval(dataInterval);
            return;
        }
        sendBotData(socket, username);
    }, 500);

    bot.on('end', () => clearInterval(dataInterval));
}

function addLog(socket, username, message, type = "info") {
    const session = sessions.get(socket.id);
    if (!session || !session.logs.has(username)) return;

    const logs = session.logs.get(username);
    logs.push({
        message,
        type,
        timestamp: new Date().toLocaleTimeString('tr-TR')
    });

    if (logs.length > 200) logs.shift();

    socket.emit('new_log', { username, log: logs[logs.length - 1] });
}

function sendBotData(socket, username) {
    const session = sessions.get(socket.id);
    if (!session || !session.bots.has(username)) return;

    const bot = session.bots.get(username);
    const config = session.configs.get(username);
    
    const inventory = bot.inventory.slots.map((item, index) => {
        if (!item) return null;
        return {
            name: item.name,
            count: item.count,
            slot: index,
            displayName: item.displayName
        };
    }).filter(item => item !== null);

    socket.emit('bot_data', {
        username,
        data: {
            hp: bot.health,
            food: bot.food,
            inventory,
            position: bot.entity.position,
            config: config || {}
        }
    });
}

function updateAutoMessage(socket, username, config) {
    const session = sessions.get(socket.id);
    if (!session) return;

    const tasks = session.autoTasks.get(username);
    const bot = session.bots.get(username);

    if (tasks.messageInterval) {
        clearInterval(tasks.messageInterval);
        tasks.messageInterval = null;
    }

    if (config.enabled && bot && config.message && config.interval > 0) {
        tasks.messageInterval = setInterval(() => {
            if (bot) {
                bot.chat(config.message);
                addLog(socket, username, `[OTOMESAJ] Gönderildi: ${config.message}`, "info");
            }
        }, config.interval * 1000);
    }
}

function updateAutoMine(socket, username, config) {
    const session = sessions.get(socket.id);
    if (!session) return;

    const tasks = session.autoTasks.get(username);
    const bot = session.bots.get(username);

    if (tasks.mineInterval) {
        clearInterval(tasks.mineInterval);
        tasks.mineInterval = null;
    }

    if (config.enabled && bot) {
        tasks.mineInterval = setInterval(async () => {
            if (!bot) return;

            try {
                const block = bot.findBlock({
                    matching: (block) => block.name === config.targetBlock,
                    maxDistance: 16
                });

                if (block) {
                    const tool = bot.pathfinder.bestHarvestTool(block);
                    if (tool) await bot.equip(tool, 'hand');
                    
                    await bot.dig(block);
                    addLog(socket, username, `[OTO-KAZMA] ${config.targetBlock} kazıldı`, "success");
                } else {
                    addLog(socket, username, `[OTO-KAZMA] Hedef blok bulunamadı: ${config.targetBlock}`, "warning");
                }
            } catch (err) {
                addLog(socket, username, `[OTO-KAZMA] Hata: ${err.message}`, "error");
            }
        }, 2000);
    }
}

function performShiftRightClick(bot, position) {
    bot.setControlState('sneak', true);
    setTimeout(() => {
        bot.activateBlock(bot.blockAt(position));
        setTimeout(() => {
            bot.setControlState('sneak', false);
        }, 500);
    }, 200);
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
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

server.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda çalışıyor`);
});