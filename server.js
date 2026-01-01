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
    
    if (bots[user]) return res.send({ status: 'already_running' });
    
    const bot = mineflayer.createBot({ host: ip, port: parseInt(port) || 25565, username: user });

    botData[user] = {
        logs: [`<div style="color:#8b5cf6; padding:5px;">--- ${user} Sohbeti Başladı ---</div>`],
        health: 20, food: 20, inventory: []
    };

    bot.on('message', (jsonMsg) => {
        if (botData[user]) {
            botData[user].logs.push(`<div class="log-row">${jsonMsg.toHTML()}</div>`);
            if (botData[user].logs.length > 150) botData[user].logs.shift();
        }
    });

    bot.on('end', () => { delete bots[user]; delete botData[user]; });
    bot.on('kicked', (reason) => { if(botData[user]) botData[user].logs.push(`<div style="color:red">[!] ATILDI: ${reason}</div>`); });

    bots[user] = bot;
    res.send({ status: 'ok' });
});

app.get('/data', (req, res) => {
    const { user } = req.query;
    const response = { active: Object.keys(bots), botData: {} };
    if (user && botData[user]) {
        response.botData[user] = {
            logs: [...botData[user].logs], // Logları kopyala
            health: bots[user]?.health || 0,
            food: bots[user]?.food || 0,
            inventory: bots[user]?.inventory.items().map(i => ({ name: i.name, count: i.count, slot: i.slot })) || []
        };
        botData[user].logs = []; // Çekilen logları temizle
    }
    res.json(response);
});

app.get('/send', (req, res) => {
    const { user, msg } = req.query;
    if (bots[user]) { bots[user].chat(msg); res.send({ status: 'ok' }); }
});

app.get('/stop', (req, res) => {
    const { user } = req.query;
    if (bots[user]) { bots[user].quit(); delete bots[user]; delete botData[user]; }
    res.send({ status: 'ok' });
});

app.get('/update', (req, res) => {
    const { user, type, val, status } = req.query;
    const bot = bots[user];
    if (bot && type === 'move') bot.setControlState(val, status === 'on');
    if (bot && type === 'look') {
        const p = bot.entity.pitch, y = bot.entity.yaw;
        if (val === 'right') bot.look(y - 0.7, p);
        if (val === 'left') bot.look(y + 0.7, p);
    }
    res.send({ status: 'ok' });
});

app.listen(PORT, '0.0.0.0');
