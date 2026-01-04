const mineflayer = require('mineflayer');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

const PORT = process.env.PORT || 10000;
const sessions = new Map();

class BotSession {
    constructor(socketId) {
        this.socketId = socketId;
        this.bots = new Map();
        this.logs = new Map();
        this.dataTimers = new Map();
        this.autoMessageTimers = new Map();
        this.autoMineTimers = new Map();
        this.movementStates = new Map();
    }

    addLog(botName, message, type = 'info') {
        if (!this.logs.has(botName)) this.logs.set(botName, []);
        const logEntry = { message, type, timestamp: new Date().toLocaleTimeString('tr-TR') };
        this.logs.get(botName).push(logEntry);
        if (this.logs.get(botName).length > 100) this.logs.get(botName).shift();
        
        const socket = io.sockets.sockets.get(this.socketId);
        if (socket) socket.emit('new_log', { username: botName, log: logEntry });
    }

    getBotData(botName) {
        const bot = this.bots.get(botName);
        if (!bot) return null;

        try {
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

    stopBot(botName) {
        const bot = this.bots.get(botName);
        if (bot) { 
            try { 
                bot.quit(); 
                bot.end(); 
            } catch (e) {} 
        }
        
        // Tüm timer'ları temizle
        const timers = ['dataTimers', 'autoMessageTimers', 'autoMineTimers'];
        timers.forEach(timerType => {
            const timer = this[timerType].get(botName);
            if (timer) {
                clearInterval(timer);
                this[timerType].delete(botName);
            }
        });
        
        this.bots.delete(botName);
        this.logs.delete(botName);
        this.movementStates.delete(botName);
    }

    // OTO MESAJ FONKSİYONU
    setupAutoMessage(botName, enabled, message, interval) {
        const timer = this.autoMessageTimers.get(botName);
        if (timer) {
            clearInterval(timer);
            this.autoMessageTimers.delete(botName);
        }

        if (enabled && message && interval > 0) {
            const bot = this.bots.get(botName);
            if (bot) {
                const newTimer = setInterval(() => {
                    if (this.bots.has(botName)) {
                        bot.chat(message);
                        this.addLog(botName, `[OTOMESAJ] ${message}`, 'info');
                    }
                }, interval * 1000);
                this.autoMessageTimers.set(botName, newTimer);
                this.addLog(botName, `Otomatik mesaj aktif: ${interval}s aralıkla`, 'success');
            }
        }
    }

    // OTO KAZMA FONKSİYONU (ZEKİ)
    setupAutoMine(botName, enabled, targetBlock) {
        const timer = this.autoMineTimers.get(botName);
        if (timer) {
            clearInterval(timer);
            this.autoMineTimers.delete(botName);
        }

        if (enabled && targetBlock) {
            const bot = this.bots.get(botName);
            if (bot) {
                let isMining = false;
                
                const mineLogic = async () => {
                    if (!this.bots.has(botName) || isMining) return;
                    
                    try {
                        const block = bot.findBlock({
                            matching: (block) => block && block.name.includes(targetBlock),
                            maxDistance: 5,
                            count: 1
                        });

                        if (block) {
                            isMining = true;
                            
                            // En iyi aleti bul
                            const tool = bot.pathfinder.bestHarvestTool(block);
                            if (tool) {
                                await bot.equip(tool, 'hand');
                            }
                            
                            // Blok kırılana kadar kaz
                            await bot.dig(block, true);
                            this.addLog(botName, `[OTOKAZMA] ${targetBlock} kazıldı`, 'success');
                            
                            // 1 saniye bekle
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                    } catch (err) {
                        if (err.message !== 'Digging aborted') {
                            this.addLog(botName, `[OTOKAZMA] Hata: ${err.message}`, 'error');
                        }
                    } finally {
                        isMining = false;
                    }
                };

                const newTimer = setInterval(mineLogic, 2000);
                this.autoMineTimers.set(botName, newTimer);
                this.addLog(botName, `Otomatik kazma aktif: ${targetBlock}`, 'success');
            }
        }
    }

    // HAREKET KONTROLÜ
    setMovement(botName, direction, state) {
        const bot = this.bots.get(botName);
        if (!bot) return;

        const controls = {
            'forward': 'forward',
            'back': 'back',
            'left': 'left',
            'right': 'right',
            'jump': 'jump',
            'sneak': 'sneak',
            'sprint': 'sprint'
        };

        if (controls[direction]) {
            bot.setControlState(controls[direction], state);
            
            // Durumu kaydet
            if (!this.movementStates.has(botName)) {
                this.movementStates.set(botName, {});
            }
            const states = this.movementStates.get(botName);
            states[direction] = state;
            
            if (state) {
                this.addLog(botName, `[HAREKET] ${direction} aktif`, 'info');
            }
        }
    }

    // EŞYA İŞLEMLERİ
    async handleItemAction(botName, slot, action) {
        const bot = this.bots.get(botName);
        if (!bot || !bot.inventory || !bot.inventory.slots[slot]) return false;

        const item = bot.inventory.slots[slot];
        if (!item) return false;

        try {
            switch(action) {
                case 'drop_all':
                    // Tümünü at
                    for (let i = 0; i < item.count; i++) {
                        await bot.tossStack(item);
                    }
                    this.addLog(botName, `[ENVANTER] ${item.displayName} tümü atıldı`, 'info');
                    break;
                    
                case 'eat':
                    // Yemekse ye
                    if (item.name.includes('potion')) {
                        await bot.equip(item, 'hand');
                        bot.activateItem();
                        this.addLog(botName, `[ENVANTER] ${item.displayName} içildi`, 'info');
                    } else if (item.food) {
                        await bot.equip(item, 'hand');
                        bot.consume();
                        this.addLog(botName, `[ENVANTER] ${item.displayName} yenildi`, 'info');
                    } else {
                        this.addLog(botName, `[ENVANTER] Bu eşya yenilemez`, 'warning');
                        return false;
                    }
                    break;
                    
                case 'right_click':
                    // Sağ tık
                    await bot.equip(item, 'hand');
                    bot.activateItem();
                    this.addLog(botName, `[ENVANTER] ${item.displayName} sağ tıklandı`, 'info');
                    break;
                    
                case 'left_click':
                    // Sol tık
                    await bot.equip(item, 'hand');
                    this.addLog(botName, `[ENVANTER] ${item.displayName} sol tıklandı`, 'info');
                    break;
            }
            return true;
        } catch (err) {
            this.addLog(botName, `[ENVANTER] İşlem hatası: ${err.message}`, 'error');
            return false;
        }
    }
}

// ✅ SOCKET.IO OLAYLARI
io.on('connection', (socket) => {
    console.log('Yeni bağlantı:', socket.id);
    const session = new BotSession(socket.id);
    sessions.set(socket.id, session);

    socket.emit('connected', { 
        message: 'AFK Client Pro bağlantısı kuruldu', 
        timestamp: new Date().toISOString() 
    });

    socket.on('start_bot', (data) => { startBot(socket, session, data); });
    socket.on('stop_bot', (botName) => { session.stopBot(botName); socket.emit('bot_stopped', { username: botName }); updateBotList(socket, session); });
    
    socket.on('send_chat', (data) => { 
        const bot = session.bots.get(data.username);
        if (bot) {
            try {
                bot.chat(data.message);
                // "[SİZ]" önekini KALDIRIYORUZ - sadece mesajı göster
                session.addLog(data.username, data.message, 'chat');
            } catch (e) {
                session.addLog(data.username, `[HATA] Mesaj gönderilemedi: ${e.message}`, 'error');
            }
        }
    });

    socket.on('request_bot_data', (data) => { 
        const botData = session.getBotData(data.username); 
        if (botData) socket.emit('bot_data', { username: data.username, data: botData }); 
    });

    socket.on('get_bot_list', () => { updateBotList(socket, session); });
    
    socket.on('item_action', (data) => {
        session.handleItemAction(data.username, data.slot, data.action)
            .then(success => {
                if (success) {
                    socket.emit('item_action_result', { 
                        success: true, 
                        message: 'İşlem başarılı' 
                    });
                    // Envanteri güncelle
                    const botData = session.getBotData(data.username);
                    if (botData) {
                        socket.emit('bot_data', {
                            username: data.username,
                            data: botData
                        });
                    }
                }
            });
    });

    // HAREKET KONTROLLERİ
    socket.on('movement', (data) => {
        session.setMovement(data.username, data.direction, data.state);
    });

    // AYARLAR
    socket.on('update_settings', (data) => {
        const { username, settings } = data;
        
        if (settings.autoMessage) {
            session.setupAutoMessage(
                username,
                settings.autoMessage.enabled,
                settings.autoMessage.message,
                settings.autoMessage.interval
            );
        }
        
        if (settings.autoMine) {
            session.setupAutoMine(
                username,
                settings.autoMine.enabled,
                settings.autoMine.targetBlock
            );
        }
        
        socket.emit('settings_updated', { success: true });
    });

    socket.on('disconnect', () => {
        console.log('Bağlantı kesildi:', socket.id);
        for (const [botName] of session.bots) session.stopBot(botName);
        sessions.delete(socket.id);
    });
});

function startBot(socket, session, data) {
    const { host, username, version } = data;
    if (!host || !username) { 
        socket.emit('notification', { 
            type: 'error', 
            message: 'Host ve kullanıcı adı gerekli!' 
        }); 
        return; 
    }
    
    if (session.bots.has(username)) { 
        socket.emit('notification', { 
            type: 'warning', 
            message: 'Bu isimle zaten bir bot var!' 
        }); 
        return; 
    }

    const [ip, portStr] = host.includes(':') ? host.split(':') : [host, '25565'];
    const port = parseInt(portStr) || 25565;
    
    socket.emit('notification', { 
        type: 'info', 
        message: 'Bot başlatılıyor...' 
    });

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

        bot.on('login', () => {
            session.addLog(username, 'Oyuna giriş yapıldı!', 'success');
            updateBotList(socket, session);
            const botData = session.getBotData(username);
            if (botData) socket.emit('bot_data', { username: username, data: botData });
            
            socket.emit('notification', { 
                type: 'success', 
                message: `${username} botu bağlandı!` 
            });
        });

        bot.on('message', (jsonMsg) => { 
            try { 
                const message = jsonMsg.toString();
                // Minecraft mesaj formatını koru
                session.addLog(username, message, 'chat'); 
            } catch (e) { 
                console.error('Mesaj parse hatası:', e); 
            } 
        });

        bot.on('health', () => { 
            const botData = session.getBotData(username); 
            if (botData) socket.emit('bot_data', { username: username, data: botData }); 
        });

        bot.on('windowUpdate', () => { 
            const botData = session.getBotData(username); 
            if (botData) socket.emit('bot_data', { username: username, data: botData }); 
        });

        bot.on('error', (err) => { 
            session.addLog(username, `Hata: ${err.message}`, 'error'); 
            session.stopBot(username); 
            updateBotList(socket, session); 
            
            socket.emit('notification', { 
                type: 'error', 
                message: `${username} botunda hata: ${err.message}` 
            });
        });

        bot.on('kicked', (reason) => { 
            session.addLog(username, `Atıldı: ${reason}`, 'error'); 
            session.stopBot(username); 
            updateBotList(socket, session); 
        });

        bot.on('end', () => { 
            session.addLog(username, "Bağlantı kesildi", 'warning'); 
            session.stopBot(username); 
            updateBotList(socket, session); 
        });

        const dataTimer = setInterval(() => {
            if (!session.bots.has(username)) { 
                clearInterval(dataTimer); 
                session.dataTimers.delete(username); 
                return; 
            }
            const botData = session.getBotData(username);
            if (botData) socket.emit('bot_data', { username: username, data: botData });
        }, 1000);
        
        session.dataTimers.set(username, dataTimer);

    } catch (error) {
        console.error('Bot oluşturma hatası:', error);
        socket.emit('notification', { 
            type: 'error', 
            message: `Bot oluşturulamadı: ${error.message}` 
        });
    }
}

function updateBotList(socket, session) {
    const botList = Array.from(session.bots.keys()).map(botName => ({ 
        name: botName, 
        online: true, 
        data: session.getBotData(botName) 
    }));
    socket.emit('bot_list', { bots: botList });
}

// STATİK DOSYALAR
app.use(express.static(__dirname));
app.get('/socket.io/socket.io.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'node_modules/socket.io/client-dist/socket.io.js'));
});
app.get('*', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });

server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ AFK Client Pro ${PORT} portunda çalışıyor!`);
});
