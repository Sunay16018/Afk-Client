const mineflayer = require('mineflayer');
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

let userSessions = {}; 

function getSession(sid) {
    if (!userSessions[sid]) userSessions[sid] = { bots: {}, logs: {}, configs: {} };
    return userSessions[sid];
}

function startBot(sid, host, user, ver) {
    const s = getSession(sid);
    if (s.bots[user]) return;

    const [ip, port] = host.split(':');
    s.logs[user] = ["<b style='color:gray'>[SİSTEM] Başlatılıyor...</b>"];
    
    // Ayarların kalıcı olması için default değerler
    if (!s.configs[user]) {
        s.configs[user] = { afk: false, reconnect: true, mining: false, cmds: [] };
    }

    const bot = mineflayer.createBot({
        host: ip, port: parseInt(port) || 25565, 
        username: user, version: ver, auth: 'offline',
        checkTimeoutInterval: 30000
    });

    s.bots[user] = bot;

    bot.on('login', () => {
        s.logs[user].push("<b style='color:#2ecc71'>[GİRİŞ] " + user + " bağlandı!</b>");
        // Kayıtlı komutları sırayla gönder
        s.configs[user].cmds.forEach((c, i) => setTimeout(() => bot.chat(c), 3000 * (i + 1)));
    });

    bot.on('message', (m) => {
        s.logs[user].push(m.toHTML());
        if(s.logs[user].length > 50) s.logs[user].shift(); // Render çökmemesi için logu kısa tut
    });

    // Akıllı Kazma (Tick bazlı değil, daha hafif)
    setInterval(() => {
        if (s.configs[user] && s.configs[user].mining && bot.entity) {
            const b = bot.blockAtCursor(4);
            if (b) bot.dig(b, true, () => {});
        }
    }, 1000);

    bot.on('end', (reason) => {
        s.logs[user].push(`<b style='color:#ff4757'>[AYRILDI] Durum: ${reason}</b>`);
        if (s.configs[user] && s.configs[user].reconnect) {
            setTimeout(() => startBot(sid, host, user, ver), 5000);
        }
    });

    bot.on('error', () => {}); // Çökmeyi engelle
}

const server = http.createServer((req, res) => {
    const q = url.parse(req.url, true).query;
    const p = url.parse(req.url, true).pathname;
    const sid = q.sid;
    if (p === '/') return fs.readFile(path.join(__dirname, 'index.html'), (err, data) => res.end(data));
    
    const s = getSession(sid);
    const bot = s.bots[q.user];

    if (p === '/start') { startBot(sid, q.host, q.user, q.ver); return res.end("ok"); }
    
    if (p === '/stop') { 
        if(s.configs[q.user]) s.configs[q.user].reconnect = false;
        if(bot) bot.quit();
        delete s.bots[q.user]; 
        return res.end("ok"); 
    }

    if (p === '/send' && bot) { bot.chat(decodeURIComponent(q.msg)); return res.end("ok"); }
    
    if (p === '/move' && bot) {
        bot.setControlState(q.dir, q.state === 'true');
        if (q.dir === 'jump' && q.state === 'true') setTimeout(() => bot.setControlState('jump', false), 500);
        return res.end("ok");
    }

    if (p === '/update') {
        const conf = s.configs[q.user];
        if (q.type === 'cmd') conf.cmds.push(decodeURIComponent(q.val));
        else if (q.type === 'inv' && bot) {
            const item = bot.inventory.slots[q.val];
            if (item) bot.tossStack(item);
        } else if (conf) {
            conf[q.type] = !conf[q.type];
        }
        return res.end("ok");
    }

    if (p === '/data') {
        const botData = {};
        if (q.user && s.bots[q.user]) {
            const b = s.bots[q.user];
            botData[q.user] = {
                hp: b.health || 0,
                pos: b.entity ? b.entity.position : {x:0, y:0, z:0},
                inv: b.inventory.slots.map((i, idx) => i ? { name: i.name, slot: idx } : null).filter(x => x)
            };
        }
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ active: Object.keys(s.bots), logs: s.logs, botData, configs: s.configs }));
    }
});
server.listen(process.env.PORT || 10000);
