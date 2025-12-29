const socket = io();

function start() {
    socket.emit('start-bot', { host: document.getElementById('ip').value, username: document.getElementById('nick').value });
}

function openMenu() { document.getElementById('modal').style.display = 'flex'; }

function save() {
    const user = document.getElementById('bot-list').value;
    const config = {
        math: document.getElementById('m-on').checked,
        delay: parseFloat(document.getElementById('m-del').value),
        recon: document.getElementById('r-on').checked,
        mine: document.getElementById('mine-on').checked
    };
    socket.emit('update-config', { user, config });
    document.getElementById('modal').style.display = 'none';
}

function mv(dir) {
    const user = document.getElementById('bot-list').value;
    if(user) socket.emit('move', { user, dir });
}

socket.on('status', d => {
    const st = document.getElementById('stat');
    st.innerText = d.online ? "ÇEVRİMİÇİ" : "ÇEVRİMDIŞI";
    st.className = d.online ? "online" : "offline";
    if(d.online && !document.getElementById('o-'+d.user)) {
        let o = document.createElement('option'); o.value = d.user; o.id = 'o-'+d.user; o.innerText = d.user;
        document.getElementById('bot-list').appendChild(o);
    }
});

socket.on('log', d => {
    const l = document.getElementById('logs');
    l.innerHTML += `<div class="msg"><b>[${d.user}]</b> ${d.msg}</div>`;
    l.scrollTop = l.scrollHeight;
});

document.getElementById('msg-in').onkeydown = (e) => {
    if(e.key === 'Enter' && e.target.value) {
        socket.emit('chat', { user: document.getElementById('bot-list').value, msg: e.target.value });
        e.target.value = '';
    }
};
