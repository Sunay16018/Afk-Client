const mineflayer = require('mineflayer');
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

let bots = {};
let logs = {};
let botConfigs = {};

// BOT BAŞLATMA FONKSİYONU (7/24 için dışarı çıkarıldı)
function createBot(host, user, ver) {
    if (bots[user]) return;

    const bot = mineflayer.createBot({ host, username: user, version: ver, auth: 'offline' });
    bots[user] = bot;
    logs[user] = ["Bağlanıyor..."];
    
    // Varsayılan boş konfigürasyon
    botConfigs[user] = botConfigs[user] || { 
        msgTimer: null, msgSec: 30, msgText: "", 
        clickTimer: null, clickSec: 5, 
        breakTimer: null,
        // Yeniden bağlanma için bilgileri sakla
        credentials: { host, user, ver }
    };

    bot.on('message', (m) => {
        if(!logs[user]) logs[user] = [];
        logs[user].push(m.toHTML());
        if(logs[user].length > 50) logs[user].shift();
    });

    // KRİTİK: 7/24 RECONNECT (Koparsa 15 sn sonra tekrar gir)
    bot.on('end', () => {
        const creds = botConfigs[user].credentials;
        delete bots[user];
        logs[user].push("<b style='color:orange'>Bağlantı koptu, 15sn sonra tekrar denenecek...</b>");
        setTimeout(() => createBot(creds.host, creds.user, creds.ver), 15000);
    });

    bot.on('error', (err) => logs[user].push("<b style='color:red'>HATA: " + err.message + "</b>"));
}

http.createServer((req, res) => {
    const q = url.parse(req.url, true).query;
    const p = url.parse(req.url, true).pathname;

    // Cron-job buraya "ping" atacak, hem loglara bakıp hem botu diri tutacağız
    if (p === '/ping') return res.end("Sistem Aktif");

    if (p === '/start') {
        createBot(q.host, q.user, q.ver);
        return res.end("ok");
    }

    if (p === '/update') {
        const { user, type, status, val, sec } = q;
        const bot = bots[user];
        const config = botConfigs[user];
        if (!bot || !config) return res.end("Bot yok");

        if (type === 'msg') clearInterval(config.msgTimer);
        if (type === 'click') clearInterval(config.clickTimer);
        if (type === 'break') clearInterval(config.breakTimer);

        if (status === 'on') {
            if (type === 'msg') {
                config.msgText = val;
                config.msgTimer = setInterval(() => { if(bots[user]) bots[user].chat(config.msgText) }, sec * 1000);
            } else if (type === 'click') {
                config.clickTimer = setInterval(() => { if(bots[user]) bots[user].activateItem() }, sec * 1000);
            } else if (type === 'break') {
                config.breakTimer = setInterval(() => {
                    const b = bots[user].blockAtCursor(4);
                    if (b) bots[user].dig(b, true).catch(()=>{});
                }, 500);
            }
        }
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

    let f = path.join(__dirname, p === '/' ? 'index.html' : p);
    fs.readFile(f, (err, data) => res.end(data));
}).listen(process.env.PORT || 10000);
