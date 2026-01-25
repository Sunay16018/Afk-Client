const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mineflayer = require('mineflayer');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Statik dosyaları sun (index.html, style.css, script.js)
app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Oturum Hafızası
let sessions = {};

// Minecraft Renk Temizleyici
function stripColors(text) {
    if (!text) return '';
    return text.replace(/§[0-9a-fk-or]/g, '');
}

io.on('connection', (socket) => {
    // 1. Session ID Kontrolü (Oturum Kurtarma)
    const sessionId = socket.handshake.query.sessionId;
    
    if (sessionId && sessions[sessionId]) {
        console.log(`♻️  Eski oturum geri yüklendi: ${sessionId}`);
        sessions[sessionId].socketId = socket.id;
        // Kullanıcı geri geldiğinde hemen verileri gönder
        setTimeout(() => updateClient(sessionId), 500);
    } else {
        const newSessionId = sessionId || Math.random().toString(36).substring(7);
        console.log(`🆕 Yeni oturum: ${newSessionId}`);
        sessions[newSessionId] = { 
            socketId: socket.id, 
            bots: {}, 
            logs: {},
            selectedBot: null 
        };
    }

    const getCurrentSession = () => {
        const sId = socket.handshake.query.sessionId;
        return sessions[sId] ? sessions[sId] : null;
    };

    // Bot Seçimi
    socket.on('select-bot', (botName) => {
        const session = getCurrentSession();
        if (!session) return;
        session.selectedBot = botName;
        updateClient(socket.handshake.query.sessionId);
    });

    // Bot Başlatma
    socket.on('start-bot', (data) => {
        const session = getCurrentSession();
        if (!session) return;

        const { host, user, ver } = data;
        const sId = socket.handshake.query.sessionId;

        if (session.bots[user]) {
            socket.emit('error', 'Bu isimde bir bot zaten var!');
            return;
        }

        // Host parse et
        let [ip, port] = host.split(':');
        port = port ? parseInt(port) : 25565;

        // Log başlat
        if (!session.logs[user]) session.logs[user] = [];
        session.logs[user].push(`[SİSTEM] ${user} bağlanıyor...`);
        updateClient(sId);

        try {
            const bot = mineflayer.createBot({
                host: ip,
                port: port,
                username: user,
                version: ver,
                auth: 'offline' // Render'da offline/cracked çalışır
            });

            session.bots[user] = bot;

            // --- Eventler ---
            bot.on('login', () => {
                logToBot(session, user, `[BAĞLANTI] Sunucuya girildi!`);
                updateClient(sId);
            });

            bot.on('end', () => {
                logToBot(session, user, `[BAĞLANTI] Bağlantı koptu.`);
                // Botu silmiyoruz ki logları okuyabilesin. "KES" diyene kadar durur.
                updateClient(sId);
            });

            bot.on('error', (err) => {
                logToBot(session, user, `[HATA] ${err.message}`);
                updateClient(sId);
            });

            bot.on('message', (jsonMsg) => {
                const msg = stripColors(jsonMsg.toAnsi());
                logToBot(session, user, msg);
                // Çok sık güncelleme yapmamak için chat mesajlarında updateClient çağırmıyoruz
                // Ama logs array'i güncellendiği için bir sonraki update'de görünecek
                // Kritik mesajlar için manuel tetiklenebilir
            });
            
            // Oyuncu giriş çıkışlarında listeyi güncelle
            bot.on('playerJoined', () => updateClient(sId));
            bot.on('playerLeft', () => updateClient(sId));

            // Periyodik güncelleme (Chat vb. için) - Her 2 saniyede bir
            // Bu, çok fazla socket trafiği yapmadan arayüzü taze tutar
            if (!bot.updateInterval) {
                bot.updateInterval = setInterval(() => updateClient(sId), 2000);
            }

        } catch (e) {
            socket.emit('error', 'Bot hatası: ' + e.message);
            delete session.bots[user];
            updateClient(sId);
        }
    });

    // Bot Durdurma
    socket.on('stop-bot', (botName) => {
        const session = getCurrentSession();
        if (!session || !session.bots[botName]) return;

        const bot = session.bots[botName];
        if (bot.updateInterval) clearInterval(bot.updateInterval);
        
        bot.quit();
        delete session.bots[botName];
        
        if (session.selectedBot === botName) session.selectedBot = null;
        updateClient(socket.handshake.query.sessionId);
    });

    // Chat
    socket.on('send-chat', (data) => {
        const session = getCurrentSession();
        if (session && session.bots[data.bot]) {
            session.bots[data.bot].chat(data.msg);
            logToBot(session, data.bot, `[SEN] ${data.msg}`);
            updateClient(socket.handshake.query.sessionId);
        }
    });

    // Hareket
    socket.on('control-move', (data) => {
        const session = getCurrentSession();
        if (session && session.bots[data.bot]) {
            const bot = session.bots[data.bot];
            const controls = { 'ileri':'forward', 'geri':'back', 'sol':'left', 'sag':'right', 'zipla':'jump' };
            if (controls[data.direction]) {
                bot.setControlState(controls[data.direction], data.state === 'down');
            }
        }
    });

    socket.on('disconnect', () => {
        // Session'ı silmiyoruz. Kullanıcı geri gelirse devam eder.
        console.log(`Socket ayrıldı: ${sessionId}`);
    });
});

function logToBot(session, botName, msg) {
    if (!session.logs[botName]) session.logs[botName] = [];
    session.logs[botName].push(msg);
    if (session.logs[botName].length > 100) session.logs[botName].shift();
}

function updateClient(sessionId) {
    if (!sessions[sessionId]) return;
    const session = sessions[sessionId];
    const socketId = session.socketId;

    const activeBots = Object.keys(session.bots);
    const botData = {};

    activeBots.forEach(name => {
        const bot = session.bots[name];
        
        // Oyuncuları Hazırla
        const players = [];
        if (bot.players) {
            Object.values(bot.players).forEach(p => {
                if (p.username) {
                    players.push({
                        username: p.username,
                        ping: p.ping,
                        uuid: p.uuid // Skin için
                    });
                }
            });
        }

        botData[name] = {
            hp: bot.health || 0,
            food: bot.food || 0,
            inv: bot.inventory ? bot.inventory.slots.filter(i => i!=null).map(i => ({name: i.name, count: i.count, slot: i.slot})) : [],
            players: players
        };
    });

    io.to(socketId).emit('bot-update', {
        active: activeBots,
        logs: session.logs,
        botData: botData,
        selectedBot: session.selectedBot
    });
}

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`Sunucu çalışıyor: ${PORT}`));
                   
