const mineflayer = require('mineflayer');
const http = require('http');

// --- RENDER İÇİN GEREKLİ WEB SUNUCUSU ---
// Render bu portu görmezse botu durdurur.
http.createServer((req, res) => {
  res.write("Bot Calisiyor!");
  res.end();
}).listen(process.env.PORT || 10000);

// --- MINECRAFT BOT AYARLARI ---
const bot = mineflayer.createBot({
  host: 'SUNUCU_IP_ADRESI', 
  port: 25565,
  username: 'AFK_Bot_Render',
  version: '1.20.1' // Sunucu sürümüne göre değiştir
});

bot.on('spawn', () => console.log('Bot sunucuya girdi!'));
bot.on('error', (err) => console.log('Hata:', err));
bot.on('kicked', (reason) => console.log('Atildi:', reason));
