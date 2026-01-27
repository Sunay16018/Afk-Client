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

function startBot(sid, host, user, ver, autoJoinCmds = []) {
    const s = getSession(sid);
    if (s.bots[user]) return;

    const [ip, port] = host.split(':');
    s.logs[user] = ["<b style='color:gray'>[SİSTEM] Bağlantı kuruluyor...</b>"];

    const bot = mineflayer.createBot({
        host: ip, port: parseInt(port) || 25565, 
        username: user, version: ver, auth: 'offline'
    });

    s.bots[user] = bot;
    if(!s.configs[user]) {
        s.configs[user] = { msgT: null, afkT: null, mineT: null, autoReconnect: false, loginCmds: [] };
    }

    bot.on('login', () => {
        s.logs[user].push("<b style='color:#2ecc71'>[GİRİŞ] " + user + " başarıyla bağlandı!</b>");
        
        // Giriş Komutlarını Çalıştır
        if (s.configs[user].loginCmds.length > 0) {
            s.configs[user].loginCmds.forEach(cmdObj => {
                setTimeout(() => {
                    if(s.bots[user]) s.bots[user].chat(cmdObj.cmd);
                }, cmdObj.delay * 1000);
            });
        }
    });
    
    bot.on('message', (m) => {
        // Oyun içi renkleri ve formatı koruyarak HTML'e çevirir
        s.logs[user].push(m.toHTML());
        if(s.logs[user].length > 150) s.logs[user].shift();
    });

    bot.on('end', (reason) => {
        s.logs[user].push(`<b style='color:#ff4757'>[AYRILDI] Bağlantı kesildi: ${reason}</b>`);
        delete s.bots[user];
        
        // Otomatik Yeniden Bağlanma
        if (s.configs[user].autoReconnect) {
            s.logs[user].push("<b style='color:#e67e22'>[SİSTEM] 5 saniye içinde otomatik yeniden bağlanılıyor...</b>");
            setTimeout(() => startBot(sid, host, user, ver), 5000);
        }
    });

    bot.on('kicked', (reason) => {
        const kickMsg = JSON.parse(reason).text || reason;
        s.logs[user].push(`<b style='color:#ff4757'>[ATILDI] Sebep: ${kickMsg}</b>`);
    });

    bot.on('error', (e) => { 
        s.logs[user].push("<b style='color:#ff4757'>[HATA] " + e.message + "</b>"); 
    });
}

const server = http.createServer((req, res) => {
    const q = url.parse(req.url, true).query;
    const p = url.parse(req.url, true).pathname;
    const sid = q.sid;
    
    if (p === '/' || p === '/index.html') {
        return fs.readFile(path.join(__dirname, 'index.html'), (err, data) => res.end(data));
    }

    if (!sid) return res.end("No SID");
    const s = getSession(sid);
    const bot = s.bots[q.user];

    if (p === '/start') { startBot(sid, q.host, q.user, q.ver); return res.end("ok"); }
    if (p === '/stop' && bot) { bot.quit(); return res.end("ok"); }
    if (p === '/send' && bot) { bot.chat(decodeURIComponent(q.msg)); return res.end("ok"); }
    
    if (p === '/update') {
        const conf = s.configs[q.user];
        if (q.type === 'reconnect') {
            conf.autoReconnect = q.val === 'true';
        } else if (q.type === 'loginCmds') {
            conf.loginCmds = JSON.parse(decodeURIComponent(q.val));
        } else if (bot) {
            if (q.type === 'msg') {
                if (conf.msgT) { clearInterval(conf.msgT); conf.msgT = null; }
                else { conf.msgT = setInterval(() => bot.chat(decodeURIComponent(q.val)), parseInt(q.sec) * 1000); }
            } else if (q.type === 'afk') {
                if (conf.afkT) { clearInterval(conf.afkT); conf.afkT = null; }
                else { conf.afkT = setInterval(() => { bot.setControlState('jump', true); setTimeout(() => bot.setControlState('jump', false), 500); }, 10000); }
            } else if (q.type === 'mine') {
                if (conf.mineT) { clearInterval(conf.mineT); conf.mineT = null; }
                else {
                    conf.mineT = setInterval(async () => {
                        const block = bot.blockAtCursor(4);
                        if (block && block.type !== 0) { try { await bot.dig(block); } catch(e) {} }
                    }, 1000);
                }
            }
        }
        return res.end("ok");
    }

    if (p === '/data') {
        const active = Object.keys(s.bots);
        const botData = {};
        if (q.user && s.bots[q.user]) {
            const b = s.bots[q.user];
            botData[q.user] = {
                hp: b.health || 0,
                food: b.food || 0,
                inv: b.inventory.slots.map((i, idx) => i ? { name: i.name, count: i.count, slot: idx } : null).filter(x => x !== null)
            };
        }
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ active, logs: s.logs, botData, configs: s.configs }));
    }
});

server.listen(process.env.PORT || 10000);
