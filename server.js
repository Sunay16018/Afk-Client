const mineflayer = require('mineflayer');
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

// Kullanıcı oturumları
let userSessions = {};

// Oturum yönetimi
function getSession(sid) {
    if (!userSessions[sid]) {
        userSessions[sid] = {
            bots: {},
            logs: {},
            configs: {},
            lastCleanup: Date.now()
        };
    }
    return userSessions[sid];
}

// Eski oturumları temizle
function cleanupOldSessions() {
    const now = Date.now();
    const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 saat
    
    for (const sid in userSessions) {
        const session = userSessions[sid];
        if (now - session.lastCleanup > SESSION_TIMEOUT) {
            // Tüm botları durdur
            for (const botName in session.bots) {
                if (session.bots[botName]) {
                    try {
                        session.bots[botName].quit();
                    } catch (e) {}
                }
            }
            delete userSessions[sid];
            console.log(`[TEMİZLİK] Eski oturum silindi: ${sid.substring(0, 10)}...`);
        }
    }
}

// Bot başlatma fonksiyonu
function startBot(sid, host, user, ver) {
    const session = getSession(sid);
    
    // Bot zaten varsa
    if (session.bots[user]) {
        if (session.logs[user]) {
            session.logs[user].push(`[SİSTEM] ${user} botu zaten çalışıyor!`);
        }
        return;
    }
    
    // Host bilgisini ayır
    let [ip, port] = host.split(':');
    if (!port) port = 25565;
    
    // Log başlat
    session.logs[user] = [`[SİSTEM] ${user} botu başlatılıyor...`];
    
    // Bot oluştur
    const bot = mineflayer.createBot({
        host: ip.trim(),
        port: parseInt(port),
        username: user.trim(),
        version: ver.trim(),
        auth: 'offline',
        hideErrors: false,
        checkTimeoutInterval: 30000
    });
    
    // Botu kaydet
    session.bots[user] = bot;
    session.configs[user] = {
        digging: false,
        diggingInterval: null,
        manuallyStopped: false,
        reconnectAttempts: 0,
        maxReconnectAttempts: 5,
        settings: {
            reconnect: true,
            antiafk: false,
            autoattack: false
        },
        connectionInfo: { host, user, ver, sid },
        controls: {}
    };
    
    // BOT OLAYLARI
    
    // Bağlantı başarılı
    bot.on('login', () => {
        if (session.logs[user]) {
            session.logs[user].push(`[BAĞLANTI] ${user} sunucuya bağlandı!`);
        }
        session.configs[user].reconnectAttempts = 0;
    });
    
    // Mesaj alma (BOZUK KARAKTER DÜZELTME)
    bot.on('message', (jsonMsg) => {
        if (!session.logs[user]) return;
        
        try {
            // Mesajı düz metne çevir ve bozuk karakterleri düzelt
            let message = jsonMsg.toString();
            
            // Bozuk UTF-8 karakterleri düzelt
            message = fixTurkishCharacters(message);
            
            // HTML özel karakterlerini koru
            message = message
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
            
            // Minecraft renk kodlarını basit HTML'e çevir
            message = convertMinecraftColors(message);
            
            session.logs[user].push(message);
            
            // Log boyutunu sınırla
            if (session.logs[user].length > 150) {
                session.logs[user] = session.logs[user].slice(-100);
            }
        } catch (error) {
            console.error('Mesaj işleme hatası:', error);
            session.logs[user].push(`[HATA] Mesaj işlenemedi: ${error.message}`);
        }
    });
    
    // Oyuncu sağlığı değişti
    bot.on('health', () => {
        if (session.logs[user]) {
            const health = bot.health || 0;
            const food = bot.food || 0;
            
            if (health < 10) {
                session.logs[user].push(`[UYARI] Düşük can: ${Math.round(health)} ❤️`);
            }
            if (food < 10) {
                session.logs[user].push(`[UYARI] Düşük açlık: ${Math.round(food)} 🍖`);
            }
        }
    });
    
    // KAZMA SİSTEMİ
    function startDiggingSystem() {
        const config = session.configs[user];
        if (!config.digging || !bot || !bot.entity) return;
        
        // Önündeki bloğu bul
        const block = bot.blockAtCursor(4);
        if (block && block.diggable) {
            bot.dig(block, false, (err) => {
                if (err) {
                    if (session.logs[user]) {
                        session.logs[user].push(`[KAZMA] Hata: ${err.message}`);
                    }
                } else {
                    if (session.logs[user]) {
                        session.logs[user].push(`[KAZMA] Blok kırıldı: ${block.name}`);
                    }
                }
                
                // Kazma devam ediyorsa tekrar dene
                if (config.digging && session.bots[user]) {
                    setTimeout(() => startDiggingSystem(), 500);
                }
            });
        } else {
            // Kazılacak blok yoksa bekle
            if (config.digging && session.bots[user]) {
                setTimeout(() => startDiggingSystem(), 1000);
            }
        }
    }
    
    // OTOMATİK YENİDEN BAĞLANMA
    function attemptReconnect(config) {
        if (config.manuallyStopped || !config.settings.reconnect) {
            return;
        }
        
        config.reconnectAttempts++;
        if (config.reconnectAttempts > config.maxReconnectAttempts) {
            if (session.logs[user]) {
                session.logs[user].push(`[BAĞLANTI] Maksimum yeniden bağlanma denemesi (${config.maxReconnectAttempts}) aşıldı.`);
            }
            return;
        }
        
        if (session.logs[user]) {
            session.logs[user].push(`[BAĞLANTI] 10 saniye sonra yeniden bağlanılıyor (${config.reconnectAttempts}/${config.maxReconnectAttempts})...`);
        }
        
        setTimeout(() => {
            if (!session.bots[user] && !config.manuallyStopped && config.settings.reconnect) {
                if (session.logs[user]) {
                    session.logs[user].push(`[BAĞLANTI] Yeniden bağlanılıyor...`);
                }
                startBot(sid, config.connectionInfo.host, user, config.connectionInfo.ver);
            }
        }, 10000);
    }
    
    // Bağlantı kesildi
    bot.on('end', (reason) => {
        const config = session.configs[user];
        
        if (session.logs[user]) {
            session.logs[user].push(`[BAĞLANTI] Bağlantı kesildi: ${reason || 'Bilinmeyen neden'}`);
        }
        
        // Manuel durdurulmadıysa yeniden bağlanmayı dene
        if (config && !config.manuallyStopped && config.settings.reconnect) {
            attemptReconnect(config);
        } else if (config && config.manuallyStopped) {
            if (session.logs[user]) {
                session.logs[user].push(`[SİSTEM] Manuel durduruldu, yeniden bağlanılmayacak.`);
            }
        }
        
        // Temizlik
        if (config) {
            if (config.diggingInterval) {
                clearInterval(config.diggingInterval);
                config.diggingInterval = null;
            }
            config.digging = false;
        }
        
        delete session.bots[user];
    });
    
    // Sunucudan atıldı
    bot.on('kicked', (reason) => {
        const config = session.configs[user];
        
        if (session.logs[user]) {
            const cleanReason = fixTurkishCharacters(reason.toString());
            session.logs[user].push(`[ATILDI] Sunucudan atıldı: ${cleanReason}`);
        }
        
        // Manuel durdurulmadıysa yeniden bağlanmayı dene
        if (config && !config.manuallyStopped && config.settings.reconnect) {
            attemptReconnect(config);
        }
        
        if (config) {
            if (config.diggingInterval) {
                clearInterval(config.diggingInterval);
                config.diggingInterval = null;
            }
            config.digging = false;
        }
        
        delete session.bots[user];
    });
    
    // Hata oluştu
    bot.on('error', (error) => {
        const config = session.configs[user];
        
        if (session.logs[user]) {
            session.logs[user].push(`[HATA] ${error.message}`);
        }
        
        // Manuel durdurulmadıysa yeniden bağlanmayı dene
        if (config && !config.manuallyStopped && config.settings.reconnect) {
            attemptReconnect(config);
        }
        
        if (config) {
            if (config.diggingInterval) {
                clearInterval(config.diggingInterval);
                config.diggingInterval = null;
            }
            config.digging = false;
        }
        
        delete session.bots[user];
    });
    
    // Spawn oldu
    bot.on('spawn', () => {
        if (session.logs[user]) {
            session.logs[user].push(`[DÜNYA] Oyuna spawn oldu`);
        }
    });
    
    // Öldü
    bot.on('death', () => {
        if (session.logs[user]) {
            session.logs[user].push(`[ÖLÜM] Bot öldü!`);
        }
    });
}

// TÜRKÇE KARAKTER DÜZELTME FONKSİYONU
function fixTurkishCharacters(text) {
    if (!text) return text;
    
    // Bozuk UTF-8 karakter düzeltmeleri
    const replacements = {
        'Ã§': 'ç', 'Ã§': 'ç',
        'ÄŸ': 'ğ', 'ÄŸ': 'ğ',
        'Ä±': 'ı', 'Ä±': 'ı',
        'Ã¶': 'ö', 'Ã¶': 'ö',
        'ÅŸ': 'ş', 'ÅŸ': 'ş',
        'Ã¼': 'ü', 'Ã¼': 'ü',
        'Ã‡': 'Ç', 'Ã‡': 'Ç',
        'Äž': 'Ğ', 'Äž': 'Ğ',
        'Ä°': 'İ', 'Ä°': 'İ',
        'Ã–': 'Ö', 'Ã–': 'Ö',
        'Åž': 'Ş', 'Åž': 'Ş',
        'Ãœ': 'Ü', 'Ãœ': 'Ü',
        'â€“': '-', 'â€”': '-',
        'â€˜': "'", 'â€™': "'",
        'â€œ': '"', 'â€�': '"',
        'Ã‚': 'Â', 'Ã¡': 'á',
        'Ã©': 'é', 'Ã³': 'ó',
        'Ãº': 'ú', 'Ã±': 'ñ',
        'â‚¬': '€', 'Â£': '£',
        'Â¥': '¥', 'Â¢': '¢',
        '{text"': '', '"text}': '',
        '{text': '', 'text}': '',
        '""': '"'
    };
    
    let fixedText = text.toString();
    
    // Tüm bozuk karakterleri düzelt
    for (const [bad, good] of Object.entries(replacements)) {
        fixedText = fixedText.replace(new RegExp(bad, 'g'), good);
    }
    
    // Fazladan boşlukları temizle
    fixedText = fixedText.replace(/\s+/g, ' ').trim();
    
    return fixedText;
}

// MINECRAFT RENK KODLARINI HTML'E ÇEVİR
function convertMinecraftColors(text) {
    const colorMap = {
        '§0': '<span style="color:#000000">',
        '§1': '<span style="color:#0000AA">',
        '§2': '<span style="color:#00AA00">',
        '§3': '<span style="color:#00AAAA">',
        '§4': '<span style="color:#AA0000">',
        '§5': '<span style="color:#AA00AA">',
        '§6': '<span style="color:#FFAA00">',
        '§7': '<span style="color:#AAAAAA">',
        '§8': '<span style="color:#555555">',
        '§9': '<span style="color:#5555FF">',
        '§a': '<span style="color:#55FF55">',
        '§b': '<span style="color:#55FFFF">',
        '§c': '<span style="color:#FF5555">',
        '§d': '<span style="color:#FF55FF">',
        '§e': '<span style="color:#FFFF55">',
        '§f': '<span style="color:#FFFFFF">',
        '§k': '<span style="display:none">',
        '§l': '<span style="font-weight:bold">',
        '§m': '<span style="text-decoration:line-through">',
        '§n': '<span style="text-decoration:underline">',
        '§o': '<span style="font-style:italic">',
        '§r': '</span>'
    };
    
    let htmlText = text;
    
    // Minecraft renk kodlarını HTML'e çevir
    for (const [code, html] of Object.entries(colorMap)) {
        htmlText = htmlText.replace(new RegExp(code.replace('§', '\\§'), 'g'), html);
    }
    
    // Kapatılmamış span'ları kapat
    const openSpans = (htmlText.match(/<span/g) || []).length;
    const closeSpans = (htmlText.match(/<\/span>/g) || []).length;
    
    if (openSpans > closeSpans) {
        htmlText += '</span>'.repeat(openSpans - closeSpans);
    }
    
    return htmlText;
}

// HTTP SUNUCU OLUŞTUR
const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const query = parsedUrl.query;
    const sid = query.sid;
    
    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // OPTIONS isteği
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    // SID kontrolü (ana sayfa hariç)
    if (!sid && pathname !== '/' && pathname !== '/index.html' && !pathname.startsWith('/static')) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Geçersiz oturum ID');
        return;
    }
    
    // ROUTE'LAR
    switch (pathname) {
        case '/start':
            handleStart(req, res, sid, query);
            break;
            
        case '/stop':
            handleStop(req, res, sid, query);
            break;
            
        case '/send':
            handleSend(req, res, sid, query);
            break;
            
        case '/dig':
            handleDig(req, res, sid, query);
            break;
            
        case '/control':
            handleControl(req, res, sid, query);
            break;
            
        case '/update':
            handleUpdate(req, res, sid, query);
            break;
            
        case '/data':
            handleData(req, res, sid, query);
            break;
            
        default:
            serveStaticFile(req, res, pathname);
            break;
    }
});

// ROUTE HANDLER'LARI

function handleStart(req, res, sid, query) {
    const { host, user, ver } = query;
    
    if (!host || !user || !ver) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Eksik parametreler');
        return;
    }
    
    try {
        startBot(sid, host, user, ver);
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('OK');
    } catch (error) {
        console.error('Bot başlatma hatası:', error);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Bot başlatılamadı: ' + error.message);
    }
}

function handleStop(req, res, sid, query) {
    const { user } = query;
    
    if (!sid || !user) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Eksik parametreler');
        return;
    }
    
    const session = getSession(sid);
    const bot = session.bots[user];
    const config = session.configs[user];
    
    if (config) {
        config.manuallyStopped = true;
        
        if (config.diggingInterval) {
            clearInterval(config.diggingInterval);
            config.diggingInterval = null;
        }
        config.digging = false;
    }
    
    if (bot) {
        try {
            bot.quit();
            if (session.logs[user]) {
                session.logs[user].push(`[SİSTEM] Bot manuel olarak durduruldu`);
            }
        } catch (error) {
            console.error('Bot durdurma hatası:', error);
        }
        delete session.bots[user];
    }
    
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
}

function handleSend(req, res, sid, query) {
    const { user, msg } = query;
    
    if (!sid || !user || !msg) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Eksik parametreler');
        return;
    }
    
    const session = getSession(sid);
    const bot = session.bots[user];
    
    if (!bot) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Bot bulunamadı');
        return;
    }
    
    try {
        const decodedMsg = decodeURIComponent(msg);
        bot.chat(decodedMsg);
        
        if (session.logs[user]) {
            session.logs[user].push(`[SOHBET] ${decodedMsg}`);
        }
        
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('OK');
    } catch (error) {
        console.error('Mesaj gönderme hatası:', error);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Mesaj gönderilemedi');
    }
}

function handleDig(req, res, sid, query) {
    const { user, action } = query;
    
    if (!sid || !user || !action) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Eksik parametreler');
        return;
    }
    
    const session = getSession(sid);
    const bot = session.bots[user];
    const config = session.configs[user];
    
    if (!bot || !config) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Bot bulunamadı');
        return;
    }
    
    if (action === 'start') {
        config.digging = true;
        
        // Kazma sistemini başlat
        if (config.diggingInterval) {
            clearInterval(config.diggingInterval);
        }
        
        config.diggingInterval = setInterval(() => {
            if (config.digging && session.bots[user]) {
                const block = bot.blockAtCursor(4);
                if (block && block.diggable) {
                    bot.dig(block, false, (err) => {
                        if (err && session.logs[user]) {
                            session.logs[user].push(`[KAZMA] Hata: ${err.message}`);
                        }
                    });
                }
            } else {
                if (config.diggingInterval) {
                    clearInterval(config.diggingInterval);
                    config.diggingInterval = null;
                }
            }
        }, 1000);
        
        if (session.logs[user]) {
            session.logs[user].push(`[KAZMA] Kazma modu başlatıldı`);
        }
        
    } else if (action === 'stop') {
        config.digging = false;
        
        if (config.diggingInterval) {
            clearInterval(config.diggingInterval);
            config.diggingInterval = null;
        }
        
        if (session.logs[user]) {
            session.logs[user].push(`[KAZMA] Kazma modu durduruldu`);
        }
    }
    
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
}

function handleControl(req, res, sid, query) {
    const { user, direction, state } = query;
    
    if (!sid || !user || !direction || state === undefined) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Eksik parametreler');
        return;
    }
    
    const session = getSession(sid);
    const bot = session.bots[user];
    
    if (!bot) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Bot bulunamadı');
        return;
    }
    
    try {
        const isActive = state === 'true';
        const controlMap = {
            'forward': 'forward',
            'back': 'back',
            'left': 'left',
            'right': 'right',
            'jump': 'jump'
        };
        
        const control = controlMap[direction];
        if (control) {
            bot.setControlState(control, isActive);
            
            // Kontrol durumunu kaydet
            if (session.configs[user]) {
                session.configs[user].controls[direction] = isActive;
            }
            
            // Log kaydı (sadece başlangıç için)
            if (isActive && session.logs[user]) {
                const directionNames = {
                    'forward': 'İleri',
                    'back': 'Geri',
                    'left': 'Sol',
                    'right': 'Sağ',
                    'jump': 'Zıplama'
                };
                session.logs[user].push(`[HA
