const mineflayer = require('mineflayer');
const express = require('express');
const path = require('path');
const app = express();

const PORT = process.env.PORT || 10000;
const bots = {};
const botData = {};

// index.html dosyasını ana dizinden oku
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/start', (req, res) => {
    const { sid, host, user } = req.query;
    if (!host || !user) return res.send({ status: 'error' });

    const [ip, port] = host.split(':');
    if (bots[user]) { try { bots[user].quit(); } catch(e) {} }

    const bot = mineflayer.createBot({
        host: ip,
        port: parseInt(port) || 25565,
        username: user,
        checkTimeoutInterval: 60000
    });

    botData[user] = {
        logs: [`[Sistem] ${user} oturumu hazır.`],
        health: 20, food: 20, inventory: [], intervals: {}
    };

    bot.on('message', (jsonMsg) => {
        const msg = jsonMsg.toString().trim();
        if (msg && botData[user]) {
            botData[user].logs.push(msg);
            if (botData[user].logs.length > 50) botData[user].logs.shift();
        }
    });

    bot.on('health', () => {
        if (botData[user]) {
            botData[user].health = bot.health;
            botData[user].food = bot.food;
        }
    });

    bot.on('spawn', () => botData[user].logs.push(">> Giriş yapıldı!"));
    bot.on('error', (err) => botData[user].logs.push("!! Hata: " + err.message));
    bot.on('kicked', (reason) => botData[user].logs.push("!! Atıldı: " + reason));

    bots[user] = bot;
    res.send({ status: 'ok' });
});

app.get('/update', (req, res) => {
    const { user, type, status, val } = req.query;
    const bot = bots[user];
    const data = botData[user];
    if (!bot || !data) return res.send({ status: 'error' });

    switch (type) {
        case 'auto_msg':
            clearInterval(data.intervals.spam);
            if (status === 'on') {
                const [text, sec] = val.split('|');
                const ms = (parseInt(sec) || 30) * 1000;
                bot.chat(text); 
                data.intervals.spam = setInterval(() => bot.chat(text), ms);
            }
            break;
        case 'look':
            const yaw = bot.entity.yaw;
            if (val === 'left') bot.look(yaw + 1.57, 0);
            if (val === 'right') bot.look(yaw - 1.57, 0);
            if (val === 'back') bot.look(yaw + 3.14, 0);
            break;
        case 'move': bot.setControlState('forward', status === 'on'); break;
        case 'jump': bot.setControlState('jump', status === 'on'); break;
        case 'action': if (val === 'swing') bot.swingArm(); break;
        case 'inv_action':
            const item = bot.inventory.slots[val];
            if (item) {
                if (status === 'drop') bot.tossStack(item);
                if (status === 'equip') bot.equip(item, 'hand');
            }
            break;
    }
    res.send({ status: 'ok' });
});

app.get('/data', (req, res) => {
    const { user } = req.query;
    const response = { active: Object.keys(bots), botData: {} };
    if (user && bots[user] && botData[user]) {
        response.botData[user] = {
            logs: [...botData[user].logs],
            health: bots[user].health || 20,
            food: bots[user].food || 20,
            inventory: bots[user].inventory.items().map(i => ({
                name: i.name, count: i.count, slot: i.slot
            }))
        };
        botData[user].logs = [];
    }
    res.json(response);
});

app.get('/stop', (req, res) => {
    const { user } = req.query;
    if (bots[user]) {
        clearInterval(botData[user].intervals.spam);
        bots[user].quit();
        delete bots[user];
        delete botData[user];
    }
    res.send({ status: 'ok' });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Sunucu ${PORT} üzerinde aktif.`);
});
