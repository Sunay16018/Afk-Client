const mineflayer = require('mineflayer');
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

let bots = {};
let logs = {};

http.createServer((req, res) => {
    const q = url.parse(req.url, true).query;
    const p = url.parse(req.url, true).pathname;

    if (p === '/start') {
        if (bots[q.user]) return res.end();
        const bot = mineflayer.createBot({ host: q.host, username: q.user, version: q.ver, auth: 'offline' });
        bots[q.user] = bot;
        logs[q.user] = ["Bağlanıyor..."];
        bot.on('message', (m) => {
            logs[q.user].push(m.toHTML());
            if(logs[q.user].length > 50) logs[q.user].shift();
        });
        bot.on('end', () => delete bots[q.user]);
        return res.end("ok");
    }

    if (p === '/data') {
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ active: Object.keys(bots), logs }));
    }

    if (p === '/send') {
        if (bots[q.user]) bots[q.user].chat(q.msg);
        return res.end();
    }

    // Basit Dosya Sunucu
    let f = path.join(__dirname, p === '/' ? 'index.html' : p);
    fs.readFile(f, (err, data) => {
        res.end(data);
    });
}).listen(process.env.PORT || 10000);
