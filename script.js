const socket = io();
const term = document.getElementById('terminal');
const botSelect = document.getElementById('bot-select');
const chatIn = document.getElementById('chat-in');

document.getElementById('connect-btn').onclick = () => {
    socket.emit('start-bot', {
        host: document.getElementById('host').value,
        username: document.getElementById('user').value,
        password: document.getElementById('pass').value
    });
};

socket.on('status', (d) => {
    let card = document.getElementById(`card-${d.username}`);
    let opt = document.getElementById(`opt-${d.username}`);
    if (d.connected) {
        if (!card) {
            const div = document.createElement('div');
            div.id = `card-${d.username}`;
            div.className = 'bot-card';
            div.innerHTML = `<span>${d.username}</span><button onclick="stopBot('${d.username}')">KES</button>`;
            document.getElementById('bot-list').appendChild(div);
            
            const o = document.createElement('option');
            o.id = `opt-${d.username}`; o.value = d.username; o.innerText = d.username;
            botSelect.appendChild(o);
            botSelect.value = d.username;
        }
        chatIn.focus();
    } else { card?.remove(); opt?.remove(); }
});

socket.on('log', (d) => {
    const p = document.createElement('p');
    p.innerHTML = `<b>${d.username}:</b> ${d.msg}`;
    term.appendChild(p);

    // OTOMATİK SİLME: Ekranda sadece son 20 mesaj kalır
    while (term.childNodes.length > 20) { term.removeChild(term.firstChild); }
    term.scrollTop = term.scrollHeight;
});

function move(dir) { if(botSelect.value) socket.emit('move-bot', { username: botSelect.value, dir }); }
function stopBot(user) { socket.emit('stop-bot', user); }

chatIn.onkeydown = (e) => {
    if (e.key === 'Enter' && chatIn.value && botSelect.value) {
        socket.emit('send-chat', { username: botSelect.value, msg: chatIn.value });
        chatIn.value = '';
    }
};
