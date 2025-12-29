const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mineflayer = require('mineflayer');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Dosyaları ana dizinden servis et
app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

let bot = null;
let miningState = false;

io.on('connection', (socket) => {
    socket.on('start-bot', (data) => {
        if (bot) {
            bot.quit();
            socket.emit('log', '§e[SİSTEM] Eski bot oturumu sonlandırıldı.');
        }

        bot = mineflayer.createBot({
            host: data.host,
            port: parseInt(data.port) || 25565,
            username: data.username,
            version: data.version || false,
            checkTimeoutInterval: 60000
        });

        setupBotEvents(socket);
    });

    socket.on('move', (dir) => {
        if (!bot) return;
        if (dir === 'stop') {
            const states = ['forward', 'back', 'left', 'right', 'jump', 'sneak'];
            states.forEach(s => bot.setControlState(s, false));
        } else {
            bot.setControlState(dir, true);
        }
    });

    socket.on('toggle-mining', (val) => { miningState = val; });
    
    socket.on('send-chat', (msg) => {
        if (bot) bot.chat(msg);
    });
});

function setupBotEvents(socket) {
    bot.on('spawn', () => socket.emit('log', '§a[SİSTEM] Bot başarıyla bağlandı ve doğdu!'));
    
    bot.on('chat', (username, message) => {
        socket.emit('log', `§b${username}: §f${message}`);
        
        // Matematik Çözücü (Regex)
        const mathMatch = message.match(/(\d+)\s*([\+\-\*\/x])\s*(\d+)/);
        if (mathMatch) {
            const n1 = parseInt(mathMatch[1]);
            const op = mathMatch[2];
            const n2 = parseInt(mathMatch[3]);
            let result;
            
            switch(op.toLowerCase()) {
                case '+': result = n1 + n2; break;
                case '-': result = n1 - n2; break;
                case '*': case 'x': result = n1 * n2; break;
                case '/': result = Math.floor(n1 / n2); break;
            }
            if (result !== undefined) {
                setTimeout(() => bot.chat(`${result}`), 1200);
            }
        }
    });

    bot.on('kicked', (reason) => {
        // Kick sebebini sade metne çevir
        let cleanReason = "Bilinmiyor";
        try {
            const parsed = JSON.parse(reason);
            cleanReason = parsed.text || parsed.extra?.map(e => e.text).join('') || reason;
        } catch(e) { cleanReason = reason; }
        
        socket.emit('log', `§c[SİSTEM] ATILDIN! Sebep: ${cleanReason}`);
    });

    bot.on('error', (err) => socket.emit('log', `§4[HATA] ${err.message}`));

    // Akıllı Mining Sistemi
    bot.on('physicsTick', async () => {
        if (!miningState || !bot || bot.isMiningTask) return;

        const targetBlock = bot.blockAtCursor(4);
        if (targetBlock && targetBlock.type !== 0) {
            try {
                bot.isMiningTask = true;
                bot.swingArm('right');
                await bot.dig(targetBlock);
            } catch (err) {
                // Blok kırılamadıysa veya iptal edildiyse
            } finally {
                bot.isMiningTask = false;
            }
        }
    });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Cyber AFK Bot aktif: Port ${PORT}`));
