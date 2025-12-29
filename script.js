const socket = io();
const logs = document.getElementById('logs');
const chatInput = document.getElementById('chat-input');
const statusText = document.getElementById('status-text');

// Mineflayer toHTML desteği sayesinde renk kodlarını manuel çözmüyoruz
socket.on('log', d => {
    const div = document.createElement('div');
    div.style.marginBottom = "5px";
    div.innerHTML = d.html; // Gelen HTML'i direkt basıyoruz
    logs.appendChild(div);
    logs.scrollTop = logs.scrollHeight;
});

socket.on('status', d => {
    statusText.style.color = d.connected ? "#00ff9d" : "#ff4b2b";
    statusText.innerText = `● ${d.msg}`;
});

function connect() {
    const h = document.getElementById('host').value.split(':');
    socket.emit('start-bot', { 
        host: h[0], 
        port: h[1] || 25565, 
        username: document.getElementById('username').value,
        password: document.getElementById('password').value
    });
}

function disconnect() { socket.emit('stop-bot'); }
function move(dir) { socket.emit('move', dir); }

function sendMsg() {
    if (chatInput.value) {
        socket.emit('send-chat', chatInput.value);
        chatInput.value = '';
    }
}

chatInput.onkeypress = e => { if (e.key === "Enter") sendMsg(); };
