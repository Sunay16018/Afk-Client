const mineflayer = require('mineflayer');
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

let bots = {};
let logs = {};
// Bot ayarlarını burada tutuyoruz
let botConfigs = {};

http.createServer((req, res) => {
    const parsed = url.parse(req.url, true);
    const q = parsed.query;
    const p = parsed.pathname;

    // 1. Botu Başlat
    if (p === '/start') {
        if (bots[q.user]) return res.end("Aktif");
        const bot = mineflayer.createBot({ host: q.host, username: q.user, version: q.ver, auth: 'offline' });
        
        bots[q.user] = bot;
        logs[q.user] = ["Bağlanıyor..."];
        botConfigs[q.user] = { 
            msgTimer: null, msgSec: 30, msgText: "", 
            clickTimer: null, clickSec: 5, 
            breakTimer: null 
        };

        bot.on('message', (m) => {
            if(!logs[q.user]) logs[q.user] = [];
            logs[q.user].push(m.toHTML());
            if(logs[q.user].length > 50) logs[q.user].shift();
        });

        bot.on('end', () => { delete bots[q.user]; delete botConfigs[q.user]; });
        return res.end("ok");
    }

    // 2. Özellikleri Güncelle (Oto Mesaj, Sağ Tık, Kırma)
    if (p === '/update') {
        const { user, type, status, val, sec } = q;
        const bot = bots[user];
        const config = botConfigs[user];
        if (!bot || !config) return res.end("Bot yok");

        // Zamanlayıcıyı Temizle
        if (type === 'msg') clearInterval(config.msgTimer);
        if (type === 'click') clearInterval(config.clickTimer);
        if (type === 'break') clearInterval(config.breakTimer);

        if (status === 'on') {
            if (type === 'msg') {
                config.msgText = val;
                config.msgTimer = setInterval(() => bot.chat(config.msgText), sec * 1000);
            } else if (type === 'click') {
                config.clickTimer = setInterval(() => bot.activateItem(), sec * 1000);
            } else if (type === 'break') {
                config.breakTimer = setInterval(() => {
                    const block = bot.blockAtCursor(4);
                    if (block) bot.dig(block, true).catch(()=>{});
                }, 500);
            }
        }
        return res.end("Guncellendi");
    }

    if (p === '/data') {
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ active: Object.keys(bots), logs }));
    }

    if (p === '/send') {
        if (bots[q.user]) bots[q.user].chat(q.msg);
        return res.end();
    }

    let f = path.join(__dirname, p === '/' ? 'index.html' : p);
    fs.readFile(f, (err, data) => { res.end(data); });
}).listen(process.env.PORT || 10000);
