const mineflayer = require('mineflayer');
const express = require('express');
const socketIo = require('socket.io');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });
const PORT = process.env.PORT || 10000;

class BotManager {
    constructor(socketId) {
        this.socketId = socketId;
        this.bots = new Map();
        this.configs = new Map();
        this.tasks = new Map();
    }

    async createBot(data) {
        const { host, username, version } = data;
        const [ip, portStr] = host.split(':');
        const port = parseInt(portStr) || 25565;
        const botKey = `${username}@${host}`;

        if (this.bots.has(botKey)) throw new Error('Bot zaten aktif!');

        try {
            const bot = mineflayer.createBot({
                host: ip,
                port: port,
                username: username,
                version: version || '1.20.1',
                auth: 'offline',
                hideErrors: true
            });

            this.bots.set(botKey, bot);
            this.configs.set(botKey, {
                autoMessage: { enabled: false, message: '', interval: 10 },
                autoMine: { enabled: false, targetBlock: 'diamond_ore', smart: true },
                autoWalk: { enabled: false, target: null },
                antiAfk: { enabled: true, interval: 30 },
                movement: { forward: false, back: false, left: false, right: false }
            });
            this.tasks.set(botKey, {});

            this.setupBotEvents(botKey);
            return botKey;
        } catch (err) {
            throw err;
        }
    }

    setupBotEvents(botKey) {
        const bot = this.bots.get(botKey);
        const socket = io.to(this.socketId);

        bot.on('login', () => {
            socket.emit('bot_connected', { botKey });
            this.sendLog(botKey, '✅ Sunucuya bağlanıldı', 'success');
            this.startTasks(botKey);
        });

        bot.on('spawn', () => {
            this.sendData(botKey);
        });

        bot.on('message', (msg) => {
            const message = msg.toString();
            if (message && !message.includes('§')) {
                this.sendLog(botKey, message, 'chat');
            }
        });

        bot.on('health', () => {
            this.sendData(botKey);
        });

        bot.on('food', () => {
            this.sendData(botKey);
        });

        bot.on('death', () => {
            this.sendLog(botKey, '❌ Öldü', 'error');
        });

        bot.on('kicked', (reason) => {
            this.sendLog(botKey, `⛔ Atıldı: ${reason}`, 'error');
            this.removeBot(botKey);
        });

        bot.on('error', (err) => {
            this.sendLog(botKey, `⚠️ Hata: ${err.message}`, 'error');
        });

        bot.on('end', () => {
            this.removeBot(botKey);
        });

        // Data updates
        setInterval(() => {
            if (this.bots.has(botKey)) this.sendData(botKey);
        }, 2000);
    }

    sendData(botKey) {
        const bot = this.bots.get(botKey);
        const config = this.configs.get(botKey);
        const socket = io.to(this.socketId);

        const inventory = [];
        if (bot.inventory?.slots) {
            bot.inventory.slots.forEach((item, i) => {
                if (item) inventory.push({
                    name: item.name,
                    count: item.count,
                    slot: i,
                    displayName: item.displayName
                });
            });
        }

        socket.emit('bot_data', {
            botKey,
            data: {
                health: bot.health || 0,
                food: bot.food || 0,
                position: bot.entity?.position || { x: 0, y: 0, z: 0 },
                inventory,
                config
            }
        });
    }

    sendLog(botKey, message, type) {
        io.to(this.socketId).emit('bot_log', {
            botKey,
            log: { message, type, timestamp: new Date().toLocaleTimeString('tr-TR') }
        });
    }

    startTasks(botKey) {
        const bot = this.bots.get(botKey);
        const config = this.configs.get(botKey);
        const tasks = this.tasks.get(botKey);

        // Clear existing tasks
        if (tasks.interval) clearInterval(tasks.interval);
        if (tasks.messageInterval) clearInterval(tasks.messageInterval);
        if (tasks.mineInterval) clearInterval(tasks.mineInterval);
        if (tasks.antiAfkInterval) clearInterval(tasks.antiAfkInterval);

        tasks.interval = setInterval(() => this.sendData(botKey), 2000);

        // Auto message
        if (config.autoMessage.enabled) {
            tasks.messageInterval = setInterval(() => {
                if (bot && config.autoMessage.message) {
                    bot.chat(config.autoMessage.message);
                    this.sendLog(botKey, `📢 ${config.autoMessage.message}`, 'info');
                }
            }, config.autoMessage.interval * 1000);
        }

        // Auto mine (smart)
        if (config.autoMine.enabled) {
            tasks.mineInterval = setInterval(async () => {
                try {
                    const block = bot.findBlock({
                        matching: b => b && b.name === config.autoMine.targetBlock,
                        maxDistance: 6
                    });
                    if (block) {
                        const tool = bot.pathfinder?.bestHarvestTool?.(block);
                        if (tool) await bot.equip(tool, 'hand');
                        await bot.dig(block);
                        this.sendLog(botKey, `⛏️ ${config.autoMine.targetBlock} kazıldı`, 'success');
                    }
                } catch (err) {
                    if (!err.message.includes('digging')) {
                        this.sendLog(botKey, `⚠️ Kazma hatası: ${err.message}`, 'warning');
                    }
                }
            }, 2000);
        }

        // Anti-AFK
        if (config.antiAfk.enabled) {
            tasks.antiAfkInterval = setInterval(() => {
                const actions = [
                    () => bot.setControlState('jump', true),
                    () => bot.look(Math.random() * Math.PI * 2, Math.random() * Math.PI - Math.PI / 2),
                    () => bot.swingArm(),
                    () => bot.setControlState('sneak', true)
                ];
                const action = actions[Math.floor(Math.random() * actions.length)];
                action();
                setTimeout(() => {
                    bot.setControlState('jump', false);
                    bot.setControlState('sneak', false);
                }, 200);
            }, config.antiAfk.interval * 1000);
        }

        // Movement
        Object.entries(config.movement).forEach(([key, value]) => {
            if (value) bot.setControlState(key, value);
        });
    }

    updateConfig(botKey, type, config) {
        const botConfig = this.configs.get(botKey);
        if (!botConfig) return;

        if (type === 'auto_message') botConfig.autoMessage = config;
        else if (type === 'auto_mine') botConfig.autoMine = config;
        else if (type === 'anti_afk') botConfig.antiAfk = config;
        else if (type === 'movement') botConfig.movement = config;
        else if (type === 'auto_walk') botConfig.autoWalk = config;

        this.startTasks(botKey);
    }

    async moveTo(botKey, x, y, z) {
        const bot = this.bots.get(botKey);
        if (!bot) return false;

        // Simple movement using lookAt and forward
        const target = { x, y, z };
        bot.lookAt(target);
        bot.setControlState('forward', true);
        
        // Check distance and stop when close
        const checkInterval = setInterval(() => {
            const pos = bot.entity.position;
            const distance = Math.sqrt(
                Math.pow(pos.x - x, 2) + 
                Math.pow(pos.y - y, 2) + 
                Math.pow(pos.z - z, 2)
            );
            
            if (distance < 2) {
                bot.setControlState('forward', false);
                clearInterval(checkInterval);
                this.sendLog(botKey, '✅ Hedefe ulaşıldı', 'success');
            }
        }, 500);

        setTimeout(() => {
            bot.setControlState('forward', false);
            clearInterval(checkInterval);
        }, 30000);

        return true;
    }

    removeBot(botKey) {
        const bot = this.bots.get(botKey);
        const tasks = this.tasks.get(botKey);

        if (bot) {
            try { bot.end(); } catch(e) {}
        }

        if (tasks) {
            Object.values(tasks).forEach(interval => {
                if (interval) clearInterval(interval);
            });
        }

        this.bots.delete(botKey);
        this.configs.delete(botKey);
        this.tasks.delete(botKey);

        io.to(this.socketId).emit('bot_removed', { botKey });
    }
}

const sessions = new Map();

io.on('connection', (socket) => {
    console.log('Bağlandı:', socket.id);
    const manager = new BotManager(socket.id);
    sessions.set(socket.id, manager);

    socket.on('start_bot', async (data, callback) => {
        try {
            const botKey = await manager.createBot(data);
            callback({ success: true, botKey });
        } catch (error) {
            callback({ success: false, error: error.message });
        }
    });

    socket.on('stop_bot', (data) => {
        manager.removeBot(data.botKey);
    });

    socket.on('send_chat', (data) => {
        const bot = manager.bots.get(data.botKey);
        if (bot) bot.chat(data.message);
    });

    socket.on('drop_item', (data) => {
        const bot = manager.bots.get(data.botKey);
        if (bot && data.slot !== undefined) {
            const item = bot.inventory.slots[data.slot];
            if (item) bot.tossStack(item);
        }
    });

    socket.on('set_config', (data) => {
        manager.updateConfig(data.botKey, data.type, data.config);
    });

    socket.on('move_to', async (data, callback) => {
        const success = await manager.moveTo(data.botKey, data.x, data.y, data.z);
        callback({ success });
    });

    socket.on('set_movement', (data) => {
        const bot = manager.bots.get(data.botKey);
        if (bot) {
            Object.entries(data.movement).forEach(([key, value]) => {
                bot.setControlState(key, value);
            });
            manager.updateConfig(data.botKey, 'movement', data.movement);
        }
    });

    socket.on('disconnect', () => {
        sessions.delete(socket.id);
    });
});

app.use(express.static(__dirname));
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

server.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda çalışıyor`);
});