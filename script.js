let sessionId = localStorage.getItem('afk_client_sid') || 'sess_' + Math.random().toString(36).substr(2, 9);
localStorage.setItem('afk_client_sid', sessionId);

const socket = io({ query: { sessionId: sessionId } });
let currentSelectedBot = null;

const ui = {
    showTab: (tabId) => {
        document.querySelectorAll('.tab').forEach(t => t.style.display = 'none');
        document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));
        
        document.getElementById('tab-' + tabId).style.display = 'block';
        // Buton aktivasyonu
        const activeBtn = Array.from(document.querySelectorAll('.menu-btn')).find(b => b.textContent.toLowerCase().includes(tabId.replace('tab-','')));
        if(activeBtn) activeBtn.classList.add('active');
    },
    showStatus: (msg, color) => {
        const s = document.getElementById('status');
        s.style.display = 'block';
        s.style.backgroundColor = color === 'error' ? '#ff4444' : '#4CAF50';
        s.textContent = msg;
        setTimeout(() => s.style.display = 'none', 3000);
    }
};

const app = {
    connectBot: () => {
        const host = document.getElementById('host').value;
        const user = document.getElementById('username').value;
        const ver = document.getElementById('version').value;
        if(!user) return ui.showStatus("İsim girin!", "error");
        socket.emit('start-bot', { host, user, ver });
    },
    selectBot: (name) => {
        currentSelectedBot = name;
        socket.emit('select-bot', name);
        ui.showTab('console'); // Bot seçince direkt konsola atar
    },
    stopBot: (name) => {
        socket.emit('stop-bot', name);
    },
    sendMessage: () => {
        const msg = document.getElementById('chat-msg').value;
        if(!currentSelectedBot || !msg) return;
        socket.emit('send-chat', { bot: currentSelectedBot, msg: msg });
        document.getElementById('chat-msg').value = "";
    }
};

socket.on('bot-update', (data) => {
    // Bot Listesini Çiz
    const list = document.getElementById('bot-list');
    list.innerHTML = data.active.map(name => `
        <div class="bot-item ${name === data.selectedBot ? 'active-bot' : ''}" onclick="app.selectBot('${name}')">
            <span>🤖 ${name}</span>
            <button class="btn-red" onclick="event.stopPropagation(); app.stopBot('${name}')">KAPAT</button>
        </div>
    `).join('');

    // Konsolu Güncelle
    if (data.selectedBot && data.logs[data.selectedBot]) {
        currentSelectedBot = data.selectedBot;
        const con = document.getElementById('console');
        con.innerHTML = data.logs[data.selectedBot].map(line => `<div class="log-line">${line}</div>`).join('');
        con.scrollTop = con.scrollHeight; // Otomatik aşağı kaydır
    }

    // Oyuncu Listesini Güncelle
    if (data.selectedBot && data.botData[data.selectedBot]) {
        const pList = document.getElementById('player-list-container');
        pList.innerHTML = data.botData[data.selectedBot].players.map(p => `
            <div class="player-card">
                <img src="https://minotar.net/avatar/${p.username}/32">
                <div>
                    <b>${p.username}</b><br>
                    <small>${p.ping}ms</small>
                </div>
            </div>
        `).join('');
    }
});

// Pencere açıldığında sekmeyi ayarla
window.onload = () => ui.showTab('bots');
