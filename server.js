const mineflayer = require('mineflayer');
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

let sessions = {}; // Yapı: { "tarayici_id": { "bot_nick": bot_objesi } }
let logs = {}; 
let configs = {}; 

function startBot(sid, host, user, ver) {
    if (!sessions[sid]) sessions[sid] = {};
    if (sessions[sid][user]) return;

    const key = sid + "_" + user;
    const [ip, port] = host.split(':');
    logs[key] = ["<b style='color:gray'>Bağlantı isteği gönderildi...</b>"];

    const bot = mineflayer.createBot({
        host: ip, port: parseInt(port) || 25565, 
        username: user, version: ver, auth: 'offline'
    });

    sessions[sid][user] = bot;
    configs[key] = { msgT: null, afkT: null, mining: false };

    bot.on('login', () => logs[key].push("<b style='color:#2ecc71'>Bot oyuna girdi!</b>"));

    bot.on('kicked', (reason) => {
        logs[key].push("<b style='color:#ff4757'>Atıldı: Sunucu bağlantıyı kesti.</b>");
        delete sessions[sid][user];
    });

    bot.on('error', (err) => {
        logs[key].push("<b style='color:#ff4757'>Hata: " + err.message + "</b>");
        delete sessions[sid][user];
    });

    bot.on('end', () => {
        logs[key].push("<b style='color:#ffa502'>Bağlantı sonlandırıldı.</b>");
        delete sessions[sid][user];
    });

    bot.on('message', (m) => {
        logs[key].push(m.toHTML());
        if(logs[key].length > 40) logs[key].shift();
    });
}

http.createServer((req, res) => {
    const q = url.parse(req.url, true).query;
    const p = url.parse(req.url, true).pathname;
    const sid = q.sid; // Tarayıcıdan gelen özel kimlik
    const bot = sessions[sid]?.[q.user];

    if (p === '/start' && sid) { startBot(sid, q.host, q.user, q.ver); return res.end("ok"); }
    
    // ANINDA BAĞLANTIYI KES
    if (p === '/stop' && bot) {
        bot.quit();
        delete sessions[sid][q.user];
        return res.end("ok");
    }

    if (p === '/send' && bot) {
        bot.chat(decodeURIComponent(q.msg));
        return res.end("ok");
    }

    if (p === '/update' && bot) {
        const key = sid + "_" + q.user;
        const conf = configs[key];
        if (q.type === 'msg') {
            clearInterval(conf.msgT);
            if (q.status === 'on') conf.msgT = setInterval(() => bot.chat(decodeURIComponent(q.val)), q.sec * 1000);
        } else if (q.type === 'afk') {
            clearInterval(conf.afkT);
            if (q.status === 'on') {
                conf.afkT = setInterval(() => {
                    bot.look(Math.random() * 6, (Math.random() - 0.5));
                    bot.setControlState('jump', true);
                    setTimeout(() => bot.setControlState('jump', false), 400);
                }, 10000);
            }
        } else if (q.type === 'mining') {
            if (q.status === 'on') {
                conf.mining = true;
                const mine = async () => {
                    if (!conf.mining || !sessions[sid]?.[q.user]) return;
                    const bl = bot.blockAtCursor(4);
                    if (bl && bl.type !== 0) {
                        try { await bot.lookAt(bl.position); await bot.dig(bl); } catch(e) {}
                    }
                    setTimeout(mine, 300);
                }; mine();
            } else conf.mining = false;
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
                
