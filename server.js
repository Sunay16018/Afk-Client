const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mineflayer = require('mineflayer');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const genAI = new GoogleGenerativeAI("AIzaSyCFU2TM3B0JLjsStCI0zObHs3K5IU5ZKc4");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

app.use(express.static(__dirname));

let bot = null;

async function solveSmart(message, botName) {
    const cleanMsg = message.replace(/§[0-9a-fk-or]/gi, '').trim();

    // 1. Matematik Sorusu Yakalama
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
        if (res !== null) return { answer: res.toString(), delay: 1200 };
    }

    // 2. Kelime/Kod Oyunu Yakalama
    const codeMatch = cleanMsg.match(/(?:yazın|kod|yaz|ilk)\s*[:>-]?\s*([A-Za-z0-9]{5,10})/i);
    if (codeMatch && codeMatch[1]) return { answer: codeMatch[1], delay: 1000 };

    // 3. AI Sohbet (Bot ismi geçerse veya soru sorulursa)
    const lowerMsg = cleanMsg.toLowerCase();
    if (lowerMsg.includes(botName.toLowerCase()) || (cleanMsg.includes("?") && cleanMsg.length > 5)) {
        try {
            const prompt = `Sen bir Minecraft oyuncususun. Kısa, samimi ve Türkçe cevap ver. Mesaj: ${cleanMsg}`;
            const result = await model.generateContent(prompt);
            const response = await result.response;
            let text = response.text().substring(0, 80).replace(/\n/g, ' ');
            return { answer: text, delay: 2000 };
        } catch (e) { return null; }
    }
    return null;
}

io.on('connection', (socket) => {
    socket.on('start-bot', (c) => {
        if (bot) { try { bot.quit(); } catch(e){} }
        bot = mineflayer.createBot({
            host: c.host,
            port: parseInt(c.port) || 25565,
            username: c.username,
            version: false
        });

        bot.on('message', async (jsonMsg) => {
            socket.emit('log', { text: jsonMsg.toMotd() });
            const result = await solveSmart(jsonMsg.toString(), c.username);
            if (result && bot) {
                setTimeout(() => { if (bot && bot.entity) bot.chat(result.answer); }, result.delay);
            }
        });

        bot.on('login', () => socket.emit('status', { connected: true }));
        bot.on('end', () => socket.emit('status', { connected: false }));
        bot.on('kicked', (r) => socket.emit('log', { text: `§cAtıldın: ${r}` }));
    });

    socket.on('send-chat', (m) => { if(bot) bot.chat(m); });
    socket.on('move', (dir) => {
        if(bot) {
            bot.setControlState(dir === 'jump' ? 'jump' : dir, true);
            setTimeout(() => bot.setControlState(dir === 'jump' ? 'jump' : dir, false), 500);
        }
    });
    socket.on('stop-bot', () => { if(bot) bot.quit(); });
});

server.listen(process.env.PORT || 3000);
