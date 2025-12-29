const socket = io();
let selBot = "";
const el = (i) => document.getElementById(i);

// KLAVYE KONTROLÜ (W, A, S, D, SPACE)
const keyMap = {
    'w': 'forward', 'W': 'forward', 'ArrowUp': 'forward',
    's': 'back', 'S': 'back', 'ArrowDown': 'back',
    'a': 'left', 'A': 'left', 'ArrowLeft': 'left',
    'd': 'right', 'D': 'right', 'ArrowRight': 'right',
    ' ': 'jump'
};

document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return; // Yazı yazarken bot hareket etmesin
    const dir = keyMap[e.key];
    if (dir && selBot) socket.emit('move-start', { user: selBot, dir });
});

document.addEventListener('keyup', (e) => {
    const dir = keyMap[e.key];
    if (dir && selBot) socket.emit('move-stop', { user: selBot, dir });
});

// PANEL TUŞLARI İÇİN (Mouse ile basılı tutma desteği)
function moveBtn(dir, state) {
    if (selBot) socket.emit(state === 'start' ? 'move-start' : 'move-stop', { user: selBot, dir });
}

function connect() {
    socket.emit('start-bot', { host: el('ip').value, username: el('nick').value, pass: el('pass').value });
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
    }
});

socket.on('log', d => {
    const l = el('logs');
    l.innerHTML += `<div>${d.msg}</div>`;
    l.scrollTop = l.scrollHeight;
});
