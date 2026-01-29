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
    s.logs[user] = ["<b style='color:gray'>[SİSTEM] " + user + " bağlanıyor...</b>"];

    const bot = mineflayer.createBot({
        host: ip, port: parseInt(port) || 25565, 
        username: user, version: ver, auth: 'offline',
        checkTimeoutInterval: 120000, // Lobby-Sunucu arası kopmaları engeller
        connectTimeout: 90000,
        keepAlive: true,
        viewDistance: "tiny" // Daha az RAM kullanımı için
    });

    s.bots[user] = bot;
    s.configs[user] = { afkT: null };

    bot.on('login', () => {
        s.logs[user].push("<b style='color:#2ecc71'>[GİRİŞ] " + user + " başarıyla bağlandı!</b>");
        
        // AKILLI % SİSTEMLİ İNSANSI ANTI-AFK
        if (s.configs[user].afkT) clearInterval(s.configs[user].afkT);
        s.configs[user].afkT = setInterval(() => {
            if (!s.bots[user] || !bot.entity) return;
            
            const r = Math.random();
            if (r < 0.45) { 
                // %45 Şans: Zıplama (AFK Algılanmasını önler)
                bot.setControlState('jump', true);
                setTimeout(() => { if(bot.setControlState) bot.setControlState('jump', false) }, 400);
            } else if (r < 0.70) {
                // %25 Şans: Hafif Bakış (İnsansı hareket)
                const yaw = bot.entity.yaw + (Math.random() - 0.5) * 1.5;
                const pitch = (Math.random() - 0.5) * 0.5;
                bot.look(yaw, pitch, false);
            }
        }, Math.floor(Math.random() * 20000) + 20000); 
    });

    // %100 OYUNCU İSMİ VE TOWNY FORMATI YAKALAYICI
    bot.on('message', (jsonMsg) => {
        // En karmaşık Towny rütbelerini ve oyuncu isimlerini yakalayan HTML dönüştürücü
        const msgHtml = jsonMsg.toHTML();
        if (jsonMsg.toString().trim() !== "") {
            s.logs[user].push(msgHtml);
        }
        if(s.logs[user].length > 150) s.logs[user].shift();
    });

    // LOBBYDEN SUNUCUYA GEÇİŞTEKİ SOCKETCLOSED HATASI ÇÖZÜMÜ
    bot.on('spawn', () => {
        s.logs[user].push("<b style='color:#3498db'>[BÖLGE] Bot yeni dünyaya doğdu (Lobby/Dünya geçişi).</b>");
    });

    bot.on('end', (reason) => {
        s.logs[user].push("<b style='color:#ff4757'>[BAĞLANTI] " + reason + " sebebiyle kesildi.</b>");
        clearInterval(s.configs[user].afkT);
        delete s.bots[user];
    });

    bot.on('error', (e) => {
        s.logs[user].push("<b style='color:#ff4757'>[HATA] " + e.message + "</b>");
    });
}

// API ve Web Paneli
http.createServer((req, res) => {
    const q = url.parse(req.url, true).query;
    const p = url.parse(req.url, true).pathname;
    const sid = q.sid;
    if (!sid && p !== '/') return res.end("No SID");
    const s = getSession(sid);

    if (p === '/start') { startBot(sid, q.host, q.user, q.ver); return res.end("ok"); }
    if (p === '/stop' && s.bots[q.user]) { s.bots[q.user].quit(); return res.end("ok"); }
    if (p === '/send' && s.bots[q.user]) { s.bots[q.user].chat(decodeURIComponent(q.msg)); return res.end("ok"); }
    if (p === '/data' && sid) {
        const active = Object.keys(s.bots);
        const botData = {};
        if (q.user && s.bots[q.user]) {
            const b = s.bots[q.user];
            botData[q.user] = { hp: b.health||0, food: b.food||0, inv: b.inventory ? b.inventory.slots.filter(i=>i).map(i=>({name:i.name, count:i.count, slot:i.slot})) : [] };
        }
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ active, logs: s.logs, botData }));
    }
    fs.readFile(path.join(__dirname, p==='/'?'index.html':p), (err, data) => res.end(data || "404"));
}).listen(process.env.PORT || 10000);
