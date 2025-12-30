
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mineflayer = require("mineflayer");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let bots = {};

app.get("/", (_, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("/style.css", (_, res) => res.sendFile(path.join(__dirname, "style.css")));
app.get("/script.js", (_, res) => res.sendFile(path.join(__dirname, "script.js")));

function logAll(msg) {
  io.emit("log", msg);
  console.log(msg);
}

function createBot(data) {
  if (bots[data.username]) return;

  const bot = mineflayer.createBot({
    host: data.ip,
    port: Number(data.port),
    username: data.username,
    version: data.version || false
  });

  bots[data.username] = bot;

  bot.once("login", () => {
    logAll("✅ " + data.username + " bağlandı");
    if (data.password) {
      setTimeout(() => {
        bot.chat(`/register ${data.password} ${data.password}`);
        bot.chat(`/login ${data.password}`);
      }, 1500);
    }
  });

  bot.on("chat", (u, m) => logAll(`<${u}> ${m}`));

  bot.on("end", () => {
    logAll("🔄 " + data.username + " yeniden bağlanıyor");
    delete bots[data.username];
    setTimeout(() => createBot(data), 5000);
  });

  setInterval(() => {
    if (!bot.entity) return;
    bot.setControlState("forward", true);
    bot.setControlState("jump", true);
    bot.look(Math.random() * Math.PI * 2, 0);
    setTimeout(() => {
      bot.setControlState("forward", false);
      bot.setControlState("jump", false);
    }, 600);
  }, 10000);
}

io.on("connection", socket => {
  socket.emit("log", "🟢 Terminal hazır");

  socket.on("startBot", data => createBot(data));

  socket.on("stopBot", name => {
    if (bots[name]) {
      bots[name].quit();
      delete bots[name];
      logAll("🛑 " + name + " durduruldu");
    }
  });

  socket.on("sendChat", data => {
    if (bots[data.username]) {
      bots[data.username].chat(data.message);
      logAll("📤 BOT: " + data.message);
    }
  });
});

server.listen(process.env.PORT || 3000, () =>
  console.log("AFK Client Ultimate çalışıyor")
);
