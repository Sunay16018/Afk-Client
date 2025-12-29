const socket = io();
const logs = document.getElementById('logs');
const botList = document.getElementById('bot-list');
const targetBot = document.getElementById('target-bot');

document.getElementById('add-bot').onclick = () => {
    const host = document.getElementById('host').value;
    const user = document.getElementById('user').value;
    const pass = document.getElementById('pass').value;

    if(!host || !user) return alert("Bilgileri doldur!");
    socket.emit('start-bot', { host, username: user, password: pass });
};

socket.on('status', (d) => {
    const existing = document.getElementById(`bot-${d.username}`);
    if (d.connected) {
        if (!existing) {
            const div = document.createElement('div');
            div.id = `bot-${d.username}`;
            div.className = 'bot-card';
            div.innerHTML = `<span>● ${d.username}</span> <button onclick="stopBot('${d.username}')">KES</button>`;
            botList.appendChild(div);

            const opt = document.createElement('option');
            opt.id = `opt-${d.username}`;
            opt.value = d.username;
            opt.innerText = d.username;
            targetBot.appendChild(opt);
            targetBot.value = d.username;
        }
    } else {
        existing?.remove();
        document.getElementById(`opt-${d.username}`)?.remove();
    }
});

function stopBot(user) { socket.emit('stop-bot', user); }

document.getElementById('chat-input').onkeypress = (e) => {
    if (e.key === 'Enter' && e.target.value && targetBot.value) {
        socket.emit('send-chat', { username: targetBot.value, msg: e.target.value });
        e.target.value = '';
    }
};

socket.on('log', (d) => {
    const div = document.createElement('div');
    div.className = "log-line";
    div.innerHTML = `<span class="bot-tag">[${d.username}]</span> ${d.msg}`;
    logs.appendChild(div);
    logs.scrollTop = logs.scrollHeight;
});

// TÜM SEÇİM VE KOPYALAMA ENGELLERİ
document.addEventListener('keydown', e => {
    if (e.ctrlKey && (e.key === 'u' || e.key === 's' || e.key === 'c' || e.key === 'a' || e.key === 'i')) e.preventDefault();
});
