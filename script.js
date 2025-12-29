const socket = io();
let mining = false;

socket.on('log', (data) => {
    const term = document.getElementById('terminal');
    const p = document.createElement('p');
    p.innerHTML = `<span style="color:#555">[${data.time}]</span> ${data.msg}`;
    if(data.type === 'error') p.style.color = '#f55';
    term.appendChild(p);
    term.scrollTop = term.scrollHeight; // Otomatik aşağı kaydır
});

function sendMove(dir) {
    socket.emit('command', { type: 'move', val: dir });
}

function toggleMining() {
    mining = !mining;
    socket.emit('command', { type: 'mining', val: mining });
    alert(mining ? "Mining Başlatıldı!" : "Mining Durduruldu!");
}

function sendChat() {
    const inp = document.getElementById('msgInput');
    if(inp.value) {
        socket.emit('command', { type: 'chat', val: inp.value });
        inp.value = '';
    }
}

function openModal() { document.getElementById('modal').style.display = 'flex'; }
function closeModal() { document.getElementById('modal').style.display = 'none'; }

document.getElementById('msgInput').addEventListener('keyup', (e) => {
    if(e.key === 'Enter') sendChat();
});
