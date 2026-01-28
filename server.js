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
    s.logs[user] = ["<b style='color:gray'>[SİSTEM] Bağlanıyor...</b>"];
    
    if (!s.configs[user]) {
        s.configs[user] = { afk: false, reconnect: true, mining: false, tasks: [] };
    }

    const bot = mineflayer.createBot({
        host: ip, port: parseInt(port) || 25565, 
        username: user, version: ver, auth: 'offline',
        checkTimeoutInterval: 90000, // Timeout süresini artırdık (Proxy Fix)
        keepAlive: true 
    });

    s.bots[user] = bot;

    bot.on('login', () => {
        s.logs[user].push("<b style='color:#2ecc71'>[BAŞARILI] Bot sunucuda!</b>");
        runTasks(sid, user); 
    });

    bot.on('message', (m) => {
        s.logs[user].push(m.toHTML());
        if(s.logs[user].length > 50) s.logs[user].shift();
    });

    // Akıllı Kazma (Performans Dostu)
    const mineInterval = setInterval(() => {
        if (s.configs[user]?.mining && bot.entity) {
            const block = bot.blockAtCursor(4);
            if (block) bot.dig(block, true, () => {});
        }
    }, 1200);

    // Bot Düştüğünde Temizlik
    bot.on('end', (reason) => {
        const shouldReconnect = s.configs[user]?.reconnect;
        s.logs[user].push(`<b style='color:#ff4757'>[AYRILDI] ${reason}</b>`);
        
        clearInterval(mineInterval);
        stopTaskTimers(sid, user);
        
        // ÖNEMLİ: Botu listeden siliyoruz ki tekrar bağlanabilsin
        delete s.bots[user];

        if (shouldReconnect) {
            setTimeout(() => startBot(sid, host, user, ver), 5000);
        }
    });

    bot.on('error', (e) => console.log("Hata:", e.message));
}

function runTasks(sid, user) {
    const s = getSession(sid);
    const conf = s.configs[user];
    stopTaskTimers(sid, user);

    conf.tasks.forEach((task) => {
        if (task.time > 0) {
            task.timer = setInterval(() => {
                if (s.bots[user]) s.bots[user].chat(task.text);
            }, task.time * 1000);
        } else {
            setTimeout(() => { if (s.bots[user]) s.bots[user].chat(task.text); }, 3000);
        }
    });
}

function stopTaskTimers(sid, user) {
    const s = getSession(sid);
    if (s.configs[user]) {
        s.configs[user].tasks.forEach(t => { if(t.timer) clearInterval(t.timer); });
    }
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

    if (p === '/update') {
        const conf = s.configs[q.user];
        if (!conf) return res.end("err");

        if (q.type === 'add_task') {
            conf.tasks.push({ text: decodeURIComponent(q.val), time: parseInt(q.sec) || 0, timer: null });
            runTasks(sid, q.user);
        } else if (q.type === 'del_task') {
            if(conf.tasks[q.val].timer) clearInterval(conf.tasks[q.val].timer);
            conf.tasks.splice(q.val, 1);
            runTasks(sid, q.user);
        } else if (q.type === 'edit_task') {
            conf.tasks[q.val].time += parseInt(q.amt);
            if (conf.tasks[q.val].time < 0) conf.tasks[q.val].time = 0;
            runTasks(sid, q.user);
        } else if (q.type === 'inv' && bot) {
            const item = bot.inventory.slots[q.val];
            if (item) bot.tossStack(item);
        } else {
            conf[q.type] = !conf[q.type]; // AFK, Mining, Reconnect anahtarları
        }
        return res.end("ok");
    }

    if (p === '/data') {
        const botData = {};
        if (q.user && s.bots[q.user]) {
            const b = s.bots[q.user];
            botData[q.user] = {
                pos: b.entity ? b.entity.position : {x:0, y:0, z:0},
                inv: b.inventory.slots.map((i, idx) => i ? { name: i.name, slot: idx, count: i.count } : null).filter(x => x)
            };
        }
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ active: Object.keys(s.bots), logs: s.logs, botData, configs: s.configs }));
    }
});
server.listen(process.env.PORT || 10000);
