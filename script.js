const socket = io();
let selBot = "";
const el = (i) => document.getElementById(i);

// AYARLAR MENÜSÜ AÇ/KAPAT
function toggleModal(show) {
    el('modal').style.display = show ? 'flex' : 'none';
}

function connect() {
    socket.emit('start-bot', { host: el('ip').value, username: el('nick').value, pass: el('pass').value });
}

// ANINDA BAĞLANTI KES
function disconnect() {
    if(selBot) socket.emit('quit', selBot);
}

// HAREKET SİSTEMİ (Basınca başlar, Stop deyince durur)
function toggleMove(dir) {
    if(!selBot) return;
    socket.emit('move-toggle', { user: selBot, dir: dir, state: true });
}

function allStop() {
    if(!selBot) return;
    const dirs = ['forward', 'back', 'left', 'right', 'jump'];
    dirs.forEach(d => {
        socket.emit('move-toggle', { user: selBot, dir: d, state: false });
    });
}

function saveSettings() {
    const config = { math: el('m-on').checked, mine: el('mine-on').checked };
    socket.emit('update-config', { user: selBot, config });
    toggleModal(false);
}

function sendChat() {
    const val = el('cin').value;
    if(selBot && val.trim() !== "") {
        socket.emit('chat', { user: selBot, msg: val });
        el('cin').value = "";
    }
}

el('cin').onkeydown = (e) => { if(e.key === 'Enter') sendChat(); };

socket.on('status', d => {
    const s = el('bot-sel');
    if (d.online) {
        if (!el("opt-"+d.user)) {
            let o = document.createElement('option'); o.value = d.user; o.id = "opt-"+d.user; o.innerText = d.user;
            s.appendChild(o);
        }
        selBot = d.user; s.value = d.user;
    } else {
        const o = el("opt-"+d.user); if(o) o.remove();
        selBot = s.value;
    }
});

socket.on('log', d => {
    const l = el('logs');
    l.innerHTML += `<div>${d.msg}</div>`;
    l.scrollTop = l.scrollHeight;
});
