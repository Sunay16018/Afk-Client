const mineflayer = require('mineflayer');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// ✅ CRITICAL FIX 1: Configure Socket.IO for Render
const io = socketIo(server, {
    cors: {
        origin: "*", // Allows your frontend to connect
        methods: ["GET", "POST"]
    }
});

// ✅ CRITICAL FIX 2: Use Render's assigned PORT
const PORT = process.env.PORT || 10000; // Render sets process.env.PORT[citation:8]

// In-memory storage for bot sessions
const sessions = new Map();

class BotSession {
    constructor(socketId) {
        this.socketId = socketId;
        this.bots = new Map();
        this.logs = new Map();
        this.configs = new Map();
    }

    addLog(username, message, type = 'info') {
        if (!this.logs.has(username)) this.logs.set(username, []);
        const logEntry = { message, type, timestamp: new Date().toLocaleTimeString('tr-TR') };
        this.logs.get(username).push(logEntry);
        
        // ✅ FIX: Send log to the correct user's socket
        const userSocket = io.sockets.sockets.get(this.socketId);
        if (userSocket) {
            userSocket.emit('new_log', { username, log: logEntry });
        }
    }

    getBotData(username) {
        const bot = this.bots.get(username);
        if (!bot) return null;

        return {
            hp: bot.health || 20,
            food: bot.food || 20,
            inventory: (bot.inventory.slots || []).map((item, idx) => 
                item ? { name: item.name, count: item.count, slot: idx } : null
            ).filter(x => x),
            config: this.configs.get(username) || {}
        };
    }
}

// ✅ CRITICAL FIX 3: Socket.IO event handlers in one place
io.on('connection', (socket) => {
    const session = new BotSession(socket.id);
    sessions.set(socket.id, session);

    socket.on('start_bot', (data) => {
        startBot(socket, session, data);
    });

    socket.on('stop_bot', (username) => {
        if (session.bots.has(username)) {
            session.bots.get(username).end();
            session.bots.delete(username);
            socket.emit('bot_stopped', { username });
            updateBotList(socket, session);
        }
    });

    socket.on('send_chat', (data) => {
        const bot = session.bots.get(data.username);
        if (bot) bot.chat(data.message);
    });

    socket.on('request_bot_data', (data) => {
        const botData = session.getBotData(data.username);
        if (botData) {
            socket.emit('bot_data', { username: data.username, data: botData });
        }
    });

    socket.on('get_bot_list', () => {
        updateBotList(socket, session);
    });

    socket.on('disconnect', () => {
        sessions.delete(socket.id);
    });
});

function startBot(socket, session, data) {
    const { host, username, version } = data;
    const [ip, port] = host.split(':');

    session.addLog(username, '[SİSTEM] Bot başlatılıyor...', 'info');

    const bot = mineflayer.createBot({
        host: ip,
        port: parseInt(port) || 25565,
        username: username,
        version: version || '1.16.5',
        auth: 'offline'
    });

    session.bots.set(username, bot);
    session.configs.set(username, {
        autoMessage: { enabled: false, message: '', interval: 5 },
        autoMine: { enabled: false, targetBlock: 'diamond_ore' }
    });

    // ✅ FIX: Event listeners that actually send data to the frontend
    bot.on('login', () => {
        session.addLog(username, '[BAŞARI] Oyuna giriş yapıldı!', 'success');
        updateBotList(socket, session);
        // Send initial data immediately
        socket.emit('bot_data', {
            username: username,
            data: session.getBotData(username)
        });
    });

    bot.on('message', (msg) => {
        session.addLog(username, msg.toString(), 'chat');
    });

    bot.on('health', () => {
        socket.emit('bot_data', {
            username: username,
            data: session.getBotData(username)
        });
    });

    bot.on('windowUpdate', () => {
        socket.emit('bot_data', {
            username: username,
            data: session.getBotData(username)
        });
    });

    bot.on('end', () => {
        session.addLog(username, '[BAĞLANTI] Bağlantı kesildi', 'warning');
        session.bots.delete(username);
        updateBotList(socket, session);
    });

    // ✅ FIX: Periodic data update (every second)
    const intervalId = setInterval(() => {
        if (!session.bots.has(username)) {
            clearInterval(intervalId);
            return;
        }
        socket.emit('bot_data', {
            username: username,
            data: session.getBotData(username)
        });
    }, 1000);

    bot.on('end', () => clearInterval(intervalId));
}

function updateBotList(socket, session) {
    const botList = Array.from(session.bots.keys()).map(name => ({
        name: name,
        online: true,
        data: session.getBotData(name)
    }));
    socket.emit('bot_list', { bots: botList });
}

// ✅ CRITICAL FIX 4: Correctly serve static files and Socket.IO client[citation:8]
app.use(express.static(__dirname));

// Serve the Socket.IO client library from node_modules
app.get('/socket.io/socket.io.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'node_modules/socket.io/client-dist/socket.io.js'));
});

// All other routes serve the main page
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ✅ CRITICAL FIX 5: Bind to all network interfaces as Render requires[citation:8]
server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ AFK Client sunucusu ${PORT} portunda çalışıyor.`);
});
