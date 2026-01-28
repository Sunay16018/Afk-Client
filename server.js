const mineflayer = require('mineflayer');
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

let userSessions = {}; 
const HF_TOKEN = "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"; 

function getSession(sid) {
    if (!userSessions[sid]) userSessions[sid] = { bots: {}, logs: {}, configs: {} };
    return userSessions[sid];
}

async function askAI(message) {
    try {
        const response = await fetch("https://api-inference.huggingface.co/models/facebook/blenderbot-400M-distill", {
            headers: { "Authorization": `Bearer ${HF_TOKEN}`, "Content-Type": "application/json" },
            method: "POST",
            body: JSON.stringify({ 
                inputs: `User: ${message}. Reply as a Minecraft player in 3-4 words.`,
                parameters: { max_new_tokens: 20, temperature: 0.7 } 
            }),
        });
        const result = await response.json();
        let reply = result[0]?.generated_text || result.generated_text || "";
        
        // Gereksiz kısımları temizle
        reply = reply.replace(/User:.*words\./gi, "").trim();
        // Eğer AI boş dönerse rastgele bir cevap ver
        const fallbacks = ["Efendim?", "Buradayım kanka", "Noldu?", "He canım"];
        if (!reply || reply.length < 2) return fallbacks[Math.floor(Math.random() * fallbacks.length)];
        
        return reply.split('.')[0].substring(0, 50);
    } catch (e) { return "Efendim?"; }
}

function startBot(sid, host, user, ver) {
    const s = getSession(sid);
    if (s.bots[user]) return;
    const [ip, port] = host.split(':');
    
    if (!s.configs[user]) s.configs[user] = { afk: false, reconnect: true, mining: false, tasks: [] };

    const bot = mineflayer.createBot({
        host: ip, port: parseInt(port) || 25565, 
        username: user, version: ver, auth: 'offline',
        checkTimeoutInterval: 90000, keepAlive: true 
    });

    s.bots[user] = bot;
    s.logs[user] = ["<b style='color:gray'>Sistem: Bağlanıyor...</b>"];

    bot.on('login', () => {
        s.logs[user].push("<b style='color:#2ecc71'>[BAŞARILI] " + user + " girdi!</b>");
        s.configs[user].tasks.forEach(t => {
            if(t.time > 0) t.timer = setInterval(() => { if(s.bots[user]) s.bots[user].chat(t.text) }, t.time * 1000);
        });
    });

    // GELİŞTİRİLMİŞ AI TETİKLEYİCİ (Harf Duyarlılığı Çözüldü)
    bot.on('chat', async (username, message) => {
        if (username === user) return;

        // Türkçe karakterleri ve büyük/küçük harfi normalize et
        const cleanMsg = message.toLocaleLowerCase('tr-TR');
        const cleanName = user.toLocaleLowerCase('tr-TR');

        if (cleanMsg.includes(cleanName)) {
            s.logs[user].push(`<i style="color:orange">AI Düşünüyor: ${message}</i>`);
            const reply = await askAI(message);
            
            // Daha insansı görünmesi için 2 saniye bekle
            setTimeout(() => { 
                if (s.bots[user]) {
                    s.bots[user].chat(reply); 
                    s.logs[user].push(`<b style="color:cyan">AI Cevap:</b> ${reply}`);
                }
            }, 2000);
        }
    });

    bot.on('message', (m) => {
        s.logs[user].push(m.toHTML());
        if(s.logs[user].length > 50) s.logs[user].shift();
    });

    const mineInt = setInterval(() => {
        if (s.configs[user]?.mining && bot.entity) {
            const block = bot.blockAtCursor(4);
            if (block) bot.dig(block, true, () => {});
        }
    }, 1200);

    bot.on('end', (reason) => {
        clearInterval(mineInt);
        s.configs[user].tasks.forEach(t => clearInterval(t.timer));
        delete s.bots[user];
        if (s.configs[user]?.reconnect) setTimeout(() => startBot(sid, host, user, ver), 5000);
    });
}

const server = http.createServer((req, res) => {
    const q = url.parse(req.url, true).query;
    const p = url.parse(req.url, true).pathname;
    const sid = q.sid;
    if (p === '/') return fs.readFile(path.join(__dirname, 'index.html'), (err, data) => res.end(data));
    
    const s = getSession(sid);
    const bot = s.bots[q.user];

    if (p === '/start') { startBot(sid, q.host, q.user, q.ver); return res.end("ok"); }
    if (p === '/send' && bot) { bot.chat(decodeURIComponent(q.msg)); return res.end("ok"); }
    if (p === '/stop') { if(s.configs[q.user]) s.configs[q.user].reconnect = false; if(bot) bot.quit(); return res.end("ok"); }

    if (p === '/update') {
        const conf = s.configs[q.user];
        if (q.type === 'add_task') {
            const t = { text: decodeURIComponent(q.val), time: parseInt(q.sec), timer: null };
            if(t.time > 0) t.timer = setInterval(() => { if(s.bots[q.user]) s.bots[q.user].chat(t.text) }, t.time * 1000);
            conf.tasks.push(t);
        } else if (q.type === 'del_task') {
            clearInterval(conf.tasks[q.val].timer);
            conf.tasks.splice(q.val, 1);
        } else if (q.type === 'inv' && bot) {
            const item = bot.inventory.slots[q.val];
            if (item) bot.tossStack(item);
        } else { conf[q.type] = !conf[q.type]; }
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
        
