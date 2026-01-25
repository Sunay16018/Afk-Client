const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mineflayer = require('mineflayer');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Kalıcı hafıza (Basit obje tabanlı veritabanı)
// Format: { 'session_id': { socketId: '...', bots: { 'BotName': botInstance }, logs: {} } }
let sessions = {};

// Minecraft renk kodlarını temizleme (Basit loglar için)
function stripColors(text) {
    return text.replace(/§[0-9a-fk-or]/g, '');
}

io.on('connection', (socket) => {
    // 1. Oturum Kurtarma Mekanizması
    const sessionId = socket.handshake.query.sessionId;
    
    if (sessionId && sessions[sessionId]) {
        console.log(`♻️ Oturum kurtarıldı: ${sessionId}`);
        sessions[sessionId].socketId = socket.id; // Yeni socket ID'yi güncelle
        updateClient(sessionId);
    } else {
        // Yeni oturum oluştur
        const newSessionId = sessionId || Math.random().toString(36).substring(7);
        console.log(`🆕 Yeni oturum: ${newSessionId}`);
        sessions[newSessionId] = { 
            socketId: socket.id, 
            bots: {}, 
            logs: {},
            selectedBot: null 
        };
        // İstemciye yeni ID'yi bildir (opsiyonel, genelde istemci üretir ama garanti olsun)
        socket.emit('session-created', newSessionId);
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
            socket.emit('error', 'Bu isimde bir bot zaten aktif!');
            return;
        }

        console.log(`🚀 Bot başlatılıyor: ${user}`);
        session.logs[user] = [`[SİSTEM] ${user} sunucuya bağlanıyor...`];
        updateClient(sId); // Arayüzde "yükleniyor" gibi gözükmesi için

        let [ip, port] = host.split(':');
        port = port ? parseInt(port) : 25565;

        try {
            const bot = mineflayer.createBot({
                host: ip,
                port: port,
                username: user,
                version: ver,
                auth: 'offline' // Render'da sadece offline/cracked çalışır
            });

            session.bots[user] = bot;

            // --- Eventler ---
            bot.on('login', () => {
                logToBot(session, user, `[BAĞLANTI] Sunucuya girildi!`);
                updateClient(sId);
            });

            bot.on('end', () => {
                logToBot(session, user, `[BAĞLANTI] Bağlantı koptu.`);
                // Botu sessiondan silme, kullanıcı "Kapat" diyene kadar kalsın ki logları görsün
                // Ama bot objesi öldüğü için yeniden bağlanması gerekebilir.
                updateClient(sId);
            });

            bot.on('error', (err) => {
                logToBot(session, user, `[HATA] ${err.message}`);
                updateClient(sId);
            });

            bot.on('message', (jsonMsg) => {
                // Ham json mesajını al, renk kodlarını frontend halledecek ya da burada işlenecek
                const cleanMsg = stripColors(jsonMsg.toAnsi()); 
                // Not: toAnsi() terminal renkleri verir, biz düz text kaydedelim, frontend'e ham veri de yollayabiliriz
                logToBot(session, user, cleanMsg);
                
                // Sohbet mesajı gelince arayüzü güncelle (çok sık olmamalı)
                // Performans için her mesajda updateClient çağırmak yerine throttle yapılabilir
                // Şimdilik kritik güncellemeler için bırakıyoruz.
            });
            
            // Oyuncu listesi güncellemeleri için
            bot.on('playerJoined', () => updateClient(sId));
            bot.on('playerLeft', () => updateClient(sId));

        } catch (e) {
            socket.emit('error', 'Bot oluşturma hatası: ' + e.message);
            delete session.bots[user];
            updateClient(sId);
        }
    });

    // Bot Durdurma
    socket.on('stop-bot', (botName) => {
        const session = getCurrentSession();
        if (!session || !session.bots[botName]) return;

        session.bots[botName].quit();
        delete session.bots[botName];
        if (session.logs[botName]) delete session.logs[botName]; // Logları da temizle
        if (session.selectedBot === botName) session.selectedBot = null;
        
        updateClient(socket.handshake.query.sessionId);
    });

    // Chat Gönderme
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
    
    // Bağlantı koparsa (Tarayıcı kapanırsa)
    socket.on('disconnect', () => {
        console.log(`Kullanıcı ayrıldı (Session korunuyor): ${sessionId}`);
        // BURADA botları öldürmüyoruz (bot.quit YAPMIYORUZ).
        // Böylece tarayıcıyı kapatınca botlar oyunda kalır.
    });
});

function logToBot(session, botName, msg) {
    if (!session.logs[botName]) session.logs[botName] = [];
    session.logs[botName].push(msg);
    if (session.logs[botName].length > 100) session.logs[botName].shift(); // Son 100 log
}

function updateClient(sessionId) {
    if (!sessions[sessionId]) return;
    
    const session = sessions[sessionId];
    const socketId = session.socketId;
    
    // Veriyi hazırla
    const activeBots = Object.keys(session.bots);
    const botData = {};

    activeBots.forEach(name => {
        const bot = session.bots[name];
        
        // Oyuncu listesini hazırla
        const players = [];
        if (bot.players) {
            Object.values(bot.players).forEach(p => {
                players.push({
                    username: p.username,
                    uuid: p.uuid, // Skin almak için
                    displayName: p.displayName ? p.displayName.toString() : p.username, // Renkli isim desteği için raw json lazım aslında ama basitleştiriyoruz
                    ping: p.ping
                });
            });
        }

        botData[name] = {
            hp: bot.health || 0,
            food: bot.food || 0,
            inv: bot.inventory ? bot.inventory.slots.filter(i => i!=null).map(i => ({name: i.name, count: i.count, slot: i.slot})) : [],
            players: players // Oyuncu listesi eklendi
        };
    });

    // Sadece ilgili kullanıcıya gönder
    io.to(socketId).emit('bot-update', {
        active: activeBots,
        logs: session.logs,
        botData: botData,
        selectedBot: session.selectedBot
    });
}

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
                         
