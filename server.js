const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mineflayer = require('mineflayer');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));
app.get('/', (req, res) => res.sendFile(__dirname + '/index.html'));

let sessions = {};

io.on('connection', (socket) => {
    const sid = socket.id;
    let selectedBot = '';
    
    if (!sessions[sid]) {
        sessions[sid] = { bots: {}, logs: {}, configs: {} };
    }
    
    socket.on('select', (bot) => selectedBot = bot);
    
    socket.on('start', (data) => {
        const { host, user, ver } = data;
        const session = sessions[sid];
        
        if (session.bots[user]) return;
        
        const [ip, port] = host.split(':');
        session.logs[user] = ['[SİSTEM] Başlatılıyor...'];
        
        const bot = mineflayer.createBot({
            host: ip,
            port: parseInt(port) || 25565,
            username: user,
            version: ver,
            auth: 'offline'
        });
        
        session.bots[user] = bot;
        session.configs[user] = { digging: false, stopped: false };
        
        bot.on('login', () => {
            session.logs[user].push(`[GİRİŞ] ${user} bağlandı`);
            updateClient(sid, socket);
        });
        
        bot.on('message', (msg) => {
            let text = msg.toString();
            text = text.replace(/Ã§/g, 'ç').replace(/Ã¶/g, 'ö').replace(/Ã¼/g, 'ü');
            session.logs[user].push(text);
            if (session.logs[user].length > 50) session.logs[user].shift();
            updateClient(sid, socket);
        });
        
        bot.on('end', () => {
            session.logs[user].push('[BAĞLANTI] Koptu');
            delete session.bots[user];
            updateClient(sid, socket);
        });
        
        updateClient(sid, socket);
    });
    
    socket.on('stop', (botName) => {
        const session = sessions[sid];
        const bot = session.bots[botName];
        if (bot) {
            bot.quit();
            delete session.bots[botName];
            session.configs[botName].stopped = true;
        }
        updateClient(sid, socket);
    });
    
    socket.on('chat', (data) => {
        const session = sessions[sid];
        const bot = session.bots[data.bot];
        if (bot) {
            bot.chat(data.msg);
            session.logs[data.bot].push(`[SEN] ${data.msg}`);
            updateClient(sid, socket);
        }
    });
    
    socket.on('dig', (data) => {
        const session = sessions[sid];
        const bot = session.bots[data.bot];
        const config = session.configs[data.bot];
        
        if (!bot || !config) return;
        
        config.digging = data.action === 'start';
        if (config.digging) {
            function dig() {
                if (!config.digging || !session.bots[data.bot]) return;
                const block = bot.blockAtCursor(5);
                if (block && block.diggable) {
                    bot.dig(block, (err) => {
                        if (!err) session.logs[data.bot].push('[KAZMA] Blok kırıldı');
                        setTimeout(() => config.digging && dig(), 500);
                    });
                } else setTimeout(() => config.digging && dig(), 1000);
            }
            dig();
        }
        updateClient(sid, socket);
    });
    
    socket.on('move', (data) => {
        const session = sessions[sid];
        const bot = session.bots[data.bot];
        if (!bot) return;
        
        const controls = { ileri:'forward', geri:'back', sol:'left', sag:'right', zipla:'jump' };
        const active = data.state === 'down';
        if (controls[data.dir]) bot.setControlState(controls[data.dir], active);
        
        updateClient(sid, socket);
    });
    
    function updateClient(sid, socket) {
        const session = sessions[sid];
        const active = Object.keys(session.bots);
        const data = {};
        
        active.forEach(name => {
            const bot = session.bots[name];
            if (bot) {
                data[name] = {
                    hp: bot.health || 0,
                    food: bot.food || 0,
                    inv: bot.inventory.slots.map((it, i) => it ? { n: it.name, c: it.count, s: i } : null).filter(x => x)
                };
            }
        });
        
        socket.emit('update', { active, logs: session.logs, data });
    }
    
    updateClient(sid, socket);
});

server.listen(process.env.PORT || 10000, () => {
    console.log(`Sunucu: ${process.env.PORT || 10000}`);
});