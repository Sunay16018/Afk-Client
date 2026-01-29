const mineflayer = require('mineflayer');
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

let userSessions = {}; 

function getSession(sid) {
    if (!userSessions[sid]) userSessions[sid] = { bots: {}, logs: {}, configs: {} };
    return userSessions[sid];
}

function startBot(sid, host, user, ver) {
    const s = getSession(sid);
    if (s.bots[user]) return;

    const [ip, port] = host.split(':');
    s.logs[user] = ["<b style='color:gray'>[SİSTEM] " + user + " hazırlanıyor...</b>"];

    const bot = mineflayer.createBot({
        host: ip, port: parseInt(port) || 25565, 
        username: user, version: ver, auth: 'offline',
        // PROXY/BUNGEE GEÇİŞLERİ İÇİN KRİTİK AYARLAR
        checkTimeoutInterval: 180000, // 3 dakika boyunca kopmaz, geçişleri bekler
        connectTimeout: 90000,
        keepAlive: true,
        hideErrors: true 
    });

    s.bots[user] = bot;
    s.configs[user] = { msgT: null, afkT: null };

    bot.on('login', () => {
        s.logs[user].push("<b style='color:#2ecc71'>[GİRİŞ] " + user + " başarıyla bağlandı!</b>");
        
        // AKILLI ANTI-AFK (Proxy sunucularda aktif kalma)
        if (s.configs[user].afkT) clearInterval(s.configs[user].afkT);
        s.configs[user].afkT = setInterval(() => {
            if (!s.bots[user] || !bot.entity) return;
            const r = Math.random();
            if (r < 0.45) { // %45 Zıpla
                bot.setControlState('jump', true);
                setTimeout(() => { if(bot.setControlState) bot.setControlState('jump', false) }, 300);
            } else if (r < 0.75) { // %30 Etrafa bak
                const yaw = bot.entity.yaw + (Math.random() - 0.5) * 1.5;
                bot.look(yaw, bot.entity.pitch, false);
            }
        }, 15000); // 15 saniyede bir kontrol
    });

    // %100 OYUNCU İSMİ VE MESAJ YAKALAMA (toHTML Kullanımı)
    bot.on('message', (jsonMsg) => {
        // Sunucudan gelen ham veriyi (rütbe, isim, sembol) olduğu gibi yakalar
        const html = jsonMsg.toHTML();
        if (jsonMsg.toString().trim() !== "") {
            s.logs[user].push(html);
        }
        if(s.logs[user].length > 150) s.logs[user].shift();
    });

    // SUNUCU DEĞİŞİMİNDE (SPAWN OLUNCA) TETİKLENİR
    bot.on('spawn', () => {
        s.logs[user].push("<b style='color:#3498db'>[BÖLGE] Yeni dünyaya giriş yapıldı/geçiş tamamlandı.</b>");
    });

    bot.on('end', (reason) => {
        s.logs[user].push("<b style='color:#ff4757'>[BAĞLANTI] Kesildi: " + reason + "</b>");
        clearInterval(s.configs[user].afkT);
        clearInterval(s.configs[user].msgT);
        delete s.bots[user];
    });

    bot.on('error', (e) => { 
        s.logs[user].push("<b style='color:#ff4757'>[HATA] " + e.message + "</b>"); 
    });
}

// ULTRA HIZLI VERİ AKIŞI İÇİN HTTP SUNUCU
http.createServer((req, res) => {
    const q = url.parse(req.url, true).query;
    const p = url.parse(req.url, true).pathname;
    const sid = q.sid;
    if (!sid && p !== '/') return res.end("No SID");
    const s = getSession(sid);
    const bot = q.user ? s.bots[q.user] : null;

    if (p === '/start') { startBot(sid, q.host, q.user, q.ver); return res.end("ok"); }
    if (p === '/stop' && bot) { bot.quit(); return res.end("ok"); }
    if (p === '/send' && bot) { bot.chat(decodeURIComponent(q.msg)); return res.end("ok"); }
    
    // MENÜLER (ENVANTER VE OTO MESAJ) KORUNDU
    if (p === '/update' && bot) {
        const conf = s.configs[q.user];
        if (q.type === 'inv' && q.status === 'drop') {
            const item = bot.inventory.slots[q.val];
            if (item) bot.tossStack(item);
        } else if (q.type === 'msg') {
            clearInterval(conf.msgT);
            if (q.status === 'on') conf.msgT = setInterval(() => bot.chat(decodeURIComponent(q.val)), q.sec * 1000);
        }
        return res.end("ok");
    }

    if (p === '/data' && sid) {
        const active = Object.keys(s.bots);
        const botData = {};
        if (q.user && s.bots[q.user]) {
            const b = s.bots[q.user];
            botData[q.user] = {
                hp: b.health || 0, food: b.food || 0,
                inv: b.inventory ? b.inventory.slots.map((i, idx) => i ? {name: i.name, count: i.count, slot: idx} : null).filter(x => x) : []
            };
        }
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ active, logs: s.logs, botData }));
    }

    fs.readFile(path.join(__dirname, p === '/' ? 'index.html' : p), (err, data) => res.end(data || "404"));
}).listen(process.env.PORT || 10000);
