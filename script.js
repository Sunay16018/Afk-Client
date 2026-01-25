const sid = localStorage.getItem('sid') || 's' + Math.random().toString(36).substr(2, 9);
localStorage.setItem('sid', sid);
const socket = io({ query: { sessionId: sid } });
let currentBot = null;

// Splash Screen Kapatma
window.addEventListener('load', () => {
    setTimeout(() => { document.getElementById('splash').style.opacity = '0'; setTimeout(() => document.getElementById('splash').style.display = 'none', 500); }, 2000);
});

const ui = {
    tab: (id) => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('tab-' + id).classList.add('active');
        event.target.classList.add('active');
    }
};

const app = {
    connect: () => {
        const h = document.getElementById('host').value, u = document.getElementById('user').value, v = document.getElementById('ver').value;
        if(!u) return;
        socket.emit('start-bot', { host: h, user: u, ver: v });
    },
    select: (n) => { currentBot = n; socket.emit('select-bot', n); ui.tab('console'); },
    send: () => {
        const m = document.getElementById('msg').value;
        if(currentBot && m) { socket.emit('send-chat', { bot: currentBot, msg: m }); document.getElementById('msg').value = ""; }
    },
    move: (d, s) => { if(currentBot) socket.emit('control-move', { bot: currentBot, direction: d, state: s }); },
    jump: () => { app.move('zipla', 'down'); setTimeout(() => app.move('zipla', 'up'), 200); }
};

socket.on('update', (d) => {
    const bl = document.getElementById('bot-list');
    bl.innerHTML = d.active.map(n => `<div class="bot-item card ${n === d.sel ? 'active-bot' : ''}" onclick="app.select('${n}')" style="display:flex; justify-content:space-between; align-items:center; border-left: 5px solid #2ecc71;"><span>🤖 ${n}</span> <small>AKTİF</small></div>`).join('');
    
    if(d.sel && d.logs[d.sel]) {
        currentBot = d.sel;
        const c = document.getElementById('console');
        c.innerHTML = d.logs[currentBot].map(l => `<div class="log-${l.type}">[${l.time}] ${l.text}</div>`).join('');
        c.scrollTop = c.scrollHeight;
    }

    if(d.sel && d.bData[currentBot]) {
        document.getElementById('player-list').innerHTML = d.bData[currentBot].players.map(p => `<div style="padding:10px; border-bottom:1px solid #1a1a1a;">🟢 ${p.username} <span style="float:right; color:#555;">${p.ping}ms</span></div>`).join('');
    }
});
