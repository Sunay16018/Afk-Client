const s = io();
const logBox = document.getElementById("log");
const settings = document.getElementById("settings");

// ANSI to HTML için CDN'den AnsiConvert global olarak geliyor
const Convert = new AnsiConvert({ escapeXML: true, fg: '#fff', bg: '#000' });

function log(m){
    logBox.innerHTML += Convert.toHtml(m) + "<br>";
    logBox.scrollTop = logBox.scrollHeight;
}

s.on("log", log);

// Ayarlar menüsü aç/kapa
document.getElementById("settingsBtn").onclick = () => settings.classList.toggle("hidden");

// Bot başlat/durdur
document.getElementById("start").onclick = () => s.emit("startBot", {
    ip: document.getElementById("ip").value,
    port: document.getElementById("port").value,
    username: document.getElementById("username").value,
    password: document.getElementById("password").value,
    version: document.getElementById("version").value
});

document.getElementById("stop").onclick = () => s.emit("stopBot", document.getElementById("username").value);

// Oyun mesajı gönder
document.getElementById("send").onclick = () => {
    s.emit("sendChat", {
        username: document.getElementById("username").value,
        message: document.getElementById("chatMsg").value
    });
    document.getElementById("chatMsg").value = "";
};

// Otomatik mesaj
document.getElementById("autoMsgEnable").onchange = () => {
    s.emit("autoMsg", {
        username: document.getElementById("username").value,
        enabled: document.getElementById("autoMsgEnable").checked,
        message: document.getElementById("autoMsgText").value,
        delay: Number(document.getElementById("autoMsgDelay").value || 5)
    });
};

// Hareket tuşları
document.querySelectorAll(".controls button").forEach(b => {
    const k = b.dataset.k;
    b.onmousedown = () => s.emit("move", { username: document.getElementById("username").value, key: k, state: true });
    b.onmouseup = () => s.emit("move", { username: document.getElementById("username").value, key: k, state: false });
    b.ontouchstart = () => s.emit("move", { username: document.getElementById("username").value, key: k, state: true });
    b.ontouchend = () => s.emit("move", { username: document.getElementById("username").value, key: k, state: false });
});
