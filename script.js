const socket = io();
let selBot = "";
const el = (id) => document.getElementById(id);

function openM(id) { el(id).style.display = 'flex'; }
function closeM(id) { el(id).style.display = 'none'; }

function connect() {
    socket.emit('start-bot', { host: el('ip').value, username: el('nick').value, pass: el('pass').value });
    closeM('bot-m');
}

function disconnect() { if(selBot) socket.emit('quit', selBot); }

function save() {
    if(!selBot) return;
    socket.emit('update-config', { user: selBot, config: {
        autoRevive: el('rev-on').checked, math: el('math-on').checked,
        msgText: el('msg-t').value, msgDelay: parseInt(el('msg-s').value) || 30, autoMsg: !!el('msg-t').value
    }});
    closeM('set-m');
}

function sendChat() {
    if(selBot && el('cin').value) {
        socket.emit('chat', { user: selBot, msg: el('cin').value });
        el('cin').value = "";
    }
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
        const o = el("opt-"+d.user); if(o) o.remove();
        selBot = s.value;
    }
});

socket.on('log', d => {
    const l = el('logs');
    const div = document.createElement('div');
    div.innerHTML = `<span style="color:#888">[${d.user}]</span> ${d.msg}`;
    l.appendChild(div);
    l.scrollTop = l.scrollHeight;
});

el('cin').onkeydown = (e) => { if(e.key === 'Enter') sendChat(); };
