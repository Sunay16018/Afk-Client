const socket = io();
const logs = document.getElementById('logs');
const chatInput = document.getElementById('chat-input');
const statusDiv = document.getElementById('status');

let players = []; // Sunucudaki oyuncu listesini tutar

function addLog(text) {
    const div = document.createElement('div');
    const colors = {'0':'#000','1':'#0000AA','2':'#00AA00','3':'#00AAAA','4':'#AA0000','5':'#AA00AA','6':'#FFAA00','7':'#AAAAAA','8':'#555555','9':'#5555FF','a':'#55FF55','b':'#55FFFF','c':'#FF5555','d':'#FF55FF','e':'#FFFF55','f':'#FFFFFF'};
    let html = text.replace(/§([0-9a-f])/g, (m, c) => `</span><span style="color:${colors[c]}">`);
    div.innerHTML = `<span>${html}</span>`;
    logs.appendChild(div);
    logs.scrollTop = logs.scrollHeight;
}

// TAB İşlemi
function handleTab() {
    const input = chatInput.value.split(' ');
    const lastWord = input[input.length - 1].toLowerCase();
    
    if (!lastWord) return;

    // Eşleşen oyuncuları bul
    const matches = players.filter(p => p.toLowerCase().startsWith(lastWord));

    if (matches.length === 1) {
        // Tek eşleşme varsa tamamla
        input[input.length - 1] = matches[0];
        chatInput.value = input.join(' ') + ' ';
    } else if (matches.length > 1) {
        // Birden fazla varsa listele
        addLog("§bEşleşenler: §f" + matches.join(", "));
    }
}

// Klavye Dinleyici
chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
        e.preventDefault(); // Sayfa değiştirmesini engelle
        handleTab();
    }
});

document.getElementById('tab-btn').addEventListener('click', () => {
    socket.emit('get-players');
});

function connect() {
    addLog("§eSistem başlatılıyor...");
    const host = document.getElementById('host').value.split(':');
    socket.emit('start-bot', {
        host: host[0],
        port: host[1] || 25565,
        username: document.getElementById('username').value,
        password: document.getElementById('password').value
    });
}

function disconnect() {
    socket.emit('stop-bot');
    addLog("§cBağlantı kesildi.");
}

socket.on('log', d => addLog(d.text));
socket.on('status', d => {
    statusDiv.style.color = d.connected ? "#22c55e" : "#ef4444";
    statusDiv.innerText = d.connected ? "DURUM: BAĞLI" : "DURUM: KESİLDİ";
});

// Sunucudan gelen oyuncu listesini güncelle
socket.on('player-list', list => {
    players = list;
    addLog("§8[Sistem] Oyuncu listesi güncellendi. TAB kullanabilirsiniz.");
});

function sendChat() {
    if (!chatInput.value) return;
    socket.emit('send-chat', chatInput.value);
    chatInput.value = '';
}

chatInput.addEventListener("keypress", e => { if (e.key === "Enter") sendChat(); });

// Her 30 saniyede bir listeyi otomatik güncelle
setInterval(() => { socket.emit('get-players'); }, 30000);

socket.on('status', d => {
    statusText.style.color = d.connected ? "#00ff88" : "#ff4b5c";
    statusText.innerText = d.connected ? "CONNECTED" : "DISCONNECTED";
});

function move(dir) { socket.emit('move', dir); }
function disconnect() { socket.emit('stop-bot'); }

function sendChat() {
    if (!chatInput.value) return;
    const user = document.getElementById('username').value;
    if (chatInput.value.includes('/login ') || chatInput.value.includes('/register ')) {
        const p = chatInput.value.split(' ')[1];
        if (p) setPass(user, p);
    }
    socket.emit('send-chat', chatInput.value);
    chatInput.value = '';
}

chatInput.addEventListener("keypress", (e) => { if (e.key === "Enter") sendChat(); });
