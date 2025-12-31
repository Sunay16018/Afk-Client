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
    const bot = mineflayer.createBot({
        host: ip, port: parseInt(port) || 25565, 
        username: user, version: ver || '1.16.5', auth: 'offline'
    });
    sessions[sid][user] = bot;
    configs[key] = { mining: null, automsg: null };
    logs[key] = ["<b style='color:gray'>[SİSTEM] Bot başlatıldı.</b>"];
    bot.on('login', () => logs[key].push("<b style='color:#2ecc71'>[GİRİŞ] Başarılı!</b>"));
    bot.on('message', (m) => {
        logs[key].push(m.toHTML());
        if(logs[key].length > 50) logs[key].shift();
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
        if (q.type === 'mining') {
            const conf = configs[sid + "_" + q.user];
            clearInterval(conf.mining);
            if (q.status === 'on') {
                conf.mining = setInterval(() => {
                    const block = bot.blockAtCursor(4);
                    bot.swingArm('right');
                    if (block && block.name !== 'air') bot.dig(block, 'ignore').catch(()=>{});
                }, parseFloat(q.sec) * 1000);
            }
        }
        if (q.type === 'inv_action') {
            const item = bot.inventory.slots[parseInt(q.slot)];
            if (item) bot.tossStack(item);
        }
        return res.end("ok");
    }
    if (p === '/data' && sid) {
        const active = sessions[sid] ? Object.keys(sessions[sid]) : [];
        const botData = {};
        if (q.user && bot) {
            botData[q.user] = {
                logs: logs[sid + "_" + q.user] || [],
                health: bot.health,
                food: bot.food,
                inventory: bot.inventory.slots.map(s => s ? { name: s.name, count: s.count, slot: s.slot } : null)
            };
        }
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ active, botData }));
    }
    fs.readFile(path.join(__dirname, p === '/' ? 'index.html' : p), (err, data) => res.end(data));
}).listen(process.env.PORT || 10000);
