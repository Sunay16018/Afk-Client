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
    if(!s.logs[user]) s.logs[user] = [];
    s.logs[user].push("<b style='color:gray'>[SİSTEM] Bağlantı başlatılıyor...</b>");
    
    // Eksik konfigürasyonları başlat
    if (!s.configs[user]) {
        s.configs[user] = { 
            afk: false, reconnect: true, mining: false,
            loginCmds: [], msgInterval: null, afkInterval: null 
        };
    }

    const bot = mineflayer.createBot({
        host: ip, port: parseInt(port) || 25565, 
        username: user, version: ver, auth: 'offline',
        checkTimeoutInterval: 60 * 1000
    });

    s.bots[user] = bot;

    bot.on('login', () => {
        s.logs[user].push("<b style='color:#2ecc71'>[GİRİŞ] Sunucuya bağlanıldı.</b>");
        // Otomatik komutları çalıştır
        s.configs[user].loginCmds.forEach(cmd => {
            setTimeout(() => bot.chat(cmd), 2000);
        });
        if (s.configs[user].afk) startAfkLoop(sid, user);
    });

    // KONSOL İÇİN HER ŞEYİ YAKALA (Oyuncu isimleri dahil)
    bot.on('message', (jsonMsg) => {
        const htmlMsg = jsonMsg.toHTML();
        s.logs[user].push(htmlMsg);
        if(s.logs[user].length > 150) s.logs[user].shift();
    });

    // AKILLI KAZMA SİSTEMİ
    bot.on('physicTick', () => {
        if (s.configs[user].mining) {
            const block = bot.blockAtCursor(4);
            if (block) {
                bot.dig(block, "ignore", (err) => {});
            }
        }
    });

    bot.on('end', (reason) => {
        s.logs[user].push(`<b style='color:#ff4757'>[AYRILDI] Bağlantı kesildi: ${reason}</b>`);
        if (s.configs[user].reconnect) {
            setTimeout(() => startBot(sid, host, user, ver), 5000);
        }
    });

    bot.on('error', (e) => s.logs[user].push("<b style='color:#ff4757'>[HATA] " + e.message + "</b>"));
}

function startAfkLoop(sid, user) {
    const s = getSession(sid);
    if (s.configs[user].afkInterval) clearInterval(s.configs[user].afkInterval);
    s.configs[user].afkInterval = setInterval(() => {
        if (s.bots[user]) {
            s.bots[user].setControlState('jump', true);
            setTimeout(() => s.bots[user] && s.bots[user].setControlState('jump', false), 500);
        }
    }, 10000);
}

const server = http.createServer((req, res) => {
    const q = url.parse(req.url, true).query;
    const p = url.parse(req.url, true).pathname;
    const sid = q.sid;
    if (p === '/') return fs.readFile(path.join(__dirname, 'index.html'), (err, data) => res.end(data));
    if (!sid) return res.end("Error");

    const s = getSession(sid);
    const bot = s.bots[q.user];

    if (p === '/start') { startBot(sid, q.host, q.user, q.ver); return res.end("ok"); }
    if (p === '/stop' && bot) { s.configs[q.user].reconnect = false; bot.quit(); return res.end("ok"); }
    if (p === '/send' && bot) { bot.chat(decodeURIComponent(q.msg)); return res.end("ok"); }
    if (p === '/move' && bot) { bot.setControlState(q.dir, q.state === 'true'); return res.end("ok"); }

    if (p === '/update') {
        const conf = s.configs[q.user];
        if (q.type === 'cmd') {
            conf.loginCmds.push(decodeURIComponent(q.val));
        } else if (q.type === 'inv' && bot) {
            const item = bot.inventory.slots[q.val];
            if (item) bot.tossStack(item);
        } else {
            conf[q.type] = !conf[q.type];
            if (q.type === 'afk') {
                if (conf.afk) startAfkLoop(sid, q.user);
                else clearInterval(conf.afkInterval);
            }
        }
        return res.end("ok");
    }

    if (p === '/data') {
        const botData = {};
        if (q.user && s.bots[q.user]) {
            const b = s.bots[q.user];
            botData[q.user] = {
                hp: b.health || 0, food: b.food || 0,
                pos: b.entity ? b.entity.position : {x:0, y:0, z:0},
                inv: b.inventory.slots.map((i, idx) => i ? { name: i.name, count: i.count, slot: idx } : null).filter(x => x !== null)
            };
        }
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ active: Object.keys(s.bots), logs: s.logs, botData, configs: s.configs }));
    }
});
server.listen(process.env.PORT || 10000);
