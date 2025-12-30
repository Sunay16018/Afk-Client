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

function startBot(d){
  if(bots[d.username]) return;

  const bot = mineflayer.createBot({
    host: d.ip,
    port: Number(d.port) || 25565,
    username: d.username,
    version: d.version || false
  });

  bots[d.username] = bot;

  bot.once("login", () => {
    if(d.password){
      setTimeout(()=>{
        bot.chat(`/register ${d.password} ${d.password}`);
        bot.chat(`/login ${d.password}`);
      },1500);
    }
  });

  bot.on("message", m => io.emit("log", m.toAnsi()));
  bot.on("kicked", r => io.emit("log", `Sunucudan atıldı: ${r}`));
  bot.on("end", () => delete bots[d.username]);
}

// Socket.io connection
io.on("connection", s => {
  s.emit("log", "Terminal hazır");

  s.on("startBot", startBot);
  s.on("stopBot", u => { if(bots[u]) { bots[u].quit(); delete bots[u]; } });
  s.on("sendChat", d => { if(bots[d.username]) bots[d.username].chat(d.message); });
  s.on("autoMsg", cfg => {
    const b = bots[cfg.username];
    if(!b) return;
    if(b.autoMsgInt) clearInterval(b.autoMsgInt);
    if(cfg.enabled) b.autoMsgInt = setInterval(()=>b.chat(cfg.message), cfg.delay*1000);
  });
  s.on("move", c => { const b = bots[c.username]; if(b) b.setControlState(c.key, c.state); });
});

server.listen(process.env.PORT || 3000, () => console.log("Server çalışıyor..."));
