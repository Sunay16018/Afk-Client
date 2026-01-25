// Oturum ve Bağlantı
let sessionId = localStorage.getItem('afk_client_sid') || 'sess_' + Math.random().toString(36).substr(2, 9);
localStorage.setItem('afk_client_sid', sessionId);

const socket = io({ query: { sessionId: sessionId } });

let selectedBotName = null;

// --- UI Kontrolleri ---
window.ui = {
    showTab: (tabId) => {
        console.log("Tab değiştiriliyor:", tabId);
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));
        
        document.getElementById('tab-' + tabId).classList.add('active');
        // Butonu aktif yap
        const btns = document.querySelectorAll('.menu-btn');
        btns.forEach(btn => {
            if(btn.getAttribute('onclick').includes(tabId)) btn.classList.add('active');
        });
    },

    showStatus: (msg, type) => {
        const status = document.getElementById('status');
        status.textContent = msg;
        status.style.display = 'block';
        status.style.background = type === 'error' ? '#d32f2f' : '#4CAF50';
        setTimeout(() => status.style.display = 'none', 3000);
    }
};

// --- Uygulama Mantığı ---
window.app = {
    connectBot: () => {
        const host = document.getElementById('host').value;
        const user = document.getElementById('username').value;
        const ver = document.getElementById('version').value;

        if(!user) return ui.showStatus("Bot adı boş olamaz!", "error");
        
        ui.showStatus("Bağlantı isteği gönderildi...", "success");
        socket.emit('start-bot', { host, user, ver });
    },

    selectBot: (name) => {
        selectedBotName = name;
        socket.emit('select-bot', name);
        ui.showStatus("Seçilen bot: " + name, "success");
        ui.showTab('console');
    },

    stopBot: (name) => {
        socket.emit('stop-bot', name);
        if(selectedBotName === name) selectedBotName = null;
    },

    sendMessage: () => {
        const input = document.getElementById('chat-msg');
        if(!selectedBotName) return ui.showStatus("Bot seçilmedi!", "error");
        socket.emit('send-chat', { bot: selectedBotName, msg: input.value });
        input.value = "";
    },

    move: (dir, state) => {
        if(!selectedBotName) return;
        socket.emit('control-move', { bot: selectedBotName, direction: dir, state: state });
    },

    jump: () => {
        if(!selectedBotName) return;
        socket.emit('control-move', { bot: selectedBotName, direction: 'zipla', state: 'down' });
        setTimeout(() => socket.emit('control-move', { bot: selectedBotName, direction: 'zipla', state: 'up' }), 200);
    }
};

// Socket Veri Dinleme
socket.on('bot-update', (data) => {
    // Bot Listesi
    const list = document.getElementById('bot-list');
    list.innerHTML = data.active.map(name => `
        <div class="bot-item ${name === data.selectedBot ? 'selected' : ''}" onclick="app.selectBot('${name}')">
            <span>🤖 <b>${name}</b></span>
            <button class="btn btn-red" onclick="event.stopPropagation(); app.stopBot('${name}')">KAPAT</button>
        </div>
    `).join('');

    // Konsol
    if(data.selectedBot && data.logs[data.selectedBot]) {
        const con = document.getElementById('console');
        con.innerHTML = data.logs[data.selectedBot].map(l => `<div>${l}</div>`).join('');
        con.scrollTop = con.scrollHeight;
    }

    // Oyuncu Listesi (Kafalarla birlikte)
    if(data.selectedBot && data.botData[data.selectedBot]) {
        const players = data.botData[data.selectedBot].players;
        const pContainer = document.getElementById('player-list-container');
        pContainer.innerHTML = players.map(p => `
            <div class="player-card">
                <img src="https://minotar.net/avatar/${p.username}/32" class="player-head">
                <div style="display:flex; flex-direction:column">
                    <span style="font-size:13px; font-weight:bold">${p.username}</span>
                    <span style="font-size:10px; color:#4CAF50">${p.ping}ms</span>
                </div>
            </div>
        `).join('');
    }
});
