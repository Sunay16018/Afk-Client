const socket = io();
const logs = document.getElementById('logs');
const statusText = document.getElementById('status-text');
const chatInput = document.getElementById('chat-input');

// Şifre Hafıza Sistemi
const getPass = (u) => localStorage.getItem(`p_${u}`) || "";
const setPass = (u, p) => localStorage.setItem(`p_${u}`, p);

function connect() {
    const user = document.getElementById('username').value;
    const iPass = document.getElementById('password').value;
    
    let pass = iPass || getPass(user);
    if (iPass) setPass(user, iPass);

    const h = document.getElementById('host').value.split(':');
    socket.emit('start-bot', {
        host: h[0],
        port: h[1] || 25565,
        username: user,
        password: pass
    });
}

socket.on('log', d => {
    const div = document.createElement('div');
    div.style.marginBottom = "4px";
    div.innerHTML = `<span style="color:#334155;">[${new Date().toLocaleTimeString()}]</span> ` + 
        d.text.replace(/§([0-9a-f])/g, (m, c) => {
            const codes = {'0':'#000','1':'#00c','2':'#0c0','3':'#0cc','4':'#c00','5':'#c0c','6':'#f90','7':'#aaa','8':'#555','9':'#55f','a':'#5f5','b':'#5ff','c':'#f55','d':'#f5f','e':'#ff5','f':'#fff'};
            return `</span><span style="color:${codes[c]}">`;
        });
    logs.appendChild(div);
    logs.scrollTop = logs.scrollHeight;
});

socket.on('status', d => {
    statusText.style.color = d.connected ? "#00ff88" : "#ff4b5c";
    statusText.innerText = d.connected ? "CONNECTED" : "DISCONNECTED";
});

function move(dir) { socket.emit('move', dir); }
function disconnect() { socket.emit('stop-bot'); }

function sendChat() {
    if (!chatInput.value) return;
    const user = document.getElementById('username').value;
    if (chatInput.value.includes('/login ') || chatInput.value.includes('/register ')) {
        const p = chatInput.value.split(' ')[1];
        if (p) setPass(user, p);
    }
    socket.emit('send-chat', chatInput.value);
    chatInput.value = '';
}

chatInput.addEventListener("keypress", (e) => { if (e.key === "Enter") sendChat(); });
