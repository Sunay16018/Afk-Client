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
    const parts = host.split(':');
    
    logs[key] = ["Bağlantı kuruluyor..."];

    const bot = mineflayer.createBot({
        host: parts[0], 
        port: parseInt(parts[1]) || 25565, 
        username: user, 
        version: ver, 
        auth: 'offline',
        hideErrors: true 
    });

    sessions[sid][user] = bot;

    // SUNUCUDAN GELEN SEBEBİ OKUYAN ÖZEL FONKSİYON
    const getKickReason = (reason) => {
        if (!reason) return "Sebep belirtilmedi.";
        if (typeof reason === 'string') return reason;
        
        // Minecraft'ın karmaşık JSON formatını metne çevirir
        try {
            if (reason.extra) return reason.extra.map(e => e.text || "").join("");
            if (reason.text) return reason.text;
            if (reason.translate) return reason.translate;
        } catch (e) {
            return "Mesaj ayrıştırılamadı (Ham: " + JSON.stringify(reason) + ")";
        }
        return JSON.stringify(reason);
    };

    bot.on('login', () => {
        logs[key].push("<b style='color:#2ecc71'>GİRİŞ BAŞARILI!</b>");
    });

    bot.on('kicked', (reason) => {
        const readable = getKickReason(reason);
        logs[key].push("<b style='color:#e74c3c'>ATILDI: " + readable + "</b>");
        delete sessions[sid][user];
    });

    bot.on('error', (err) => {
        logs[key].push("<b style='color:#e74c3c'>HATA: " + err.message + "</b>");
        delete sessions[sid][user];
    });

    bot.on('end', () => {
        if (sessions[sid]?.[user]) {
            logs[key].push("<b style='color:#95a5a6'>BAĞLANTI KESİLDİ.</b>");
            delete sessions[sid][user];
        }
    });

    bot.on('message', (m) => {
        logs[key].push(m.toHTML());
        if(logs[key].length > 50) logs[key].shift();
    });
}

http.createServer((req, res) => {
    const q = url.parse(req.url, true).query;
    const p = url.parse(req.url, true).pathname;
    const sid = q.sid;

    if (p === '/send' && sid) {
        const bot = sessions[sid]?.[q.user];
        if (bot && bot.entity) { // Botun dünyada olduğundan emin ol
            bot.chat(decodeURIComponent(q.msg));
            return res.end("ok");
        }
        return res.end("error");
    }

    if (p === '/start' && sid) { startBot(sid, q.host, q.user, q.ver); return res.end("ok"); }

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
