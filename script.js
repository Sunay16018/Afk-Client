const socket = io();
let mathEnabled = false;

function startSystem() {
    const host = document.getElementById('host').value;
    const user = document.getElementById('user').value;
    const pass = document.getElementById('pass').value;
    const btn = document.getElementById('start-btn');

    if(!host || !user) {
        alert("Lütfen IP ve Bot İsmi girin!");
        return;
    }

    btn.innerText = "BAĞLANILIYOR...";
    btn.style.opacity = "0.5";
    
    socket.emit('start-bot', { host, username: user, password: pass });
}

function toggleMath() {
    mathEnabled = !mathEnabled;
    const btn = document.getElementById('math-toggle');
    btn.innerText = mathEnabled ? "AÇIK" : "KAPALI";
    btn.className = mathEnabled ? "on" : "off";
    syncSettings();
}

function syncSettings() {
    const user = document.getElementById('active-bot-select').value;
    const delay = document.getElementById('math-delay').value;
    if(user) socket.emit('update-settings', { user, mathOn: mathEnabled, mathSec: delay });
}

socket.on('status', (d) => {
    const btn = document.getElementById('start-btn');
    if (d.connected) {
        btn.innerText = "SİSTEMİ AÇ";
        btn.style.opacity = "1";
        
        if (!document.getElementById(`card-${d.username}`)) {
            document.getElementById('bot-list').innerHTML += `
                <div class="bot-card" id="card-${d.username}">
                    <span>${d.username}</span>
                    <button onclick="socket.emit('stop-bot','${d.username}')">X</button>
                </div>`;
            const opt = document.createElement('option');
            opt.value = d.username; opt.innerText = d.username; opt.id = `opt-${d.username}`;
            document.getElementById('active-bot-select').appendChild(opt);
        }
    } else {
        document.getElementById(`card-${d.username}`)?.remove();
        document.getElementById(`opt-${d.username}`)?.remove();
    }
});

socket.on('log', (d) => {
    const l = document.getElementById('logs');
    const p = document.createElement('p');
    p.innerHTML = `<b style="color:#00f2ff">[${d.username}]</b> ${d.msg}`;
    l.appendChild(p);
    l.scrollTop = l.scrollHeight;
});

function sendMove(dir) {
    const user = document.getElementById('active-bot-select').value;
    if(user) socket.emit('move-bot', { username: user, dir });
}

document.getElementById('chat-msg').onkeydown = (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) {
        const user = document.getElementById('active-bot-select').value;
        if(user) {
            socket.emit('send-chat', { username: user, msg: e.target.value });
            e.target.value = '';
        }
    }
};
