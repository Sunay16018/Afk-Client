const socket = io();
let isMath = false;

function connect() {
    socket.emit('start-bot', {
        host: document.getElementById('host').value,
        username: document.getElementById('user').value,
        password: document.getElementById('pass').value
    });
}

function toggleMath() {
    isMath = !isMath;
    const btn = document.getElementById('m-btn');
    btn.innerText = isMath ? "AÇIK" : "KAPALI";
    btn.className = isMath ? "on" : "off";
    updateSet();
}

function updateSet() {
    const user = document.getElementById('bot-select').value;
    const sec = document.getElementById('m-time').value;
    if(user) socket.emit('update-settings', { user, mathOn: isMath, mathSec: sec });
}

socket.on('status', (d) => {
    if (d.connected) {
        if (!document.getElementById(`b-${d.username}`)) {
            document.getElementById('bot-list').innerHTML += `<div class="card" id="b-${d.username}"><span>${d.username}</span><button onclick="socket.emit('stop-bot','${d.username}')">X</button></div>`;
            const opt = document.createElement('option');
            opt.value = d.username; opt.innerText = d.username; opt.id = `o-${d.username}`;
            document.getElementById('bot-select').appendChild(opt);
        }
        document.getElementById('chat-input').focus();
    } else {
        document.getElementById(`b-${d.username}`)?.remove();
        document.getElementById(`o-${d.username}`)?.remove();
    }
});

socket.on('log', (d) => {
    const l = document.getElementById('logs');
    const p = document.createElement('p');
    p.innerHTML = `<span class="user-tag">[${d.username}]</span> ${d.msg}`;
    l.appendChild(p);
    if(l.childNodes.length > 25) l.removeChild(l.firstChild);
    l.scrollTop = l.scrollHeight;
});

function move(dir) { 
    const u = document.getElementById('bot-select').value; 
    if(u) socket.emit('move-bot', { username: u, dir }); 
}

// MESAJ GÖNDERME DÜZELTİLDİ
document.getElementById('chat-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        const user = document.getElementById('bot-select').value;
        const msg = this.value;
        if (msg && user) {
            socket.emit('send-chat', { username: user, msg: msg });
            this.value = '';
        }
    }
});
