class AFKClient {
    constructor() {
        this.selectedBot = null;
        this.socket = null;
        this.activeBots = new Map();
        this.init();
    }

    init() {
        this.setupSocket();
        this.setupEventListeners();
        this.setupTabs();
        this.setupNotifications();
    }

    setupSocket() {
        // Socket.io bağlantısı
        this.socket = io();
        
        // Bağlantı başarılı
        this.socket.on('connect', () => {
            console.log('✅ Socket bağlantısı kuruldu');
            this.updateStatus('✅ Çevrimiçi', '#2ecc71');
            this.showNotification('Sunucuya bağlanıldı', 'success');
            
            // Bot listesini iste
            this.socket.emit('get_bot_list');
        });

        // Bağlantı kesildi
        this.socket.on('disconnect', () => {
            console.log('❌ Socket bağlantısı kesildi');
            this.updateStatus('❌ Çevrimdışı', '#ff4757');
            this.showNotification('Sunucu bağlantısı kesildi', 'error');
        });

        // Bağlantı hatası
        this.socket.on('connect_error', (error) => {
            console.error('Socket hatası:', error);
            this.updateStatus('⚠️ Bağlantı Hatası', '#ffa502');
            this.showNotification(`Bağlantı hatası: ${error.message}`, 'error');
        });

        // İlk bağlantı mesajı
        this.socket.on('connected', (data) => {
            console.log('Sunucu mesajı:', data);
            this.addLog(data.message, 'info');
        });

        // Yeni log mesajı
        this.socket.on('new_log', (data) => {
            console.log('Yeni log:', data);
            if (!this.selectedBot || data.username === this.selectedBot) {
                this.addLog(data.log.message, data.log.type, data.log.timestamp);
            }
        });

        // Bot verisi
        this.socket.on('bot_data', (data) => {
            console.log('Bot verisi:', data.username, data.data);
            
            if (data.username === this.selectedBot) {
                // İstatistikleri güncelle
                this.updateBotStats(data.data);
                
                // Envanteri güncelle
                this.updateInventory(data.data.inventory);
                
                // Bot listesindeki botu güncelle
                this.updateBotInList(data.username, data.data);
            }
        });

        // Bot listesi
        this.socket.on('bot_list', (data) => {
            console.log('Bot listesi:', data.bots);
            this.activeBots.clear();
            
            data.bots.forEach(bot => {
                this.activeBots.set(bot.name, {
                    name: bot.name,
                    online: bot.online,
                    data: bot.data
                });
            });
            
            this.updateBotListDisplay();
        });

        // Bot durduruldu
        this.socket.on('bot_stopped', (data) => {
            console.log('Bot durduruldu:', data.username);
            
            if (this.selectedBot === data.username) {
                this.selectedBot = null;
                this.clearBotDisplay();
                this.addLog(`🛑 ${data.username} botu durduruldu`, 'warning');
                document.getElementById('selected-bot-name').textContent = 'Bot Seçilmedi';
                document.getElementById('bot-name-display').textContent = 'Bot Seçilmedi';
            }
            
            // Listeden kaldır
            this.activeBots.delete(data.username);
            this.updateBotListDisplay();
            
            this.showNotification(`${data.username} botu durduruldu`, 'info');
        });

        // Hata mesajı
        this.socket.on('error', (data) => {
            this.showNotification(data.message, 'error');
        });
    }

    setupEventListeners() {
        // Bağlantı butonu
        document.getElementById('connect-btn').addEventListener('click', (e) => {
            e.preventDefault();
            this.connectBot();
        });

        // Mesaj gönderme
        document.getElementById('send-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.sendChat();
        });

        // Log temizleme
        document.getElementById('clear-logs').addEventListener('click', () => {
            document.getElementById('logbox').innerHTML = `
                <div class="welcome-message">
                    <i class="fas fa-info-circle"></i> Konsol temizlendi<br>
                    <small>Yeni mesajlar burada görünecek</small>
                </div>
            `;
            this.addLog('Konsol temizlendi', 'info');
        });

        // Bot listesini yenile
        document.getElementById('refresh-bots').addEventListener('click', () => {
            this.socket.emit('get_bot_list');
            this.showNotification('Bot listesi yenilendi', 'info');
        });

        // Envanteri yenile
        document.getElementById('update-inv').addEventListener('click', () => {
            if (this.selectedBot) {
                this.socket.emit('request_bot_data', { username: this.selectedBot });
                this.showNotification('Envanter yenilendi', 'info');
            }
        });

        // Klavye kısayolları
        document.addEventListener('keydown', (e) => {
            // Ctrl+Enter ile mesaj gönder
            if (e.ctrlKey && e.key === 'Enter' && document.activeElement.id === 'chat-input') {
                this.sendChat();
            }
            
            // ESC ile odak kaldır
            if (e.key === 'Escape') {
                document.activeElement.blur();
            }
        });

        // Sekme değiştirme
        document.querySelectorAll('nav button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabId = e.target.id.replace('btn-', 'tab-');
                this.switchTab(tabId);
            });
        });
    }

    setupTabs() {
        // İlk sekme aktif
        this.switchTab('tab-bots');
    }

    setupNotifications() {
        // Bildirim konteyneri oluştur
        if (!document.getElementById('notification-container')) {
            const container = document.createElement('div');
            container.id = 'notification-container';
            document.body.appendChild(container);
        }
    }

    switchTab(tabId) {
        // Tüm sekmeleri gizle
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active-tab');
        });
        
        // Tüm butonları pasif yap
        document.querySelectorAll('nav button').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Hedef sekme ve butonu aktif yap
        document.getElementById(tabId).classList.add('active-tab');
        document.getElementById(`btn-${tabId.split('-')[1]}`).classList.add('active');
    }

    updateStatus(text, color) {
        const statusEl = document.getElementById('connection-status-text');
        if (statusEl) {
            statusEl.textContent = text;
            statusEl.style.color = color;
        }
    }

    connectBot() {
        const host = document.getElementById('host-input').value.trim();
        const username = document.getElementById('username-input').value.trim();
        const version = document.getElementById('version-input').value.trim();

        if (!host) {
            this.showNotification('Sunucu IP adresi gerekli!', 'error');
            return;
        }

        if (!username) {
            this.showNotification('Bot ismi gerekli!', 'error');
            return;
        }

        if (!this.socket.connected) {
            this.showNotification('Sunucuya bağlı değil!', 'error');
            return;
        }

        if (this.activeBots.has(username)) {
            this.showNotification('Bu isimle zaten bir bot var!', 'error');
            return;
        }

        this.showNotification('Bot başlatılıyor...', 'info');
        
        this.socket.emit('start_bot', { 
            host, 
            username, 
            version: version || '1.16.5' 
        });

        // Formu temizle
        document.getElementById('host-input').value = '';
        document.getElementById('username-input').value = '';

        // 3 saniye sonra botu seç
        setTimeout(() => {
            this.selectBot(username);
            this.switchTab('tab-term');
        }, 3000);
    }

    selectBot(botName) {
        if (!this.activeBots.has(botName)) {
            this.showNotification('Bot bulunamadı!', 'error');
            return;
        }

        // Önceki seçimi temizle
        document.querySelectorAll('.bot-card').forEach(card => {
            card.classList.remove('selected');
        });

        // Yeni botu seç
        this.selectedBot = botName;
        
        // Bot kartını seçili yap
        const selectedCard = document.querySelector(`.bot-card[data-bot-name="${botName}"]`);
        if (selectedCard) {
            selectedCard.classList.add('selected');
        }

        // Arayüzü güncelle
        document.getElementById('selected-bot-name').textContent = botName;
        document.getElementById('bot-name-display').textContent = botName;
        
        this.addLog(`🤖 "${botName}" botu seçildi`, 'success');
        
        // Konsolu temizle (opsiyonel)
        // document.getElementById('logbox').innerHTML = '';
        
        // Bot verilerini iste
        this.socket.emit('request_bot_data', { username: botName });
        
        this.showNotification(`${botName} botu seçildi`, 'success');
    }

    stopBot(botName) {
        if (!botName || !this.activeBots.has(botName)) {
            this.showNotification('Bot bulunamadı!', 'error');
            return;
        }

        if (confirm(`"${botName}" botunu durdurmak istediğinize emin misiniz?`)) {
            this.socket.emit('stop_bot', botName);
            this.showNotification(`${botName} durduruluyor...`, 'info');
        }
    }

    sendChat() {
        const input = document.getElementById('chat-input');
        const message = input.value.trim();
        
        if (!message) {
            this.showNotification('Mesaj yazın!', 'warning');
            return;
        }

        if (!this.selectedBot) {
            this.showNotification('Önce bir bot seçin!', 'warning');
            return;
        }

        if (!this.socket.connected) {
            this.showNotification('Sunucuya bağlı değilsiniz!', 'error');
            return;
        }

        this.socket.emit('send_chat', {
            username: this.selectedBot,
            message: message
        });

        // Kendi mesajımızı log'a ekle
        this.addLog(`[SİZ] ${message}`, 'chat');
        
        input.value = '';
        input.focus();
    }

    updateBotListDisplay() {
        const container = document.getElementById('bot-list');
        
        if (this.activeBots.size === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-robot fa-3x"></i>
                    <p>Aktif bot bulunmuyor</p>
                    <small>Yukarıdan yeni bot bağlatabilirsiniz</small>
                </div>
            `;
            return;
        }

        let html = '';
        this.activeBots.forEach((bot, botName) => {
            const isSelected = this.selectedBot === botName;
            const hp = bot.data?.hp || 0;
            const food = bot.data?.food || 0;
            
            html += `
                <div class="bot-card ${isSelected ? 'selected' : ''}" data-bot-name="${botName}">
                    <div class="bot-info">
                        <div class="bot-name">
                            <i class="fas fa-robot"></i> ${botName}
                            ${isSelected ? '<span style="color: #2ecc71; font-size: 11px;">(SEÇİLİ)</span>' : ''}
                        </div>
                        <div class="bot-status">
                            <span class="status-indicator"></span>
                            🟢 Çevrimiçi
                        </div>
                        <div class="bot-stats-small">
                            ${hp > 0 ? `<span>❤️ ${Math.round(hp)}</span>` : ''}
                            ${food > 0 ? `<span>🍖 ${Math.round(food)}</span>` : ''}
                        </div>
                    </div>
                    <div class="bot-actions">
                        <button class="btn btn-small" onclick="app.selectBot('${botName}')">
                            <i class="fas fa-check"></i> ${isSelected ? 'SEÇİLİ' : 'SEÇ'}
                        </button>
                        <button class="btn btn-danger btn-small" onclick="app.stopBot('${botName}')">
                            <i class="fas fa-stop"></i> DURDUR
                        </button>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
    }

    updateBotInList(botName, data) {
        const bot = this.activeBots.get(botName);
        if (bot) {
            bot.data = data;
            this.updateBotListDisplay();
        }
    }

    updateBotStats(data) {
        if (!data) return;
        
        // Can değeri
        const hpElement = document.getElementById('hp-value');
        if (hpElement) {
            hpElement.textContent = Math.round(data.hp);
            hpElement.style.color = data.hp > 10 ? '#2ecc71' : data.hp > 5 ? '#ffa502' : '#ff4757';
        }
        
        // Açlık değeri
        const foodElement = document.getElementById('food-value');
        if (foodElement) {
            foodElement.textContent = Math.round(data.food);
            foodElement.style.color = data.food > 10 ? '#2ecc71' : data.food > 5 ? '#ffa502' : '#ff4757';
        }
        
        // Konum
        const posElement = document.getElementById('pos-value');
        if (posElement && data.position) {
            posElement.textContent = `${data.position.x}, ${data.position.y}, ${data.position.z}`;
        }
    }

    updateInventory(inventory) {
        const container = document.getElementById('inv-box');
        if (!container) return;
        
        if (!inventory || inventory.length === 0) {
            container.innerHTML = `
                <div class="empty-inventory">
                    <i class="fas fa-box-open fa-2x"></i>
                    <p>Envanter boş veya yüklenemedi</p>
                </div>
            `;
            return;
        }

        // 45 slot oluştur (9x5 envanter)
        let html = '';
        for (let i = 0; i < 45; i++) {
            const item = inventory.find(item => item.slot === i);
            
            html += `
                <div class="slot" data-slot="${i}" 
                     onclick="app.dropItem(${i})"
                     title="${item ? (item.displayName || item.name) + (item.count > 1 ? ` (${item.count})` : '') : 'Boş'}">
            `;
            
            if (item) {
                const itemName = item.name.replace('minecraft:', '');
                html += `
                    <img src="https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.16.1/items/${itemName}.png"
                         alt="${item.name}"
                         onerror="this.src='https://minecraft.wiki/images/Barrier_JE2_BE2.png'; this.onerror=null;">
                    ${item.count > 1 ? `<span class="count">${item.count}</span>` : ''}
                `;
            }
            
            html += '</div>';
        }
        
        container.innerHTML = html;
    }

    dropItem(slotIndex) {
        if (!this.selectedBot) {
            this.showNotification('Önce bir bot seçin!', 'warning');
            return;
        }

        if (confirm('Bu eşyayı atmak istediğinize emin misiniz?')) {
            this.socket.emit('drop_item', {
                username: this.selectedBot,
                slot: slotIndex
            });
            
            this.addLog(`📦 ${slotIndex}. slot eşyası atılıyor...`, 'info');
        }
    }

    addLog(message, type = 'info', timestamp = null) {
        const logbox = document.getElementById('logbox');
        const time = timestamp || new Date().toLocaleTimeString('tr-TR');
        
        // Welcome mesajını kaldır
        const welcomeMsg = logbox.querySelector('.welcome-message');
        if (welcomeMsg) {
            welcomeMsg.remove();
        }
        
        const logElement = document.createElement('div');
        logElement.className = `log-message ${type}`;
        logElement.innerHTML = `
            <span class="log-time">[${time}]</span>
            <span class="log-content">${this.escapeHtml(message)}</span>
        `;
        
        logbox.appendChild(logElement);
        
        // Animasyon
        setTimeout(() => {
            logElement.style.opacity = '1';
        }, 10);
        
        // Otomatik scroll
        logbox.scrollTop = logbox.scrollHeight;
        
        // Çok fazla log varsa temizle (300'den fazla)
        const logs = logbox.querySelectorAll('.log-message');
        if (logs.length > 300) {
            for (let i = 0; i < 100; i++) {
                if (logs[i]) logs[i].remove();
            }
        }
    }

    clearBotDisplay() {
        document.getElementById('hp-value').textContent = '-';
        document.getElementById('food-value').textContent = '-';
        document.getElementById('pos-value').textContent = '-';
        
        document.getElementById('inv-box').innerHTML = `
            <div class="empty-inventory">
                <i class="fas fa-box-open fa-2x"></i>
                <p>Bot seçilmedi</p>
            </div>
        `;
    }

    showNotification(message, type = 'info', duration = 3000) {
        const container = document.getElementById('notification-container');
        if (!container) return;
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        // İkon seç
        let icon = 'fas fa-info-circle';
        switch (type) {
            case 'success': icon = 'fas fa-check-circle'; break;
            case 'error': icon = 'fas fa-exclamation-circle'; break;
            case 'warning': icon = 'fas fa-exclamation-triangle'; break;
            case 'info': icon = 'fas fa-info-circle'; break;
        }
        
        notification.innerHTML = `
            <i class="${icon}"></i>
            <span>${this.escapeHtml(message)}</span>
        `;
        
        container.appendChild(notification);
        
        // Otomatik kaldır
        setTimeout(() => {
            notification.classList.add('hide');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }, duration);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Global instance oluştur
const app = new AFKClient();
window.app = app;

// Sayfa yüklendiğinde
document.addEventListener('DOMContentLoaded', () => {
    console.log('AFK Client Pro yüklendi');
    
    // Ek CSS animasyonları
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes slideInUp {
            from { opacity: 0; transform: translateY(50px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .bot-card {
            animation: fadeInUp 0.4s ease;
        }
        
        .log-message {
            animation: slideInUp 0.3s ease;
        }
    `;
    document.head.appendChild(style);
});
