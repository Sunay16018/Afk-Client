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
        logs: [],
        health: 20, food: 20,
        spamActive: false,
        spamInterval: null
    };

    bot.on('message', (jsonMsg) => {
        if (botData[user]) {
            botData[user].logs.push(`<div class="log-row">${jsonMsg.toHTML()}</div>`);
            if (botData[user].logs.length > 100) botData[user].logs.shift();
        }
    });

    bot.on('end', () => { 
        if(botData[user]?.spamInterval) clearInterval(botData[user].spamInterval);
        delete bots[user]; delete botData[user]; 
    });

    bots[user] = bot;
    res.send({ status: 'ok' });
});

app.get('/update', (req, res) => {
    const { user, type, val, status } = req.query;
    const bot = bots[user];
    const data = botData[user];
    if (!bot || !data) return res.send({ status: 'error' });

    if (type === 'move') bot.setControlState(val, status === 'on');
    
    // OTO MESAJ SİSTEMİ - HER BOTA ÖZEL
    if (type === 'auto_msg') {
        clearInterval(data.spamInterval);
        if (status === 'on') {
            const [msg, sec] = val.split('|');
            data.spamActive = true;
            data.spamInterval = setInterval(() => {
                if (bots[user]) bots[user].chat(msg);
            }, (parseInt(sec) || 10) * 1000);
        } else {
            data.spamActive = false;
        }
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

app.get('/data', (req, res) => {
    const { user } = req.query;
    const response = { active: Object.keys(bots), botData: {} };
    if (user && bots[user] && botData[user]) {
        response.botData[user] = {
            logs: botData[user].logs,
            health: bots[user].health || 0,
            food: bots[user].food || 0,
            spamActive: botData[user].spamActive,
            // Envanter verisine NBT/Açıklama ekledik
            inventory: bots[user].inventory.slots.map((i, idx) => i ? {
                name: i.name, 
                count: i.count, 
                slot: idx,
                displayName: i.displayName,
                nbt: i.nbt || {}
            } : null).filter(i => i !== null)
        };
        botData[user].logs = []; 
    }
    res.json(response);
});

app.get('/send', (req, res) => {
    const { user, msg } = req.query;
    if (bots[user]) bots[user].chat(msg);
    res.send({ status: 'ok' });
});

app.get('/stop', (req, res) => {
    const { user } = req.query;
    if (bots[user]) bots[user].quit();
    res.send({ status: 'ok' });
});

app.listen(PORT, '0.0.0.0');
