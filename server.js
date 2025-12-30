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
    const parts = host.split(':');
    const ip = parts[0];
    const port = parts[1] ? parseInt(parts[1]) : 25565;

    const bot = mineflayer.createBot({
        host: ip, port: port, username: user, version: ver, auth: 'offline'
    });

    sessions[sid][user] = bot;
    logs[key] = ["Bağlantı başlatıldı..."];
    configs[key] = { msgT: null, clickT: null, mining: false, creds: { host, user, ver } };

    bot.on('login', () => logs[key].push("<b style='color:#2ecc71'>GİRİŞ YAPILDI!</b>"));
    bot.on('spawn', () => logs[key].push("<b style='color:#2ecc71'>BOT DOĞDU!</b>"));
    
    bot.on('message', (m) => {
        logs[key].push(m.toHTML());
        if(logs[key].length > 40) logs[key].shift();
    });

    bot.on('error', (err) => logs[key].push("<b style='color:red'>HATA: " + err.message + "</b>"));
    
    bot.on('end', () => {
        if (sessions[sid] && sessions[sid][user]) {
            logs[key].push("<b style='color:orange'>Koptu, 15sn sonra tekrar...</b>");
            setTimeout(() => startBot(sid, host, user, ver), 15000);
        }
    });
}

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

    if (p === '/update' && sid) {
        const key = sid + "_" + q.user;
        const b = sessions[sid] ? sessions[sid][q.user] : null;
        const c = configs[key];
        if (!b || !c) return res.end("error");

        clearInterval(c.msgT);
        clearInterval(c.clickT);

        if (q.type === 'msg' && q.status === 'on') {
            c.msgT = setInterval(() => b.chat(q.val), q.sec * 1000);
        } 
        else if (q.type === 'click' && q.status === 'on') {
            c.clickT = setInterval(() => {
                b.activateItem(); 
                const block = b.blockAtCursor(4);
                if (block) b.activateBlock(block).catch(()=>{});
            }, q.sec * 1000);
        }
        else if (q.type === 'mining') {
            c.mining = (q.status === 'on');
            if (c.mining) {
                const dig = async () => {
                    if (!configs[key]?.mining || !sessions[sid][q.user]) return;
                    const target = sessions[sid][q.user].blockAtCursor(4);
                    if (target && target.type !== 0) {
                        try {
                            await sessions[sid][q.user].lookAt(target.position, true);
                            await sessions[sid][q.user].dig(target, true);
                        } catch(e) {}
                    }
                    setTimeout(dig, 300);
                };
                dig();
            }
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

    if (p === '/send' && sid) {
        if (sessions[sid]?.[q.user]) sessions[sid][q.user].chat(q.msg);
        return res.end("ok");
    }

    let f = path.join(__dirname, p === '/' ? 'index.html' : p);
    fs.readFile(f, (err, data) => res.end(data));
}).listen(process.env.PORT || 10000);
                  
