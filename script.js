const socket = io();
let mathState = false;

function connect() {
    socket.emit('start-bot', {
        host: document.getElementById('host').value,
        username: document.getElementById('user').value,
        password: document.getElementById('pass').value
    });
}

function toggleMath() {
    mathState = !mathState;
    const b = document.getElementById('m-btn');
    b.innerText = mathState ? "AÇIK" : "KAPALI";
    b.className = mathState ? "on" : "off";
    updateSettings();
}

function updateSettings() {
    const user = document.getElementById('bselect').value;
    const sec = document.getElementById('m-time').value;
    if(user) socket.emit('update-settings', { user, mathOn: mathState, mathSec: sec });
}

socket.on('status', (d) => {
    if (d.connected) {
        if (!document.getElementById(`b-${d.username}`)) {
            document.getElementById('blist').innerHTML += `<div class="card" id="b-${d.username}"><span>${d.username}</span><button onclick="socket.emit('stop-bot','${d.username}')">X</button></div>`;
            const opt = document.createElement('option');
            opt.value = d.username; opt.innerText = d.username; opt.id = `o-${d.username}`;
            document.getElementById('bselect').appendChild(opt);
        }
        document.getElementById('chat-in').focus();
    } else {
        document.getElementById(`b-${d.username}`)?.remove();
        document.getElementById(`o-${d.username}`)?.remove();
    }
});

socket.on('log', (d) => {
    const l = document.getElementById('logs');
    l.innerHTML += `<p><b>${d.username}:</b> ${d.msg}</p>`;
    if(l.childNodes.length > 25) l.removeChild(l.firstChild);
    l.scrollTop = l.scrollHeight;
});

function move(dir) { const u = document.getElementById('bselect').value; if(u) socket.emit('move-bot', { username: u, dir }); }

document.getElementById('chat-in').onkeydown = (e) => {
    if (e.key === 'Enter' && e.target.value && document.getElementById('bselect').value) {
        socket.emit('send-chat', { username: document.getElementById('bselect').value, msg: e.target.value });
        e.target.value = '';
    }
};
    
