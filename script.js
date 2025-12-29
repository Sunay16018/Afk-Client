const socket = io();
let isMiningActive = false;

function move(dir) {
    socket.emit('move', dir);
}

function toggleMining() {
    isMiningActive = !isMiningActive;
    socket.emit('toggle-mining', isMiningActive);
    const btn = document.getElementById('mineBtn');
    btn.innerText = isMiningActive ? 'STOP MINING' : 'START MINING';
    btn.classList.toggle('mining-on');
}

function sendChat() {
    const input = document.getElementById('chatInput');
    if (input.value.trim()) {
        socket.emit('send-chat', input.value);
        input.value = '';
    }
}

function connectBot() {
    const data = {
        host: document.getElementById('host').value,
        port: document.getElementById('port').value,
        username: document.getElementById('username').value
    };
    if (!data.host || !data.username) return alert('Lütfen gerekli alanları doldurun!');
    socket.emit('start-bot', data);
    closeModal();
}

socket.on('log', (msg) => {
    const terminal = document.getElementById('terminal');
    const line = document.createElement('div');
    
    // Minecraft Renk Kodlarını Render Etme
    const colors = {
        '0': '#000', '1': '#00a', '2': '#0a0', '3': '#0aa', '4': '#a00', '5': '#a0a',
        '6': '#fa0', '7': '#aaa', '8': '#555', '9': '#55f', 'a': '#5f5', 'b': '#5ff',
        'c': '#f55', 'd': '#f5f', 'e': '#ff5', 'f': '#fff'
    };

    let html = msg.replace(/§([0-9a-f])/g, (m, c) => `</span><span style="color:${colors[c]}">`);
    line.innerHTML = `<span>${html}</span>`;
    
    terminal.appendChild(line);
    terminal.scrollTop = terminal.scrollHeight;
});

function openModal() { document.getElementById('settingsModal').style.display = 'flex'; }
function closeModal() { document.getElementById('settingsModal').style.display = 'none'; }

// Enter tuşu ile chat gönderme
document.getElementById('chatInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChat();
});
