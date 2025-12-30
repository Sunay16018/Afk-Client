const mineflayer = require('mineflayer');
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

let bot;
let logs = [];

function addLog(msg) {
    const time = new Date().toLocaleTimeString();
    logs.push(`[${time}] ${msg}`);
    if (logs.length > 50) logs.shift();
    console.log(msg);
}

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);

    // API: Botu Başlat
    if (parsedUrl.pathname === '/start') {
        const { host, user, ver, port } = parsedUrl.query;
        if (bot) { bot.quit(); addLog("Eski bot kapatıldı."); }

        addLog(`${host} adresine ${ver} sürümü ile bağlanılıyor...`);
        
        bot = mineflayer.createBot({
            host: host,
            port: parseInt(port) || 25565,
            username: user || 'AFK_Bot',
            version: ver
        });

        bot.on('spawn', () => {
            addLog("Bot başarıyla sunucuya girdi!");
            // Anti-AFK: 30 saniyede bir zıpla
            setInterval(() => { if(bot.entity) bot.setControlState('jump', true); setTimeout(() => bot.setControlState('jump', false), 500); }, 30000);
        });

        bot.on('chat', (username, message) => addLog(`${username}: ${message}`));
        bot.on('death', () => { addLog("Bot öldü, yeniden doğuluyor..."); bot.quit(); });
        bot.on('error', (err) => addLog("Hata: " + err.message));
        bot.on('end', () => addLog("Bağlantı kesildi."));

        res.end("OK");
        return;
    }

    // API: Komut Gönder
    if (parsedUrl.pathname === '/send' && bot) {
        bot.chat(parsedUrl.query.msg);
        res.end("OK");
        return;
    }

    // API: Logları Getir
    if (parsedUrl.pathname === '/getlogs') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ logs }));
        return;
    }

    // Statik Dosyalar (HTML & CSS)
    let filePath = '.' + parsedUrl.pathname;
    if (filePath === './') filePath = './index.html';
    const ext = path.extname(filePath);
    const mimeTypes = { '.html': 'text/html', '.css': 'text/css' };

    fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); res.end("Dosya bulunamadi"); }
        else { res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' }); res.end(data); }
    });
});

server.listen(process.env.PORT || 10000);
