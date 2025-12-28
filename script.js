const socket = io();
const logs = document.getElementById('logs');
const chatInput = document.getElementById('chat-input');
const statusInd = document.getElementById('status-indicator');
let players = [];

const mcColors = {'0':'#000','1':'#00A','2':'#0A0','3':'#0AA','4':'#A00','5':'#A0A','6':'#FA0','7':'#AAA','8':'#555','9':'#55F','a':'#5F5','b':'#5FF','c':'#F55','d':'#F5F','e':'#FF5','f':'#FFF'};

function addLog(text) {
    if(!text) return;
    const div = document.createElement('div');
    div.className = 'mc-text';
    let html = text.replace(/§([0-9a-f])/gi, (m, c) => `</span><span style="color:${mcColors[c.toLowerCase()]}">`);
    div.innerHTML = `<span>${html}</span>`;
    logs.appendChild(div);
    logs.scrollTop = logs.scrollHeight;
}

// TAB & Otomatik Tamamlama
chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
        e.preventDefault();
        const words = chatInput.value.split(' ');
        const last = words[words.length - 1].toLowerCase();
        if (!last) return;
        const matches = players.filter(p => p.toLowerCase().startsWith(last));
        if (matches.length === 1) {
            words[words.length - 1] = matches[0];
            chatInput.value = words.join(' ') + ' ';
        } else if (matches.length > 1) {
            addLog("§bEşleşenler: §f" + matches.join(", "));
        }
    }
});

function connect() {
    const h = document.getElementById('host').value.split(':');
    socket.emit('start-bot', {
        host: h[0], port: h[1] || 25565,
        username: document.getElementById('username').value,
        password: document.getElementById('password').value
    });
}

function disconnect() { socket.emit('stop-bot'); }
function move(dir) { socket.emit('move', dir); }

socket.on('log', d => addLog(d.text));
socket.on('player-list', list => { players = list; });
socket.on('status', d => {
    statusInd.style.color = d.connected ? "#00ff88" : "#ff4d4d";
    statusInd.innerText = d.connected ? "● ONLINE" : "● OFFLINE";
});

function sendChat() {
    if (!chatInput.value) return;
    socket.emit('send-chat', chatInput.value);
    chatInput.value = '';
}

document.getElementById('tab-btn').onclick = () => socket.emit('get-players');
chatInput.addEventListener("keypress", e => { if (e.key === "Enter") sendChat(); });
