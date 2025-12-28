const socket = io();
const logs = document.getElementById('logs');
const chatInput = document.getElementById('chat-input');
const statusInd = document.getElementById('status-indicator');

let currentSettings = { aiEnabled: true, mathEnabled: true, delay: 2000 };

function toggleSetting(type) {
    if (type === 'ai') {
        currentSettings.aiEnabled = !currentSettings.aiEnabled;
        document.getElementById('toggle-ai').className = currentSettings.aiEnabled ? "btn btn-on" : "btn btn-off";
        document.getElementById('toggle-ai').innerText = currentSettings.aiEnabled ? "AI: AÇIK" : "AI: KAPALI";
    } else {
        currentSettings.mathEnabled = !currentSettings.mathEnabled;
        document.getElementById('toggle-math').className = currentSettings.mathEnabled ? "btn btn-on" : "btn btn-off";
        document.getElementById('toggle-math').innerText = currentSettings.mathEnabled ? "MAT: AÇIK" : "MAT: KAPALI";
    }
    socket.emit('update-settings', currentSettings);
}

function updateDelay(val) {
    currentSettings.delay = parseInt(val);
    document.getElementById('delay-val').innerText = val;
    socket.emit('update-settings', currentSettings);
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

const mcColors = {'0':'#000','1':'#00A','2':'#0A0','3':'#0AA','4':'#A00','5':'#A0A','6':'#FA0','7':'#AAA','8':'#555','9':'#55F','a':'#5F5','b':'#5FF','c':'#F55','d':'#F5F','e':'#FF5','f':'#FFF','r':'#FFF'};

socket.on('log', d => {
    const div = document.createElement('div');
    div.className = "mc-text";
    let parts = d.text.split('§');
    let html = parts[0] || '';
    let color = '#fff';
    for(let i=1; i<parts.length; i++) {
        let code = parts[i][0].toLowerCase();
        if(mcColors[code]) color = mcColors[code];
        html += `<span style="color:${color}">${parts[i].substring(1)}</span>`;
    }
    div.innerHTML = html;
    logs.appendChild(div);
    logs.scrollTop = logs.scrollHeight;
});

socket.on('status', d => {
    statusInd.style.color = d.connected ? "#3fb950" : "#f85149";
    statusInd.innerText = d.connected ? "● ONLINE" : "● OFFLINE";
});
