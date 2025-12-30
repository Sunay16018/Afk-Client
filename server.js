const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const mineflayer = require('mineflayer');
const AnsiToHtml = require('ansi-to-html');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from the same directory
app.use(express.static(path.join(__dirname)));

const PORT = process.env.PORT || 3000;

// ---------- Mineflayer Bot ----------
let bot = null;
const ansiConverter = new AnsiToHtml();

function createBot(options) {
  if (bot) {
    bot.end();
    bot = null;
  }

  bot = mineflayer.createBot({
    host: options.host,
    port: options.port,
    username: options.username,
    password: options.password,
    version: options.version || false,
  });

  bot.on('login', () => {
    emitStatus('✅ Bot logged in');
  });

  bot.on('spawn', () => {
    emitStatus('🚀 Bot spawned in the world');
  });

  bot.on('chat', (username, message) => {
    // Convert Minecraft color codes (§) to ANSI then to HTML
    const ansiMsg = mcToAnsi(`<${username}> ${message}`);
    const html = ansiConverter.toHtml(ansiMsg);
    io.emit('chat', html);
  });

  bot.on('kicked', (reason) => {
    const ansi = mcToAnsi(`⚠️ Kicked: ${reason}`);
    io.emit('status', ansiConverter.toHtml(ansi));
    bot.end();
  });

  bot.on('end', () => {
    emitStatus('❌ Bot disconnected');
    bot = null;
  });

  bot.on('error', (err) => {
    emitStatus(`❗ Error: ${err.message}`);
  });
}

// Helper: Minecraft § color codes → ANSI escape sequences
function mcToAnsi(text) {
  const colorMap = {
    '0': '\x1b[30m', // black
    '1': '\x1b[34m', // dark_blue
    '2': '\x1b[32m', // dark_green
    '3': '\x1b[36m', // dark_aqua
    '4': '\x1b[31m', // dark_red
    '5': '\x1b[35m', // dark_purple
    '6': '\x1b[33m', // gold
    '7': '\x1b[37m', // gray
    '8': '\x1b[90m', // dark_gray
    '9': '\x1b[94m', // blue
    'a': '\x1b[92m', // green
    'b': '\x1b[96m', // aqua
    'c': '\x1b[91m', // red
    'd': '\x1b[95m', // light_purple
    'e': '\x1b[93m', // yellow
    'f': '\x1b[97m', // white
    'k': '', // obfuscated (ignore)
    'l': '\x1b[1m', // bold
    'm': '\x1b[9m', // strikethrough
    'n': '\x1b[4m', // underline
    'o': '\x1b[3m', // italic
    'r': '\x1b[0m'  // reset
  };
  return text.replace(/§([0-9a-frk-or])/gi, (_, code) => colorMap[code.toLowerCase()] || '');
}

// Emit status messages (HTML)
function emitStatus(message) {
  const html = ansiConverter.toHtml(message);
  io.emit('status', html);
}

// ---------- Socket.io ----------
io.on('connection', (socket) => {
  console.log('Browser connected');

  socket.on('startBot', (data) => {
    try {
      createBot(data);
    } catch (e) {
      emitStatus(`❗ Failed to start bot: ${e.message}`);
    }
  });

  socket.on('stopBot', () => {
    if (bot) bot.end();
    emitStatus('🛑 Bot stopped by user');
  });

  socket.on('sendChat', (msg) => {
    if (bot) bot.chat(msg);
  });

  // Movement commands
  socket.on('move', ({ direction, state }) => {
    if (!bot) return;
    const control = bot.control;
    const actions = {
      forward: 'forward',
      back: 'back',
      left: 'left',
      right: 'right',
      jump: 'jump'
    };
    if (state) control[actions[direction]] = true;
    else control[actions[direction]] = false;
  });

  // Auto‑message system
  let autoMsgInterval = null;
  socket.on('autoMessageStart', ({ messages, delay }) => {
    if (autoMsgInterval) clearInterval(autoMsgInterval);
    let idx = 0;
    autoMsgInterval = setInterval(() => {
      if (!bot) return;
      bot.chat(messages[idx % messages.length]);
      idx++;
    }, delay);
    emitStatus('🔁 Auto‑message started');
  });

  socket.on('autoMessageStop', () => {
    if (autoMsgInterval) {
      clearInterval(autoMsgInterval);
      autoMsgInterval = null;
      emitStatus('⏹ Auto‑message stopped');
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
      
