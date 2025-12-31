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
        username: user, version: ver, auth: 'offline'
    });

    sessions[sid][user] = bot;
    configs[key] = { mining: null, jump: null, rclick: null, automsg: null };
    logs[key] = ["<b style='color:gray'>[SİSTEM] Başlatıldı.</b>"];

    bot.on('login', () => logs[key].push("<b style='color:#2ecc71'>[GİRİŞ] Başarılı!</b>"));
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

        if (q.type === 'look') {
            let yaw = bot.entity.yaw;
            if (q.dir === 'left') yaw += Math.PI/2;
            if (q.dir === 'right') yaw -= Math.PI/2;
            bot.look(yaw, q.dir==='up'?Math.PI/2:q.dir==='down'?-Math.PI/2:0, true);
        }

        if (q.type === 'mining') {
            clearInterval(conf.mining);
            if (q.status === 'on') {
                conf.mining = setInterval(() => {
                    const block = bot.blockAtCursor(4);
                    bot.swingArm('right');
                    if (block && block.name !== 'air') bot.dig(block, 'ignore').catch(()=>{});
                }, ms);
            }
        }

        if (q.type === 'automsg') {
            clearInterval(conf.automsg);
            if (q.status === 'on') {
                const text = decodeURIComponent(q.msg);
                // Botun chate yazması için zorlama
                conf.automsg = setInterval(() => { bot.chat(text); }, ms);
            }
        }

        // ENVANTER ETKİLEŞİMLERİ
        if (q.type === 'inv_action') {
            const slot = parseInt(q.slot);
            const item = bot.inventory.slots[slot];
            if (item) {
                if (q.act === 'drop_all') bot.tossStack(item);
                if (q.act === 'drop_one') bot.toss(item.type, null, 1);
                if (q.act === 'click_left') bot.clickWindow(slot, 0, 0);
                if (q.act === 'click_right') bot.clickWindow(slot, 1, 0);
            }
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
                pos: bot.entity.position,
                inventory: bot.inventory.slots.map(s => s ? { name: s.name, count: s.count, slot: s.slot } : null)
            };
        }
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ active, botData }));
    }
    
    fs.readFile(path.join(__dirname, p === '/' ? 'index.html' : p), (err, data) => res.end(data));
}).listen(process.env.PORT || 10000);
