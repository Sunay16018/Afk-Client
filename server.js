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
    logs[key] = ["<b style='color:gray'>[SİSTEM] Bot hazırlanıyor...</b>"];

    const bot = mineflayer.createBot({
        host: ip, port: parseInt(port) || 25565, 
        username: user, version: ver, auth: 'offline'
    });

    sessions[sid][user] = bot;
    configs[key] = { mining: false, antiAfk: false };

    bot.on('login', () => logs[key].push("<b style='color:#2ecc71'>[GİRİŞ] Başarılı!</b>"));
    bot.on('kicked', (r) => { delete sessions[sid][user]; logs[key].push("<b style='color:#f44'>[ATILDI] Bağlantı kesildi.</b>"); });
    bot.on('error', (e) => logs[key].push("<b style='color:#f44'>[HATA] " + e.message + "</b>"));

    bot.on('message', (m) => {
        logs[key].push(m.toHTML());
        if(logs[key].length > 40) logs[key].shift();
    });
}

http.createServer((req, res) => {
    const q = url.parse(req.url, true).query;
    const p = url.parse(req.url, true).pathname;
    const sid = q.sid;
    const bot = sessions[sid]?.[q.user];

    if (p === '/start' && sid) { startBot(sid, q.host, q.user, q.ver); return res.end("ok"); }
    if (p === '/stop' && bot) { bot.quit(); delete sessions[sid][q.user]; return res.end("ok"); }
    if (p === '/send' && bot) { bot.chat(decodeURIComponent(q.msg)); return res.end("ok"); }

    if (p === '/update' && bot) {
        const key = sid + "_" + q.user;
        const conf = configs[key];

        // 90 DERECE NET DÖNÜŞ SİSTEMİ
        if (q.type === 'look') {
            let yaw = bot.entity.yaw;
            let pitch = bot.entity.pitch;
            if (q.dir === 'left') yaw += Math.PI / 2;    // +90 Derece
            if (q.dir === 'right') yaw -= Math.PI / 2;   // -90 Derece
            if (q.dir === 'up') pitch = Math.PI / 2;     // Tam Yukarı
            if (q.dir === 'down') pitch = -Math.PI / 2;  // Tam Aşağı
            if (q.dir === 'front') pitch = 0;            // Karşıya Bak
            bot.look(yaw, pitch, true);
        }

        // ENVANTER VE EŞYA
        if (q.type === 'drop') {
            if (bot.heldItem) bot.tossStack(bot.heldItem);
        }

        // GELİŞMİŞ OTO-KAZMA (Blok Algılamalı)
        if (q.type === 'mining') {
            if (q.status === 'on') {
                conf.mining = true;
                const mineLoop = async () => {
                    if (!conf.mining || !sessions[sid]?.[q.user]) return;
                    // Baktığı yerdeki bloğu bul
                    const block = bot.blockAtCursor(4); 
                    if (block && block.type !== 0 && block.name !== 'air') {
                        try {
                            await bot.dig(block); 
                        } catch (err) {}
                    }
                    setTimeout(mineLoop, 200);
                };
                mineLoop();
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
