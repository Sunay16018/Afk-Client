const socket = io();
const logs = document.getElementById('logs');
const chatInput = document.getElementById('chat-input');
const statusInd = document.getElementById('status-indicator');

const mcColors = {'0':'#000','1':'#00A','2':'#0A0','3':'#0AA','4':'#A00','5':'#A0A','6':'#FA0','7':'#AAA','8':'#555','9':'#55F','a':'#5F5','b':'#5FF','c':'#F55','d':'#F5F','e':'#FF5','f':'#FFF','r':'#FFF'};

function addLog(text) {
    if(!text) return;
    if (logs.childNodes.length > 100) logs.removeChild(logs.firstChild);

    const div = document.createElement('div');
    div.className = 'mc-text';
    let parts = text.split('§');
    let finalHTML = '';
    let currentColor = '#fff';
    let isBold = false;

    if (parts[0]) finalHTML += `<span>${parts[0]}</span>`;
    for (let i = 1; i < parts.length; i++) {
        let code = parts[i].charAt(0).toLowerCase();
        let content = parts[i].substring(1);
        if (mcColors[code]) currentColor = mcColors[code];
        else if (code === 'l') isBold = true;
        else if (code === 'r') { currentColor = '#fff'; isBold = false; }
        finalHTML += `<span style="color:${currentColor}; font-weight:${isBold?'bold':'normal'}">${content}</span>`;
    }

    div.innerHTML = finalHTML;
    const isAtBottom = logs.scrollHeight - logs.clientHeight <= logs.scrollTop + 60;
    logs.appendChild(div);
    if (isAtBottom) logs.scrollTop = logs.scrollHeight;
}

function connect() {
    const h = document.getElementById('host').value.split(':');
    socket.emit('start-bot', { host: h[0], port: h[1], username: document.getElementById('username').value, password: document.getElementById('password').value });
}

socket.on('log', d => addLog(d.text));
socket.on('status', d => {
    statusInd.style.color = d.connected ? "#00ff88" : "#ff4d4d";
    statusInd.innerText = d.connected ? "● ONLINE" : "● OFFLINE";
});

chatInput.addEventListener("keypress", e => { if (e.key === "Enter" && chatInput.value) { socket.emit('send-chat', chatInput.value); chatInput.value = ''; } });
