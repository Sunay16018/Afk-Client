const socket = io();

socket.on('log', (msg) => {
    const box = document.getElementById('logs');
    box.innerHTML += `<div>> ${msg}</div>`;
    box.scrollTop = box.scrollHeight;
});

socket.on('chat-log', (data) => {
    const box = document.getElementById('logs');
    box.innerHTML += `<div><span style="color:#00d4ff">[${data.user}]</span>: ${data.msg}</div>`;
    box.scrollTop = box.scrollHeight;
});

socket.on('status', (s) => {
    const badge = document.getElementById('status');
    badge.innerText = s === 'connected' ? 'BAĞLI' : 'BAĞLI DEĞİL';
    badge.style.color = s === 'connected' ? '#0f9' : '#f00';
});

function openModal() { document.getElementById('modal').style.display = 'flex'; }
function start() {
    const data = { host: document.getElementById('ip').value, username: document.getElementById('user').value, password: document.getElementById('pass').value };
    socket.emit('connect-bot', data);
    document.getElementById('modal').style.display = 'none';
}
function move(dir, state) { socket.emit('move', { dir, state }); }
function sendMsg() {
    const inp = document.getElementById('chatInput');
    socket.emit('send-chat', inp.value);
    inp.value = '';
}
