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
        checkTimeoutInterval: 60000
    });

    sessions[sid][user] = bot;
    configs[key] = { msgT: null };

    // --- KRİTİK MESAJ İŞLEYİCİ ---
    const parseReason = (reason) => {
        if (!reason) return "Bilinmeyen bir sebeple bağlantı kesildi.";
        if (typeof reason === 'string') return reason;
        
        // Minecraft'ın JSON formatındaki mesajlarını (extra/text) düz metne çevirir
        try {
            if (reason.extra) return reason.extra.map(e => e.text || "").join("");
            if (reason.text) return reason.text;
            if (reason.translate) return reason.translate;
        } catch (e) {
            return "Hata kodu çözülemedi: " + JSON.stringify(reason);
        }
        return JSON.stringify(reason);
    };

    bot.on('login', () => {
        logs[key].push("<b style='color:#2ecc71'>[SİSTEM] Sunucuya giriş başarılı!</b>");
    });

    bot.on('kicked', (reason) => {
        const cleanMessage = parseReason(reason);
        logs[key].push("<b style='color:#ff4757'>[ATILDI] " + cleanMessage + "</b>");
        delete sessions[sid][user];
    });

    bot.on('error', (err) => {
        let errorMsg = err.message;
        if (errorMsg.includes("unsupported minecraft version")) errorMsg = "Sürüm hatalı veya desteklenmiyor!";
        logs[key].push("<b style='color:#ff4757'>[HATA] " + errorMsg + "</b>");
        delete sessions[sid][user];
    });

    bot.on('end', () => {
        // Eğer bot listeden silinmemişse ama kapandıysa bilgilendir
        if (sessions[sid]?.[user]) {
            logs[key].push("<b style='color:#ffa502'>[BİLGİ] Botun sunucuyla bağlantısı kesildi.</b>");
            delete sessions[sid][user];
        }
    });

    bot.on('message', (m) => {
        logs[key].push(m.toHTML());
        if(logs[key].length > 50) logs[key].shift();
    });
}

// HTTP API
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
    
