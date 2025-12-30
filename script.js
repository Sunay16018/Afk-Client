const socket = io();
const term = document.getElementById("terminal");
const invDiv = document.getElementById("inventory");

// ANSI Renklerini HTML'e çevirici (Eğer kütüphane yüklenmezse hata vermez)
const convert = typeof AnsiConvert !== 'undefined' ? new AnsiConvert({newline:true}) : { toHtml: (m) => m };

socket.on("log", (m) => {
    term.innerHTML += convert.toHtml(m) + "<br>";
    term.scrollTop = term.scrollHeight;
});

socket.on("inv", (items) => {
    invDiv.innerHTML = '<span style="color:#aaa">Envanter: </span>';
    items.forEach(i => {
        invDiv.innerHTML += `
            <div style="border:1px solid #555; padding:2px; text-align:center;">
                <img src="https://wsrv.nl/?url=https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.20.1/items/${i.name}.png&w=32" onerror="this.src='https://via.placeholder.com/32?text=?'">
                <div style="font-size:10px; color:white;">${i.count}</div>
            </div>`;
    });
});

document.getElementById("start").onclick = () => {
    socket.emit("startBot", {
        ip: document.getElementById("ip").value,
        user: document.getElementById("user").value
    });
};

document.getElementById("send").onclick = () => {
    socket.emit("sendChat", document.getElementById("msg").value);
    document.getElementById("msg").value = "";
};

document.getElementById("stop").onclick = () => socket.emit("stopBot");
