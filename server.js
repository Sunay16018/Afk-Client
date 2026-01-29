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
    // Bot bağlanmadan önce sadece log kaydı açıyoruz, listeye tam bağlandığında girecek
    s.logs[user] = ["<b style='color:#f1c40f'>[SİSTEM] " + user + " bağlanıyor...</b>"];

    const bot = mineflayer.createBot({
        host: ip, port: parseInt(port) || 25565, 
        username: user, version: ver, auth: 'offline',
        checkTimeoutInterval: 120000, 
        connectTimeout: 45000,
        keepAlive: true,
        physicsEnabled: true
    });

    // Bağlantı reddedilirse (Ban, Whitelist, Kapalı)
    bot._client.on('connect_allowed', () => {
        s.logs[user].push("<b style='color:#3498db'>[BİLGİ] Sunucu izni alındı, giriş yapılıyor...</b>");
    });

    bot.on('login', () => {
        s.bots[user] = bot; // Sadece başarılı girişte listeye ekle!
        s.configs[user] = { afkT: null, msgT: null };
        s.logs[user].push("<b style='color:#2ecc71'>[GİRİŞ] " + user + " başarıyla içeride!</b>");
        
        // İnsansı Hareket (Admin Savar)
        const runAfk = () => {
            if (!s.bots[user]) return;
            const r = Math.random();
            if (r < 0.2) {
                const yaw = bot.entity.yaw + (Math.random() - 0.5) * 0.4;
                bot.look(yaw, bot.entity.pitch, false);
            }
            s.configs[user].afkT = setTimeout(runAfk, Math.random() * 120000 + 60000);
        };
        runAfk();
    });

    // Towny ve Oyuncu İsimleri Fix
    bot.on('message', (jsonMsg) => {
        const html = jsonMsg.toHTML();
        if (jsonMsg.toString().trim()) s.logs[user].push(html);
        if(s.logs[user].length > 150) s.logs[user].shift();
    });

    // KRİTİK HATA YAKALAYICI (Ban, Kicked, Error)
    bot.on('kicked', (reason) => {
        const r = JSON.parse(reason);
        const text = r.text || r.extra?.[0]?.text || reason;
        s.logs[user].push("<b style='color:#ff4757'>[ATILDI/BAN] " + text + "</b>");
        delete s.bots[user]; // Listeden anında sil
    });

    bot.on('error', (err) => {
        let msg = err.message;
        if(msg.includes("ECONNREFUSED")) msg = "Sunucu Kapalı veya IP Yanlış!";
        if(msg.includes("ETIMEDOUT")) msg = "Bağlantı Zaman Aşımı (Proxy Hatası)!";
        s.logs[user].push("<b style='color:#ff4757'>[HATA] " + msg + "</b>");
        delete s.bots[user];
    });

    bot.on('end', (reason) => {
        s.logs[user].push("<b style='color:orange'>[AYRILDI] " + reason + "</b>");
        if(s.configs[user]) clearTimeout(s.configs[user].afkT);
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
    if (p === '/stop') { 
        if(s.bots[q.user]) {
            s.bots[q.user].quit();
            delete s.bots[q.user];
        }
        return res.end("ok"); 
    }
    if (p === '/send' && s.bots[q.user]) { s.bots[q.user].chat(decodeURIComponent(q.msg)); return res.end("ok"); }

    if (p === '/data' && sid) {
        res.setHeader('Content-Type', 'application/json');
        const botData = {};
        if (q.user && s.bots[q.user]) {
            const b = s.bots[q.user];
            botData[q.user] = { hp: b.health||0, food: b.food||0, inv: b.inventory ? b.inventory.slots.map((i,idx)=>i?{name:i.name,count:i.count,slot:idx}:null).filter(x=>x) : [] };
        }
        return res.end(JSON.stringify({ active: Object.keys(s.bots), logs: s.logs, botData }));
    }
    fs.readFile(path.join(__dirname, p==='/'?'index.html':p), (err, data) => res.end(data || "404"));
}).listen(process.env.PORT || 10000);
