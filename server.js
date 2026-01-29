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
        checkTimeoutInterval: 180000, // Proxy geçişlerinde (BungeeCord) kopmayı önler
        connectTimeout: 90000,
        keepAlive: true,
        physicsEnabled: true // Hareketlerin doğal görünmesi için fizik açık
    });

    s.bots[user] = bot;
    s.configs[user] = { msgT: null, afkT: null };

    bot.on('login', () => {
        s.logs[user].push("<b style='color:#2ecc71'>[BAĞLANTI] " + user + " sunucuya sızdı!</b>");
        
        // İNSANSI HAREKET ALGORİTMASI (Hile Koruması Fix)
        if (s.configs[user].afkT) clearInterval(s.configs[user].afkT);
        s.configs[user].afkT = setInterval(() => {
            if (!s.bots[user] || !bot.entity) return;
            
            const r = Math.random();
            // Asla sürekli zıplamaz! Sadece %15 ihtimalle rastgele kafa oynatır.
            if (r < 0.15) {
                const yaw = bot.entity.yaw + (Math.random() - 0.5) * 0.5;
                const pitch = (Math.random() - 0.5) * 0.3;
                bot.look(yaw, pitch, false);
            } 
            // %5 ihtimalle çok kısa bir an eğilir (Sneak)
            else if (r < 0.20) {
                bot.setControlState('sneak', true);
                setTimeout(() => { if(bot.setControlState) bot.setControlState('sneak', false) }, 500);
            }
        }, Math.floor(Math.random() * 20000) + 30000); // 30-50 saniye arası rastgele süre
    });

    // CHATCRAFT MODELİ: %100 OYUNCU İSMİ VE MESAJ YAKALAMA
    bot.on('message', (jsonMsg) => {
        const html = jsonMsg.toHTML(); // Towny rütbeleri ve isimleri korur
        if (jsonMsg.toString().trim() !== "") {
            s.logs[user].push(html);
        }
        if(s.logs[user].length > 150) s.logs[user].shift();
    });

    // PROXY/LOBBY GEÇİŞLERİNDE TETİKLENİR
    bot.on('spawn', () => {
        s.logs[user].push("<b style='color:#3498db'>[DÜNYA] Yeni bölgeye geçiş yapıldı.</b>");
    });

    bot.on('end', (reason) => {
        s.logs[user].push("<b style='color:#ff4757'>[KESİLDİ] " + reason + "</b>");
        clearInterval(s.configs[user].afkT);
        clearInterval(s.configs[user].msgT);
        delete s.bots[user];
    });

    bot.on('error', (e) => { s.logs[user].push("<b style='color:#ff4757'>[HATA] " + e.message + "</b>"); });
}

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
    
    // MENÜLER (KORUNDU)
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

    fs.readFile(path.join(__dirname, p==='/'?'index.html':p), (err, data) => res.end(data || "404"));
}).listen(process.env.PORT || 10000);
