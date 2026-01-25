const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mineflayer = require('mineflayer');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Render.com için kritik: Statik dosyaları doğru sun
app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Session storage
let sessions = {};

// Fix Turkish characters
function fixTurkish(text) {
    const map = {'Ã§':'ç','Ã¶':'ö','Ã¼':'ü','Ä±':'ı','ÅŸ':'ş','ÄŸ':'ğ'};
    let result = text.toString();
    for (const [bad, good] of Object.entries(map)) {
        result = result.replace(new RegExp(bad, 'g'), good);
    }
    return result;
}

io.on('connection', (socket) => {
    console.log('✅ Yeni kullanıcı:', socket.id);
    
    const sid = socket.id;
    if (!sessions[sid]) {
        sessions[sid] = { bots: {}, logs: {} };
    }
    
    let selectedBot = '';
    
    // Bot seçimi
    socket.on('select-bot', (bot) => {
        selectedBot = bot;
        console.log(`Seçilen bot: ${bot}`);
    });
    
    // Bot başlatma - RENDER İÇİN DÜZELTİLDİ
    socket.on('start-bot', async (data) => {
        try {
            const { host, user, ver } = data;
            const session = sessions[sid];
            
            if (!host || !user || !ver) {
                socket.emit('error', 'Tüm alanları doldurun!');
                return;
            }
            
            console.log(`Bot başlatılıyor: ${user} @ ${host}`);
            
            // Host'u parse et
            let [ip, port] = host.split(':');
            if (!port) port = 25565;
            
            // Log başlat
            session.logs[user] = ['[SİSTEM] Bot başlatılıyor...'];
            
            // Bot oluştur - TRY-CATCH ile
            const bot = mineflayer.createBot({
                host: ip.trim(),
                port: parseInt(port),
                username: user.trim(),
                version: ver.trim(),
                auth: 'offline'
            });
            
            session.bots[user] = bot;
            
            // Bot events
            bot.on('login', () => {
                console.log(`✅ ${user} sunucuya bağlandı`);
                session.logs[user].push(`[BAĞLANTI] ${user} sunucuya bağlandı!`);
                updateClient();
            });
            
            bot.on('message', (msg) => {
                if (session.logs[user]) {
                    const cleanMsg = fixTurkish(msg.toString());
                    session.logs[user].push(cleanMsg);
                    if (session.logs[user].length > 50) session.logs[user].shift();
                    updateClient();
                }
            });
            
            bot.on('end', () => {
                console.log(`❌ ${user} bağlantısı kesildi`);
                if (session.logs[user]) {
                    session.logs[user].push('[BAĞLANTI] Bağlantı kesildi');
                }
                delete session.bots[user];
                updateClient();
            });
            
            bot.on('error', (err) => {
                console.error(`Bot hatası (${user}):`, err.message);
                if (session.logs[user]) {
                    session.logs[user].push(`[HATA] ${err.message}`);
                }
                delete session.bots[user];
                updateClient();
            });
            
            selectedBot = user;
            updateClient();
            
        } catch (error) {
            console.error('Bot başlatma hatası:', error);
            socket.emit('error', `Bot başlatılamadı: ${error.message}`);
        }
    });
    
    // Bot durdurma
    socket.on('stop-bot', (botName) => {
        const session = sessions[sid];
        const bot = session.bots[botName];
        if (bot) {
            console.log(`Bot durduruluyor: ${botName}`);
            bot.quit();
            delete session.bots[botName];
            if (session.logs[botName]) {
                session.logs[botName].push('[SİSTEM] Bot durduruldu');
            }
        }
        updateClient();
    });
    
    // Mesaj gönderme
    socket.on('send-chat', (data) => {
        const session = sessions[sid];
        const bot = session.bots[data.bot];
        if (bot) {
            bot.chat(data.msg);
            if (session.logs[data.bot]) {
                session.logs[data.bot].push(`[SEN] ${data.msg}`);
            }
            updateClient();
        }
    });
    
    // Hareket kontrolü
    socket.on('control-move', (data) => {
        const session = sessions[sid];
        const bot = session.bots[data.bot];
        if (bot) {
            const controls = {
                'ileri': 'forward',
                'geri': 'back', 
                'sol': 'left',
                'sag': 'right',
                'zipla': 'jump'
            };
            const active = data.state === 'down';
            if (controls[data.direction]) {
                bot.setControlState(controls[data.direction], active);
                if (active && session.logs[data.bot]) {
                    session.logs[data.bot].push(`[HAREKET] ${data.direction.toUpperCase()}`);
                }
            }
            updateClient();
        }
    });
    
    // İstemciyi güncelleme fonksiyonu
    function updateClient() {
        const session = sessions[sid];
        const active = Object.keys(session.bots);
        const botData = {};
        
        active.forEach(name => {
            const bot = session.bots[name];
            if (bot) {
                botData[name] = {
                    hp: bot.health || 0,
                    food: bot.food || 0,
                    inv: bot.inventory ? bot.inventory.slots.map((it, i) => 
                        it ? { name: it.name, count: it.count, slot: i } : null
                    ).filter(x => x) : []
                };
            }
        });
        
        socket.emit('bot-update', {
            active: active,
            logs: session.logs,
            botData: botData
        });
    }
    
    // İlk güncellemeyi gönder
    updateClient();
    
    // Bağlantı kesilirse
    socket.on('disconnect', () => {
        console.log('Kullanıcı ayrıldı:', sid);
        // Tüm botları durdur
        const session = sessions[sid];
        if (session) {
            Object.keys(session.bots).forEach(botName => {
                const bot = session.bots[botName];
                if (bot) bot.quit();
            });
        }
        delete sessions[sid];
    });
});

// RENDER.COM İÇİN KRİTİK: Port ayarı
const PORT = process.env.PORT || 10000;

// Sunucuyu başlat - RENDER İÇİN DÜZELTİLDİ
server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Render.com sunucusu çalışıyor: ${PORT}`);
    console.log(`🌐 Socket.io hazır`);
});

// Hata yakalama
process.on('uncaughtException', (err) => {
    console.error('Kritik hata:', err);
});
