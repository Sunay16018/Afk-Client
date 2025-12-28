const socket = io();

const logs = document.getElementById('logs');
const statusIndicator = document.getElementById('status-indicator');

// Minecraft Renk Kodları Dönüştürücü
function parseChat(text) {
    const colors = {
        '0': '#000000', '1': '#0000AA', '2': '#00AA00', '3': '#00AAAA',
        '4': '#AA0000', '5': '#AA00AA', '6': '#FFAA00', '7': '#AAAAAA',
        '8': '#555555', '9': '#5555FF', 'a': '#55FF55', 'b': '#55FFFF',
        'c': '#FF5555', 'd': '#FF55FF', 'e': '#FFFF55', 'f': '#FFFFFF'
    };
    let html = text.replace(/§([0-9a-f])/g, (match, code) => {
        return `</span><span style="color:${colors[code]}">`;
    });
    return `<span>${html}</span>`;
}

socket.on('log', (data) => {
    const div = document.createElement('div');
    div.className = 'log-entry';
    if (data.type === 'chat') {
        div.innerHTML = `<b style="color:#3b82f6">${data.user}:</b> ${parseChat(data.text)}`;
    } else {
        div.innerHTML = parseChat(data.text);
    }
    logs.appendChild(div);
    logs.scrollTop = logs.scrollHeight;
});

socket.on('status', (data) => {
    if (data.connected) {
        statusIndicator.innerText = 'Çevrimiçi';
        statusIndicator.className = 'status-online';
    } else {
        statusIndicator.innerText = 'Çevrimdışı';
        statusIndicator.className = 'status-offline';
    }
});

document.getElementById('btn-connect').onclick = () => {
    const config = {
        host: document.getElementById('host').value,
        port: document.getElementById('port').value,
        username: document.getElementById('username').value,
        password: document.getElementById('password').value
    };
    socket.emit('start-bot', config);
};

document.getElementById('btn-disconnect').onclick = () => {
    socket.emit('stop-bot');
};

document.getElementById('btn-reconnect').onclick = () => {
    socket.emit('stop-bot');
    setTimeout(() => document.getElementById('btn-connect').click(), 1000);
};

document.getElementById('auto-msg-toggle').onchange = (e) => {
    socket.emit('set-auto-msg', {
        enabled: e.target.checked,
        message: document.getElementById('auto-msg').value,
        interval: document.getElementById('msg-interval').value
    });
};