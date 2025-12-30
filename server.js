const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mineflayer = require("mineflayer");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

io.on("connection", (socket) => {
    let bot = null;

    // Envanter bilgisini paketleyip gönderen fonksiyon
    const sendInv = () => {
        if (!bot || !bot.inventory) return;
        const items = bot.inventory.items().map(i => ({
            name: i.name,
            count: i.count,
            label: i.displayName
        }));
        socket.emit("inv", items);
    };

    socket.on("startBot", (data) => {
        if (bot) return;
        
        bot = mineflayer.createBot({
            host: data.ip,
            port: parseInt(data.port) || 25565,
            username: data.user,
            version: data.version || false,
            hideErrors: true
        });

        bot.on("spawn", () => {
            socket.emit("log", "§a[SİSTEM] Bot başarıyla bağlandı!");
            sendInv();
        });

        bot.on("message", (m) => socket.emit("log", m.toAnsi()));
        
        // Envanterde bir slot güncellendiğinde tetiklenir
        bot.inventory.on("updateSlot", () => sendInv());

        bot.on("kicked", (reason) => socket.emit("log", `§c[KICK] ${reason}`));
        bot.on("error", (err) => socket.emit("log", `§c[HATA] ${err.message}`));
        
        bot.on("end", () => {
            socket.emit("log", "§e[BİLGİ] Bağlantı kesildi.");
            socket.emit("inv", []);
            bot = null;
        });
    });

    socket.on("sendChat", (msg) => {
        if (bot) bot.chat(msg);
    });

    socket.on("stopBot", () => {
        if (bot) {
            bot.quit();
            bot = null;
        }
    });

    socket.on("move", (d) => {
        if (bot) bot.setControlState(d.key, d.state);
    });

    socket.on("disconnect", () => {
        if (bot) {
            bot.quit();
            bot = null;
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda calisiyor.`);
});
