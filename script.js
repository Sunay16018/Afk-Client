const socket = io();
let selBot = "";
const el = (id) => document.getElementById(id);

// Pencere (Modal) Açma-Kapama Fonksiyonu
function toggleModal(id, show) {
    el(id).style.display = show ? 'flex' : 'none';
}

// Yeni Bot Bağlama
function connect() {
    const data = {
        host: el('ip').value,
        username: el('nick').value,
        pass: el('pass').value
    };
    
    if(!data.host || !data.username) {
        alert("IP ve Nick alanları boş bırakılamaz!");
        return;
    }

    socket.emit('start-bot', data);
    toggleModal('bot-modal', false); // Bağlan diyince pencereyi kapat
}

// Botun Bağlantısını Kesme
function disconnect() {
    if (selBot) {
        socket.emit('quit', selBot);
    } else {
        alert("Önce listeden bir bot seçmelisin!");
    }
}

// Ayarları Kaydetme
function saveSettings() {
    if (!selBot) {
        alert("Ayarları kaydetmek için aktif bir bot seçili olmalı!");
        return;
    }

    const config = {
        autoRevive: el('rev-on').checked,
        math: el('math-on').checked,
        autoMsg: el('msg-on').checked,
        msgText: el('msg-text').value,
        msgDelay: parseInt(el('msg-sec').value) || 30
    };

    socket.emit('update-config', { user: selBot, config });
    toggleModal('set-modal', false); // Kaydedince pencereyi kapat
}

// Sunucuya Mesaj Gönderme
function sendChat() {
    const msgInput = el('cin');
    const msg = msgInput.value.trim();

    if (!selBot) {
        alert("Mesaj göndermek için bağlı bir bot seçmelisin!");
        return;
    }

    if (msg) {
        socket.emit('chat', { user: selBot, msg: msg });
        msgInput.value = ""; // Gönderdikten sonra kutuyu temizle
        msgInput.focus(); // Kutuda kalmaya devam et
    }
}

// Bot Listesi Güncelleme (Dropdown)
socket.on('status', d => {
    const s = el('bot-sel');
    if (d.online) {
        if (!el("opt-" + d.user)) {
            let o = document.createElement('option');
            o.value = d.user;
            o.id = "opt-" + d.user;
            o.innerText = d.user;
            s.appendChild(o);
        }
        selBot = d.user; 
        s.value = d.user;
    } else {
        const o = el("opt-" + d.user);
        if (o) o.remove();
        selBot = s.value;
    }
});

// Terminale Mesaj Yazdırma ve Otomatik Kaydırma
socket.on('log', d => {
    const l = el('logs');
    const item = document.createElement('div');
    item.style.marginBottom = "3px";
    // Sunucudan gelen renkli HTML mesajını ekler
    item.innerHTML = `<span style="color:#888">[${d.user}]</span> ${d.msg}`;
    l.appendChild(item);

    // Terminali her zaman en aşağıya kaydırır
    l.scrollTop = l.scrollHeight;
});

// Enter Tuşu İle Mesaj Gönderme Dinleyicisi
el('cin').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        sendChat();
    }
});
