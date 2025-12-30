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
    
    logs[key] = ["Bağlantı kuruluyor..."];

    const bot = mineflayer.createBot({
        host: parts[0], 
        port: parseInt(parts[1]) || 25565, 
        username: user, 
        version: ver, 
        auth: 'offline'
    });

    sessions[sid][user] = bot;
    configs[key] = { msgT: null, clickT: null, mining: false };

    const getKickReason = (reason) => {
        if (!reason) return "Bilinmeyen sebep";
        if (typeof reason === 'string') return reason;
        try {
            if (reason.extra) return reason.extra.map(e => e.text || "").join("");
            if (reason.text) return reason.text;
        } catch (e) { return JSON.stringify(reason); }
        return JSON.stringify(reason);
    };

    bot.on('login', () => logs[key].push("<b style='color:#2ecc71'>GİRİŞ YAPILDI!</b>"));
    bot.on('kicked', (r) => { logs[key].push("<b style='color:#e74c3c'>ATILDI: " + getKickReason(r) + "</b>"); delete sessions[sid][user]; });
    bot.on('error', (e) => { logs[key].push("<b style='color:#e74c3c'>HATA: " + e.message + "</b>"); delete sessions[sid][user]; });
    bot.on('end', () => { if (sessions[sid]?.[user]) { logs[key].push("<b style='color:gray'>BAĞLANTI KESİLDİ.</b>"); delete sessions[sid][user]; } });

    bot.on('message', (m) => {
        logs[key].push(m.toHTML());
        if(logs[key].length > 40) logs[key].shift();
    });
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
    if (p === '/stop' && sid) { if (sessions[sid]?.[q.user]) { sessions[sid][q.user].quit(); delete sessions[sid][q.user]; } return res.end("ok"); }

    if (p === '/update' && sid) {
        const key = sid + "_" + q.user;
        const b = sessions[sid]?.[q.user];
        const c = configs[key];
        if (!b || !c) return res.end("offline");
        clearInterval(c.msgT); clearInterval(c.clickT);
        if (q.type === 'msg' && q.status === 'on') c.msgT = setInterval(() => b.chat(q.val), q.sec * 1000);
        else if (q.type === 'click' && q.status === 'on') {
            c.clickT = setInterval(() => { b.activateItem(); const bl = b.blockAtCursor(4); if (bl) b.activateBlock(bl).catch(()=>{}); }, q.sec * 1000);
        }
        else if (q.type === 'mining' && q.status === 'on') {
            c.mining = true;
            const dig = async () => {
                if (!configs[key]?.mining || !sessions[sid]?.[q.user]) return;
                const t = sessions[sid][q.user].blockAtCursor(4);
                if (t && t.type !== 0) { try { await sessions[sid][q.user].lookAt(t.position, true); await sessions[sid][q.user].dig(t, true); } catch(e) {} }
                setTimeout(dig, 500);
            }; dig();
        } else if (q.type === 'mining' && q.status === 'off') { c.mining = false; }
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
