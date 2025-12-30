const mineflayer = require('mineflayer');
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

let bot = null;
let logs = [];
let autoMsgTask = null;
let botStatus = { health: 20, food: 20, pos: { x: 0, y: 0, z: 0 }, players: [] };

function addLog(msg) {
    logs.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
    if (logs.length > 50) logs.shift();
}

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);

    // API: Botu Başlat
    if (parsedUrl.pathname === '/start') {
        const { host, user, ver } = parsedUrl.query;
        if (bot) bot.quit();

        bot = mineflayer.createBot({
            host: host,
            port: 25565,
            username: user || 'AFK_Bot',
            version: ver,
            auth: 'offline',
            checkTimeoutInterval: 90000
        });

        bot.on('spawn', () => {
            addLog("Başarıyla giriş yapıldı!");
            setInterval(() => {
                if (bot.entity) {
                    botStatus = {
                        health: Math.round(bot.health),
                        food: Math.round(bot.food),
                        pos: { x: Math.round(bot.entity.position.x), y: Math.round(bot.entity.position.y), z: Math.round(bot.entity.position.z) },
                        players: Object.values(bot.entities)
                            .filter(e => e.type === 'player' && e.username !== bot.username)
                            .map(e => ({ n: e.username, x: Math.round(e.position.x - bot.entity.position.x), z: Math.round(e.position.z - bot.entity.position.z) }))
                    };
                }
            }, 1000);
        });

        bot.on('chat', (u, m) => addLog(`${u}: ${m}`));
        bot.on('error', (e) => addLog("Hata: " + e.message));
        bot.on('end', () => addLog("Bağlantı kesildi."));
        res.end("OK"); return;
    }

    // API: Otomatik Mesaj Ayarı
    if (parsedUrl.pathname === '/automsg') {
        const { enabled, msg, delay } = parsedUrl.query;
        if (autoMsgTask) clearInterval(autoMsgTask);
        if (enabled === 'true' && bot) {
            autoMsgTask = setInterval(() => {
                if (bot && bot.chat) bot.chat(msg);
            }, parseInt(delay) * 1000);
        }
        res.end("OK"); return;
    }

    // API: Veri Çekme
    if (parsedUrl.pathname === '/getdata') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ logs, status: botStatus }));
        return;
    }

    if (parsedUrl.pathname === '/send' && bot) {
        bot.chat(parsedUrl.query.msg);
        res.end("OK"); return;
    }

    // Dosyaları Sun
    let filePath = path.join(__dirname, parsedUrl.pathname === '/' ? 'index.html' : parsedUrl.pathname);
    fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); res.end(); }
        else { res.writeHead(200); res.end(data); }
    });
});

server.listen(process.env.PORT || 10000);
