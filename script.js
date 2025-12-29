const socket = io();

function connectBot() {
    const host = document.getElementById('host').value;
    const user = document.getElementById('user').value;
    if(host && user) socket.emit('start-bot', { host, username: user });
}

function openMenu() { document.getElementById('modal').style.display = 'flex'; }
function closeMenu() { document.getElementById('modal').style.display = 'none'; }

function save() {
    const user = document.getElementById('bot-sel').value;
    if(!user) return alert("Bot seçilmedi!");

    const config = {
        math: document.getElementById('m-on').checked,
        delay: parseFloat(document.getElementById('m-delay').value) || 0,
        recon: document.getElementById('r-on').checked,
        mining: document.getElementById('min-on').checked,
        msgs: Array.from(document.querySelectorAll('.msg-item')).map(el => ({
            text: el.querySelector('.m-txt').value,
            time: parseInt(el.querySelector('.m-time').value)
        }))
    };

    socket.emit('update-config', { user, config });
    closeMenu();
}

function move(dir) {
    const user = document.getElementById('bot-sel').value;
    if(user) socket.emit('move-bot', { user, dir });
}

socket.on('status', (d) => {
    if(d.connected) {
        document.getElementById('status-tag').className = 'tag online';
        document.getElementById('status-tag').innerText = 'ONLINE';
        if(!document.getElementById('opt-'+d.username)) {
            let o = document.createElement('option'); o.value = d.username; o.id = 'opt-'+d.username; o.innerText = d.username;
            document.getElementById('bot-sel').appendChild(o);
        }
    }
});

socket.on('log', (d) => {
    const l = document.getElementById('logs');
    l.innerHTML += `<div class="ln"><b>[${d.username}]</b> ${d.msg}</div>`;
    l.scrollTop = l.scrollHeight;
});

document.getElementById('chat-in').onkeydown = (e) => {
    if(e.key === 'Enter' && e.target.value) {
        socket.emit('send-chat', { user: document.getElementById('bot-sel').value, msg: e.target.value });
        e.target.value = '';
    }
};
