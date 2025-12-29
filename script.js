const socket = io();
const term = document.getElementById('terminal');

socket.on('log', (data) => {
    const entry = document.createElement('div');
    entry.textContent = `> ${data}`;
    term.appendChild(entry);
    term.scrollTop = term.scrollHeight; // Terminali hep en altta tutar
});

function move(dir) { socket.emit('move', dir); }
function stopBot() { socket.emit('stop'); }
function mineBlock() { socket.emit('mine'); }
function sendChat() {
    const val = document.getElementById('chatMsg').value;
    if(val) { socket.emit('send-chat', val); document.getElementById('chatMsg').value = ''; }
}
