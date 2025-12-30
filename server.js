const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mineflayer = require('mineflayer');
const AnsiToHtml = require('ansi-to-html');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const ansiConverter = new AnsiToHtml();

// Serve static files from the same directory
app.use(express.static(__dirname));

// ---------- Bot Management ----------
let bot = null;

function createBot(options) {
  if (bot) bot.end(); // clean previous instance

  bot = mineflayer.createBot({
    host: options.host,
    port: options.port,
    username: options.username,
    password: options.password,
    version: options.version || false,
  });

  bot.on('login', () => {
    io.emit('status', ansiConverter.toHtml('\u001b[32m[Bot] Bağlandı\u001b[0m'));
  });

  bot.on('chat', (username, message) => {
    const formatted = `\u001b[36m<${username}> ${message}\u001b[0m`;
    io.emit('chat', ansiConverter.toHtml(formatted));
  });

  bot.on('kicked', (reason) => {
    io.emit('status', ansiConverter.toHtml(`\u001b[33m[Bot] Atıldı: ${reason}\u001b[0m`));
    bot.end();
  });

  bot.on('end', () => {
    io.emit('status', ansiConverter.toHtml('\u001b[31m[Bot] Bağlantı kapandı\u001b[0m'));
    bot = null;
  });

  // Forward any console.log from bot to client (optional)
  bot.on('error', (err) => {
    io.emit('status', ansiConverter.toHtml(`\u001b[31m[Bot] Hata: ${err.message}\u001b[0m`));
  });
}

// ---------- Socket.io ----------
io.on('connection', (socket) => {
  console.log('Browser connected');

  socket.on('startBot', (data) => {
    createBot(data);
  });

  socket.on('stopBot', () => {
    if (bot) bot.end();
  });

  socket.on('chatMessage', (msg) => {
    if (bot) bot.chat(msg);
  });

  socket.on('autoMessage', ({ message, interval }) => {
    if (!bot) return;
    const send = () => bot.chat(message);
    const id = setInterval(send, interval * 1000);
    socket.once('stopAutoMessage', () => clearInterval(id));
  });

  // Movement controls
  const moveMap = {
    forward: 'forward',
    back: 'back',
    left: 'left',
    right: 'right',
    jump: 'jump',
  };

  socket.on('move', ({ action, state }) => {
    if (!bot) return;
    if (state) bot.setControlState(moveMap[action], true);
    else bot.setControlState(moveMap[action], false);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
