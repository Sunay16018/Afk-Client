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
    // Mevcut bot listesini gönder
    socket.emit('bot-listesi-guncelle', Object.keys(aktifBotlar));

    socket.on('bot-baslat', (veri) => {
        const { ip, port, isim, sifre } = veri;
        if (aktifBotlar[isim]) return socket.emit('log', `§c[HATA] ${isim} isimli bot zaten aktif!`);

        const bot = mineflayer.createBot({
            host: ip,
            port: parseInt(port) || 25565,
            username: isim,
            checkTimeoutInterval: 60000
        });

        // Bot Ayarları Başlangıç Değerleri
        bot.ayarlar = {
            kazmaAktif: false,
            otoMesajAktif: false,
            otoMesajMetni: "",
            otoMesajSuresi: 30,
            matematikAktif: false,
            matematikGecikme: 2
        };

        bot.on('spawn', () => {
            socket.emit('log', `§a[SİSTEM] ${isim} sunucuya giriş yaptı!`);
            io.emit('bot-listesi-guncelle', Object.keys(aktifBotlar));
            
            // Otomatik Login (Şifre varsa)
            if (sifre) {
                setTimeout(() => bot.chat(`/login ${sifre}`), 2500);
            }

            // Oyuncu sayısı güncelleme döngüsü
            setInterval(() => {
                if (bot.players) {
                    socket.emit('bilgi-guncelle', { 
                        isim, 
                        oyuncuSayisi: Object.keys(bot.players).length 
                    });
                }
            }, 3000);
        });

        bot.on('chat', (kullanici, mesaj) => {
            socket.emit('log', `§7[${isim}] §b${kullanici}: §f${mesaj}`);
            
            // Matematik Çözücü Mantığı
            if (bot.ayarlar.matematikAktif) {
                const matRegex = /(\d+)\s*([\+\-\*\/x])\s*(\d+)/;
                const eslesme = mesaj.match(matRegex);
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

        // Akıllı Kazma Döngüsü (PhysicsTick)
        bot.on('physicsTick', async () => {
            if (!bot.ayarlar.kazmaAktif || bot.kaziyorMu) return;
            
            const blok = bot.blockAtCursor(4);
            if (blok && blok.type !== 0) {
                try {
                    bot.kaziyorMu = true;
                    bot.swingArm('right');
                    await bot.dig(blok);
                } catch (hata) {
                    // Kırma iptal olursa veya hata verirse
                } finally {
                    bot.kaziyorMu = false;
                }
            }
        });

        bot.on('kicked', (sebep) => {
            socket.emit('log', `§c[SİSTEM] ${isim} ATILDI! Sebep: ${sebep}`);
            delete aktifBotlar[isim];
            io.emit('bot-listesi-guncelle', Object.keys(aktifBotlar));
        });

        bot.on('error', (h) => socket.emit('log', `§4[HATA] ${isim}: ${h.message}`));

        aktifBotlar[isim] = bot;
    });

    socket.on('bot-durdur', (isim) => {
        if (aktifBotlar[isim]) {
            aktifBotlar[isim].quit();
            delete aktifBotlar[isim];
            io.emit('bot-listesi-guncelle', Object.keys(aktifBotlar));
        }
    });

    socket.on('mesaj-gonder', ({ isim, mesaj }) => {
        if (aktifBotlar[isim]) aktifBotlar[isim].chat(mesaj);
    });

    socket.on('hareket', ({ isim, yon, durum }) => {
        if (aktifBotlar[isim]) aktifBotlar[isim].setControlState(yon, durum);
    });

    socket.on('ayarlari-uygula', ({ isim, yeniAyarlar }) => {
        const bot = aktifBotlar[isim];
        if (!bot) return;

        bot.ayarlar = { ...bot.ayarlar, ...yeniAyarlar };

        // Oto Mesaj Zamanlayıcısını Yönet
        if (bot.otoMesajInterval) clearInterval(bot.otoMesajInterval);
        if (bot.ayarlar.otoMesajAktif && bot.ayarlar.otoMesajMetni) {
            bot.otoMesajInterval = setInterval(() => {
                bot.chat(bot.ayarlar.otoMesajMetni);
            }, bot.ayarlar.otoMesajSuresi * 1000);
        }
    });
});

const PORT = process.env.PORT || 3000;
sunucu.listen(PORT, () => console.log(`Sistem Aktif: Port ${PORT}`));
