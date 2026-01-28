const mineflayer = require('mineflayer');
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

let bots = {};
let logs = {};
let config = {};

const server = http.createServer((req, res) => {
    const q = url.parse(req.url, true).query;
    const p = url.parse(req.url, true).pathname;
    const user = q.user;

    if (p === '/') return fs.readFile(path.join(__dirname, 'index.html'), (err, data) => res.end(data));

    if (p === '/start') {
        if (bots[user]) return res.end("aktif");
        const [ip, port] = q.host.split(':');
        
        config[user] = { msg: "", time: 0, timer: null };
        logs[user] = ["<b style='color:gray'>Bağlanıyor...</b>"];

        const bot = mineflayer.createBot({
            host: ip, port: parseInt(port) || 25565,
            username: user, version: q.ver, auth: 'offline',
            checkTimeoutInterval: 60000
        });

        bots[user] = bot;

        bot.on('login', () => logs[user].push("<b style='color:green'>Giriş Yapıldı!</b>"));
        bot.on('message', (m) => {
            logs[user].push(m.toHTML());
            if(logs[user].length > 40) logs[user].shift();
        });

        bot.on('end', () => {
            if(config[user]?.timer) clearInterval(config[user].timer);
            delete bots[user];
            logs[user].push("<b style='color:red'>Bağlantı Kesildi.</b>");
        });

        bot.on('error', (err) => logs[user].push("Hata: " + err.message));
        return res.end("ok");
    }

    if (p === '/set_spam') {
        const conf = config[user];
        if (!conf || !bots[user]) return res.end("bot_yok");

        // Eski zamanlayıcıyı temizle
        if (conf.timer) clearInterval(conf.timer);

        const msg = decodeURIComponent(q.msg);
        const sec = parseInt(q.sec);

        if (sec > 0 && msg) {
            conf.msg = msg;
            conf.time = sec;
            conf.timer = setInterval(() => {
                if (bots[user]) bots[user].chat(msg);
            }, sec * 1000);
            logs[user].push(`<b>Spam Başladı:</b> ${sec}sn`);
        } else {
            logs[user].push(`<b>Spam Durduruldu.</b>`);
        }
        return res.end("ok");
    }

    if (p === '/data') {
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ 
            active: Object.keys(bots), 
            logs: logs,
            status: config
        }));
    }

    if (p === '/stop') {
        if (bots[user]) bots[user].quit();
        return res.end("ok");
    }
});

server.listen(process.env.PORT || 10000);
