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

    // Mineflayer otomatik olarak sürüme uygun protokolü seçecektir
    const bot = mineflayer.createBot({ host, username: user, version: ver, auth: 'offline' });
    sessions[sid][user] = bot;
    
    const key = sid + "_" + user;
    logs[key] = ["Bağlanıyor..."];
    configs[key] = { msgT: null, clickT: null, mining: false, creds: { host, user, ver } };

    bot.on('message', (m) => {
        if(!logs[key]) logs[key] = [];
        logs[key].push(m.toHTML());
        if(logs[key].length > 40) logs[key].shift();
    });

    bot.on('spawn', () => {
        logs[key].push("<b style='color:#2ecc71'>Bot doğdu! Aktif sürüm: " + bot.version + "</b>");
    });

    bot.on('end', () => {
        const c = configs[key].creds;
        delete sessions[sid][user];
        logs[key].push("<b style='color:orange'>Bağlantı koptu, 15sn sonra tekrar...</b>");
        setTimeout(() => startBot(sid, c.host, c.user, c.ver), 15000);
    });

    bot.on('error', (err) => {
        logs[key].push("<b style='color:red'>Hata: " + err.message + "</b>");
    });
}

http.createServer((req, res) => {
    const q = url.parse(req.url, true).query;
    const p = url.parse(req.url, true).pathname;
    const sid = q.sid;

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

        if (q.type === 'msg') {
            clearInterval(c.msgT);
            if (q.status === 'on') c.msgT = setInterval(() => b.chat(q.val), q.sec * 1000);
        } 
        else if (q.type === 'click') {
            clearInterval(c.clickT);
            if (q.status === 'on') c.clickT = setInterval(() => b.activateItem(), q.sec * 1000);
        }
        else if (q.type === 'mining') {
            c.mining = (q.status === 'on');
            if (c.mining) {
                const dig = async () => {
                    if (!configs[key] || !configs[key].mining || !sessions[sid][q.user]) return;
                    const target = sessions[sid][q.user].blockAtCursor(4);
                    if (target && target.type !== 0) { // Hava (0) değilse kaz
                        try { await sessions[sid][q.user].dig(target, true); } catch(e) {}
                    }
                    setTimeout(dig, 250);
                };
                dig();
            }
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
    fs.readFile(f, (err, data) => res.end(data));
}).listen(process.env.PORT || 10000);
