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
        username: user, version: ver, auth: 'offline'
    });

    s.bots[user] = bot;
    s.configs[user] = { msgT: null, antiAfkT: null };

    bot.on('login', () => {
        s.logs[user].push("<b style='color:#2ecc71'>[GİRİŞ] " + user + " bağlandı!</b>");
        
        // GELİŞMİŞ ATILMAMA SİSTEMİ (Anti-AFK)
        s.configs[user].antiAfkT = setInterval(() => {
            if (!s.bots[user]) return;
            // Rastgele hareketler: Zıpla, Sağa bak, Sola bak
            const botInstance = s.bots[user];
            botInstance.setControlState('jump', true);
            setTimeout(() => botInstance.setControlState('jump', false), 500);
            
            // Rastgele ufak kafa hareketleri (Sunucu bot olduğunu anlamasın diye)
            const yaw = (Math.random() - 0.5) * 2;
            const pitch = (Math.random() - 0.5) * 2;
            botInstance.look(botInstance.entity.yaw + yaw, botInstance.entity.pitch + pitch);
        }, 30000); // Her 30 saniyede bir tetiklenir
    });
    
    bot.on('message', (m) => {
        s.logs[user].push(m.toHTML());
        if(s.logs[user].length > 100) s.logs[user].shift();
    });

    bot.on('end', () => {
        if(s.logs[user]) s.logs[user].push("<b style='color:#ff4757'>[BAĞLANTI] Bot düştü.</b>");
        clearInterval(s.configs[user].antiAfkT);
        delete s.bots[user];
    });

    bot.on('error', (e) => { 
        s.logs[user].push("<b style='color:#ff4757'>[HATA] " + e.message + "</b>"); 
        clearInterval(s.configs[user].antiAfkT);
        delete s.bots[user]; 
    });
}

http.createServer((req, res) => {
    const q = url.parse(req.url, true).query;
    const p = url.parse(req.url, true).pathname;
    const sid = q.sid;
    if (!sid && p !== '/') return res.end("No SID");

    const s = getSession(sid);
    const bot = s.bots[q.user];

    if (p === '/start') { startBot(sid, q.host, q.user, q.ver); return res.end("ok"); }
    if (p === '/stop' && bot) { bot.quit(); return res.end("ok"); }
    if (p === '/send' && bot) { bot.chat(decodeURIComponent(q.msg)); return res.end("ok"); }
    
    if (p === '/data' && sid) {
        const active = Object.keys(s.bots);
        const botData = {};
        if (q.user && s.bots[q.user]) {
            const b = s.bots[q.user];
            botData[q.user] = {
                hp: b.health || 0,
                food: b.food || 0,
                inv: b.inventory ? b.inventory.slots.map((i, idx) => i ? {
                    name: i.name, count: i.count, slot: idx
                } : null).filter(x => x !== null) : []
            };
        }
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ active, logs: s.logs, botData }));
    }

    let f = path.join(__dirname, p === '/' ? 'index.html' : p);
    fs.readFile(f, (err, data) => res.end(data || "404"));
}).listen(process.env.PORT || 10000);
