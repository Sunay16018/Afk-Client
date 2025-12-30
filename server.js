const mineflayer = require('mineflayer');
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

let bots = {};
let logs = {};
let botStatus = {};

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    res.setHeader('Content-Type', 'application/json');

    // BOT BAŞLATMA
    if (parsedUrl.pathname === '/start') {
        const { host, user, ver } = parsedUrl.query;
        if (bots[user]) return res.end(JSON.stringify({msg: "Zaten aktif"}));

        const bot = mineflayer.createBot({ host, username: user, version: ver, auth: 'offline' });
        bots[user] = bot;
        logs[user] = [];

        bot.on('message', (jsonMsg) => {
            if (!logs[user]) logs[user] = [];
            logs[user].push(jsonMsg.toHTML());
            if (logs[user].length > 150) logs[user].shift();
        });

        bot.on('spawn', () => {
            setInterval(() => {
                if (bot.entity) {
                    botStatus[user] = {
                        health: Math.round(bot.health),
                        food: Math.round(bot.food),
                        pos: { x: Math.round(bot.entity.position.x), z: Math.round(bot.entity.position.z) },
                        players: Object.values(bot.entities)
                            .filter(e => e.type === 'player' && e.username !== bot.username)
                            .map(e => ({ n: e.username, x: Math.round(e.position.x - bot.entity.position.x), z: Math.round(e.position.z - bot.entity.position.z) }))
                    };
                }
            }, 1000);
        });

        bot.on('end', () => { delete bots[user]; delete botStatus[user]; });
        return res.end(JSON.stringify({msg: "Bot giriyor"}));
    }

    // BOTU ÇIKART
    if (parsedUrl.pathname === '/quit') {
        if (bots[parsedUrl.query.user]) bots[parsedUrl.query.user].quit();
        return res.end(JSON.stringify({status: "ok"}));
    }

    // TÜM VERİLERİ ÇEK
    if (parsedUrl.pathname === '/getall') {
        const invData = {};
        Object.keys(bots).forEach(name => {
            invData[name] = bots[name].inventory.slots
                .filter(s => s !== null)
                .map(s => ({ slot: s.slot, name: s.name, count: s.count }));
        });
        return res.end(JSON.stringify({ activeBots: Object.keys(bots), logs, status: botStatus, invs: invData }));
    }

    // MESAJ GÖNDER
    if (parsedUrl.pathname === '/send') {
        if (bots[parsedUrl.query.user]) bots[parsedUrl.query.user].chat(parsedUrl.query.msg);
        return res.end(JSON.stringify({status: "ok"}));
    }

    // DOSYA SUNUCUSU
    let filePath = path.join(__dirname, parsedUrl.pathname === '/' ? 'index.html' : parsedUrl.pathname);
    fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); res.end(); }
        else { res.setHeader('Content-Type', 'text/html'); res.end(data); }
    });
});

server.listen(process.env.PORT || 10000);
