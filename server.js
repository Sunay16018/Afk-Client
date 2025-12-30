const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mineflayer = require("mineflayer");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let bot = null;

// HTML
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// CSS
app.get("/style.css", (req, res) => {
  res.sendFile(path.join(__dirname, "style.css"));
});

// JS
app.get("/script.js", (req, res) => {
  res.sendFile(path.join(__dirname, "script.js"));
});

io.on("connection", socket => {
  socket.emit("log", "🟢 Panel bağlandı");

  socket.on("startBot", data => {
    if (bot) {
      socket.emit("log", "⚠️ Bot zaten çalışıyor");
      return;
    }

    bot = mineflayer.createBot({
      host: data.ip,
      port: Number(data.port),
      username: data.username,
      version: data.version || false
    });

    bot.on("login", () => {
      socket.emit("log", "✅ Bot sunucuya girdi");
    });

    bot.on("chat", (username, message) => {
      socket.emit("log", `<${username}> ${message}`);
    });

    bot.on("error", err => {
      socket.emit("log", "❌ Hata: " + err.message);
    });

    bot.on("end", () => {
      socket.emit("log", "⛔ Bot bağlantısı koptu");
      bot = null;
    });

    // AFK hareket
    setInterval(() => {
      if (!bot) return;
      bot.setControlState("jump", true);
      setTimeout(() => {
        if (bot) bot.setControlState("jump", false);
      }, 300);
    }, 15000);
  });

  socket.on("stopBot", () => {
    if (bot) {
      bot.quit();
      bot = null;
      socket.emit("log", "🛑 Bot durduruldu");
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("AFK Client çalışıyor | Port:", PORT);
});
