const mineflayer = require('mineflayer');
const express = require('express');
const app = express();
const bots = {};

// Her botun kendine has verilerini tutacak obje
const botData = {};

app.get('/start', (req, res) => {
    const { sid, host, user } = req.query;
    const [ip, port] = host.split(':');

    if (bots[user]) bots[user].quit();

    const bot = mineflayer.createBot({
        host: ip,
        port: port || 25565,
        username: user
    });

    // Bot verilerini sıfırla (Yeni giriş yapıldığında eskiler silinir)
    botData[user] = {
        logs: [`[Sistem] ${user} için bağlantı başlatıldı.`],
        health: 20,
        food: 20,
        inventory: [],
        intervals: {} // Oto-mesaj gibi tekrarlı işler için
    };

    bot.on('message', (jsonMsg) => {
        const msg = jsonMsg.toString();
        // Sadece anlamlı mesajları al, boşlukları temizle
        if (msg.trim().length > 0) {
            botData[user].logs.push(msg);
            // Bellek şişmesin diye son 100 mesajı tut
            if (botData[user].logs.length > 100) botData[user].logs.shift();
        }
    });

    bot.on('health', () => {
        botData[user].health = bot.health;
        botData[user].food = bot.food;
    });

    bot.on('spawn', () => {
        botData[user].logs.push(">>> Bot sunucuya giriş yaptı!");
    });

    bot.on('error', (err) => botData[user].logs.push(`!!! Hata: ${err.message}`));
    bot.on('kicked', (reason) => botData[user].logs.push(`!!! Atıldı: ${reason}`));

    bots[user] = bot;
    res.send({ status: 'ok' });
});

app.get('/update', (req, res) => {
    const { user, type, status, val } = req.query;
    const bot = bots[user];
    if (!bot) return res.send({ status: 'error' });

    const data = botData[user];

    switch (type) {
        case 'auto_msg':
            // Önce varsa eski döngüyü temizle
            clearInterval(data.intervals.spam);
            if (status === 'on') {
                const [msg, sec] = val.split('|');
                const ms = parseInt(sec) * 1000 || 30000;
                bot.chat(msg); // İlk mesajı hemen at
                data.intervals.spam = setInterval(() => {
                    bot.chat(msg);
                }, ms);
            }
            break;

        case 'look':
            const yaw = bot.entity.yaw;
            if (val === 'left') bot.look(yaw + Math.PI / 2, 0);
            if (val === 'right') bot.look(yaw - Math.PI / 2, 0);
            if (val === 'back') bot.look(yaw + Math.PI, 0);
            break;

        case 'move':
            bot.setControlState('forward', status === 'on');
            break;

        case 'jump':
            if (val === 'once') {
                bot.setControlState('jump', true);
                setTimeout(() => bot.setControlState('jump', false), 100);
            } else {
                bot.setControlState('jump', status === 'on');
            }
            break;

        case 'action':
            if (val === 'swing') bot.swingArm();
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
    const activeBots = Object.keys(bots);
    const response = { active: activeBots, botData: {} };

    if (user && bots[user]) {
        const bot = bots[user];
        response.botData[user] = {
            logs: botData[user].logs,
            health: bot.health,
            food: bot.food,
            inventory: bot.inventory.items().map(i => ({
                name: i.name,
                count: i.count,
                slot: i.slot
            }))
        };
        // Logları gönderdikten sonra geçici listeyi temizle (HTML tarafında birikmemesi için)
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

app.listen(3000, () => console.log('BotMaster Backend 3000 portunda aktif!'));
