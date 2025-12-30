const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mineflayer = require("mineflayer");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname)));

function fixColors(text) {
  return text.replace(/&([0-9a-fk-or])/g, '§$1');
}

io.on("connection", (socket) => {
  // Her socket bağlantısı (tarayıcı sekmesi) kendi botunu bu objede tutacak
  let myBot = null;

  socket.on("startBot", (d) => {
    if (myBot) return;

    myBot = mineflayer.createBot({
      host: d.ip,
      port: Number(d.port) || 25565,
      username: d.username,
      version: d.version || false,
      hideErrors: true
    });

    myBot.once("spawn", () => {
      socket.emit("log", "§a[SİSTEM] Senin botun başarıyla giriş yaptı.");
      if (d.password) {
        setTimeout(() => {
          myBot.chat(`/register ${d.password} ${d.password}`);
          myBot.chat(`/login ${d.password}`);
        }, 1500);
      }
    });

    myBot.on("message", (m) => {
      if (myBot.entity) socket.emit("log", m.toAnsi());
    });

    myBot.on("kicked", (r) => socket.emit("log", `§c[KICK] ${r}`));
    myBot.on("error", (err) => socket.emit("log", `§c[HATA] ${err.message}`));
    
    myBot.on("end", () => {
      socket.emit("log", "§e[BİLGİ] Bağlantı kesildi.");
      myBot = null;
    });
  });

  socket.on("stopBot", () => {
    if (myBot) {
      myBot.quit();
      myBot = null;
    }
  });

  socket.on("sendChat", (d) => {
    if (myBot) myBot.chat(fixColors(d.message));
  });

  socket.on("autoMsg", (cfg) => {
    if (!myBot) return;
    if (myBot.autoMsgInt) clearInterval(myBot.autoMsgInt);
    if (cfg.enabled) {
      myBot.autoMsgInt = setInterval(() => myBot.chat(fixColors(cfg.message)), cfg.delay * 1000);
    }
  });

  socket.on("move", (c) => {
    if (myBot) myBot.setControlState(c.key, c.state);
  });

  // Sekme kapatılırsa botu temizle (Opsiyonel: Botun kalmasını istiyorsan burayı sil)
  socket.on("disconnect", () => {
    if (myBot) {
      myBot.quit();
      myBot = null;
    }
  });
});

server.listen(process.env.PORT || 3000);
        
