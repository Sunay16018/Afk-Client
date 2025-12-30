const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mineflayer = require("mineflayer");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname)); // Dosyaları birbirine bağlayan kritik satır

io.on("connection", (socket) => {
    let bot = null;

    socket.on("startBot", (data) => {
        if (bot) return;
        bot = mineflayer.createBot({
            host: data.ip,
            username: data.user,
            version: false,
            hideErrors: true
        });

        bot.on("message", (m) => socket.emit("log", m.toAnsi()));
        bot.on("spawn", () => {
            socket.emit("log", "§a[OK] Bot oyuna girdi!");
            if(bot.inventory) {
                const items = bot.inventory.items().map(i => ({name: i.name, count: i.count}));
                socket.emit("inv", items);
            }
        });
        bot.inventory?.on("updateSlot", () => {
            const items = bot.inventory.items().map(i => ({name: i.name, count: i.count}));
            socket.emit("inv", items);
        });
        bot.on("end", () => { socket.emit("log", "§cBağlantı koptu."); bot = null; });
    });

    socket.on("sendChat", (m) => { if(bot) bot.chat(m); });
    socket.on("stopBot", () => { if(bot) bot.quit(); });
});

server.listen(process.env.PORT || 3000);
