const mineflayer = require('mineflayer');
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

// Hafıza Yönetimi
let sessions = {}; // Tüm bot oturumları
let logs = {};     // Konsol geçmişi
let configs = {};  // Otomatik kazma vb. ayarlar

// --- [FONKSİYON] Bot Başlatıcı ---
function startBot(sid, host, user, ver) {
    if (!sessions[sid]) sessions[sid] = {};
    if (sessions[sid][user]) return; // Zaten varsa tekrar açma

    const key = sid + "_" + user;
    const [ip, port] = host.split(':');

    // Bot Ayarları
    const bot = mineflayer.createBot({
        host: ip, 
        port: parseInt(port) || 25565, 
        username: user, 
        version: ver || false, // Sürüm otomatik algılansın
        auth: 'offline'
    });

    sessions[sid][user] = bot;
    configs[key] = { mining: null };
    logs[key] = [`<span style="color:#00d2ff">[SİSTEM] ${user} başlatılıyor...</span>`];

    // 1. GİRİŞ BAŞARILI
    bot.on('login', () => {
        logs[key].push(`<span style="color:#2ecc71">✔ [BAĞLANDI] Sunucuya giriş yapıldı.</span>`);
    });

    // 2. MESAJLARI YAKALA (Chat & Sistem Mesajları)
    bot.on('message', (jsonMsg) => {
        // Mineflayer'ın kendi HTML çeviricisini kullanıyoruz, renkler korunsun diye.
        const html = jsonMsg.toHTML(); 
        logs[key].push(html);
        if(logs[key].length > 150) logs[key].shift(); // RAM şişmemesi için limit
    });

    // 3. ATILMA (KICK) YAKALAMA
    bot.on('kicked', (reason) => {
        // Sebep bazen JSON object, bazen string gelir. İkisini de çözüyoruz.
        const r = typeof reason === 'string' ? reason : JSON.stringify(reason);
        logs[key].push(`<span style="color:#ff4757; font-weight:bold;">✖ [ATILDI] Sebep: ${r}</span>`);
    });

    // 4. HATA (ERROR) YAKALAMA
    bot.on('error', (err) => {
        logs[key].push(`<span style="color:#ffa502">⚠ [HATA] ${err.message}</span>`);
    });

    // 5. BAĞLANTI KOPTU (END)
    bot.on('end', () => {
        logs[key].push(`<span style="color:gray">Checking connection... (Bağlantı sonlandı)</span>`);
    });
    
    // 6. ÖLÜM (DEATH)
    bot.on('death', () => {
        logs[key].push(`<span style="color:red">☠ [ÖLDÜN] Karakter hayatını kaybetti.</span>`);
    });
}

// --- [SUNUCU] HTTP İsteklerini Dinle ---
http.createServer((req, res) => {
    const q = url.parse(req.url, true).query;
    const p = url.parse(req.url, true).pathname;
    const sid = q.sid;
    const bot = sessions[sid]?.[q.user];

    // Bot Başlat
    if (p === '/start' && sid) { 
        startBot(sid, q.host, q.user, q.ver); 
        return res.end("ok"); 
    }
    
    // Bot Durdur (Quit)
    if (p === '/stop' && bot) { 
        bot.quit(); 
        delete sessions[sid][q.user]; 
        return res.end("ok"); 
    }
    
    // Mesaj Gönder
    if (p === '/send' && bot) { 
        bot.chat(decodeURIComponent(q.msg)); 
        return res.end("ok"); 
    }

    // Aksiyonlar (Kazma / Envanter)
    if (p === '/update' && bot) {
        if (q.type === 'inv_action') {
            const slot = parseInt(q.slot);
            const item = bot.inventory.slots[slot];
            if (item) {
                if (q.act === 'drop') bot.tossStack(item);
                if (q.act === 'use') bot.activateItem();
                if (q.act === 'equip') bot.equip(item, 'hand');
            }
        }
        return res.end("ok");
    }

    // Veri Çekme (Polling)
    if (p === '/data' && sid) {
        const active = sessions[sid] ? Object.keys(sessions[sid]) : [];
        const botData = {};
        if (q.user && bot) {
            botData[q.user] = {
                logs: logs[sid + "_" + q.user] || [],
                health: bot.health || 20,
                food: bot.food || 20,
                // Envanteri güvenli şekilde map'liyoruz
                inventory: bot.inventory.slots.map(s => s ? { 
                    name: s.name, 
                    count: s.count, 
                    slot: s.slot,
                    displayName: s.displayName 
                } : null)
            };
        }
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ active, botData }));
    }

    // HTML Dosyasını Sun
    fs.readFile(path.join(__dirname, p === '/' ? 'index.html' : p), (err, data) => {
        if(err) return res.end("404");
        res.end(data);
    });

}).listen(process.env.PORT || 10000);
            
