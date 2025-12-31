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
    logs[key] = ["<b style='color:gray'>[SİSTEM] Bot başlatılıyor...</b>"];

    const bot = mineflayer.createBot({
        host: ip, port: parseInt(port) || 25565, 
        username: user, version: ver, auth: 'offline'
    });

    sessions[sid][user] = bot;
    configs[key] = { mining: null, jump: null, rclick: null, automsg: null };

    bot.on('login', () => logs[key].push("<b style='color:#2ecc71'>[GİRİŞ] Başarılı!</b>"));
    bot.on('kicked', (r) => logs[key].push("<b style='color:#ff4757'>[ATILDI] " + r + "</b>"));
    bot.on('end', () => { logs[key].push("<b style='color:#f39c12'>[BAĞLANTI KESİLDİ]</b>"); delete sessions[sid][user]; });
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
        const ms = parseFloat(q.sec) * 1000 || 1000;

        // YÖN
        if (q.type === 'look') {
            if (q.dir === 'left') bot.look(bot.entity.yaw + Math.PI/2, bot.entity.pitch, true);
            if (q.dir === 'right') bot.look(bot.entity.yaw - Math.PI/2, bot.entity.pitch, true);
            if (q.dir === 'up') bot.look(bot.entity.yaw, Math.PI/2, true);
            if (q.dir === 'down') bot.look(bot.entity.yaw, -Math.PI/2, true);
            if (q.dir === 'front') bot.look(bot.entity.yaw, 0, true);
        }

        // SOL TIK (KAZMA) SÜRELİ
        if (q.type === 'mining') {
            clearInterval(conf.mining);
            if (q.status === 'on') {
                conf.mining = setInterval(() => {
                    const block = bot.blockAtCursor(4);
                    bot.swingArm('right');
                    if (block && block.name !== 'air') bot.dig(block, 'ignore').catch(() => {});
                }, ms);
            }
        }

        // SAĞ TIK SÜRELİ
        if (q.type === 'rclick') {
            clearInterval(conf.rclick);
            if (q.status === 'on') {
                conf.rclick = setInterval(() => {
                    const block = bot.blockAtCursor(4);
                    bot.swingArm('right');
                    if (block) bot.activateBlock(block).catch(() => {});
                    bot.activateItem(); 
                }, ms);
            }
        }

        // OTO MESAJ
        if (q.type === 'automsg') {
            clearInterval(conf.automsg);
            if (q.status === 'on') {
                const text = decodeURIComponent(q.msg);
                conf.automsg = setInterval(() => bot.chat(text), ms);
            }
        }

        // ZIPLAMA
        if (q.type === 'jump') {
            clearInterval(conf.jump);
            if (q.status === 'on') {
                conf.jump = setInterval(() => {
                    bot.setControlState('jump', true);
                    setTimeout(() => bot.setControlState('jump', false), 200);
                }, ms);
            }
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
