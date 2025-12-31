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

    try {
        const bot = mineflayer.createBot({
            host: ip, 
            port: parseInt(port) || 25565, 
            username: user, 
            version: ver, // Kullanıcının yazdığı sürüm
            auth: 'offline',
            checkTimeoutInterval: 60000
        });

        sessions[sid][user] = bot;
        configs[key] = { msgT: null };

        bot.on('login', () => logs[key].push("<b style='color:#2ecc71'>BAŞARIYLA GİRDİ!</b>"));
        
        bot.on('kicked', (reason) => {
            let msg = typeof reason === 'string' ? reason : JSON.stringify(reason);
            try { if(reason.extra) msg = reason.extra.map(e => e.text).join(""); } catch(e){}
            logs[key].push("<b style='color:#e74c3c'>SUNUCU ATTI: " + msg + "</b>");
            delete sessions[sid][user];
        });

        bot.on('error', (err) => {
            let errorMsg = err.message;
            if (errorMsg.includes("unsupported minecraft version")) {
                errorMsg = "BU SÜRÜM MEVCUT DEĞİL VEYA DESTEKLENMİYOR!";
            }
            logs[key].push("<b style='color:#e74c3c'>HATA: " + errorMsg + "</b>");
            delete sessions[sid][user];
        });

        bot.on('message', (m) => {
            logs[key].push(m.toHTML());
            if(logs[key].length > 50) logs[key].shift();
        });

    } catch (e) {
        logs[key].push("<b style='color:red'>Sistem Hatası: " + e.message + "</b>");
    }
}

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
        if (q.type === 'msg' && q.status === 'on') {
            configs[key].msgT = setInterval(() => b.chat(decodeURIComponent(q.val)), q.sec * 1000);
        }
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
