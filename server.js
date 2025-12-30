const mineflayer = require('mineflayer');
const http = require('http');

// 1. RENDER İÇİN HTTP SUNUCUSU (Kritik: Port hatasını önler)
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Minecraft AFK Botu Aktif!\n');
});

// Render'ın atadığı portu veya 10000 portunu kullanır
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda dinleniyor...`);
});

// 2. MINECRAFT BOT AYARLARI
const botArgs = {
    host: 'SUNUCU_IP_ADRESI', // Buraya sunucu IP'sini yaz (örn: play.sunucu.com)
    port: 25565,              // Genelde 25565'tir
    username: 'AFK_Bot_Render', // Botun oyundaki adı
    version: '1.20.1'         // Sunucu sürümünü buraya yaz
};

let bot;

function createBot() {
    bot = mineflayer.createBot(botArgs);

    bot.on('spawn', () => {
        console.log('Bot başarıyla sunucuya giriş yaptı!');
    });

    bot.on('chat', (username, message) => {
        if (username === bot.username) return;
        console.log(`${username}: ${message}`);
    });

    // Bağlantı kesilirse otomatik yeniden bağlanma
    bot.on('end', () => {
        console.log('Bağlantı kesildi, 10 saniye sonra tekrar denenecek...');
        setTimeout(createBot, 10000);
    });

    bot.on('error', (err) => {
        console.log('Hata oluştu:', err);
    });

    bot.on('kicked', (reason) => {
        console.log('Sunucudan atıldı. Sebep:', reason);
    });
}

createBot();
