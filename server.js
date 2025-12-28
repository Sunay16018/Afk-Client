const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mineflayer = require('mineflayer');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Gemini API Yapılandırması (Kendi anahtarını buraya koyabilirsin)
const genAI = new GoogleGenerativeAI("AIzaSyCFU2TM3B0JLjsStCI0zObHs3K5IU5ZKc4");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

app.use(express.static(__dirname));

let bot = null;
let botSettings = { aiEnabled: true, mathEnabled: true, delay: 2000 };

async function solveSmart(msgStr, botName) {
    const cleanMsg = msgStr.replace(/§[0-9a-fk-or]/gi, '').trim();
    const lowerMsg = cleanMsg.toLowerCase();

    // 1. Matematik Çözücü
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

    // 2. AI Sohbet
    if (botSettings.aiEnabled) {
        const keywords = ["naber", "selam", "sa", "nasılsın", "merhaba", botName.toLowerCase()];
        if (keywords.some(k => lowerMsg.includes(k)) && !lowerMsg.startsWith(botName.toLowerCase())) {
            try {
                const prompt = `Sen bir Minecraft oyuncususun. Adın ${botName}. Çok kısa ve samimi bir cevap ver. Mesaj: ${cleanMsg}`;
                const result = await model.generateContent(prompt);
                const response = await result.response;
                return { answer: response.text().substring(0, 80).replace(/\n/g, ' '), delay: botSettings.delay + 1000 };
            } catch (e) { return null; }
        }
    }
    return null;
}

io.on('connection', (socket) => {
    socket.on('update-settings', (s) => { botSettings = s; });

    socket.on('start-bot', (c) => {
        if (bot) { try { bot.quit(); } catch(e){} }
        
        bot = mineflayer.createBot({
            host: c.host.split(':')[0],
            port: parseInt(c.host.split(':')[1]) || 25565,
            username: c.username,
            version: false
        });

        bot.on('spawn', () => {
            if (c.password) {
                setTimeout(() => {
                    bot.chat(`/register ${c.password} ${c.password}`);
                    bot.chat(`/login ${c.password}`);
                }, 1500);
            }
        });

        bot.on('message', async (jsonMsg) => {
            socket.emit('log', { text: jsonMsg.toMotd() });
            const result = await solveSmart(jsonMsg.toString(), c.username);
            if (result && bot && bot.entity) {
                setTimeout(() => { if(bot && bot.entity) bot.chat(result.answer); }, result.delay);
            }
        });

        bot.on('login', () => socket.emit('status', { connected: true }));
        bot.on('end', () => socket.emit('status', { connected: false }));
        bot.on('kicked', (reason) => socket.emit('log', { text: `§cAtıldı: ${reason}` }));
        bot.on('error', (err) => socket.emit('log', { text: `§cHata: ${err.message}` }));
    });

    socket.on('send-chat', (m) => { if(bot) bot.chat(m); });
    socket.on('stop-bot', () => { if(bot) bot.quit(); });
});

server.listen(process.env.PORT || 3000);
                           
