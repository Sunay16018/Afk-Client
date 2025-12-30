const mineflayer = require('mineflayer');
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

let bot = null;
let logs = [];
let botStatus = { health: 20, food: 20, pos: { x: 0, y: 0, z: 0 } };

function addLog(htmlMsg) {
    logs.push(htmlMsg);
    if (logs.length > 100) logs.shift();
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
            auth: 'offline'
        });

        // Renkli Mesajları Yakala ve HTML'e Çevir
        bot.on('message', (jsonMsg) => {
            const html = jsonMsg.toHTML();
            addLog(html);
        });

        bot.on('spawn', () => {
            addLog('<b style="color:#58a6ff">>>> SUNUCUYA BAĞLANDI <<<</b>');
            setInterval(() => {
                if (bot && bot.entity) {
                    botStatus = {
                        health: Math.round(bot.health),
                        food: Math.round(bot.food),
                        pos: { x: Math.round(bot.entity.position.x), y: Math.round(bot.entity.position.y), z: Math.round(bot.entity.position.z) }
                    };
                }
            }, 1000);
        });

        bot.on('error', (e) => addLog(`<span style="color:#f85149">Hata: ${e.message}</span>`));
        bot.on('end', () => addLog('<span style="color:#8b949e">Bağlantı koptu.</span>'));
        res.end("OK"); return;
    }

    // API: Verileri Oku (Loglar ve Durum)
    if (parsedUrl.pathname === '/getdata') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ logs, status: botStatus }));
        return;
    }

    // API: Komut Gönder
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
