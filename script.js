const socket = io();

const chatWindow = document.getElementById('chatWindow');
const statusBox = document.getElementById('statusBox');

// Log Ekleme Fonksiyonu
function addLog(htmlContent) {
    const div = document.createElement('div');
    div.className = 'chat-entry';
    div.innerHTML = htmlContent;
    chatWindow.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight; // Otomatik kaydır
}

// Socket Olayları
socket.on('log', (msg) => {
    addLog(`<span class="log-msg">> ${msg}</span>`);
});

socket.on('chat-log', (data) => {
    addLog(`<span class="chat-user">[${data.user}]</span> <span class="chat-msg">${data.msg}</span>`);
});

socket.on('status', (state) => {
    if (state === 'connected') {
        statusBox.innerText = "DURUM: BAĞLI 🟢";
        statusBox.style.color = "#2ea043";
        statusBox.style.borderColor = "#2ea043";
    } else {
        statusBox.innerText = "DURUM: BAĞLI DEĞİL 🔴";
        statusBox.style.color = "#da3633";
        statusBox.style.borderColor = "#da3633";
    }
});

// Kontrol Fonksiyonları
function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

function connectBot() {
    const host = document.getElementById('inpIp').value;
    const user = document.getElementById('inpUser').value;
    const pass = document.getElementById('inpPass').value;

    if (!host || !user) {
        alert("IP ve Kullanıcı Adı zorunludur!");
        return;
    }

    socket.emit('connect-bot', { host, username: user, password: pass });
    closeModal('loginModal');
}

function disconnectBot() {
    socket.emit('disconnect-bot');
}

function saveSettings() {
    const settings = {
        mathEnabled: document.getElementById('setMath').checked,
        mathDelay: parseInt(document.getElementById('setMathDelay').value) || 2000,
        autoMine: document.getElementById('setMine').checked,
        autoMsgEnabled: document.getElementById('setAutoMsg').checked,
        autoMsgText: document.getElementById('setAutoMsgText').value || "AFK",
        autoMsgTime: parseInt(document.getElementById('setAutoMsgTime').value) || 60
    };

    socket.emit('update-settings', settings);
    closeModal('settingsModal');
    addLog('<span class="log-msg">> Ayarlar güncellendi ve gönderildi.</span>');
}

function sendChat() {
    const inp = document.getElementById('chatInput');
    if (inp.value) {
        socket.emit('send-chat', inp.value);
        inp.value = '';
    }
}

// Hareket Gönderme
function sendMove(dir, state) {
    socket.emit('move', { dir: dir, state: state });
}

// Enter tuşu ile mesaj gönderme
document.getElementById('chatInput').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') sendChat();
});
                    
