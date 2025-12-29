const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mineflayer = require('mineflayer');
const path = require('path');

const uygulama = express();
const sunucu = http.createServer(uygulama);
const io = new Server(sunucu);

uygulama.use(express.static(__dirname));
let aktifBotlar = {};

io.on('connection', (socket) => {
    socket.emit('bot-listesi-guncelle', Object.keys(aktifBotlar));

    socket.on('bot-baslat', (veri) => {
        const { ip, port, isim, sifre } = veri;
        if (aktifBotlar[isim]) return socket.emit('log', '<span style="color:#f33">[HATA] Bot zaten aktif!</span>');

        const bot = mineflayer.createBot({
            host: ip,
            port: parseInt(port) || 25565,
            username: isim
        });

        // Sohbet Dönüştürücü Hazırla
        const MesajParser = require('prismarine-chat')(bot.version || '1.20.1');

        bot.ayarlar = {
            kazmaAktif: false,
            otoMesajAktif: false,
            otoMesajMetni: "",
            otoMesajSuresi: 30,
            matematikAktif: false,
            matematikGecikme: 2
        };

        // TÜM MESAJLARI YAKALA (Sistem, Sohbet, Duyuru)
        bot.on('message', (jsonMsg) => {
            // Minecraft JSON mesajını HTML'e çevir
            const htmlMesaj = jsonMsg.toHTML();
            socket.emit('log', `<div class="satir"><strong>[${isim}]</strong> ${htmlMesaj}</div>`);

            // Matematik Çözücü için düz metin kontrolü
            if (bot.ayarlar.matematikAktif) {
                const duzMetin = jsonMsg.toString();
                const matRegex = /(\d+)\s*([\+\-\*\/x])\s*(\d+)/;
                const eslesme = duzMetin.match(matRegex);
                if (eslesme) {
                    let n1 = parseInt(eslesme[1]), n2 = parseInt(eslesme[3]), op = eslesme[2], sonuc;
                    if (op === '+') sonuc = n1 + n2;
                    else if (op === '-') sonuc = n1 - n2;
                    else if (op === '*' || op === 'x') sonuc = n1 * n2;
                    else if (op === '/') sonuc = Math.floor(n1 / n2);
                    if (sonuc !== undefined) {
                        setTimeout(() => bot.chat(`${sonuc}`), bot.ayarlar.matematikGecikme * 1000);
                    }
                }
            }
        });

        bot.on('spawn', () => {
            io.emit('bot-listesi-guncelle', Object.keys(aktifBotlar));
            if (sifre) setTimeout(() => bot.chat(`/login ${sifre}`), 2500);
            
            setInterval(() => {
                if (bot.players) {
                    socket.emit('bilgi-guncelle', { isim, oyuncuSayisi: Object.keys(bot.players).length });
                }
            }, 3000);
        });

        bot.on('physicsTick', async () => {
            if (!bot.ayarlar.kazmaAktif || bot.kaziyor) return;
            const blok = bot.blockAtCursor(4);
            if (blok && blok.type !== 0) {
                try {
                    bot.kaziyor = true;
                    bot.swingArm('right');
                    await bot.dig(blok);
                } catch (e) {} finally { bot.kaziyor = false; }
            }
        });

        bot.on('kicked', (sebep) => {
            socket.emit('log', `<span style="color:#f33">[SİSTEM] ${isim} Atıldı: ${sebep}</span>`);
            delete aktifBotlar[isim];
            io.emit('bot-listesi-guncelle', Object.keys(aktifBotlar));
        });

        aktifBotlar[isim] = bot;
    });

    // ... (Diğer durdurma, hareket ve ayar soketleri aynı kalıyor)
    socket.on('bot-durdur', (isim) => { if (aktifBotlar[isim]) { aktifBotlar[isim].quit(); delete aktifBotlar[isim]; io.emit('bot-listesi-guncelle', Object.keys(aktifBotlar)); } });
    socket.on('mesaj-gonder', ({ isim, mesaj }) => { if (aktifBotlar[isim]) aktifBotlar[isim].chat(mesaj); });
    socket.on('hareket', ({ isim, yon, durum }) => { if (aktifBotlar[isim]) aktifBotlar[isim].setControlState(yon, durum); });
    socket.on('ayarlari-uygula', ({ isim, yeniAyarlar }) => {
        const bot = aktifBotlar[isim];
        if (!bot) return;
        bot.ayarlar = { ...bot.ayarlar, ...yeniAyarlar };
        if (bot.otoInterval) clearInterval(bot.otoInterval);
        if (bot.ayarlar.otoMesajAktif && bot.ayarlar.otoMesajMetni) {
            bot.otoInterval = setInterval(() => bot.chat(bot.ayarlar.otoMesajMetni), bot.ayarlar.otoMesajSuresi * 1000);
        }
    });
});

sunucu.listen(process.env.PORT || 3000);
