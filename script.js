const socket = io();
let mOn = false;

function start(isMulti) {
    const host = document.getElementById('host').value;
    const user = document.getElementById('user').value;
    if(!host || !user) return alert("Bilgileri doldur!");
    socket.emit('start-bot', { host, username: user, isMulti });
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

function move(dir, type) {
    const user = document.getElementById('bot-sel').value;
    if(user) socket.emit('move-bot', { username: user, dir, type });
}

socket.on('status', (d) => {
    if (d.connected && !document.getElementById(`b-${d.username}`)) {
        document.getElementById('bot-list').innerHTML += `<div class="card" id="b-${d.username}">${d.username}</div>`;
        let o = document.createElement('option'); o.value = d.username; o.innerText = d.username; o.id = `o-${d.username}`;
        document.getElementById('bot-sel').appendChild(o);
    }
});

socket.on('log', (d) => {
    const l = document.getElementById('logs');
    l.innerHTML += `<p><b>[${d.username}]</b> ${d.msg}</p>`;
    l.scrollTop = l.scrollHeight;
});

document.getElementById('chat-in').onkeydown = (e) => {
    if (e.key === 'Enter') {
        const user = document.getElementById('bot-sel').value;
        socket.emit('send-chat', { username: user, msg: e.target.value });
        e.target.value = '';
    }
};
