const socket = io();
const logBox = document.getElementById("log");
const invGrid = document.getElementById("inventory-grid");
const settings = document.getElementById("settings");
const Convert = new AnsiConvert({ escapeXML: true, fg: '#fff', bg: '#000', newline: true });

// Log Basma
socket.on("log", (m) => {
    if(!m) return;
    logBox.innerHTML += Convert.toHtml(m) + "<br>";
    logBox.scrollTop = logBox.scrollHeight;
});

// Envanter Güncelleme (Resimli)
socket.on("inventory", (items) => {
    invGrid.innerHTML = ""; // Temizle
    
    if (!items || items.length === 0) {
        invGrid.innerHTML = '<div class="empty-msg">Envanter Boş</div>';
        return;
    }

    items.forEach(item => {
        const slot = document.createElement("div");
        slot.className = "inv-slot";
        slot.title = item.displayName; // Üzerine gelince isim yazar

        // Resim URL'si (PrismarineJS deposundan çekiyoruz)
        // Eğer resim yüklenmezse ismini yazar
        const imgUrl = `https://wsrv.nl/?url=https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.20.1/items/${item.name}.png&w=64&h=64`;

        const img = document.createElement("img");
        img.src = imgUrl;
        img.className = "inv-img";
        img.onerror = function() { this.style.display='none'; }; // Resim yoksa gizle

        const count = document.createElement("span");
        count.className = "inv-count";
        count.innerText = item.count > 1 ? item.count : ""; // Sayı 1 ise gösterme

        slot.appendChild(img);
        slot.appendChild(count);
        invGrid.appendChild(slot);
    });
});

// Buton İşlevleri
document.getElementById("start").onclick = () => {
    logBox.innerHTML = "";
    invGrid.innerHTML = '<div class="empty-msg">Yükleniyor...</div>';
    socket.emit("startBot", {
        ip: document.getElementById("ip").value,
        port: document.getElementById("port").value,
        username: document.getElementById("username").value,
        password: document.getElementById("password").value,
        version: document.getElementById("version").value
    });
};

document.getElementById("stop").onclick = () => socket.emit("stopBot");

document.getElementById("send").onclick = () => {
    const msg = document.getElementById("chatMsg").value;
    if(msg) { socket.emit("sendChat", { message: msg }); document.getElementById("chatMsg").value = ""; }
};

document.getElementById("settingsBtn").onclick = () => settings.classList.toggle("hidden");

document.getElementById("autoMsgEnable").onchange = () => {
    socket.emit("autoMsg", {
        enabled: document.getElementById("autoMsgEnable").checked,
        message: document.getElementById("autoMsgText").value,
        delay: Number(document.getElementById("autoMsgDelay").value || 30)
    });
};

// Hareket Tuşları
document.querySelectorAll("button[data-k]").forEach(b => {
    b.onmousedown = () => socket.emit("move", { key: b.dataset.k, state: true });
    b.onmouseup = () => socket.emit("move", { key: b.dataset.k, state: false });
});
