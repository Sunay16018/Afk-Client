const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve every file from the root directory
app.use(express.static(__dirname));

// Render.com port handling
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Listening on ${PORT}`));

let bot = null;

// ---------- Bot Helper Functions ----------
async function createBot(config) {
  if (bot) bot.end();
  bot = mineflayer.createBot(config);
  bot.loadPlugin(pathfinder);

  bot.once('spawn', () => {
    const defaultMovements = new Movements(bot);
    bot.pathfinder.setMovements(defaultMovements);
    io.emit('status', 'Bot spawned');
  });

  // Auto‑defend
  bot.on('physicTick', () => {
    const entity = bot.nearestEntity(entity => entity.type === 'mob' && entity.position.distanceTo(bot.entity.position) < 5);
    if (entity && bot.canSeeEntity(entity) && bot.health > 0) {
      bot.attack(entity);
    }
  });

  // Radar & inventory updates
  setInterval(() => {
    const nearby = bot.entities
      .filter(e => e.type === 'player' || e.type === 'mob')
      .map(e => ({
        name: e.username || e.type,
        dist: bot.entity.position.distanceTo(e.position).toFixed(1)
      }));
    io.emit('radar', nearby);
    io.emit('inventory', bot.inventory.items().map(i => ({
      name: i.name,
      count: i.count
    })));
  }, 2000);

  // Chat math solver
  bot.on('chat', async (username, message) => {
    if (username === bot.username) return;
    const match = message.match(/solve\s+([\d\+\-\*\/\^\(\) ]+)/i);
    if (match) {
      const expr = match[1];
      try {
        // simple eval – replace ^ with ** for exponent
        const safeExpr = expr.replace(/\^/g, '**');
        const result = eval(safeExpr);
        setTimeout(() => bot.chat(`${username}: ${result}`), 1500);
      } catch (e) {
        bot.chat(`${username}: could not solve`);
      }
    }
  });
}

// ---------- Socket.io ----------
io.on('connection', socket => {
  socket.emit('status', bot ? 'connected' : 'disconnected');

  socket.on('connectBot', data => {
    const { host, port, username, password } = data;
    createBot({
      host,
      port,
      username,
      password,
      version: false // auto‑detect
    });
  });

  socket.on('disconnectBot', () => {
    if (bot) bot.end();
    bot = null;
    io.emit('status', 'disconnected');
  });

  socket.on('toggleMining', async enabled => {
    if (!bot) return;
    if (enabled) {
      const block = bot.blockAt(bot.entity.position.offset(0, -1, 0));
      if (block && bot.canDigBlock(block)) {
        try {
          await bot.dig(block);
          socket.emit('miningResult', 'block mined');
        } catch (e) {
          socket.emit('miningResult', 'failed');
        }
      }
    }
  });

  socket.on('sendMessage', msg => {
    if (bot) bot.chat(msg);
  });

  socket.on('loginPassword', pwd => {
    if (bot) bot.chat(`/login ${pwd}`);
  });
});
