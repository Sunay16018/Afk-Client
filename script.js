const socket = io();
let isMathOn = false;

function connect() {
    socket.emit('start-bot', {
        host: document.getElementById('host').value,
        username: document.getElementById('user').value,
        password: document.getElementById('pass').value
    });
}

function toggleMath() {
    isMathOn = !isMathOn;
    const btn = document.getElementById('m-btn');
    btn.innerText = isMathOn ? "AÇIK" : "KAPALI";
    btn.className = isMathOn ? "on" : "off";
    updateSettings();
}

function updateSettings() {
    const user = document.getElementById('bot-sel').value;
    const sec = document.getElementById('m-time').value;
    if(user) socket.emit('update-settings', { user, mathOn: isMathOn, mathSec: sec });
}

socket.on('status', (d) => {
    if (d.connected) {
        if (!document.getElementById(`b-${d.username}`)) {
            document.getElementById('active-bots').innerHTML += `
                <div class="bot-tag" id="b-${d.username}">
                    <span>${d.username}</span>
                    <button onclick="socket.emit('stop-bot','${d.username}')">X</button>
                </div>`;
            const opt = document.createElement('option');
            opt.value = d.username; opt.innerText = d.username; opt.id = `o-${d.username}`;
            document.getElementById('bot-sel').appendChild(opt);
        }
    } else {
        document.getElementById(`b-${d.username}`)?.remove();
        document.getElementById(`o-${d.username}`)?.remove();
    }
});

socket.on('log', (d) => {
    const l = document.getElementById('logs');
    const p = document.createElement('p');
    // toHTML() ile gelen renkli veriyi basıyoruz
    p.innerHTML = `<b style="color:#00f2ff">[${d.username}]</b> ${d.msg}`;
    l.appendChild(p);
    if(l.childNodes.length > 50) l.removeChild(l.firstChild);
    l.scrollTop = l.scrollHeight;
});

function move(dir) { 
    const u = document.getElementById('bot-sel').value; 
    if(u) socket.emit('move-bot', { username: u, dir }); 
}

document.getElementById('chat-in').onkeydown = (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) {
        const u = document.getElementById('bot-sel').value;
        socket.emit('send-chat', { username: u, msg: e.target.value });
        e.target.value = '';
    }
};
