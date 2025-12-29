const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const OpenAI = require('openai');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));

// --- GÜVENLİK VE AI KONFİGÜRASYONU ---
const OPENAI_KEY = "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";
const openai = new OpenAI({ apiKey: OPENAI_KEY });

let bot = null;
let settings = { aiChat: true, autoMine: false, autoDefend: true };

function createBot(config) {
    if (bot) { bot.quit(); bot = null; }

    bot = mineflayer.createBot({
        host: config.host,
        username: config.username,
        version: false,
        checkTimeoutInterval: 60000
    });

    bot.loadPlugin(pathfinder);

    bot.on('spawn', () => {
        io.emit('status', 'connected');
        io.emit('log', '💎 SİSTEM AKTİF: AI Zekası ve Koruma Devrede.');
        if (config.password) bot.chat(`/login ${config.password}`);
    });

    // --- ChatGPT SOHBET MODÜLÜ ---
    bot.on('chat', async (username, message) => {
        if (username === bot.username) return;
        io.emit('chat-log', { user: username, msg: message });

        if (settings.aiChat) {
            try {
                const aiResponse = await openai.chat.completions.create({
                    model: "gpt-3.5-turbo",
                    messages: [
                        { role: "system", content: "Sen bir Minecraft botusun. Kısa, samimi ve oyuncuları eğlendiren cevaplar ver." },
                        { role: "user", content: `${username}: ${message}` }
                    ],
                    max_tokens: 60
                });
                bot.chat(aiResponse.choices[0].message.content);
            } catch (err) { console.error("AI Hatası:", err.message); }
        }
    });

    // --- HATA VE RECONNECT YÖNETİMİ (7/24 İÇİN) ---
    bot.on('error', (err) => io.emit('log', `⚠️ HATA: ${err.message}`));
    bot.on('end', () => {
        io.emit('status', 'disconnected');
        io.emit('log', '🔌 Bağlantı koptu, 5 saniye içinde otomatik yeniden bağlanılıyor...');
        setTimeout(() => createBot(config), 5000);
    });
}

// Socket İletişimi
io.on('connection', (socket) => {
    socket.on('connect-bot', (data) => createBot(data));
    socket.on('send-chat', (msg) => bot?.chat(msg));
    socket.on('move', (d) => bot?.setControlState(d.dir, d.state));
});

server.listen(PORT, () => console.log(`CyberCore 7/24 Yayında!`));
