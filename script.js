let sessionId = localStorage.getItem('afk_client_sid');
if (!sessionId) {
    sessionId = 'sess_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('afk_client_sid', sessionId);
}

// Socket bağlantısını ID ile kur
const socket = io({
    query: { sessionId: sessionId }
});

let selectedBotName = null;
let currentBotData = {};

// --- Arayüz Fonksiyonları ---
const ui = {
    showTab: (tabId) => {
        // Sekmeleri gizle
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));
        
        // Seçileni aç
        document.getElementById('tab-' + tabId).classList.add('active');
        const btn = document.querySelector(`button[onclick="ui.showTab('${tabId}')"]`);
        if(btn) btn.classList.add('active');
    },

    showStatus: (msg, type) => {
        const el = document.getElementById('status');
        el.textContent = msg;
        el.style.display = 'block';
        el.style.background = type === 'error' ? '#d32f2f' : '#4CAF50';
        setTimeout(() => el.style.display = 'none', 3000);
    },

    renderBots: (activeBots, selected) => {
        const list = document.getElementById('bot-list');
        if (activeBots.length === 0) {
            list.innerHTML = '<div style="text-align:center; padding:20px; color:#666;">Aktif bot yok.</div>';
            return;
        }

        list.innerHTML = activeBots.map(bot => `
            <div class="bot-item ${bot === selected ? 'selected' : ''}" onclick="app.selectBot('${bot}')">
                <span>🤖 ${bot}</span>
                <button class="btn btn-red" onclick="event.stopPropagation(); app.stopBot('${bot}')">KES</button>
            </div>
        `).join('');
    },

    renderLogs: (logs) => {
        if (!selectedBotName || !logs[selectedBotName]) return;
        const con = document.getElementById('console');
        const isBottom = con.scrollHeight - con.clientHeight <= con.scrollTop + 50;

        con.innerHTML = logs[selectedBotName].map(l => `<div>${l}</div>`).join('');
        
        if (isBottom) con.scrollTop = con.scrollHeight;
    },

    renderStats: (data) => {
        if (!data) return;
        
        // Can ve Açlık
        document.getElementById('stats').innerHTML = `
            <span style="color:#ff5555">❤ ${Math.round(data.hp)}</span> &nbsp; 
            <span style="color:#ffaa00">🍖 ${Math.round(data.food)}</span>
        `;

        // Envanter
        const grid = document.getElementById('inventory-grid');
        let html = '';
        for (let i = 0; i < 45; i++) {
            const item = data.inv.find(it => it.slot === i);
            html += `
                <div class="slot">
                    ${item ? `
                        <img src="https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.16.5/items/${item.name}.png">
                        ${item.count > 1 ? `<span>${item.count}</span>` : ''}
                    ` : ''}
                </div>
            `;
        }
        grid.innerHTML = html;
    },

    renderPlayers: (players) => {
        const container = document.getElementById('player-list-container');
        if (!players || players.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:20px; color:#666;">Oyuncu listesi boş veya yükleniyor...</div>';
            return;
        }

        container.innerHTML = players.map(p => `
            <div class="player-card">
                <img class="player-head" src="https://minotar.net/avatar/${p.username}/32" onerror="this.src='https://minotar.net/avatar/Steve/32'">
                <div class="player-info">
                    <span class="player-name">${p.username}</span>
                    <span class="player-ping">📶 ${p.ping}ms</span>
                </div>
            </div>
        `).join('');
    }
};

// --- Uygulama Kontrolleri ---
const app = {
    connectBot: () => {
        const host = document.getElementById('host').value;
        const user = document.getElementById('username').value;
        const ver = document.getElementById('version').value;

        if (!host || !user) return ui.showStatus('Lütfen tüm alanları doldurun!', 'error');
        
        ui.showStatus('Bağlantı isteği gönderildi...', 'success');
        socket.emit('start-bot', { host, user, ver });
    },

    selectBot: (name) => {
        selectedBotName = name;
        document.getElementById('console-bot-name').innerText = `(${name})`;
        socket.emit('select-bot', name);
        ui.showTab('console'); // Bot seçince konsola git
    },

    stopBot: (name) => {
        if (confirm(`${name} botunu durdurmak istediğine emin misin?`)) {
            socket.emit('stop-bot', name);
        }
    },

    sendMessage: () => {
        const input = document.getElementById('chat-msg');
        const msg = input.value.trim();
        if (!selectedBotName) return ui.showStatus('Önce bir bot seçin!', 'error');
        if (!msg) return;

        socket.emit('send-chat', { bot: selectedBotName, msg: msg });
        input.value = '';
    },

    move: (dir, state) => {
        if (!selectedBotName) return;
        socket.emit('control-move', { bot: selectedBotName, direction: dir, state: state });
    },

    jump: () => {
        app.move('zipla', 'down');
        setTimeout(() => app.move('zipla', 'up'), 250);
    }
};

// --- Socket Eventleri ---
socket.on('connect', () => {
    ui.showStatus('Sunucuya Bağlandı', 'success');
});

socket.on('bot-update', (data) => {
    currentBotData = data.botData;

    // 1. Bot listesini güncelle
    ui.renderBots(data.active, data.selectedBot);

    // 2. Eğer bir bot seçiliyse onun verilerini ekrana bas
    if (data.selectedBot) {
        selectedBotName = data.selectedBot;
        document.getElementById('console-bot-name').innerText = `(${selectedBotName})`;

        // Loglar
        ui.renderLogs(data.logs);

        // Detaylar
        if (data.botData[selectedBotName]) {
            ui.renderStats(data.botData[selectedBotName]);
            ui.renderPlayers(data.botData[selectedBotName].players);
        }
    }
});

socket.on('error', (msg) => {
    ui.showStatus(msg, 'error');
});

socket.on('disconnect', () => {
    ui.showStatus('Sunucu bağlantısı koptu', 'error');
});
                          
