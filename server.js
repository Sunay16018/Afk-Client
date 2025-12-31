const mineflayer = require('mineflayer');
const express = require('express');
const path = require('path');
const app = express();

const PORT = process.env.PORT || 10000;
const bots = {};
const botData = {};

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.get('/start', (req, res) => {
    const { host, user } = req.query;
    if (!host || !user) return res.send({ status: 'error' });

    const [ip, port] = host.split(':');
    if (bots[user]) { try { bots[user].quit(); } catch(e) {} }

    const bot = mineflayer.createBot({
        host: ip,
        port: parseInt(port) || 25565,
        username: user,
        checkTimeoutInterval: 60000
    });

    // Bot Hafızasını Sıfırla
    botData[user] = {
        logs: [`<div style="color:#aaa">--- ${user} Oturumu Başladı ---</div>`],
        health: 20, food: 20, 
        intervals: {}
    };

    bot.on('message', (jsonMsg) => {
        if (botData[user]) {
            const cleanMsg = jsonMsg.toHTML(); 
            botData[user].logs.push(cleanMsg);
            if (botData[user].logs.length > 100) botData[user].logs.shift();
        }
    });

    bot.on('kicked', (reason) => {
        const r = JSON.parse(reason);
        const text = r.text || r.extra?.[0]?.text || "Bilinmiyor";
        if(botData[user]) botData[user].logs.push(`<div style="color:#ff5555; font-weight:bold;">[!] ATILDI: ${text}</div>`);
    });

    bot.on('error', (err) => {
        if(botData[user]) botData[user].logs.push(`<div style="color:#ff5555;">[!] HATA: ${err.message}</div>`);
    });

    bot.on('health', () => {
        if (botData[user]) {
            botData[user].health = bot.health;
            botData[user].food = bot.food;
        }
    });

    bots[user] = bot;
    res.send({ status: 'ok' });
});

app.get('/update', (req, res) => {
    const { user, type, val, status } = req.query;
    const bot = bots[user];
    const data = botData[user];
    if (!bot || !data) return res.send({ status: 'error' });

    switch (type) {
        case 'move':
            bot.setControlState(val, status === 'on');
            break;
        case 'look':
            const p = bot.entity.pitch, y = bot.entity.yaw;
            if (val === 'right') bot.look(y - 0.8, p);
            if (val === 'left') bot.look(y + 0.8, p);
            if (val === 'up') bot.look(y, p + 0.5);
            if (val === 'down') bot.look(y, p - 0.5);
            break;
        case 'jump':
            bot.setControlState('jump', status === 'on');
            break;
        case 'auto_msg':
            clearInterval(data.intervals.spam);
            if(status === 'on'){
                const [msg, sec] = val.split('|');
                data.intervals.spam = setInterval(() => bot.chat(msg), (parseInt(sec)||10)*1000);
            }
            break;
        case 'inv': // 4 Seçenek: drop, equip, use, toss
            const item = bot.inventory.slots[val];
            if(item){
                if(status === 'drop') bot.tossStack(item);
                if(status === 'equip') bot.equip(item, 'hand');
                if(status === 'use') bot.activateItem();
                if(status === 'toss') bot.toss(item.type, null, 1);
            }
            break;
    }
    res.send({ status: 'ok' });
});

app.get('/send', (req, res) => {
    const { user, msg } = req.query;
    if (bots[user]) { bots[user].chat(msg); res.send({ status: 'ok' }); }
});

app.get('/data', (req, res) => {
    const { user } = req.query;
    const response = { active: Object.keys(bots), botData: {} };
    if (user && bots[user] && botData[user]) {
        response.botData[user] = {
            logs: botData[user].logs,
            health: bots[user].health,
            food: bots[user].food,
            inventory: bots[user].inventory.items().map(i => ({
                name: i.name, count: i.count, slot: i.slot
            }))
        };
        botData[user].logs = []; // Her çekimde temizle ki karışmasın
    }
    res.json(response);
});

app.get('/stop', (req, res) => {
    const { user } = req.query;
    if (bots[user]) {
        bots[user].quit();
        delete bots[user];
        delete botData[user];
    }
    res.send({ status: 'ok' });
});

app.listen(PORT, '0.0.0.0', () => console.log(`Server running on ${PORT}`));
                      
