const mineflayer = require('mineflayer');
const http = require('http');
const url = require('url');
const fs = require('fs');
const { GoogleGenerativeAI } = require("@google/generative-ai");

let userSessions = {}; 
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function getSession(sid) {
    if (!userSessions[sid]) userSessions[sid] = { bots: {}, logs: {}, configs: {} };
    return userSessions[sid];
}

async function askGemini(message, botName) {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        // Hız için model parametreleri optimize edildi
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: `Sen Minecraft oyuncusu ${botName}sin. Kısa cevap ver: ${message}` }]}],
            generationConfig: { maxOutputTokens: 20, temperature: 0.7 }
        });
        return result.response.text().trim().replace(/"/g, "");
    } catch (e) { return "Efendim?"; }
}

function startBot(sid, host, user, ver) {
    const s = getSession(sid);
    if (s.bots[user]) return;
    const [ip, port] = host.split(':');
    
    s.configs[user] = s.configs[user] || { afk: false, reconnect: true, mining: false, tasks: [] };

    const bot = mineflayer.createBot({
        host: ip, port: parseInt(port) || 25565, 
        username: user, version: ver, auth: 'offline',
        checkTimeoutInterval: 30000, // Daha hızlı kopma tespiti
        hideErrors: true 
    });

    s.bots[user] = bot;
    s.logs[user] = ["<b>Sistem: Başlatıldı...</b>"];

    bot.on('message', (jsonMsg) => {
        s.logs[user].push(jsonMsg.toHTML());
        if(s.logs[user].length > 40) s.logs[user].shift(); // Veri hafifletme
    });

    bot.on('chat', async (username, message) => {
        if (username === user) return;
        if (message.toLocaleLowerCase('tr-TR').includes(user.toLocaleLowerCase('tr-TR'))) {
            const reply = await askGemini(message, user);
            if (s.bots[user]) s.bots[user].chat(reply);
        }
    });

    bot.on('end', () => {
        if(s.configs[user]?.reconnect) setTimeout(() => startBot(sid, host, user, ver), 3000);
        delete s.bots[user];
    });
    
    bot.on('error', (err) => console.log("Bot Hatası: " + err.message));
}

const server = http.createServer((req, res) => {
    const q = url.parse(req.url, true).query;
    const p = url.parse(req.url, true).pathname;
    const s = getSession(q.sid);

    if (p === '/') return res.end(fs.readFileSync('./index.html'));

    // GECİKMEYİ SIFIRLAYAN HEADERLAR
    res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
    });

    if (p === '/start') startBot(q.sid, q.host, q.user, q.ver);
    if (p === '/send' && s.bots[q.user]) s.bots[q.user].chat(decodeURIComponent(q.msg));
    if (p === '/stop' && q.user) { if(s.configs[q.user]) s.configs[q.user].reconnect = false; s.bots[q.user]?.quit(); }
    
    if (p === '/update') {
        const conf = s.configs[q.user];
        if (q.type === 'add_task') {
            const t = { text: decodeURIComponent(q.val), time: parseInt(q.sec), timer: setInterval(() => s.bots[q.user]?.chat(decodeURIComponent(q.val)), parseInt(q.sec)*1000) };
            conf.tasks.push(t);
        } else if (q.type === 'del_task') {
            clearInterval(conf.tasks[q.val].timer);
            conf.tasks.splice(q.val, 1);
        } else { conf[q.type] = !conf[q.type]; }
    }

    if (p === '/data') {
        const botData = {};
        if (q.user && s.bots[q.user]) {
            const b = s.bots[q.user];
            botData[q.user] = { pos: b.entity?.position || {x:0,y:0,z:0} };
        }
        return res.end(JSON.stringify({ active: Object.keys(s.bots), logs: s.logs, configs: s.configs, botData }));
    }
    res.end();
});
server.listen(process.env.PORT || 10000);
