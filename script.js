const sid = localStorage.getItem('sid') || 's' + Math.random().toString(36).substr(2, 9);
localStorage.setItem('sid', sid);
const socket = io({ query: { sessionId: sid } });
let currentBot = null;

window.addEventListener('load', () => {
    setTimeout(() => { 
        document.getElementById('splash').style.opacity = '0'; 
        setTimeout(() => document.getElementById('splash').style.display = 'none', 800); 
    }, 2500);
});

const ui = {
    tab: (id) => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('tab-' + id).classList.add('active');
        if(event) event.target.classList.add('active');
    }
};

const app = {
    connect: () => {
        const h = document.getElementById('host').value, u = document.getElementById('user').value, v = document.getElementById('ver').value;
        if(!u) return;
        socket.emit('start-bot', { host: h, user: u, ver: v });
        ui.tab('console');
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
    bl.innerHTML = d.active.map(n => `<div class="card" onclick="app.select('${n}')" style="border-left:5px solid #2ecc71; display:flex; justify-content:space-between;"><span>🤖 ${n}</span> <b style="color:#2ecc71;">AKTİF</b></div>`).join('');
    
    if(d.sel && d.logs[d.sel]) {
        currentBot = d.sel;
        const c = document.getElementById('console');
        c.innerHTML = d.logs[currentBot].map(l => `<div class="log-${l.type}">[${l.time}] ${l.text}</div>`).join('');
        c.scrollTop = c.scrollHeight;
    }
});
