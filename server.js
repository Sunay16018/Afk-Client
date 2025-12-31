const mineflayer = require('mineflayer');
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

// --- HAFINZA ---
let sessions = {}; 
let logs = {}; 
let configs = {}; 

// [YARDIMCI] Saat Damgası
function timestamp() {
    const d = new Date();
    return `[${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}]`;
}

// [ÖNEMLİ] Mesaj Temizleyici (JSON karmaşasını çözer)
function cleanMessage(msg) {
    if (!msg) return "";
    
    // 1. Eğer Mineflayer mesaj nesnesiyse HTML'e çevir
    if (typeof msg === 'object' && msg.toHTML) {
        return msg.toHTML(); 
    }

    // 2. Eğer yazı JSON formatındaysa (örn: atılma sebepleri)
    if (typeof msg === 'string') {
        try {
            const parsed = JSON.parse(msg);
            // JSON içinden sadece yazıyı al
            if (parsed.text) return parsed.text;
            if (parsed.extra) return parsed.extra.map(e => e.text).join('');
            if (parsed.translate) return parsed.translate; // Çeviri kodları
            return JSON.stringify(parsed); // Tanınmayan format
        } catch (e) {
            // JSON değilse düz yazıdır, olduğu gibi döndür
            return msg; 
        }
    }
    return String(msg);
}

function startBot(sid, host, user, ver) {
    if (!sessions[sid]) sessions[sid] = {};
    if (sessions[sid][user]) return;

    const key = sid + "_" + user;
    const [ip, port] = host.split(':');

    const bot = mineflayer.createBot({
        host: ip, port: parseInt(port) || 25565, 
        username: user, version: ver || false, auth: 'offline'
    });

    sessions[sid][user] = bot;
    configs[key] = { mining: null, afk: null, clicker: null };
    
    // Log Dizisini Başlat
    logs[key] = [`<span style="color:cyan">${timestamp()} [SİSTEM] Bot başlatılıyor...</span>`];

    // --- OLAYLAR ---

    bot.on('login', () => {
        logs[key].push(`<span style="color:#2ecc71">${timestamp()} ✔ BAŞARILI: Sunucuya girildi.</span>`);
    });

    bot.on('end', () => {
        logs[key].push(`<span style="color:gray">${timestamp()} ⚠ Bağlantı kapandı.</span>`);
    });

    bot.on('kicked', (reason) => {
        // Atılma sebebini temizle
        const cleanReason = cleanMessage(reason);
        logs[key].push(`<span style="color:#ff4757; font-weight:bold;">${timestamp()} ✖ ATILDI: ${cleanReason}</span>`);
    });

    bot.on('error', (err) => {
        logs[key].push(`<span style="color:orange">${timestamp()} ⚡ HATA: ${err.message}</span>`);
    });
    
    bot.on('message', (m) => {
        // Chat mesajlarını temizle ve HTML formatında al
        const html = cleanMessage(m);
        logs[key].push(`<span style="opacity:0.7; font-size:11px; margin-right:5px;">${timestamp()}</span><span>${html}</span>`);
        
        // Log şişmesini önle (Son 200 mesaj)
        if(logs[key].length > 200) logs[key].shift();
    });
}

http.createServer((req, res) => {
    const q = url.parse(req.url, true).query;
    const p = url.parse(req.url, true).pathname;
    const sid = q.sid;
    const bot = sessions[sid]?.[q.user];

    // --- KOMUTLAR ---
    if (p === '/start' && sid) { startBot(sid, q.host, q.user, q.ver); return res.end("ok"); }
    if (p === '/stop' && bot) { bot.quit(); delete sessions[sid][q.user]; return res.end("ok"); }
    if (p === '/send' && bot) { bot.chat(decodeURIComponent(q.msg)); return res.end("ok"); }

    // --- GÜNCELLEMELER ---
    if (p === '/update' && bot) {
        const key = sid + "_" + q.user;
        const conf = configs[key];
        
        if (q.type === 'inv_action') {
            const slot = parseInt(q.slot);
            const item = bot.inventory.slots[slot];
            if (item) {
                if (q.act === 'drop') bot.tossStack(item);
                if (q.act === 'equip') bot.equip(item, 'hand');
                if (q.act === 'use') bot.activateItem();
            }
        }
        
        if (q.type === 'mining') {
            clearInterval(conf.mining);
            if (q.status === 'on') {
                conf.mining = setInterval(() => {
                    const b = bot.blockAtCursor(4);
                    if(b) bot.dig(b, 'ignore').catch(()=>{});
                }, parseFloat(q.val) * 1000);
            }
        }

        if (q.type === 'afk') {
            clearInterval(conf.afk);
            if (q.status === 'on') {
                conf.afk = setInterval(() => {
                    bot.look(Math.random() * Math.PI, Math.random() * Math.PI);
                }, 5000);
            }
        }

        if (q.type === 'clicker') {
            clearInterval(conf.clicker);
            if (q.status === 'on') {
                conf.clicker = setInterval(() => {
                    bot.swingArm('right');
                }, parseFloat(q.val) * 1000);
            }
        }
        return res.end("ok");
    }

    // --- VERİ ÇEKME ---
    if (p === '/data' && sid) {
        const active = sessions[sid] ? Object.keys(sessions[sid]) : [];
        const botData = {};
        if (q.user && bot) {
            botData[q.user] = {
                logs: logs[sid + "_" + q.user] || [],
                health: bot.health || 20,
                food: bot.food || 20,
                inventory: bot.inventory.slots.map(s => s ? { name: s.name, count: s.count, slot: s.slot, displayName: s.displayName } : null)
            };
        }
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ active, botData }));
    }

    fs.readFile(path.join(__dirname, p === '/' ? 'index.html' : p), (err, data) => res.end(data));
}).listen(process.env.PORT || 10000);
