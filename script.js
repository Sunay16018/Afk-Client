const socket = io();
let selBot = "";
const el = (i) => document.getElementById(i);

function connect() {
    socket.emit('start-bot', { host: el('ip').value, username: el('nick').value, pass: el('pass').value });
}

function disconnect() { if(selBot) socket.emit('quit', selBot); }
function move(dir) { if(selBot) socket.emit('move', { user: selBot, dir }); }
function openSet() { el('modal').style.display = 'flex'; }
function save() {
    const config = { math: el('m-on').checked, delay: el('m-del').value, mine: el('mine-on').checked };
    socket.emit('update-config', { user: selBot, config });
    el('modal').style.display = 'none';
}

socket.on('status', d => {
    const s = el('bot-sel');
    if (d.online) {
        if (!el("opt-"+d.user)) {
            let o = document.createElement('option'); o.value = d.user; o.id = "opt-"+d.user; o.innerText = d.user;
            s.appendChild(o);
        }
        selBot = d.user; s.value = d.user;
    } else {
        const elO = el("opt-"+d.user); if(elO) elO.remove();
        selBot = s.value;
    }
});

socket.on('log', d => {
    const l = el('logs');
    l.innerHTML += `<div><span style="color:#00ffcc">[${d.user}]</span> ${d.msg}</div>`;
    l.scrollTop = l.scrollHeight;
});

el('cin').onkeydown = e => {
    if(e.key === 'Enter' && selBot && e.target.value) {
        socket.emit('chat', { user: selBot, msg: e.target.value });
        e.target.value = "";
    }
};
