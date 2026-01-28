const mineflayer = require('mineflayer');
const readline = require('readline');

// --- AYARLAR ---
const botOptions = {
    host: 'localhost', // Sunucu IP adresi
    port: 25565,       // Sunucu portu
    username: 'Kontrol_Botu'
};

const bot = mineflayer.createBot(botOptions);

// Değişkenler
let autoMessageActive = false;
let autoMessageTimer = null;
const moveStates = { forward: false, back: false, left: false, right: false, jump: false };

// --- ARAYÜZ ÇİZİMİ ---
function updateUI() {
    console.clear();
    const pos = bot.entity ? bot.entity.position : { x: 0, y: 0, z: 0 };
    
    console.log("==================================================");
    console.log(` BOT ADI: ${bot.username} | DURUM: Bağlı`);
    console.log(` KOORDİNAT: X: ${pos.x.toFixed(1)} Y: ${pos.y.toFixed(1)} Z: ${pos.z.toFixed(1)}`);
    console.log("==================================================");
    console.log(" [W-A-S-D] Hareket (Basınca başlar, tekrar basınca durur)");
    console.log(" [SPACE]   Zıplama Aç/Kapat");
    console.log(" [E]       Envanteri Listele");
    console.log(" [M]       Oto-Mesaj Aç/Kapat (60sn)");
    console.log(" [Q]       Çıkış Yap");
    console.log("--------------------------------------------------");
    console.log(" KONSOL AKIŞI:");
}

// --- KLAVYE KONTROLÜ ---
readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) process.stdin.setRawMode(true);

process.stdin.on('keypress', (str, key) => {
    if (!key) return;

    // Hareket Kontrolleri
    const controls = { 'w': 'forward', 's': 'back', 'a': 'left', 'd': 'right', 'space': 'jump' };
    
    if (controls[key.name]) {
        const dir = controls[key.name];
        moveStates[dir] = !moveStates[dir];
        bot.setControlState(dir, moveStates[dir]);
        updateUI();
        console.log(`>> ${dir.toUpperCase()} durumu: ${moveStates[dir] ? 'AKTİF' : 'DURDURULDU'}`);
    }

    // Envanter Listesi
    if (key.name === 'e') {
        const items = bot.inventory.items();
        console.log("\n--- ENVANTER ---");
        if (items.length === 0) console.log("Envanter boş.");
        else items.forEach(item => console.log(`- ${item.name} x${item.count}`));
        console.log("----------------\n");
    }

    // Oto-Mesaj
    if (key.name === 'm') {
        autoMessageActive = !autoMessageActive;
        if (autoMessageActive) {
            autoMessageTimer = setInterval(() => bot.chat("Bot aktif!"), 60000);
            console.log(">> Oto-mesaj sistemi AÇILDI.");
        } else {
            clearInterval(autoMessageTimer);
            console.log(">> Oto-mesaj sistemi KAPATILDI.");
        }
    }

    // Çıkış
    if (key.name === 'q' || (key.ctrl && key.name === 'c')) {
        console.log("Ayrılıyor...");
        process.exit();
    }
});

// --- BOT OLAYLARI ---
bot.on('chat', (username, message) => {
    if (username === bot.username) return;
    console.log(`[MESAJ] ${username}: ${message}`);
});

bot.on('spawn', () => {
    updateUI();
    setInterval(updateUI, 2000); // Ekranı 2 saniyede bir güncelle (koordinatlar için)
});

bot.on('error', (err) => console.log(`Hata: ${err.message}`));
bot.on('kicked', (reason) => console.log(`Sunucudan atıldı: ${reason}`));
