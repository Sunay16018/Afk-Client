const socket = io();
const logs = document.getElementById('logs');
const targetBot = document.getElementById('target-bot');
const chatInput = document.getElementById('chat-input');

socket.on('status', (d) => {
    let card = document.getElementById(`bot-${d.username}`);
    let opt = document.getElementById(`opt-${d.username}`);
    if (d.connected) {
        if (!card) {
            const div = document.createElement('div');
            div.id = `bot-${d.username}`;
            div.className = 'bot-card';
            div.innerHTML = `<span>● ${d.username}</span> <button onclick="stopBot('${d.username}')">KES</button>`;
            document.getElementById('bot-list').appendChild(div);
            const o = document.createElement('option');
            o.id = `opt-${d.username}`; o.value = d.username; o.innerText = d.username;
            targetBot.appendChild(o);
            targetBot.value = d.username;
        }
        chatInput.focus();
    } else { card?.remove(); opt?.remove(); }
});

// LOGLARI SINIRLANDIRMA VE SİLME SİSTEMİ
socket.on('log', (d) => {
    const div = document.createElement('div');
    div.className = "log-line";
    div.innerHTML = `<span style="color:#00f2ff">[${d.username}]</span> ${d.msg}`;
    logs.appendChild(div);

    // Mesaj sayısı 50'yi geçerse en üsttekini sil (Ekranı temiz tutar)
    if (logs.childNodes.length > 50) {
        logs.removeChild(logs.firstChild);
    }
    
    logs.scrollTop = logs.scrollHeight;
});

function move(dir) { if(targetBot.value) socket.emit('move-bot', { username: targetBot.value, dir: dir }); }
function stopBot(user) { socket.emit('stop-bot', user); }

chatInput.onkeydown = (e) => {
    if (e.key === 'Enter' && chatInput.value && targetBot.value) {
        socket.emit('send-chat', { username: targetBot.value, msg: chatInput.value });
        chatInput.value = '';
    }
};
