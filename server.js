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

    if (parsedUrl.pathname === '/start') {
        const { host, user, ver } = parsedUrl.query;
        if (bots[user]) return res.end(JSON.stringify({msg: "Aktif"}));

        const bot = mineflayer.createBot({ host, username: user, version: ver, auth: 'offline' });
        bots[user] = bot;
        logs[user] = [];

        bot.on('message', (jsonMsg) => {
            if (!logs[user]) logs[user] = [];
            logs[user].push(jsonMsg.toHTML());
            if (logs[user].length > 100) logs[user].shift();
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
                            .map(e => ({ x: Math.round(e.position.x - bot.entity.position.x), z: Math.round(e.position.z - bot.entity.position.z) }))
                    };
                }
            }, 1000);
        });

        bot.on('end', () => { delete bots[user]; delete botStatus[user]; });
        return res.end(JSON.stringify({msg: "Tamam"}));
    }

    if (parsedUrl.pathname === '/getall') {
        const invs = {};
        Object.keys(bots).forEach(n => {
            invs[n] = bots[n].inventory.slots.filter(s => s !== null).map(s => ({ slot: s.slot, name: s.name, count: s.count }));
        });
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ activeBots: Object.keys(bots), logs, status: botStatus, invs }));
    }

    if (parsedUrl.pathname === '/send') {
        if (bots[parsedUrl.query.user]) bots[parsedUrl.query.user].chat(parsedUrl.query.msg);
        return res.end(JSON.stringify({ok: true}));
    }

    if (parsedUrl.pathname === '/quit') {
        if (bots[parsedUrl.query.user]) bots[parsedUrl.query.user].quit();
        return res.end(JSON.stringify({ok: true}));
    }

    let filePath = path.join(__dirname, parsedUrl.pathname === '/' ? 'index.html' : parsedUrl.pathname);
    const ext = path.extname(filePath);
    const contentType = ext === '.css' ? 'text/css' : ext === '.js' ? 'text/javascript' : 'text/html';
    
    fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); res.end(); }
        else { res.writeHead(200, {'Content-Type': contentType}); res.end(data); }
    });
});

server.listen(process.env.PORT || 10000);
