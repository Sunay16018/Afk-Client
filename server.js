const mineflayer = require('mineflayer');
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

// Oturum depolama
let userSessions = {};

// Oturum alma
function getSession(sid) {
    if (!userSessions[sid]) {
        userSessions[sid] = { bots: {}, logs: {}, configs: {} };
    }
    return userSessions[sid];
}

// Türkçe karakter düzeltme
function fixTurkishChars(text) {
    const replacements = {
        'Ã§': 'ç', 'ÄŸ': 'ğ', 'Ä±': 'ı', 'Ã¶': 'ö',
        'ÅŸ': 'ş', 'Ã¼': 'ü', 'Ã‡': 'Ç', 'Äž': 'Ğ',
        'Ä°': 'İ', 'Ã–': 'Ö', 'Åž': 'Ş', 'Ãœ': 'Ü',
        '{text"': '', '"text}': '', '{text': '', 'text}': ''
    };
    
    let result = text.toString();
    for (const [bad, good] of Object.entries(replacements)) {
        result = result.replace(new RegExp(bad, 'g'), good);
    }
    return result;
}

// Bot başlatma fonksiyonu
function startBot(sid, host, username, version) {
    const session = getSession(sid);
    
    // Bot zaten varsa
    if (session.bots[username]) return;
    
    // Host ayırma
    const [ip, port] = host.split(':');
    
    // Log başlatma
    session.logs[username] = ["[SİSTEM] Başlatılıyor..."];
    
    // Bot oluşturma
    const bot = mineflayer.createBot({
        host: ip,
        port: parseInt(port) || 25565,
        username: username,
        version: version,
        auth: 'offline'
    });
    
    // Bot kaydetme
    session.bots[username] = bot;
    session.configs[username] = {
        digging: false,
        manuallyStopped: false,
        settings: {
            reconnect: true,
            antiafk: false,
            autoattack: false
        },
        connectionInfo: { host, username, version, sid }
    };
    
    // Bot event'leri
    bot.on('login', () => {
        session.logs[username].push(`[BAĞLANTI] ${username} sunucuya bağlandı!`);
    });
    
    bot.on('message', (msg) => {
        const cleanMsg = fixTurkishChars(msg.toString());
        session.logs[username].push(cleanMsg);
        
        // Log sınırlama
        if (session.logs[username].length > 100) {
            session.logs[username].shift();
        }
    });
    
    // Bağlantı kesilme
    bot.on('end', () => {
        session.logs[username].push("[BAĞLANTI] Bağlantı kesildi");
        
        const config = session.configs[username];
        
        // Manuel durdurulmadıysa ve otomatik bağlanma açıksa
        if (!config.manuallyStopped && config.settings.reconnect) {
            session.logs[username].push("[SİSTEM] 10 saniye sonra yeniden bağlanılıyor...");
            
            setTimeout(() => {
                if (!session.bots[username] && !config.manuallyStopped && config.settings.reconnect) {
                    startBot(sid, config.connectionInfo.host, username, config.connectionInfo.version);
                }
            }, 10000);
        }
        
        delete session.bots[username];
    });
    
    // Sunucudan atılma
    bot.on('kicked', (reason) => {
        session.logs[username].push("[ATILDI] " + fixTurkishChars(reason.toString()));
        delete session.bots[username];
    });
    
    // Hata
    bot.on('error', (error) => {
        session.logs[username].push("[HATA] " + error.message);
        delete session.bots[username];
    });
}

// HTTP sunucu oluşturma
const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const query = parsedUrl.query;
    const sid = query.sid;
    
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // OPTIONS isteği
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    // SID kontrolü
    if (!sid && pathname !== '/' && pathname !== '/index.html') {
        return res.end("No SID");
    }
    
    const session = getSession(sid);
    const bot = session.bots[query.user];
    
    // Route'lar
    switch (pathname) {
        case '/start':
            if (session.configs[query.user]) {
                session.configs[query.user].manuallyStopped = false;
            }
            startBot(sid, query.host, query.user, query.ver);
            res.end("ok");
            break;
            
        case '/stop':
            if (bot) {
                if (session.configs[query.user]) {
                    session.configs[query.user].manuallyStopped = true;
                    session.logs[query.user].push("[SİSTEM] Bot manuel olarak durduruldu.");
                }
                bot.quit();
                delete session.bots[query.user];
            }
            res.end("ok");
            break;
            
        case '/send':
            if (bot) {
                bot.chat(decodeURIComponent(query.msg));
            }
            res.end("ok");
            break;
            
        case '/dig':
            if (bot) {
                const config = session.configs[query.user];
                
                if (query.action === 'start') {
                    config.digging = true;
                    
                    // Kazma fonksiyonu
                    function dig() {
                        if (!config.digging || !bot) return;
                        
                        const block = bot.blockAtCursor(5);
                        if (block && block.diggable) {
                            bot.dig(block, (err) => {
                                if (!err) {
                                    session.logs[query.user].push("[KAZMA] Blok kırıldı!");
                                }
                                setTimeout(() => {
                                    if (config.digging) dig();
                                }, 500);
                            });
                        } else {
                            setTimeout(() => {
                                if (config.digging) dig();
                            }, 1000);
                        }
                    }
                    
                    dig();
                    session.logs[query.user].push("[KAZMA] Kazma başladı!");
                    
                } else if (query.action === 'stop') {
                    config.digging = false;
                    session.logs[query.user].push("[KAZMA] Kazma durdu.");
                }
            }
            res.end("ok");
            break;
            
        case '/control':
            if (bot) {
                const direction = query.direction;
                const state = query.state === 'true';
                
                const controlMap = {
                    'forward': 'forward',
                    'back': 'back',
                    'left': 'left',
                    'right': 'right',
                    'jump': 'jump'
                };
                
                if (controlMap[direction]) {
                    bot.setControlState(controlMap[direction], state);
                }
            }
            res.end("ok");
            break;
            
        case '/update':
            if (session.configs[query.user]) {
                const config = session.configs[query.user];
                
                if (query.type === 'inv' && query.status === 'drop' && bot) {
                    const item = bot.inventory.slots[parseInt(query.val)];
                    if (item) bot.tossStack(item);
                    
                } else if (query.type === 'setting') {
                    config.settings[query.setting] = query.value === 'true';
                }
            }
            res.end("ok");
            break;
            
        case '/data':
            if (sid) {
                const active = Object.keys(session.bots);
                const botData = {};
                const settings = {};
                
                // Bot verilerini toplama
                active.forEach(username => {
                    const bot = session.bots[username];
                    if (bot) {
                        botData[username] = {
                            hp: bot.health || 0,
                            food: bot.food || 0,
                            inv: bot.inventory.slots
                                .map((item, idx) => item ? {
                                    n: item.name,
                                    c: item.count,
                                    s: idx,
                                    d: item.displayName
                                } : null)
                                .filter(item => item !== null)
                        };
                    }
                    
                    // Ayarları toplama
                    if (session.configs[username]) {
                        settings[username] = session.configs[username].settings;
                    }
                });
                
                // JSON response
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                    active: active,
                    logs: session.logs,
                    botData: botData,
                    settings: settings
                }));
            }
            break;
            
        default:
            // Statik dosya sunucusu
            let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
            
            fs.readFile(filePath, (err, content) => {
                if (err) {
                    // Dosya yoksa index.html göster
                    fs.readFile(path.join(__dirname, 'index.html'), (err2, content2) => {
                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end(content2);
                    });
                } else {
                    // Content-Type belirleme
                    const extname = path.extname(filePath);
                    let contentType = 'text/html';
                    
                    switch (extname) {
                        case '.js': contentType = 'text/javascript'; break;
                        case '.css': contentType = 'text/css'; break;
                        case '.json': contentType = 'application/json'; break;
                        case '.png': contentType = 'image/png'; break;
                        case '.jpg': contentType = 'image/jpg'; break;
                    }
                    
                    res.writeHead(200, { 'Content-Type': contentType });
                    res.end(content);
                }
            });
            break;
    }
});

// Sunucuyu başlat
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`✅ AFK Minecraft Client ${PORT} portunda çalışıyor`);
});
