const mineflayer = require('mineflayer');
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

let bot = null;
let logs = []; // Mesajları nesne olarak tutacağız
let botStatus = { health: 20, food: 20, pos: { x: 0, y: 0, z: 0 } };

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);

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

        bot.on('message', (jsonMsg) => {
            // Renk kodlarını ve JSON yapısını bozmadan gönderiyoruz
            logs.push(jsonMsg.toHTML()); 
            if (logs.length > 100) logs.shift();
        });

        bot.on('spawn', () => {
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

        bot.on('end', () => logs.push('<span style="color:red">Bağlantı kesildi.</span>'));
        res.end("OK"); return;
    }

    if (parsedUrl.pathname === '/getdata') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ logs, status: botStatus }));
        return;
    }

    if (parsedUrl.pathname === '/send' && bot) {
        bot.chat(parsedUrl.query.msg);
        res.end("OK"); return;
    }

    let filePath = path.join(__dirname, parsedUrl.pathname === '/' ? 'index.html' : parsedUrl.pathname);
    fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); res.end(); }
        else { res.writeHead(200); res.end(data); }
    });
});

server.listen(process.env.PORT || 10000);
