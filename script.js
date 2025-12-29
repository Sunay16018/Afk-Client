const socket = io(); // Render'da otomatik olarak doğru adrese bağlanır

// IP ve Nick Kontrolü
function connect() {
    const host = document.getElementById('ip').value;
    const username = document.getElementById('nick').value;
    if(!host || !username) {
        addLog('SİSTEM', '§cLütfen Sunucu IP ve Bot İsmi girin!');
        return;
    }
    socket.emit('start-bot', { host, username });
}

function disconnect() {
    const user = document.getElementById('bot-list').value;
    if(user) socket.emit('quit-bot', user);
}

// UI İşlemleri
function openMenu() { document.getElementById('settings-modal').style.display = 'flex'; }
function closeMenu() { document.getElementById('settings-modal').style.display = 'none'; }

function saveSettings() {
    const user = document.getElementById('bot-list').value;
    if(!user) {
        alert("Önce bir bot seçmelisin!");
        return;
    }
    const config = {
        math: document.getElementById('m-on').checked,
        delay: parseFloat(document.getElementById('m-del').value) || 0,
        recon: document.getElementById('r-on').checked,
        mine: document.getElementById('mine-on').checked,
        msgs: [{ txt: document.getElementById('otxt').value, sec: parseInt(document.getElementById('osec').value) }]
    };
    socket.emit('update-config', { user, config });
    closeMenu();
    addLog('AYARLAR', '§7Yapılandırma başarıyla kaydedildi.');
}

function mv(dir) {
    const user = document.getElementById('bot-list').value;
    if(user) socket.emit('move', { user, dir });
}

// Log Ekleme
function addLog(user, msg) {
    const l = document.getElementById('logs');
    l.innerHTML += `<div class="log-line"><b>[${user}]</b> ${msg}</div>`;
    l.scrollTop = l.scrollHeight;
}

// Socket Dinleyicileri
socket.on('status', (d) => {
    const badge = document.getElementById('status-badge');
    badge.innerText = d.online ? "ONLINE" : "OFFLINE";
    badge.className = `badge ${d.online ? 'online' : 'offline'}`;

    if (d.online) {
        const select = document.getElementById('bot-list');
        // Eğer listede yoksa ekle
        if (!document.getElementById(`opt-${d.user}`)) {
            let opt = document.createElement('option');
            opt.value = d.user;
            opt.id = `opt-${d.user}`;
            opt.innerText = d.user;
            select.appendChild(opt);
            select.value = d.user; // Otomatik seç
        }
    } else {
        const el = document.getElementById(`opt-${d.user}`);
        if(el) el.remove();
    }
});

socket.on('log', (d) => addLog(d.user, d.msg));

// Enter ile Mesaj Gönderme
document.getElementById('chat-msg').onkeydown = (e) => {
    if (e.key === 'Enter' && e.target.value) {
        const user = document.getElementById('bot-list').value;
        if (user) {
            socket.emit('chat', { user, msg: e.target.value });
            e.target.value = '';
        } else {
            addLog('SİSTEM', '§cÖnce bir bot seçin!');
        }
    }
};
