const socket = io();
const logs = document.getElementById('logs');
const chatInput = document.getElementById('chat-input');
let players = [];

const mcColors = {'0':'#000000','1':'#0000AA','2':'#00AA00','3':'#00AAAA','4':'#AA0000','5':'#AA00AA','6':'#FFAA00','7':'#AAAAAA','8':'#555555','9':'#5555FF','a':'#55FF55','b':'#55FFFF','c':'#FF5555','d':'#FF55FF','e':'#FFFF55','f':'#FFFFFF'};

function addLog(text) {
    if(!text) return;
    const div = document.createElement('div');
    div.className = 'mc-text';
    
    // Minecraft renk kodlarını HTML span'larına çevir
    let html = text.replace(/§([0-9a-f])/g, (m, c) => `</span><span style="color:${mcColors[c]}">`);
    div.innerHTML = `<span>${html}</span>`;
    
    logs.appendChild(div);
    logs.scrollTop = logs.scrollHeight;
}

// TAB Tamamlama
chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
        e.preventDefault();
        const words = chatInput.value.split(' ');
        const lastWord = words[words.length - 1].toLowerCase();
        if (!lastWord) return;

        const matches = players.filter(p => p.toLowerCase().startsWith(lastWord));
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

function disconnect() { socket.emit('stop-bot'); addLog("§cBağlantı kesildi."); }
function move(dir) { socket.emit('move', dir); }

socket.on('log', d => addLog(d.text));
socket.on('player-list', list => { players = list; }); // Sessiz güncelleme

function sendChat() {
    if (!chatInput.value) return;
    socket.emit('send-chat', chatInput.value);
    chatInput.value = '';
}

document.getElementById('tab-btn').onclick = () => socket.emit('get-players');
chatInput.addEventListener("keypress", e => { if (e.key === "Enter") sendChat(); });
