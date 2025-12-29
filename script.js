const socket = io();
const logs = document.getElementById('logs');
const botList = document.getElementById('bot-list');
const targetBot = document.getElementById('target-bot');
const chatInput = document.getElementById('chat-input');

document.getElementById('add-bot').onclick = () => {
    const host = document.getElementById('host').value;
    const user = document.getElementById('user').value;
    const pass = document.getElementById('pass').value;
    if(!host || !user) return;
    socket.emit('start-bot', { host, username: user, password: pass });
};

socket.on('status', (d) => {
    let card = document.getElementById(`bot-${d.username}`);
    let opt = document.getElementById(`opt-${d.username}`);
    if (d.connected) {
        if (!card) {
            const div = document.createElement('div');
            div.id = `bot-${d.username}`;
            div.className = 'bot-card';
            div.innerHTML = `<span>● ${d.username}</span> <button onclick="stopBot('${d.username}')">KES</button>`;
            botList.appendChild(div);

            const o = document.createElement('option');
            o.id = `opt-${d.username}`;
            o.value = d.username;
            o.innerText = d.username;
            targetBot.appendChild(o);
            targetBot.value = d.username;
        }
    } else {
        card?.remove();
        opt?.remove();
    }
});

function stopBot(user) { socket.emit('stop-bot', user); }

chatInput.onkeypress = (e) => {
    if (e.key === 'Enter' && chatInput.value && targetBot.value) {
        socket.emit('send-chat', { username: targetBot.value, msg: chatInput.value });
        chatInput.value = '';
    }
};

socket.on('log', (d) => {
    const div = document.createElement('div');
    div.innerHTML = `<span style="color:#58a6ff">[${d.username}]</span> ${d.msg}`;
    logs.appendChild(div);
    logs.scrollTop = logs.scrollHeight;
});

document.addEventListener('keydown', e => {
    if (e.ctrlKey && ['u','s','c','a','i'].includes(e.key)) e.preventDefault();
});
