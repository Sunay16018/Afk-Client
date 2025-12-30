const socket = io();
let selBot = "";
const el = (id) => document.getElementById(id);

// Pencereleri aç/kapat
function toggleModal(id, show) {
    el(id).style.display = show ? 'flex' : 'none';
}

// Bağlan butonu
function connect() {
    const data = {
        host: el('ip').value,
        username: el('nick').value,
        pass: el('pass').value
    };
    if(!data.host || !data.username) return; // Boşsa işlem yapma
    
    socket.emit('start-bot', data);
    toggleModal('bot-modal', false);
}

// Kes butonu
function disconnect() {
    if(selBot) socket.emit('quit', selBot);
}

// Ayarları Kaydet ve Kapat
function saveSettings() {
    if(!selBot) return;
    const config = {
        autoRevive: el('rev-on').checked,
        math: el('math-on').checked,
        autoMsg: el('msg-on').checked,
        msgText: el('msg-text').value,
        msgDelay: parseInt(el('msg-sec').value) || 30
    };
    socket.emit('update-config', { user: selBot, config });
    toggleModal('set-modal', false); // Kaydedince kapatır
}

// Mesaj Gönder
function sendChat() {
    const msg = el('cin').value.trim();
    if(selBot && msg) {
        socket.emit('chat', { user: selBot, msg: msg });
        el('cin').value = ""; // Kutuyu temizle
    }
}

// Bot listesini dinle
socket.on('status', d => {
    const s = el('bot-sel');
    if (d.online) {
        if (!el("opt-"+d.user)) {
            let o = document.createElement('option');
            o.value = d.user;
            o.id = "opt-"+d.user;
            o.innerText = d.user;
            s.appendChild(o);
        }
        selBot = d.user; 
        s.value = d.user;
    } else {
        const o = el("opt-"+d.user);
        if(o) o.remove();
        selBot = s.value;
    }
});

// Terminale yaz ve aşağı kaydır
socket.on('log', d => {
    const l = el('logs');
    const div = document.createElement('div');
    div.style.marginBottom = "5px";
    div.innerHTML = `<span style="color:#888">[${d.user}]</span> ${d.msg}`;
    l.appendChild(div);
    
    // Terminali otomatik en aşağı indirir
    l.scrollTop = l.scrollHeight;
});

// Enter tuşu desteği
el('cin').onkeydown = (e) => {
    if(e.key === 'Enter') sendChat();
};
