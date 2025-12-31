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
        username: user
    });

    botData[user] = {
        logs: [`<div style="color:#8b5cf6; border-bottom:1px solid #333; padding-bottom:5px;">--- ${user} Oturumu Başladı ---</div>`],
        health: 20, food: 20, inventory: [], intervals: {}
    };

    bot.on('message', (jsonMsg) => {
        if (botData[user]) {
            // toHTML() Minecraft renklerini korur, biz de bunu bir div içine alarak satır yaparız
            const htmlMsg = jsonMsg.toHTML();
            botData[user].logs.push(`<div class="log-row">${htmlMsg}</div>`);
            if (botData[user].logs.length > 200) botData[user].logs.shift();
        }
    });

    bot.on('kicked', (reason) => {
        if(botData[user]) botData[user].logs.push(`<div style="color:#ff5555; background:rgba(255,0,0,0.1); padding:5px;">[!] ATILDI: ${reason}</div>`);
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
    if (!bot || !botData[user]) return res.send({ status: 'error' });

    if (type === 'move') bot.setControlState(val, status === 'on');
    if (type === 'jump') bot.setControlState('jump', status === 'on');
    if (type === 'look') {
        const p = bot.entity.pitch, y = bot.entity.yaw;
        if (val === 'right') bot.look(y - 0.7, p);
        if (val === 'left') bot.look(y + 0.7, p);
    }
    if (type === 'auto_msg' && status === 'on') {
        const [msg, sec] = val.split('|');
        clearInterval(botData[user].intervals.spam);
        botData[user].intervals.spam = setInterval(() => bot.chat(msg), (parseInt(sec) || 10) * 1000);
    } else if (type === 'auto_msg') {
        clearInterval(botData[user].intervals.spam);
    }
    res.send({ status: 'ok' });
});

app.get('/send', (req, res) => {
    const { user, msg } = req.query;
    if (bots[user]) { bots[user].chat(msg); res.send({ status: 'ok' }); }
});

app.get('/data', (req, res) => {
    const { user } = req.query;
    if (user && bots[user] && botData[user]) {
        const data = {
            active: Object.keys(bots),
            botData: {
                [user]: {
                    logs: botData[user].logs,
                    health: bots[user].health,
                    food: bots[user].food,
                    inventory: bots[user].inventory.items().map(i => ({ name: i.name, count: i.count, slot: i.slot }))
                }
            }
        };
        botData[user].logs = []; // Çekilenleri temizle
        return res.json(data);
    }
    res.json({ active: Object.keys(bots), botData: {} });
});

app.listen(PORT, '0.0.0.0');
