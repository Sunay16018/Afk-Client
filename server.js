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
        // Bağlantıyı stabil tutan ayarlar
        checkTimeoutInterval: 60000,
        physicsEnabled: true // Bazı sunucular hareket bekler
    });

    sessions[sid][user] = bot;
    configs[key] = { msgT: null, clickT: null, mining: false };

    bot.on('login', () => {
        logs[key].push("<b style='color:#2ecc71'>GİRİŞ YAPILDI!</b>");
    });

    bot.on('kicked', (reason) => {
        let msg = reason;
        try { if(reason.extra) msg = reason.extra.map(e => e.text).join(""); else if(reason.text) msg = reason.text; } catch(e){}
        logs[key].push("<b style='color:#e74c3c'>ATILDI: " + msg + "</b>");
        delete sessions[sid][user];
    });

    bot.on('error', (err) => {
        logs[key].push("<b style='color:#e74c3c'>HATA: " + err.message + "</b>");
        delete sessions[sid][user];
    });

    bot.on('end', () => {
        if (sessions[sid]?.[user]) {
            logs[key].push("<b style='color:gray'>BAĞLANTI KESİLDİ.</b>");
            delete sessions[sid][user];
        }
    });

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
        const b = sessions[sid]?.[q.user];
        if (b) { b.chat(decodeURIComponent(q.msg)); return res.end("ok"); }
        return res.end("error");
    }

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
            
