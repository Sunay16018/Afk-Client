const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mineflayer = require("mineflayer");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname)));

// Renk kodlarını düzeltme
function fixColors(text) {
  return text.replace(/&([0-9a-fk-or])/g, '§$1');
}

io.on("connection", (socket) => {
  let myBot = null;

  // Envanteri tarayıcıya gönderen özel fonksiyon
  const sendInventory = () => {
    if (!myBot || !myBot.inventory) return;
    
    // Envanterdeki dolu slotları alıp basitleştiriyoruz
    const items = myBot.inventory.items().map(item => ({
      name: item.name,      // örn: diamond_sword
      count: item.count,    // örn: 1
      displayName: item.displayName // örn: Elmas Kılıç
    }));
    
    socket.emit("inventory", items);
  };

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
      socket.emit("log", "§a[SİSTEM] Giriş Başarılı! Envanter yükleniyor...");
      sendInventory(); // Girişte envanteri yolla
      
      if (d.password) {
        setTimeout(() => {
          myBot.chat(`/register ${d.password} ${d.password}`);
          myBot.chat(`/login ${d.password}`);
        }, 1500);
      }
    });

    // Envanter değişikliklerini dinle
    myBot.inventory.on("updateSlot", (slot, oldItem, newItem) => {
      sendInventory();
    });

    myBot.on("message", (m) => {
      if (myBot.entity) socket.emit("log", m.toAnsi());
    });

    myBot.on("kicked", (r) => socket.emit("log", `§c[KICK] ${r}`));
    myBot.on("error", (err) => socket.emit("log", `§c[HATA] ${err.message}`));
    
    myBot.on("end", () => {
      socket.emit("log", "§e[BİLGİ] Bağlantı koptu.");
      socket.emit("inventory", []); // Envanteri temizle
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

  socket.on("disconnect", () => {
    if (myBot) {
      myBot.quit();
      myBot = null;
    }
  });
});

server.listen(process.env.PORT || 3000);
