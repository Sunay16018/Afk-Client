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
        checkTimeoutInterval: 90000
    });

    s.bots[user] = bot;
    s.configs[user] = { antiAfkT: null };

    bot.on('login', () => {
        s.logs[user].push("<b style='color:#2ecc71'>[GİRİŞ] " + user + " bağlandı!</b>");
        
        // ANTI-AFK SİSTEMİ
        s.configs[user].antiAfkT = setInterval(() => {
            if (!s.bots[user] || !bot.entity) return;
            const chance = Math.random();
            if (chance < 0.3) {
                bot.setControlState('jump', true);
                setTimeout(() => { if(bot.setControlState) bot.setControlState('jump', false) }, 300);
            } else if (chance < 0.6) {
                bot.look(bot.entity.yaw + (Math.random()-0.5), (Math.random()-0.5)*0.3, false);
            }
        }, Math.floor(Math.random() * 15000) + 20000);
    });
    
    // HER TÜRLÜ MESAJI VE İSMİ YAKALAMA MANTIĞI
    bot.on('message', (jsonMsg, position) => {
        // Towny ve özel chat formatları için tüm satırı HTML olarak al
        let formattedMsg = jsonMsg.toHTML();
        
        // Eğer mesaj boş değilse loglara ekle
        if (jsonMsg.toString().trim().length > 0) {
            s.logs[user].push(formattedMsg);
        }

        if(s.logs[user].length > 120) s.logs[user].shift();
    });

    // Chat event'i ile ismi ayrıca kontrol et (Yedek mekanizma)
    bot.on('chat', (username, message) => {
        console.log(`[CHAT] ${username}: ${message}`);
    });

    bot.on('end', (r) => {
        s.logs[user].push("<b style='color:#ff4757'>[KESİLDİ] " + r + "</b>");
        clearInterval(s.configs[user].antiAfkT);
        delete s.bots[user];
    });

    bot.on('error', (e) => { 
        s.logs[user].push("<b style='color:#ff4757'>[HATA] " + e.message + "</b>"); 
        delete s.bots[user]; 
    });
}

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
            botData[q.user] = {
                hp: b.health || 0, food: b.food || 0,
                inv: b.inventory ? b.inventory.slots.map((i, idx) => i ? {name: i.name, count: i.count, slot: idx} : null).filter(x => x !== null) : []
            };
        }
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ active, logs: s.logs, botData }));
    }

    let f = path.join(__dirname, p === '/' ? 'index.html' : p);
    fs.readFile(f, (err, data) => res.end(data || "404"));
}).listen(process.env.PORT || 10000);
