const socket = io();
const logs = document.getElementById('logs');
const chatInput = document.getElementById('chat-input');
const statusInd = document.getElementById('status-indicator');

let currentSettings = { aiEnabled: true, mathEnabled: true, delay: 2000 };

function toggleSetting(type) {
    if (type === 'ai') {
        currentSettings.aiEnabled = !currentSettings.aiEnabled;
        const btn = document.getElementById('toggle-ai');
        btn.innerText = currentSettings.aiEnabled ? "AI: AÇIK" : "AI: KAPALI";
        btn.className = currentSettings.aiEnabled ? "btn btn-on" : "btn btn-off";
    } else {
        currentSettings.mathEnabled = !currentSettings.mathEnabled;
        const btn = document.getElementById('toggle-math');
        btn.innerText = currentSettings.mathEnabled ? "MAT: AÇIK" : "MAT: KAPALI";
        btn.className = currentSettings.mathEnabled ? "btn btn-on" : "btn btn-off";
    }
    socket.emit('update-settings', currentSettings);
}

function updateDelay(val) {
    currentSettings.delay = parseInt(val);
    document.getElementById('delay-val').innerText = val;
    socket.emit('update-settings', currentSettings);
}

const mcColors = {'0':'#000','1':'#00A','2':'#0A0','3':'#0AA','4':'#A00','5':'#A0A','6':'#FA0','7':'#AAA','8':'#555','9':'#55F','a':'#5F5','b':'#5FF','c':'#F55','d':'#F5F','e':'#FF5','f':'#FFF','r':'#FFF'};

function addLog(text) {
    if(!text) return;
    const div = document.createElement('div');
    div.className = "mc-text";
    let parts = text.split('§');
    let finalHTML = parts[0] ? `<span>${parts[0]}</span>` : '';
    let currentColor = '#fff';
    for (let i = 1; i < parts.length; i++) {
        let code = parts[i].charAt(0).toLowerCase();
        let content = parts[i].substring(1);
        if (mcColors[code]) currentColor = mcColors[code];
        finalHTML += `<span style="color:${currentColor}">${content}</span>`;
    }
    div.innerHTML = finalHTML;
    logs.appendChild(div);
    const win = document.querySelector('.terminal-window');
    win.scrollTop = win.scrollHeight;
}

function connect() {
    socket.emit('start-bot', { 
        host: document.getElementById('host').value, 
        username: document.getElementById('username').value,
        password: document.getElementById('password').value
    });
}
function disconnect() { socket.emit('stop-bot'); }
chatInput.addEventListener("keypress", e => {
    if (e.key === "Enter" && chatInput.value) {
        socket.emit('send-chat', chatInput.value);
        chatInput.value = '';
    }
});
socket.on('log', d => addLog(d.text));
socket.on('status', d => {
    statusInd.style.color = d.connected ? "#3fb950" : "#f85149";
    statusInd.innerText = d.connected ? "● ONLINE" : "● OFFLINE";
});
