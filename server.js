const mineflayer = require('mineflayer');
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const Vec3 = require('vec3');

let sessions = {}; 
let logs = {}; 
let configs = {}; 

function startBot(sid, host, user, ver) {
    if (!sessions[sid]) sessions[sid] = {};
    if (sessions[sid][user]) return;

    const key = sid + "_" + user;
    const [ip, port] = host.split(':');
    logs[key] = ["<b style='color:gray'>[SİSTEM] Bot başlatılıyor...</b>"];

    const bot = mineflayer.createBot({
        host: ip, port: parseInt(port) || 25565, 
        username: user, version: ver, auth: 'offline'
    });

    sessions[sid][user] = bot;
    configs[key] = { mining: false, jump: null, rclick: null };

    bot.on('login', () => logs[key].push("<b style='color:#2ecc71'>[GİRİŞ] Başarılı!</b>"));
    bot.on('kicked', (r) => logs[key].push("<b style='color:#ff4757'>[ATILDI] " + r + "</b>"));
    bot.on('end', () => { 
        logs[key].push("<b style='color:#f39c12'>[BAĞLANTI KESİLDİ]</b>"); 
        delete sessions[sid][user]; 
    });
    bot.on('error', (e) => logs[key].push("<b style='color:#ff4757'>[HATA] " + e.message + "</b>"));

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

        // YÖN DEĞİŞTİRME - KESİN ÇÖZÜM (lookAt ve Koordinat Hesaplama)
        if (q.type === 'look') {
            const pos = bot.entity.position;
            if (q.dir === 'left') bot.look(bot.entity.yaw + Math.PI / 2, bot.entity.pitch, true);
            if (q.dir === 'right') bot.look(bot.entity.yaw - Math.PI / 2, bot.entity.pitch, true);
            if (q.dir === 'up') bot.look(bot.entity.yaw, Math.PI / 2, true);
            if (q.dir === 'down') bot.look(bot.entity.yaw, -Math.PI / 2, true);
            if (q.dir === 'front') bot.look(bot.entity.yaw, 0, true);
        }

        // AKILLI KAZMA (WAIT UNTIL BROKEN)
        if (q.type === 'mining') {
            if (q.status === 'on') {
                if (conf.mining) return res.end("ok");
                conf.mining = true;
                const mineLoop = async () => {
                    while(conf.mining && sessions[sid]?.[q.user]) {
                        const block = bot.blockAtCursor(4);
                        if (block && block.name !== 'air') {
                            try {
                                await bot.dig(block, true); // true: kazarken başka yere bakma
                            } catch (e) { await new Promise(r => setTimeout(r, 100)); }
                        } else {
                            await new Promise(r => setTimeout(r, 200));
                        }
                    }
                };
                mineLoop();
            } else {
                conf.mining = false;
                bot.stopDigging();
            }
        }

        // ZIPLAMA & SAĞ TIK
        const sec = parseInt(q.sec) * 1000 || 1000;
        if (q.type === 'jump') {
            clearInterval(conf.jump);
            if (q.status === 'on') conf.jump = setInterval(() => { bot.setControlState('jump', true); setTimeout(() => bot.setControlState('jump', false), 400); }, sec);
        }
        if (q.type === 'rclick') {
            clearInterval(conf.rclick);
            if (q.status === 'on') conf.rclick = setInterval(() => bot.activateItem(), sec);
        }

        if (q.type === 'drop' && bot.heldItem) bot.tossStack(bot.heldItem);
        
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
