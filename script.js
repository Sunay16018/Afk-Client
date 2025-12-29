const socket = io();

// Bağlantı Modal Kontrolleri
const connectionModal = document.getElementById('connection-modal');
const connectBtn = document.getElementById('connect-btn');
const disconnectBtn = document.getElementById('disconnect-btn');

// Form Elemanları
const serverIpInput = document.getElementById('server-ip');
const botUsernameInput = document.getElementById('bot-username');
const botPasswordInput = document.getElementById('bot-password');

// Toggle Switchler
const autoMineToggle = document.getElementById('auto-mine');
const autoDefendToggle = document.getElementById('auto-defend');

// Log ve Bilgilendirme Alanları
const chatLog = document.getElementById('chat-log');
const nearbyEntitiesDiv = document.getElementById('nearby-entities');
const inventoryContentDiv = document.getElementById('inventory-content');

// Bağlantı Butonu Event Listener
connectBtn.addEventListener('click', () => {
    const config = {
        host: serverIpInput.value,
        username: botUsernameInput.value,
        password: botPasswordInput.value
    };
    socket.emit('connect_minecraft', config);
});

// Bağlantı Kes Butonu Event Listener
disconnectBtn.addEventListener('click', () => {
    socket.emit('disconnect_minecraft');
});

// Oto Maden Toggle Event Listener
autoMineToggle.addEventListener('change', (e) => {
    socket.emit('toggle_auto_mine', e.target.checked);
});

// Oto Savunma Toggle Event Listener
autoDefendToggle.addEventListener('change', (e) => {
    socket.emit('toggle_auto_defend', e.target.checked);
});

// Sunucu Durum Bildirimleri
socket.on('bot_status', (message) => {
    const statusEntry = document.createElement('div');
    statusEntry.textContent = `[STATUS] ${message}`;
    statusEntry.style.color = '#0f9';
    chatLog.appendChild(statusEntry);
    chatLog.scrollTop = chatLog.scrollHeight;
});

// Bot Hata Bildirimleri
socket.on('bot_error', (errorMessage) => {
    const errorEntry = document.createElement('div');
    errorEntry.textContent = `[ERROR] ${errorMessage}`;
    errorEntry.style.color = 'red';
    chatLog.appendChild(errorEntry);
    chatLog.scrollTop = chatLog.scrollHeight;
});

// Yakındaki Varlıkları Güncelleme
socket.on('nearby_entities', (entities) => {
    nearbyEntitiesDiv.innerHTML = '';
    entities.forEach(entity => {
        const entityDiv = document.createElement('div');
        entityDiv.textContent = `${entity.name} (${entity.distance.toFixed(2)}m)`;
        nearbyEntitiesDiv.appendChild(entityDiv);
    });
});

// Envanter İçeriğini Güncelleme
socket.on('inventory_update', (inventory) => {
    inventoryContentDiv.innerHTML = '';
    inventory.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.textContent = `${item.name} (${item.count})`;
        inventoryContentDiv.appendChild(itemDiv);
    });
});
