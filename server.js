const mineflayer = require('mineflayer');
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

let sessions = {}; 
let logs = {}; 
let configs = {}; 

function startBot(sid, host, user, ver) {
    if (!sessions[sid]) sessions[sid] = {};
    if (sessions[sid][user]) return;

    const key = sid + "_" + user;
    const [ip, port] = host.split(':');
    
    logs[key] = ["Bağlantı kuruluyor..."];

    const bot = mineflayer.createBot({
        host: ip, 
        port: parseInt(port) || 25565, 
        username: user, 
        version: ver, 
        auth: 'offline',
        // SUNUCU KORUMASINI GEÇMEK İÇİN AYARLAR
        viewDistance: "tiny",
        language: "tr_tr",
        checkTimeoutInterval: 90000,
        skinParts: {
            showCape: true,
            showJacked: true,
            showLeftSleeve: true,
            showRightSleeve: true,
            showLeftPants: true,
            showRightPants: true,
            showHat: true
        }
    });

    sessions[sid][user] = bot;
    configs[key] = { msgT: null, clickT: null, mining: false };

    bot.on('login', () => {
        logs[key].push("<b style='color:#2ecc71'>BAŞARIYLA GİRİLDİ!</b>");
        // Giriş yapınca sunucuya minik bir paket gönder (ayarlar paketi)
        bot.write('settings', {
            locale: 'tr_TR',
            viewDistance: 8,
            chatFlags: 0,
            chatColors: true,
            skinParts: 127,
            mainHand: 1
        });
    });

    bot.on('kicked', (reason) => {
        let msg = reason;
        try { 
            if(typeof reason === 'object') {
                msg = reason.extra ? reason.extra.map(e => e.text).join("") : (reason.text || JSON.stringify(reason));
            }
        } catch(e){}
        logs[key].push("<b style='color:#e74c3c'>SUNUCU ATTI: " + msg + "</b>");
        delete sessions[sid][user];
    });

    bot.on('error', (err) => {
        logs[key].push("<b style='color:#e74c3c'>HATA: " + err.message + "</b>");
        delete sessions[sid][user];
    });

    bot.on('message', (m) => {
        logs[key].push(m.toHTML());
        if(logs[key].length > 50) logs[key].shift();
    });
}

// HTTP API (Aynen devam)
http.createServer((req, res) => {
    const q = url.parse(req.url, true).query;
    const p = url.parse(req.url, true).pathname;
    const sid = q.sid;

    if (p === '/start' && sid) { startBot(sid, q.host, q.user, q.ver); return res.end("ok"); }
    if (p === '/send' && sid) {
        if (sessions[sid]?.[q.user]) { sessions[sid][q.user].chat(decodeURIComponent(q.msg)); return res.end("ok"); }
        return res.end("error");
    }
    if (p === '/update' && sid) {
        const key = sid + "_" + q.user;
        const b = sessions[sid]?.[q.user];
        if (!b) return res.end("offline");
        clearInterval(configs[key].msgT);
        if (q.type === 'msg' && q.status === 'on') configs[key].msgT = setInterval(() => b.chat(q.val), q.sec * 1000);
        return res.end("ok");
    }
    if (p === '/data' && sid) {
        const active = sessions[sid] ? Object.keys(sessions[sid]) : [];
        const sLogs = {};
        active.forEach(u => { sLogs[u] = logs[sid + "_" + u] || []; });
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ active, logs: sLogs }));
    }
    let f = path.join(__dirname, p === '/' ? 'index.html' : p);
    fs.readFile(f, (err, data) => res.end(data));
}).listen(process.env.PORT || 10000);
