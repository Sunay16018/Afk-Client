const mineflayer = require('mineflayer');
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

let sessions = {}; 
let logs = {}; 

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
        hideErrors: true // Gereksiz hata mesajlarını gizle, botu yormasın
    });

    sessions[sid][user] = bot;

    bot.on('login', () => {
        logs[key].push("<b style='color:#2ecc71'>BAŞARIYLA GİRDİ!</b>");
    });

    // Sunucudan atılma sebebini en net şekilde oku
    bot.on('kicked', (reason) => {
        let msg = "Atıldı.";
        try {
            msg = typeof reason === 'string' ? reason : JSON.stringify(reason);
            if (reason.extra) msg = reason.extra.map(e => e.text).join("");
            else if (reason.text) msg = reason.text;
        } catch(e) {}
        logs[key].push("<b style='color:#e74c3c'>SUNUCU ATTI: " + msg + "</b>");
        delete sessions[sid][user];
    });

    bot.on('error', (err) => {
        logs[key].push("<b style='color:#e74c3c'>HATA: " + err.message + "</b>");
        delete sessions[sid][user];
    });

    bot.on('end', () => {
        if (sessions[sid]?.[user]) {
            logs[key].push("<b style='color:gray'>BAĞLANTI SONLANDI.</b>");
            delete sessions[sid][user];
        }
    });

    bot.on('message', (m) => {
        logs[key].push(m.toHTML());
        if(logs[key].length > 40) logs[key].shift();
    });
}

// HTTP İletişim Hattı
http.createServer((req, res) => {
    const q = url.parse(req.url, true).query;
    const p = url.parse(req.url, true).pathname;
    const sid = q.sid;

    if (p === '/start' && sid) { startBot(sid, q.host, q.user, q.ver); return res.end("ok"); }
    
    if (p === '/send' && sid) {
        if (sessions[sid]?.[q.user]) {
            sessions[sid][q.user].chat(decodeURIComponent(q.msg));
            return res.end("ok");
        }
        return res.end("error");
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
