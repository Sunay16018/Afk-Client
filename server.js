const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const mineflayer = require('mineflayer');
const { GoogleGenerativeAI } = require("@google/generative-ai");

app.use(express.static(__dirname));

// Gemini AI Yapılandırması
const genAI = new GoogleGenerativeAI("AIzaSyCFU2TM3B0JLjsStCI0zObHs3K5IU5ZKc4");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

let bots = {};
// Arayüzden gelecek olan buton ayarlarını burada tutuyoruz
let botSettings = { aiEnabled: true, mathEnabled: true, delay: 2000 };

// AI ve Matematik Motoru
async function handleSmartResponse(msgStr, botName) {
    const cleanMsg = msgStr.replace(/§[0-9a-fk-or]/gi, '').trim();
    const lowerMsg = cleanMsg.toLowerCase();

    // 1. Matematik Çözücü (Sadece buton AÇIKSA çalışır)
    if (botSettings.mathEnabled) {
        const mathMatch = cleanMsg.match(/(\d+)\s*([\+\-\*x\/])\s*(\d+)/);
        if (mathMatch) {
            const n1 = parseInt(mathMatch[1]);
            const op = mathMatch[2];
            const n2 = parseInt(mathMatch[3]);
            let res = null;
            if (op === '+') res = n1 + n2;
            else if (op === '-') res = n1 - n2;
            else if (op === '*' || op === 'x') res = n1 * n2;
            else if (op === '/' || op === ':') res = n2 !== 0 ? Math.floor(n1 / n2) : null;
            
            if (res !== null) return { answer: res.toString(), delay: botSettings.delay };
        }
    }

    // 2. AI Sohbet (Sadece buton AÇIKSA çalışır)
    if (botSettings.aiEnabled) {
        const keywords = ["naber", "selam", "sa", "nasılsın", botName.toLowerCase()];
        // Mesajda botun adı geçiyorsa veya selam veriliyorsa cevap ver
        if (keywords.some(k => lowerMsg.includes(k))) {
            try {
                const prompt = `Sen bir Minecraft oyuncususun. Adın ${botName}. Çok kısa ve samimi bir cevap ver: ${cleanMsg}`;
                const result = await model.generateContent(prompt);
                const response = result.response.text().substring(0, 80).replace(/\n/g, ' ');
                return { answer: response, delay: botSettings.delay + 500 };
            } catch (e) { return null; }
        }
    }
    return null;
}

io.on('connection', (socket) => {
    // Arayüzdeki butonlara basıldığında burası tetiklenir
    socket.on('update-settings', (newSettings) => {
        botSettings = newSettings;
        console.log("Ayarlar Güncellendi:", botSettings);
    });

    // BOTU BAĞLATMA
    socket.on('join', (data) => {
        const botId = "1";
        if (bots[botId]) { try { bots[botId].quit(); } catch(e){} }

        const bot = mineflayer.createBot({
            host: data.host,
            port: parseInt(data.port) || 25565,
            username: data.username,
            version: false
        });

        bots[botId] = bot;

        bot.on('spawn', () => {
            socket.emit('status', { connected: true });
            socket.emit('log', { msg: '§a[SİSTEM] Bot başarıyla bağlandı!' });

            // Otomatik Şifre Girişi
            if (data.password) {
                setTimeout(() => {
                    bot.chat(`/register ${data.password} ${data.password}`);
                    bot.chat(`/login ${data.password}`);
                }, 2000);
            }
        });

        bot.on('message', async (jsonMsg) => {
            // Mesajı arayüze gönder
            socket.emit('log', { msg: jsonMsg.toHTML() });

            // AI/Matematik cevaplarını kontrol et
            const result = await handleSmartResponse(jsonMsg.toString(), data.username);
            if (result && bot.entity) {
                setTimeout(() => { 
                    if(bot.entity) bot.chat(result.answer); 
                }, result.delay);
            }
        });

        bot.on('error', (err) => socket.emit('log', { msg: `§cHata: ${err.message}` }));
        bot.on('kicked', (reason) => socket.emit('log', { msg: `§cAtıldı: ${reason}` }));
        bot.on('end', () => socket.emit('status', { connected: false }));
    });

    // Manuel Mesaj Gönderme
    socket.on('send-chat', (data) => {
        const bot = bots["1"];
        if (bot && bot.entity) bot.chat(data.msg);
    });

    socket.on('stop-bot', () => {
        if (bots["1"]) bots["1"].quit();
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Stabil server ${PORT} portunda çalışıyor.`));
    
