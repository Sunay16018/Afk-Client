const socket = io();

function connect() {
    const data = {
        host: document.getElementById('host').value,
        username: document.getElementById('user').value,
        password: document.getElementById('pass').value
    };
    socket.emit('join-bot', data);
    document.getElementById('login-modal').style.display = 'none';
}

function sendAction(type) {
    socket.emit('bot-action', type);
}

socket.on('chat-msg', (data) => {
    const box = document.getElementById('chat-box');
    box.innerHTML += `<div><strong>${data.username}:</strong> ${data.message}</div>`;
    box.scrollTop = box.scrollHeight;
});

socket.on('status', (msg) => {
    document.getElementById('bot-status').innerText = `Durum: ${msg}`;
});

socket.on('update-data', (data) => {
    const radar = document.getElementById('radar-list');
    radar.innerHTML = '<strong>Varlıklar:</strong><br>' + 
        data.entities.map(e => `[${e.dist}m] ${e.name}`).join('<br>');

    const inv = document.getElementById('inv-list');
    inv.innerHTML = '<strong>Envanter:</strong><br>' + data.inventory.join('<br>');
});
