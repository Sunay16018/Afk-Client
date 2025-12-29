const mineflayer = require('mineflayer');
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

// Statik Dosyalar
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/style.css', (req, res) => res.sendFile(path.join(__dirname, 'style.css')));
app.get('/script.js', (req, res) => res.sendFile(path.join(__dirname, 'script.js')));

let bot = null;
let autoMsgInterval = null;
let isMining = false;

// Bot Ayarları (Frontend'den gelecek)
let botSettings = {
    mathEnabled: false,
    mathDelay: 2000,
    autoMsgEnabled: false,
    autoMsgText: "AFK Botu Aktif!",
    autoMsgTime: 60,
    autoMine: false
};

// Bot Başlatma Fonksiyonu
function startBot(config) {
    if (bot) return; // Zaten açıksa tekrar açma

    io.emit('log', `⏳ ${config.host} sunucusuna bağlanılıyor...`);

    bot = mineflayer.createBot({
        host: config.host,
        port: 25565,
        username: config.username,
        version: '1.19.2'
    });

    bot.on('spawn', () => {
        io.emit('status', 'connected');
        io.emit('log', '✅ Sunucuya giriş yapıldı!');
        io.emit('log', '🔐 Giriş komutu gönderiliyor...');
        if (config.password) {
            bot.chat(`/login ${config.password}`);
        }
        
        // Auto Message Başlat
        handleAutoMessage();
        // Mining Kontrolü
        if(botSettings.autoMine) startMining();
    });

    bot.on('chat', (username, message) => {
        if (!bot) return;
        if (username === bot.username) return;

        // Logu arayüze gönder
        io.emit('chat-log', { user: username, msg: message });

        // Matematik Çözücü
        if (botSettings.mathEnabled) {
            const mathMatch = message.match(/(\d+)\s*([\+\-\*\/])\s*(\d+)/);
            if (mathMatch) {
                const n1 = parseInt(mathMatch[1]);
                const op = mathMatch[2];
                const n2 = parseInt(mathMatch[3]);
                let ans = 0;
                if(op==='+') ans = n1+n2;
                if(op==='-') ans = n1-n2;
                if(op==='*') ans = n1*n2;
                if(op==='/') ans = Math.floor(n1/n2);

                io.emit('log', `🧠 Soru bulundu: ${n1}${op}${n2}. Cevap ${botSettings.mathDelay}ms sonra verilecek.`);
                
                setTimeout(() => {
                    if(bot) bot.chat(ans.toString());
                }, botSettings.mathDelay);
            }
        }
    });

    bot.on('kicked', (reason) => {
        io.emit('log', `❌ ATILMA: ${reason}`);
        stopBot();
    });

    bot.on('error', (err) => {
        io.emit('log', `⚠️ Hata: ${err.message}`);
        stopBot();
    });

    bot.on('end', () => {
        io.emit('log', '🔌 Sunucu bağlantısı kesildi.');
        stopBot();
    });
}

function stopBot() {
    if (bot) {
        bot.quit(); // veya bot.end()
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
            if(bot) bot.chat(botSettings.autoMsgText);
        }, botSettings.autoMsgTime * 1000);
    }
}

async function startMining() {
    if (!bot || !botSettings.autoMine || isMining) return;
    isMining = true;

    while (botSettings.autoMine && bot) {
        // Göz hizasındaki veya önündeki bloğu al
        const block = bot.blockAtCursor(4) || bot.blockAt(bot.entity.position.offset(0, 1.6, 0).offset(0, 0, 1)); // Basit ön kontrolü
        
        if (block && block.type !== 0) { // Hava değilse
            try {
                // io.emit('log', `⛏️ Kazılıyor: ${block.name}`);
                await bot.dig(block);
                // io.emit('log', `✅ Kırıldı.`);
            } catch (e) {
                // Kırma hatası (reach vs) olursa biraz bekle
                await new Promise(r => setTimeout(r, 1000));
            }
        } else {
            // Blok yoksa bekle
            await new Promise(r => setTimeout(r, 500));
        }
    }
    isMining = false;
}

io.on('connection', (socket) => {
    // 1. Bağlanma İsteği
    socket.on('connect-bot', (config) => {
        startBot(config);
    });

    // 2. Bağlantıyı Kes
    socket.on('disconnect-bot', () => {
        stopBot();
        io.emit('log', '🛑 Kullanıcı isteğiyle bağlantı kesildi.');
    });

    // 3. Ayarları Güncelle
    socket.on('update-settings', (settings) => {
        botSettings = settings;
        io.emit('log', '⚙️ Ayarlar güncellendi.');
        
        // Çalışan sistemleri güncelle
        handleAutoMessage();
        if(botSettings.autoMine && !isMining) startMining();
    });

    // 4. Sohbet & Komut
    socket.on('send-chat', (msg) => {
        if(bot) {
            bot.chat(msg);
            io.emit('chat-log', { user: 'BEN', msg: msg });
        }
    });

    // 5. Hareket
    socket.on('move', (action) => {
        if (!bot) return;
        if (action.type === 'stop') {
            bot.clearControlStates();
        } else {
            bot.setControlState(action.dir, action.state);
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
        
