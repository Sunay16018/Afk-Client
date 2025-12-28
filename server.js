const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mineflayer = require('mineflayer');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Gemini API Yapılandırması
const genAI = new GoogleGenerativeAI("AIzaSyCFU2TM3B0JLjsStCI0zObHs3K5IU5ZKc4");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

app.use(express.static(__dirname));

let bot = null;

async function solveSmart(msgStr, botName) {
    const cleanMsg = msgStr.replace(/§[0-9a-fk-or]/gi, '').trim();
    const lowerMsg = cleanMsg.toLowerCase();

    // 1. Matematik & Kelime Oyunları
    const mathMatch = cleanMsg.match(/(\d+)\s*([\+\-\*x\/])\s*(\d+)/);
    if (mathMatch) {
        const n1 = parseInt(mathMatch[1]);
        const op = mathMatch[2];
        const n2 = parseInt(mathMatch[3]);
        let res;
        if (op === '+') res = n1 + n2;
        else if (op === '-') res = n1 - n2;
        else if (op === '*' || op === 'x') res = n1 * n2;
        else if (op === '/' || op === ':') res = n2 !== 0 ? Math.floor(n1 / n2) : null;
        if (res !== null) return { answer: res.toString(), delay: 1100 };
    }

    // 2. AI Sohbet Tetikleyici
    // Botun ismi geçerse veya birisi "naber, selam" vb. yazarsa
    const keywords = ["naber", "selam", "sa", "nasılsın", "merhaba", "hi", "hey", botName.toLowerCase()];
    const hasKeyword = keywords.some(k => lowerMsg.includes(k));

    if (hasKeyword && !lowerMsg.startsWith(botName.toLowerCase())) {
        try {
            const prompt = `Sen bir Minecraft oyuncususun (Adın: ${botName}). Çok kısa, havalı ve Türk oyuncu dilinde (sa, as, eyv gibi) cevap ver. Mesaj: ${cleanMsg}`;
            const result = await model.generateContent(prompt);
            return { answer: result.response.text().substring(0, 80), delay: 2000 };
        } catch (e) { return null; }
    }
    return null;
}

io.on('connection', (socket) => {
    socket.on('start-bot', (c) => {
        if (bot) { try { bot.quit(); } catch(e){} }
        bot = mineflayer.createBot({ host: c.host, port: parseInt(c.port) || 25565, username: c.username });

        bot.on('message', async (jsonMsg) => {
            // İsimleri ve renkleri içeren tam satırı gönderir
            socket.emit('log', { text: jsonMsg.toMotd() });
            
            const result = await solveSmart(jsonMsg.toString(), c.username);
            if (result && bot) {
                setTimeout(() => { if(bot && bot.entity) bot.chat(result.answer); }, result.delay);
            }
        });

        bot.on('login', () => socket.emit('status', { connected: true }));
        bot.on('end', () => socket.emit('status', { connected: false }));
    });

    socket.on('send-chat', (m) => { if(bot) bot.chat(m); });
    socket.on('stop-bot', () => { if(bot) bot.quit(); });
});

server.listen(process.env.PORT || 3000);
