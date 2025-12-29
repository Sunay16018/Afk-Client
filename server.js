const mineflayer = require('mineflayer');
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

// Tüm dosyalar ana dizinde olduğu için statik servisi ayarla
app.use(express.static(__dirname));

// Ana sayfa yönlendirmesi
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

let bot = null;
let autoMsgInterval = null;
let isMining = false;

// Varsayılan Ayarlar
let botSettings = {
    mathEnabled: false,
    mathDelay: 2000,
    autoMsgEnabled: false,
    autoMsgText: "AFK",
    autoMsgTime: 60,
    autoMine: false
};

// --- BOT FONKSİYONLARI ---

function startBot(config) {
    if (bot) return;

    io.emit('log', `⏳ ${config.host} sunucusuna bağlanılıyor...`);

    bot = mineflayer.createBot({
        host: config.host,
        port: 25565,
        username: config.username,
        version: false // Otomatik sürüm algılama
    });

    bot.on('spawn', () => {
        io.emit('status', 'connected');
        io.emit('log', '✅ Sunucuya GİRİŞ YAPILDI!');
        
        if (config.password) {
            io.emit('log', '🔐 Şifre gönderiliyor...');
            bot.chat(`/login ${config.password}`);
        }

        handleAutoMessage();
        if (botSettings.autoMine) startMining();
    });

    bot.on('chat', (username, message) => {
        if (!bot) return;
        if (username === bot.username) return;

        io.emit('chat-log', { user: username, msg: message });

        // Matematik Sistemi
        if (botSettings.mathEnabled) {
            // Örnek formatlar: "12 + 5", "Kaçtır: 10 * 2" vb.
            const mathMatch = message.match(/(\d+)\s*([\+\-\*\/])\s*(\d+)/);
            if (mathMatch) {
                const n1 = parseInt(mathMatch[1]);
                const op = mathMatch[2];
                const n2 = parseInt(mathMatch[3]);
                
                let ans = 0;
                switch(op) {
                    case '+': ans = n1 + n2; break;
                    case '-': ans = n1 - n2; break;
                    case '*': ans = n1 * n2; break;
                    case '/': ans = Math.floor(n1 / n2); break;
                }

                io.emit('log', `🧠 Soru Algılandı: ${n1}${op}${n2}. Cevap ${botSettings.mathDelay}ms sonra verilecek.`);
                
                setTimeout(() => {
                    if (bot) bot.chat(ans.toString());
                }, botSettings.mathDelay);
            }
        }
    });

    bot.on('kicked', (reason) => {
        io.emit('log', `❌ ATILDI: ${reason}`);
        stopBot();
    });

    bot.on('error', (err) => {
        io.emit('log', `⚠️ HATA: ${err.message}`);
        stopBot();
    });

    bot.on('end', () => {
        io.emit('log', '🔌 Sunucu bağlantısı koptu.');
        stopBot();
    });
}

function stopBot() {
    if (bot) {
        bot.quit();
        bot = null;
    }
    if (autoMsgInterval) clearInterval(autoMsgInterval);
    isMining = false;
    io.emit('status', 'disconnected');
}

function handleAutoMessage() {
    if (autoMsgInterval) clearInterval(autoMsgInterval);
    if (botSettings.autoMsgEnabled && bot) {
        autoMsgInterval = setInterval(() => {
            if (bot) bot.chat(botSettings.autoMsgText);
        }, botSettings.autoMsgTime * 1000);
    }
}

async function startMining() {
    if (!bot || !botSettings.autoMine || isMining) return;
    isMining = true;
    io.emit('log', '⛏️ Otomatik Maden Başlatıldı.');

    while (botSettings.autoMine && bot) {
        // Önündeki veya kafasının içindeki bloğu bul
        const block = bot.blockAtCursor(4) || bot.blockAt(bot.entity.position.offset(0, 1.6, 0));

        if (block && block.type !== 0) { // Hava değilse
            try {
                await bot.dig(block); // Asenkron kırma - Sunucuyu dondurmaz
            } catch (e) {
                await new Promise(r => setTimeout(r, 1000)); // Hata varsa 1sn bekle
            }
        } else {
            await new Promise(r => setTimeout(r, 500)); // Blok yoksa bekle
        }
    }
    isMining = false;
}

// --- SOCKET.IO İLETİŞİMİ ---

io.on('connection', (socket) => {
    socket.on('connect-bot', (data) => startBot(data));
    socket.on('disconnect-bot', () => stopBot());
    
    socket.on('update-settings', (data) => {
        botSettings = data;
        io.emit('log', '⚙️ Ayarlar güncellendi.');
        handleAutoMessage();
        if (botSettings.autoMine && !isMining) startMining();
    });

    socket.on('send-chat', (msg) => {
        if (bot) {
            bot.chat(msg);
            io.emit('chat-log', { user: 'BEN', msg: msg });
        }
    });

    socket.on('move', (data) => {
        if (!bot) return;
        if (data.type === 'stop') {
            bot.clearControlStates();
        } else {
            bot.setControlState(data.dir, data.state);
        }
    });
});

server.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda çalışıyor.`);
});
        
