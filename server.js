const mineflayer = require('mineflayer');
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

// Hafıza Yönetimi
let sessions = {}; // Her tarayıcı kimliği (sid) için bot listesi
let logs = {}; // sid + botNick şeklinde log saklama
let configs = {}; // sid + botNick şeklinde özellik ayarları

// Bot Oluşturma Fonksiyonu
function startBot(sid, host, user, ver) {
    if (!sessions[sid]) sessions[sid] = {};
    if (sessions[sid][user]) return;

    const bot = mineflayer.createBot({ host, username: user, version: ver, auth: 'offline' });
    sessions[sid][user] = bot;
    
    const key = sid + "_" + user;
    logs[key] = ["Bağlanıyor..."];
    configs[key] = { msgT: null, clickT: null, breakT: null, creds: { host, user, ver } };

    bot.on('message', (m) => {
        if(!logs[key]) logs[key] = [];
        logs[key].push(m.toHTML());
        if(logs[key].length > 40) logs[key].shift();
    });

    bot.on('end', () => {
        const c = configs[key].creds;
        delete sessions[sid][user];
        logs[key].push("<b style='color:orange'>Koptu, 15sn sonra tekrar girecek...</b>");
        // Auto-Reconnect: 7/24 için kritik
        setTimeout(() => startBot(sid, c.host, c.user, c.ver), 15000);
    });
}

http.createServer((req, res) => {
    const q = url.parse(req.url, true).query;
    const p = url.parse(req.url, true).pathname;
    const sid = q.sid; // Tarayıcı Kimliği

    if (p === '/ping') return res.end("pong");

    if (p === '/start' && sid) {
        startBot(sid, q.host, q.user, q.ver);
        return res.end("ok");
    }

    if (p === '/update' && sid) {
        const key = sid + "_" + q.user;
        const b = sessions[sid] ? sessions[sid][q.user] : null;
        const c = configs[key];
        if (!b || !c) return res.end("error");

        if (q.type === 'msg') clearInterval(c.msgT);
        if (q.type === 'click') clearInterval(c.clickT);
        if (q.type === 'break') clearInterval(c.breakT);

        if (q.status === 'on') {
            if (q.type === 'msg') c.msgT = setInterval(() => b.chat(q.val), q.sec * 1000);
            if (q.type === 'click') c.clickT = setInterval(() => b.activateItem(), q.sec * 1000);
            if (q.type === 'break') c.breakT = setInterval(() => { 
                const bl = b.blockAtCursor(4); if(bl) b.dig(bl, true).catch(()=>{}); 
            }, 500);
        }
        return res.end("ok");
    }

    if (p === '/data' && sid) {
        const active = sessions[sid] ? Object.keys(sessions[sid]) : [];
        const sLogs = {};
        active.forEach(u => { sLogs[u] = logs[sid + "_" + u]; });
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ active, logs: sLogs }));
    }

    if (p === '/send' && sid) {
        if (sessions[sid] && sessions[sid][q.user]) sessions[sid][q.user].chat(q.msg);
        return res.end("ok");
    }

    let f = path.join(__dirname, p === '/' ? 'index.html' : p);
    fs.readFile(f, (err, data) => { res.end(data); });
}).listen(process.env.PORT || 10000);
