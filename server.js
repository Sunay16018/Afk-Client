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
    logs[key] = ["Bağlantı deneniyor: " + host];

    // IP ve Port Ayırma
    const parts = host.split(':');
    const ip = parts[0];
    const port = parts[1] ? parseInt(parts[1]) : 25565;

    try {
        const bot = mineflayer.createBot({
            host: ip,
            port: port,
            username: user,
            version: ver,
            auth: 'offline',
            hideErrors: false // Hataları gizleme ki görelim
        });

        sessions[sid][user] = bot;
        configs[key] = { msgT: null, clickT: null, mining: false, creds: { host, user, ver } };

        bot.on('login', () => logs[key].push("<b style='color:#2ecc71'>BAŞARILI: Sunucuya girildi!</b>"));
        bot.on('spawn', () => logs[key].push("<b style='color:#2ecc71'>BOT DOĞDU: Komut bekliyor.</b>"));
        
        bot.on('error', (err) => {
            logs[key].push("<b style='color:red'>HATA: " + err.message + "</b>");
            console.error(err);
        });

        bot.on('kicked', (reason) => {
            logs[key].push("<b style='color:red'>ATILDI: " + reason + "</b>");
        });

        bot.on('end', () => {
            if (sessions[sid] && sessions[sid][user]) {
                logs[key].push("<b style='color:orange'>Bağlantı bitti. 15sn sonra tekrar...</b>");
                setTimeout(() => startBot(sid, host, user, ver), 15000);
            }
        });

        // Sohbet Logları
        bot.on('message', (m) => {
            logs[key].push(m.toHTML());
            if(logs[key].length > 50) logs[key].shift();
        });

    } catch (e) {
        logs[key].push("<b style='color:red'>KRİTİK HATA: " + e.message + "</b>");
    }
}

// HTTP Server
http.createServer((req, res) => {
    const q = url.parse(req.url, true).query;
    const p = url.parse(req.url, true).pathname;
    const sid = q.sid;

    if (p === '/start' && sid) {
        startBot(sid, q.host, q.user, q.ver);
        return res.end("ok");
    }

    if (p === '/stop' && sid) {
        if (sessions[sid] && sessions[sid][q.user]) {
            sessions[sid][q.user].quit();
            delete sessions[sid][q.user];
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

    // Dosyaları oku (index.html vb.)
    let f = path.join(__dirname, p === '/' ? 'index.html' : p);
    fs.readFile(f, (err, data) => res.end(data));

}).listen(process.env.PORT || 10000);
