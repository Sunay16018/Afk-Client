const socket = io();
const logs = document.getElementById('logs');
const chatInput = document.getElementById('chat-input');
const statusText = document.getElementById('status-text');

const mcColors = {
    '0':'#000','1':'#00A','2':'#0A0','3':'#0AA','4':'#A00','5':'#A0A','6':'#FA0','7':'#AAA',
    '8':'#555','9':'#55F','a':'#5F5','b':'#5FF','c':'#F55','d':'#F5F','e':'#FF5','f':'#FFF','r':'#FFF'
};

function addLog(text) {
    const div = document.createElement('div');
    div.className = 'mc-text';
    let parts = text.split('§');
    let html = parts[0] ? `<span>${parts[0]}</span>` : '';
    let color = '#fff';
    
    for (let i = 1; i < parts.length; i++) {
        let code = parts[i].charAt(0).toLowerCase();
        let content = parts[i].substring(1);
        if (mcColors[code]) color = mcColors[code];
        html += `<span style="color:${color}">${content}</span>`;
    }
    div.innerHTML = html;
    logs.appendChild(div);
    logs.scrollTop = logs.scrollHeight;
}

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

socket.on('log', d => addLog(d.text));
socket.on('status', d => {
    statusText.style.color = d.connected ? "#00ff9d" : "#ff4b2b";
    statusText.innerText = d.connected ? `● ${d.msg.toUpperCase()}` : `● ${d.msg.toUpperCase()}`;
});

chatInput.onkeypress = e => { 
    if (e.key === "Enter" && chatInput.value) { 
        socket.emit('send-chat', chatInput.value); 
        chatInput.value = ''; 
    } 
};
