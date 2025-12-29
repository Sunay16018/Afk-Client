const socket = io();

// Elementler
const term = document.getElementById('terminal');
const statusDiv = document.getElementById('statusIndicator');

// Log Yazdırma
function log(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    term.appendChild(div);
    term.scrollTop = term.scrollHeight;
}

// Socket Olayları
socket.on('log', (msg) => log(`<span class="sys-msg">> ${msg}</span>`));
socket.on('chat-log', (data) => {
    log(`<span class="chat-entry"><span class="user">[${data.user}]</span> <span class="msg">${data.msg}</span></span>`);
});

socket.on('status', (state) => {
    if(state === 'connected') {
        statusDiv.innerText = "BAĞLI 🟢";
        statusDiv.className = "status-online";
    } else {
        statusDiv.innerText = "BAĞLI DEĞİL 🔴";
        statusDiv.className = "status-offline";
    }
});

// Kontroller
function toggleModal(id) {
    const el = document.getElementById(id);
    el.style.display = (el.style.display === 'flex') ? 'none' : 'flex';
}

function connectBot() {
    const ip = document.getElementById('ip').value;
    const user = document.getElementById('user').value;
    const pass = document.getElementById('pass').value;

    if(!ip || !user) return alert("IP ve Kullanıcı Adı gerekli!");

    socket.emit('connect-bot', { host: ip, username: user, password: pass });
    toggleModal('loginModal');
}

function disconnectBot() {
    socket.emit('disconnect-bot');
}

function saveSettings() {
    const settings = {
        mathEnabled: document.getElementById('setMath').checked,
        mathDelay: parseInt(document.getElementById('setMathDelay').value) || 2000,
        autoMine: document.getElementById('setMine').checked,
        autoMsgEnabled: document.getElementById('setMsg').checked,
        autoMsgText: document.getElementById('setMsgText').value,
        autoMsgTime: parseInt(document.getElementById('setMsgTime').value) || 60
    };
    socket.emit('update-settings', settings);
    toggleModal('settingsModal');
}

function move(dir, state) {
    socket.emit('move', { dir, state });
}

function sendChat() {
    const inp = document.getElementById('chatInp');
    if(inp.value) {
        socket.emit('send-chat', inp.value);
        inp.value = '';
    }
}
function handleEnter(e) {
    if(e.key === 'Enter') sendChat();
}
