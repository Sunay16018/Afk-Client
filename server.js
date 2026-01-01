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
    
    const bot = mineflayer.createBot({ host: ip, port: parseInt(port) || 25565, username: user });

    botData[user] = {
        logs: [`<div style="color:#8b5cf6; border-bottom:1px solid #333; padding-bottom:5px;">--- ${user} Oturumu ---</div>`],
        health: 20, food: 20, inventory: [], intervals: {}
    };

    bot.on('message', (jsonMsg) => {
        if (botData[user]) {
            botData[user].logs.push(`<div class="log-row">${jsonMsg.toHTML()}</div>`);
            if (botData[user].logs.length > 200) botData[user].logs.shift();
        }
    });

    bot.on('health', () => {
        if (botData[user]) { 
            botData[user].health = bot.health || 0; 
            botData[user].food = bot.food || 0; 
        }
    });

    // Bot bir sebeple çıkarsa listeden temizle
    bot.on('end', () => { delete bots[user]; delete botData[user]; });

    bots[user] = bot;
    res.send({ status: 'ok' });
});

app.get('/update', (req, res) => {
    const { user, type, val, status } = req.query;
    const bot = bots[user];
    if (!bot) return res.send({ status: 'error' });

    if (type === 'move') bot.setControlState(val, status === 'on');
    if (type === 'jump') bot.setControlState('jump', status === 'on');
    if (type === 'look') {
        const p = bot.entity.pitch, y = bot.entity.yaw;
        if (val === 'right') bot.look(y - 0.7, p);
        if (val === 'left') bot.look(y + 0.7, p);
    }
    if (type === 'inv') {
        const item = bot.inventory.slots[val];
        if (item) {
            if (status === 'drop') bot.tossStack(item);
            if (status === 'equip') bot.equip(item, 'hand');
            if (status === 'use') bot.activateItem();
            if (status === 'toss') bot.toss(item.type, null, 1);
        }
    }
    res.send({ status: 'ok' });
});

app.get('/stop', (req, res) => {
    const { user } = req.query;
    if (bots[user]) {
        bots[user].quit();
        delete bots[user];
        delete botData[user];
        res.send({ status: 'ok' });
    } else res.send({ status: 'not_found' });
});

app.get('/data', (req, res) => {
    const { user } = req.query;
    const response = { active: Object.keys(bots), botData: {} };
    if (user && bots[user] && botData[user]) {
        response.botData[user] = {
            logs: botData[user].logs,
            health: bots[user].health || 0,
            food: bots[user].food || 0,
            inventory: bots[user].inventory.items().map(i => ({ name: i.name, count: i.count, slot: i.slot }))
        };
        botData[user].logs = []; 
    }
    res.json(response);
});

app.get('/send', (req, res) => {
    const { user, msg } = req.query;
    if (bots[user]) { bots[user].chat(msg); res.send({ status: 'ok' }); }
});

app.listen(PORT, '0.0.0.0');
