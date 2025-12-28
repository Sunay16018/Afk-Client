const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mineflayer = require('mineflayer');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Statik dosyaları (html, css, js) sunar
app.use(express.static(__dirname));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

let bot = null;

// Matematik Çözücü (Gelişmiş)
function solveMath(message) {
    const match = message.match(/(\d+)\s*([\+\-\*\:])\s*(\d+)/);
    if (match) {
        const n1 = parseInt(match[1]);
        const op = match[2];
        const n2 = parseInt(match[3]);
        if (op === '+') return n1 + n2;
        if (op === '-') return n1 - n2;
        if (op === '*') return n1 * n2;
        if (op === ':') return n2 !== 0 ? Math.floor(n1 / n2) : null;
    }
    return null;
}

io.on('connection', (socket) => {
    console.log('Bir kullanıcı panele bağlandı.');

    socket.on('start-bot', (config) => {
        if (bot) {
            bot.quit();
            console.log('Eski bot kapatıldı.');
        }

        bot = mineflayer.createBot({
            host: config.host,
            port: parseInt(config.port) || 25565,
            username: config.username,
            version: false, // Otomatik versiyon tespiti
            checkTimeoutInterval: 60000
        });

        // BOT BAŞARIYLA GİRDİĞİNDE
        bot.on('login', () => {
            socket.emit('status', { connected: true });
            console.log(`${config.username} sunucuya girdi.`);
            
            // Oyuncu listesini hemen gönder (TAB için)
            setTimeout(() => {
                if (bot.players) {
                    socket.emit('player-list', Object.keys(bot.players));
                }
            }, 3000);
        });

        // MESAJLARI TERMİNALE GÖNDER
        bot.on('messagestr', (msg) => {
            socket.emit('log', { text: msg });

            // Otomatik Login/Register (Şifre varsa)
            if ((msg.includes('/login') || msg.includes('/register')) && config.password) {
                bot.chat(`/login ${config.password}`);
            }

            // Matematik Çözücü
            const mathResult = solveMath(msg);
            if (mathResult !== null) {
                setTimeout(() => bot.chat(mathResult.toString()), 1000);
            }
        });

        // OYUNCU AYRILDIĞINDA VEYA GİRDİĞİNDE LİSTEYİ GÜNCELLE
        bot.on('playerJoined', () => {
            socket.emit('player-list', Object.keys(bot.players));
        });
        bot.on('playerLeft', () => {
            socket.emit('player-list', Object.keys(bot.players));
        });

        // HATA VE ATILMA DURUMLARI
        bot.on('kicked', (reason) => {
            socket.emit('log', { text: `§cSunucudan Atıldın: ${reason}` });
        });

        bot.on('error', (err) => {
            socket.emit('log', { text: `§4Hata: ${err.message}` });
        });

        bot.on('end', () => {
            socket.emit('status', { connected: false });
            socket.emit('log', { text: '§7Bağlantı koptu.' });
        });
    });

    // TERMİNALDEN GELEN KOMUTLAR
    socket.on('send-chat', (msg) => {
        if (bot) bot.chat(msg);
    });

    // OYUNCU LİSTESİ İSTEĞİ (TAB BUTONU)
    socket.on('get-players', () => {
        if (bot && bot.players) {
            socket.emit('player-list', Object.keys(bot.players));
        } else {
            socket.emit('log', { text: '§cBot bağlı değil veya liste alınamadı.' });
        }
    });

    // HAREKET KOMUTLARI
    socket.on('move', (dir) => {
        if (bot) {
            if (dir === 'jump') {
                bot.setControlState('jump', true);
                setTimeout(() => bot.setControlState('jump', false), 500);
            } else {
                bot.setControlState(dir, true);
                setTimeout(() => bot.setControlState(dir, false), 1000);
            }
        }
    });

    // BAĞLANTIYI KES
    socket.on('stop-bot', () => {
        if (bot) {
            bot.quit();
            bot = null;
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`AFK CLIENT sunucusu ${PORT} portunda aktif.`);
});
