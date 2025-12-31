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
        logs: [], // Artık ham JSON mesajları da tutacak
        health: 20, food: 20, inventory: []
    };

    // Mesajları renkli HTML olarak işle
    bot.on('message', (jsonMsg) => {
        if (botData[user]) {
            const htmlMsg = jsonMsg.toHTML(); // Minecraft renk kodlarını HTML'e çevirir
            botData[user].logs.push(htmlMsg);
            if (botData[user].logs.length > 100) botData[user].logs.shift();
        }
    });

    bot.on('health', () => {
        if (botData[user]) {
            botData[user].health = bot.health;
            botData[user].food = bot.food;
        }
    });

    bot.on('spawn', () => botData[user].logs.push('<span style="color:#55ff55">>> Sunucuya bağlandı!</span>'));
    bot.on('kicked', (reason) => botData[user].logs.push(`<span style="color:#ff5555">!! Atıldı: ${reason}</span>`));
    bot.on('error', (err) => botData[user].logs.push(`<span style="color:#ff5555">!! Hata: ${err.message}</span>`));

    bots[user] = bot;
    res.send({ status: 'ok' });
});

app.get('/send', (req, res) => {
    const { user, msg } = req.query;
    if (bots[user]) {
        bots[user].chat(msg);
        res.send({ status: 'ok' });
    } else res.send({ status: 'error' });
});

app.get('/update', (req, res) => {
    const { user, type, val, status } = req.query;
    const bot = bots[user];
    if (!bot) return res.send({ status: 'error' });

    switch (type) {
        case 'move': // forward, back, left, right
            bot.setControlState(val, status === 'on');
            break;
        case 'jump':
            bot.setControlState('jump', status === 'on');
            break;
        case 'look': // right, left, up, down
            const p = bot.entity.pitch;
            const y = bot.entity.yaw;
            if (val === 'right') bot.look(y - 0.5, p);
            if (val === 'left') bot.look(y + 0.5, p);
            if (val === 'up') bot.look(y, p + 0.3);
            if (val === 'down') bot.look(y, p - 0.3);
            break;
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
            logs: botData[user].logs,
            health: bots[user].health,
            food: bots[user].food,
            inventory: bots[user].inventory.items().map(i => ({
                name: i.name, count: i.count, slot: i.slot
            }))
        };
        botData[user].logs = []; // Çekilen logları temizle
    }
    res.json(response);
});

app.listen(PORT, '0.0.0.0', () => console.log(`Sistem ${PORT} portunda aktif.`));
