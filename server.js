const mineflayer = require('mineflayer');
const http = require('http');
const fs = require('fs');
const path = require('path');

// --- WEB SUNUCUSU AYARLARI ---
const server = http.createServer((req, res) => {
    let filePath = '.' + req.url;
    if (filePath === './') filePath = './index.html';

    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            res.writeHead(404);
            res.end('Dosya Bulunamadi');
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`Panel ${PORT} portunda aktif.`));

// --- MINECRAFT BOT AYARLARI ---
const botArgs = {
    host: 'SUNUCU_IP_ADRESI', // Burayı değiştir!
    port: 25565,
    username: 'Render_Bot_724',
    version: '1.20.1' // Sunucu sürümünü buraya yaz
};

function createBot() {
    const bot = mineflayer.createBot(botArgs);

    bot.on('spawn', () => {
        console.log('Bot sunucuya girdi!');
        // Botun AFK atılmaması için 30 saniyede bir zıplamasını sağlar
        setInterval(() => {
            bot.setControlState('jump', true);
            setTimeout(() => bot.setControlState('jump', false), 500);
        }, 30000);
    });

    bot.on('end', () => {
        console.log('Bağlantı koptu, 10 sn sonra tekrar denenecek...');
        setTimeout(createBot, 10000);
    });

    bot.on('error', err => console.log('Hata:', err));
}

createBot();
