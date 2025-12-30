const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mineflayer = require("mineflayer");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let bots = {};

app.use(express.static(path.join(__dirname)));

function fixColors(text) {
  return text.replace(/&([0-9a-fk-or])/g, '§$1');
}

function startBot(d, socket){
  if(bots[d.username]) return;

  const bot = mineflayer.createBot({
    host: d.ip,
    port: Number(d.port) || 25565,
    username: d.username,
    version: d.version || false,
    hideErrors: true
  });

  bots[d.username] = bot;

  // Sadece sunucuya girince logları açar
  bot.once("spawn", () => {
    socket.emit("log", "§a[SİSTEM] Başarıyla giriş yapıldı.");
    if(d.password){
      setTimeout(()=>{
        bot.chat(`/register ${d.password} ${d.password}`);
        bot.chat(`/login ${d.password}`);
      },1500);
    }
  });

  bot.on("message", m => {
    // Sadece bot dünya üzerindeyse log gönder ve ANSI formatında ilet
    if(bot.entity) socket.emit("log", m.toAnsi());
  });

  bot.on("kicked", r => socket.emit("log", `§c[KICK] ${r}`));
  bot.on("error", err => socket.emit("log", `§c[HATA] ${err.message}`));
  bot.on("end", () => {
    socket.emit("log", "§e[BİLGİ] Bağlantı kesildi.");
    delete bots[d.username];
  });
}

io.on("connection", s => {
  s.on("startBot", d => startBot(d, s));
  s.on("stopBot", u => { if(bots[u]) { bots[u].quit(); delete bots[u]; } });
  s.on("sendChat", d => { 
    if(bots[d.username]) bots[d.username].chat(fixColors(d.message));
  });
  s.on("autoMsg", cfg => {
    const b = bots[cfg.username];
    if(!b) return;
    if(b.autoMsgInt) clearInterval(b.autoMsgInt);
    if(cfg.enabled) b.autoMsgInt = setInterval(()=>b.chat(fixColors(cfg.message)), cfg.delay*1000);
  });
  s.on("move", c => { const b = bots[c.username]; if(b) b.setControlState(c.key, c.state); });
});

server.listen(process.env.PORT || 3000);
