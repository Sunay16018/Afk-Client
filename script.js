const socket = io();
const logs = document.getElementById('logs');
const botList = document.getElementById('bot-list');
const targetBot = document.getElementById('target-bot');

document.getElementById('add-bot').onclick = () => {
    const data = {
        host: document.getElementById('host').value,
        username: document.getElementById('user').value,
        password: document.getElementById('pass').value
    };
    if(!data.host || !data.username) return alert("Bilgileri doldur!");
    
    socket.emit('start-bot', data);
};

socket.on('status', (d) => {
    if (d.connected) {
        if (!document.getElementById(`bot-${d.username}`)) {
            const btn = document.createElement('div');
            btn.id = `bot-${d.username}`;
            btn.className = 'bot-item';
            btn.innerHTML = `<span>● ${d.username}</span> <button onclick="stopBot('${d.username}')">KES</button>`;
            botList.appendChild(btn);

            const opt = document.createElement('option');
            opt.value = d.username;
            opt.innerText = d.username;
            targetBot.appendChild(opt);
        }
    } else {
        document.getElementById(`bot-${d.username}`)?.remove();
        Array.from(targetBot.options).forEach(o => { if(o.value === d.username) o.remove(); });
    }
});

function stopBot(user) { socket.emit('stop-bot', user); }

document.getElementById('chat-input').onkeypress = (e) => {
    if (e.key === 'Enter' && e.target.value) {
        socket.emit('send-chat', { username: targetBot.value, msg: e.target.value });
        e.target.value = '';
    }
};

socket.on('log', (d) => {
    const div = document.createElement('div');
    div.innerHTML = `<small>[${d.username || 'SİSTEM'}]</small> ${d.msg}`;
    logs.appendChild(div);
    logs.scrollTop = logs.scrollHeight;
});
