const mineflayer = require('mineflayer');
const express = require('express');
const path = require('path');
const app = express();

// Render'ın otomatik atadığı portu kullanmak zorunludur
const PORT = process.env.PORT || 10000;

const bots = {};
const botData = {};

// STATIK DOSYALAR (HTML dosyanın adının index.html olduğunu varsayıyorum)
app.use(express.static(path.join(__dirname, 'public')));

// RENDER YAŞAM SİNYALİ (Bu rota olmazsa Render projeyi kapatır)
app.get('/', (req, res) => {
    res.send('BotMaster Backend Aktif - Render Uyumluluk Modu');
});

// BOT BAŞLATMA
app.get('/start', (req, res) => {
    const { sid, host, user } = req.query;
    if (!host || !user) return res.send({ status: 'error', msg: 'Eksik bilgi' });

    const [ip, port] = host.split(':');

    // Eğer bot zaten varsa temizle
    if (bots[user]) {
        try { bots[user].quit(); } catch(e) {}
    }

    const bot = mineflayer.createBot({
        host: ip,
        port: parseInt(port) || 25565,
        username: user
    });

    // Hesap bazlı veriyi sıfırla
    botData[user] = {
        logs: [`[Sistem] ${user} için oturum açıldı.`],
        health: 20,
        food: 20,
        inventory: [],
        intervals: {}
    };

    bot.on('message', (jsonMsg) => {
        const msg = jsonMsg.toString();
        if (msg.trim()) {
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

    bot.on('spawn', () => botData[user].logs.push(">> Sunucuya başarıyla girildi!"));
    bot.on('error', (err) => botData[user].logs.push("!! Hata: " + err.message));
    bot.on('kicked', (reason) => botData[user].logs.push("!! Atıldı: " + reason));

    bots[user] = bot;
    res.send({ status: 'ok' });
});

// GÜNCELLEME VE AYARLAR
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
            const currentYaw = bot.entity.yaw;
            if (val === 'left') bot.look(currentYaw + 1.57, 0);
            if (val === 'right') bot.look(currentYaw - 1.57, 0);
            if (val === 'back') bot.look(currentYaw + 3.14, 0);
            break;

        case 'move':
            bot.setControlState('forward', status === 'on');
            break;

        case 'jump':
            bot.setControlState('jump', status === 'on');
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

// VERİ SENKRONİZASYONU
app.get('/data', (req, res) => {
    const { user } = req.query;
    const response = { active: Object.keys(bots), botData: {} };

    if (user && bots[user] && botData[user]) {
        response.botData[user] = {
            logs: [...botData[user].logs], // Logları kopyala
            health: bots[user].health || 20,
            food: bots[user].food || 20,
            inventory: bots[user].inventory.items().map(i => ({
                name: i.name, count: i.count, slot: i.slot
            }))
        };
        // Logları temizleme: İstersen temizle, istersen HTML tarafında kontrol et. 
        // Burada temizliyoruz ki HTML sadece yenileri alsın.
        botData[user].logs = [];
    }
    res.json(response);
});

// DURDURMA
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

// SUNUCUYU BAŞLAT
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Render Uyumluluk Modu: Port ${PORT} dinleniyor.`);
});
                                
