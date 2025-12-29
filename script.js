const socket = io();

function connect() {
    const host = document.getElementById('host').value;
    const user = document.getElementById('user').value;
    if(host && user) socket.emit('start-bot', { host, username: user });
}

function toggleMenu() {
    const m = document.getElementById('settings-menu');
    m.style.display = m.style.display === 'flex' ? 'none' : 'flex';
}

function saveSettings() {
    const user = document.getElementById('bot-sel').value;
    if(!user) return alert("Önce bir bot seç!");

    const autoMsgs = [];
    document.querySelectorAll('.msg-row').forEach(row => {
        autoMsgs.push({
            text: row.querySelector('.msg-txt').value,
            time: parseInt(row.querySelector('.msg-time').value)
        });
    });

    const settings = {
        mathOn: document.getElementById('m-on').checked,
        mathSec: parseFloat(document.getElementById('m-sec').value),
        autoRecon: document.getElementById('recon-on').checked,
        mineMode: document.getElementById('mine-on').checked,
        autoMsgs: autoMsgs
    };

    socket.emit('update-config', { user, settings });
    toggleMenu();
}

function move(dir) {
    const u = document.getElementById('bot-sel').value;
    if(u) socket.emit('move-bot', { username: u, dir });
}

socket.on('status', (d) => {
    if (d.connected && !document.getElementById(`b-${d.username}`)) {
        document.getElementById('bot-list').innerHTML += `<div class="card">${d.username}</div>`;
        let o = document.createElement('option'); o.value = d.username; o.innerText = d.username;
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
        const u = document.getElementById('bot-sel').value;
        socket.emit('send-chat', { username: u, msg: e.target.value });
        e.target.value = '';
    }
};
