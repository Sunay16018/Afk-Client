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
    if(!s.logs[user]) s.logs[user] = [];
    s.logs[user].push("<b style='color:gray'>[SİSTEM] Sunucuya bağlanılıyor...</b>");
    
    if (!s.configs[user]) {
        s.configs[user] = { afk: false, reconnect: true, afkInterval: null };
    }

    const bot = mineflayer.createBot({
        host: ip, 
        port: parseInt(port) || 25565, 
        username: user, 
        version: ver, 
        auth: 'offline',
        // PROXY ÇÖZÜMÜ: Sunucu geçişlerinde zaman aşımını engellemek için
        checkTimeoutInterval: 60 * 1000, 
        hideErrors: true 
    });

    s.bots[user] = bot;

    bot.on('login', () => {
        s.logs[user].push("<b style='color:#2ecc71'>[BAĞLANTI] " + user + " sunucuya giriş yaptı.</b>");
        if (s.configs[user].afk) startAfkLoop(sid, user);
    });

    // PROXY ÇÖZÜMÜ: Sunucu değişimini (Skyblock geçişi gibi) yakala
    bot.on('respawn', () => {
        s.logs[user].push("<b style='color:#3498db'>[SİSTEM] Sunucu/Boyut değiştirildi, bot korunuyor.</b>");
    });

    bot.on('message', (m) => {
        s.logs[user].push(m.toHTML());
        if(s.logs[user].length > 100) s.logs[user].shift();
    });

    bot.on('end', (reason) => {
        s.logs[user].push(`<b style='color:#ff4757'>[AYRILDI] Bağlantı kesildi. Sebep: ${reason}</b>`);
        
        if (s.configs[user].afkInterval) clearInterval(s.configs[user].afkInterval);
        delete s.bots[user];

        // Proxy geçişlerinde düşerse 2 saniye içinde sessizce geri bağla
        if (s.configs[user].reconnect) {
            setTimeout(() => {
                s.logs[user].push("<b style='color:#e67e22'>[OTOMATİK] Tekrar bağlanılıyor...</b>");
                startBot(sid, host, user, ver);
            }, 2000);
        }
    });

    bot.on('error', (e) => {
        // "ECONNRESET" hatası genelde proxy geçişlerinde olur, görmezden geliyoruz
        if(e.code !== 'ECONNRESET') {
            s.logs[user].push("<b style='color:#ff4757'>[HATA] " + e.message + "</b>");
        }
    });
}

function startAfkLoop(sid, user) {
    const s = getSession(sid);
    if (s.configs[user].afkInterval) clearInterval(s.configs[user].afkInterval);
    s.configs[user].afkInterval = setInterval(() => {
        const bot = s.bots[user];
        if (bot && bot.entity) {
            bot.setControlState('jump', true);
            setTimeout(() => bot && bot.setControlState('jump', false), 500);
        }
    }, 10000);
}

const server = http.createServer((req, res) => {
    const q = url.parse(req.url, true).query;
    const p = url.parse(req.url, true).pathname;
    const sid = q.sid;
    
    if (p === '/') return fs.readFile(path.join(__dirname, 'index.html'), (err, data) => res.end(data));
    if (!sid) return res.end("SID Missing");

    const s = getSession(sid);
    const bot = s.bots[q.user];

    if (p === '/start') { startBot(sid, q.host, q.user, q.ver); return res.end("ok"); }
    if (p === '/stop' && bot) { 
        s.configs[q.user].reconnect = false; // Manuel durdurmada geri bağlanma
        bot.quit(); 
        return res.end("ok"); 
    }
    if (p === '/send' && bot) { bot.chat(decodeURIComponent(q.msg)); return res.end("ok"); }
    if (p === '/move' && bot) { bot.setControlState(q.dir, q.state === 'true'); return res.end("ok"); }

    if (p === '/update') {
        if (!s.configs[q.user]) return res.end("Error");
        if (q.type === 'inv' && bot) {
            const item = bot.inventory.slots[q.val];
            if (item) bot.tossStack(item);
        } else {
            s.configs[q.user][q.type] = !s.configs[q.user][q.type];
            if (q.type === 'afk') {
                if (s.configs[q.user].afk) startAfkLoop(sid, q.user);
                else clearInterval(s.configs[q.user].afkInterval);
            }
        }
        return res.end("ok");
    }

    if (p === '/data') {
        const botData = {};
        if (q.user && s.bots[q.user]) {
            const b = s.bots[q.user];
            botData[q.user] = {
                hp: b.health || 0, food: b.food || 0,
                pos: b.entity ? b.entity.position : {x:0, y:0, z:0},
                inv: b.inventory.slots.map((i, idx) => i ? { name: i.name, count: i.count, slot: idx } : null).filter(x => x !== null)
            };
        }
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ active: Object.keys(s.bots), logs: s.logs, botData, configs: s.configs }));
    }
});

server.listen(process.env.PORT || 10000);
            
