const sid = localStorage.getItem('sid') || 's' + Math.random().toString(36).substr(2, 9);
localStorage.setItem('sid', sid);
const socket = io({ query: { sessionId: sid } });
let sel = null;

const ui = {
    tab: (id) => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('tab-' + id).classList.add('active');
        event.target.classList.add('active');
    },
    stat: (m, c) => {
        const s = document.getElementById('status');
        s.style.display = 'block'; s.style.background = c === 'err' ? '#e74c3c' : '#2ecc71';
        s.textContent = m; setTimeout(() => s.style.display = 'none', 2000);
    }
};

const app = {
    connect: () => {
        const h = document.getElementById('host').value, u = document.getElementById('user').value, v = document.getElementById('ver').value;
        if (!u) return ui.stat("İsim gir!", "err");
        socket.emit('start-bot', { host: h, user: u, ver: v });
    },
    select: (n) => { sel = n; socket.emit('select-bot', n); ui.tab('console'); },
    send: () => {
        const m = document.getElementById('msg').value;
        if (sel && m) { socket.emit('send-chat', { bot: sel, msg: m }); document.getElementById('msg').value = ""; }
    },
    move: (d, s) => { if (sel) socket.emit('control-move', { bot: sel, direction: d, state: s }); },
    jump: () => { app.move('zipla', 'down'); setTimeout(() => app.move('zipla', 'up'), 200); }
};

socket.on('bot-update', (d) => {
    const bl = document.getElementById('bot-list');
    bl.innerHTML = d.active.map(n => `
        <div class="bot-item ${n === d.selectedBot ? 'sel' : ''}" onclick="app.select('${n}')">
            <span>🤖 ${n}</span>
            <button onclick="socket.emit('stop-bot','${n}')" style="background:#e74c3c; border:none; color:#fff; border-radius:4px; padding:5px 10px;">X</button>
        </div>
    `).join('');

    if (d.selectedBot && d.logs[d.selectedBot]) {
        sel = d.selectedBot;
        const c = document.getElementById('console');
        c.innerHTML = d.logs[sel].map(l => `<div class="log-${l.type}">[${l.time}] ${l.text}</div>`).join('');
        c.scrollTop = c.scrollHeight;
    }

    if (d.selectedBot && d.botData[sel]) {
        document.getElementById('player-list').innerHTML = d.botData[sel].players.map(p => `
            <div style="padding:10px; border-bottom:1px solid #222;"><b>${p.username}</b> <small>${p.ping}ms</small></div>
        `).join('');
    }
});
