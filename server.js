const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mineflayer = require('mineflayer');
const OpenAI = require('openai');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

const OPENAI_KEY = "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";
const openai = new OpenAI({ apiKey: OPENAI_KEY });

let bot = null;

function solveSmart(message) {
    const cleanMsg = message.replace(/§[0-9a-fk-or]/gi, '').trim();
    // Matematik Çözücü
    const mathMatch = cleanMsg.match(/(\d+)\s*([\+\-\*x\/])\s*(\d+)/);
    if (mathMatch) {
        const n1 = parseInt(mathMatch[1]);
        const op = mathMatch[2];
        const n2 = parseInt(mathMatch[3]);
        let res;
        if (op === '+') res = n1 + n2;
        else if (op === '-') res = n1 - n2;
        else if (op === '*' || op === 'x') res = n1 * n2;
        else if (op === '/') res = n2 !== 0 ? Math.floor(n1 / n2) : null;
        if (res !== null) return res.toString();
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
            checkTimeoutInterval: 60000
        });

        bot.on('message', async (jsonMsg) => {
            const rawText = jsonMsg.toString();
            socket.emit('log', { text: jsonMsg.toMotd() });
            
            // 1. Otomatik Matematik/Kod Çözücü
            const answer = solveSmart(rawText);
            if (answer) setTimeout(() => bot.chat(answer), 1200);

            // 2. ChatGPT Entegrasyonu (Sana seslenilirse cevap verir)
            if (rawText.includes(bot.username)) {
                try {
                    const aiRes = await openai.chat.completions.create({
                        model: "gpt-3.5-turbo",
                        messages: [{role: "system", content: "Sen zeki bir Minecraft botusun."}, {role: "user", content: rawText}],
                        max_tokens: 50
                    });
                    bot.chat(aiRes.choices[0].message.content);
                } catch(e) {}
            }
        });

        bot.on('login', () => {
            socket.emit('status', { connected: true, msg: "Sisteme Giriş Yapıldı" });
            if (c.password) bot.chat(`/login ${c.password}`);
        });

        bot.on('error', (err) => socket.emit('log', { text: `§4[HATA] ${err.message}` }));
        bot.on('kicked', (reason) => socket.emit('log', { text: `§c[ATILDI] ${reason}` }));
        bot.on('end', () => socket.emit('status', { connected: false, msg: "Bağlantı Kesildi" }));
    });

    socket.on('send-chat', (m) => { if(bot) bot.chat(m); });
    socket.on('move', (dir) => {
        if(bot) {
            bot.setControlState(dir, true);
            setTimeout(() => bot.setControlState(dir, false), 400);
        }
    });
    socket.on('stop-bot', () => { if(bot) bot.quit(); });
});

server.listen(process.env.PORT || 3000, () => console.log("CyberCore Aktif!"));
