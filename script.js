const socket = io();
let mOn = false;

function start() {
    const host = document.getElementById('host').value;
    const user = document.getElementById('user').value;
    const pass = document.getElementById('pass').value;
    if(!host || !user) return alert("Bilgileri doldur!");
    
    document.getElementById('s-btn').innerText = "BAĞLANILIYOR...";
    socket.emit('start-bot', { host, username: user, password: pass });
}

function toggleM() {
    mOn = !mOn;
    document.getElementById('m-toggle').innerText = mOn ? "AÇIK" : "KAPALI";
    document.getElementById('m-toggle').className = mOn ? "on" : "off";
    sync();
}

function sync() {
    const user = document.getElementById('bot-sel').value;
    const delay = document.getElementById('m-delay').value;
    if(user) socket.emit('update-settings', { user, mathOn: mOn, mathSec: delay });
}

socket.on('status', (d) => {
    document.getElementById('s-btn').innerText = "SİSTEMİ BAŞLAT";
    if (d.connected && !document.getElementById(`b-${d.username}`)) {
        document.getElementById('active-list').innerHTML += `<div class="card" id="b-${d.username}">${d.username} <button onclick="socket.emit('stop-bot','${d.username}')">X</button></div>`;
        let o = document.createElement('option'); o.value = d.username; o.innerText = d.username; o.id = `o-${d.username}`;
        document.getElementById('bot-sel').appendChild(o);
    } else if(!d.connected) {
        document.getElementById(`b-${d.username}`)?.remove();
        document.getElementById(`o-${d.username}`)?.remove();
    }
});

socket.on('log', (d) => {
    const l = document.getElementById('logs');
    const p = document.createElement('div');
    p.className = 'msg-line';
    p.innerHTML = `<span class="u">[${d.username}]</span> ${d.msg}`;
    l.appendChild(p);
    l.scrollTop = l.scrollHeight;
});

function move(dir) {
    const u = document.getElementById('bot-sel').value;
    if(u) socket.emit('move-bot', { username: u, dir });
}

document.getElementById('chat-in').onkeydown = (e) => {
    if (e.key === 'Enter' && e.target.value) {
        const u = document.getElementById('bot-sel').value;
        socket.emit('send-chat', { username: u, msg: e.target.value });
        e.target.value = '';
    }
};
