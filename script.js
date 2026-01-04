class AFKClient {
    constructor() {
        this.selectedBot = null;
        this.socket = null;
        this.isConnected = false;
        this.init();
    }

    init() {
        this.setupSocket();
        this.setupEventListeners();
        this.setupTabs();
        this.setupSettings();
        this.checkConnection();
    }

    setupSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            this.isConnected = true;
            this.addLog('Sunucuya bağlanıldı', 'success');
            document.getElementById('connection-status').style.color = '#2ecc71';
        });

        this.socket.on('disconnect', () => {
            this.isConnected = false;
            this.addLog('Sunucu bağlantısı kesildi', 'error');
            document.getElementById('connection-status').style.color = '#ff4757';
        });

        this.socket.on('new_log', (data) => {
            if (data.username === this.selectedBot) {
                this.addLog(data.log.message, data.log.type, data.log.timestamp);
            }
        });

        this.socket.on('bot_data', (data) => {
            if (data.username === this.selectedBot) {
                this.updateBotStats(data.data);
                this.updateInventory(data.data.inventory);
                this.updateConfigDisplay(data.data.config);
            }
        });

        this.socket.on('bot_stopped', (data) => {
            if (data.username === this.selectedBot) {
                this.selectedBot = null;
                this.clearBotDisplay();
                this.addLog(`${data.username} botu durduruldu`, 'warning');
            }
        });
    }

    setupEventListeners() {
        // Bağlantı formu
        document.getElementById('connect-btn').addEventListener('click', () => this.connectBot());
        
        // Mesaj gönderme
        document.getElementById('send-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.sendChat();
        });

        // Eşya atma
        document.getElementById('inv-box').addEventListener('click', (e) => {
            const slot = e.target.closest('.slot');
            if (slot && this.selectedBot) {
                const slotIndex = Array.from(slot.parentNode.children).indexOf(slot);
                this.dropItem(slotIndex);
            }
        });

        // Klavye kısayolları
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter' && document.activeElement.id !== 'chat-input') {
                document.getElementById('chat-input').focus();
            }
        });

        // Bot seçimi
        document.getElementById('bot-list').addEventListener('click', (e) => {
            const botCard = e.target.closest('.bot-card');
            if (botCard) {
                const botName = botCard.dataset.botName;
                if (botName !== this.selectedBot) {
                    this.selectBot(botName);
                }
            }
        });

        // Ayarlar butonu
        document.getElementById('settings-btn').addEventListener('click', () => {
            this.toggleSettings();
        });

        // Ayarlar kaydetme
        document.getElementById('save-settings').addEventListener('click', () => {
            this.saveSettings();
        });
    }

    setupTabs() {
        const tabButtons = document.querySelectorAll('nav button');
        tabButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabId = e.target.id.replace('btn-', 'tab-');
                this.switchTab(tabId);
            });
        });
    }

    setupSettings() {
        this.settingsPanel = document.getElementById('settings-panel');
        this.overlay = document.getElementById('settings-overlay');
        
        // Overlay'e tıklayınca kapat
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.toggleSettings();
            }
        });

        // Auto-message ayarları
        const autoMsgToggle = document.getElementById('auto-message-toggle');
        const autoMsgFields = document.getElementById('auto-message-fields');
        
        autoMsgToggle.addEventListener('change', (e) => {
            autoMsgFields.style.display = e.target.checked ? 'block' : 'none';
        });

        // Auto-mine ayarları
        const autoMineToggle = document.getElementById('auto-mine-toggle');
        const autoMineFields = document.getElementById('auto-mine-fields');
        
        autoMineToggle.addEventListener('change', (e) => {
            autoMineFields.style.display = e.target.checked ? 'block' : 'none';
        });
    }

    switchTab(tabId) {
        // Tüm sekmeleri gizle
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active-tab');
        });
        
        // Tüm butonlardan aktif sınıfını kaldır
        document.querySelectorAll('nav button').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Hedef sekme ve butonu aktif yap
        document.getElementById(tabId).classList.add('active-tab');
        document.getElementById(`btn-${tabId.split('-')[1]}`).classList.add('active');
    }

    async connectBot() {
        const host = document.getElementById('host-input').value.trim();
        const username = document.getElementById('username-input').value.trim();
        const version = document.getElementById('version-input').value.trim();

        if (!host || !username) {
            this.showNotification('Lütfen IP ve isim girin!', 'error');
            return;
        }

        try {
            this.socket.emit('start_bot', { host, username, version });
            this.showNotification('Bot başlatılıyor...', 'info');
            
            // Formu temizle
            document.getElementById('host-input').value = '';
            document.getElementById('username-input').value = '';
            
            // Terminal sekmesine geç
            this.switchTab('tab-term');
            
        } catch (error) {
            this.showNotification(`Bağlantı hatası: ${error.message}`, 'error');
        }
    }

    selectBot(botName) {
        // Önceki seçili botu temizle
        document.querySelectorAll('.bot-card').forEach(card => {
            card.classList.remove('selected');
        });

        // Yeni botu seç
        this.selectedBot = botName;
        const selectedCard = document.querySelector(`.bot-card[data-bot-name="${botName}"]`);
        if (selectedCard) {
            selectedCard.classList.add('selected');
            this.addLog(`${botName} seçildi`, 'success');
            
            // Bot durumunu güncellemek için istek gönder
            if (this.socket.connected) {
                this.socket.emit('request_bot_data', { username: botName });
            }
        }
    }

    sendChat() {
        const input = document.getElementById('chat-input');
        const message = input.value.trim();
        
        if (!message || !this.selectedBot) {
            this.showNotification('Lütfen bir mesaj yazın ve bot seçin!', 'warning');
            return;
        }

        this.socket.emit('send_chat', {
            username: this.selectedBot,
            message: message
        });

        input.value = '';
        input.focus();
    }

    dropItem(slotIndex) {
        if (!this.selectedBot) {
            this.showNotification('Lütfen önce bir bot seçin!', 'warning');
            return;
        }

        if (confirm('Bu eşyayı atmak istediğinize emin misiniz?')) {
            this.socket.emit('drop_item', {
                username: this.selectedBot,
                slot: slotIndex
            });
        }
    }

    addLog(message, type = 'info', timestamp = null) {
        const logbox = document.getElementById('logbox');
        const time = timestamp || new Date().toLocaleTimeString('tr-TR');
        
        const logElement = document.createElement('div');
        logElement.className = `log-message ${type}`;
        logElement.innerHTML = `
            <span class="log-time">[${time}]</span>
            <span class="log-content">${this.escapeHtml(message)}</span>
        `;
        
        logbox.appendChild(logElement);
        
        // Animasyon için
        setTimeout(() => {
            logElement.style.opacity = '1';
        }, 10);
        
        // Otomatik scroll
        logbox.scrollTop = logbox.scrollHeight;
        
        // Çok fazla log varsa temizle
        const logs = logbox.querySelectorAll('.log-message');
        if (logs.length > 200) {
            for (let i = 0; i < 50; i++) {
                if (logs[i]) logs[i].remove();
            }
        }
    }

    updateBotStats(data) {
        const statsElement = document.getElementById('bot-stats');
        if (!statsElement) return;

        statsElement.innerHTML = `
            <div class="stat-item">
                <span class="stat-icon health">❤️</span>
                <span class="stat-value">${Math.round(data.hp)}</span>
            </div>
            <div class="stat-item">
                <span class="stat-icon food">🍖</span>
                <span class="stat-value">${Math.round(data.food)}</span>
            </div>
            <div class="stat-item">
                <span class="stat-icon">📍</span>
                <span class="stat-value">${Math.round(data.position?.x || 0)}, ${Math.round(data.position?.y || 0)}, ${Math.round(data.position?.z || 0)}</span>
            </div>
        `;
    }

    updateInventory(inventory) {
        const invBox = document.getElementById('inv-box');
        if (!invBox) return;

        // 45 slot için HTML oluştur
        let html = '';
        for (let i = 0; i < 45; i++) {
            const item = inventory.find(item => item.slot === i);
            
            html += `
                <div class="slot" data-slot="${i}" title="${item ? item.displayName : 'Boş'}">
                    ${item ? `
                        <img src="https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.16.1/items/${item.name}.png"
                             alt="${item.name}"
                             onerror="this.src='https://minecraft.wiki/images/Barrier_JE2_BE2.png'">
                        ${item.count > 1 ? `<span class="count">${item.count}</span>` : ''}
                    ` : ''}
                </div>
            `;
        }
        
        invBox.innerHTML = html;
    }

    updateConfigDisplay(config) {
        // Ayarlar panelindeki değerleri güncelle
        document.getElementById('auto-message-toggle').checked = config.autoMessage?.enabled || false;
        document.getElementById('message-content').value = config.autoMessage?.message || '';
        document.getElementById('message-interval').value = config.autoMessage?.interval || 5;
        
        document.getElementById('auto-mine-toggle').checked = config.autoMine?.enabled || false;
        document.getElementById('target-block').value = config.autoMine?.targetBlock || 'diamond_ore';
        
        // Görünürlüğü ayarla
        document.getElementById('auto-message-fields').style.display = 
            config.autoMessage?.enabled ? 'block' : 'none';
        document.getElementById('auto-mine-fields').style.display = 
            config.autoMine?.enabled ? 'block' : 'none';
    }

    toggleSettings() {
        if (!this.selectedBot) {
            this.showNotification('Lütfen önce bir bot seçin!', 'warning');
            return;
        }

        this.overlay.style.display = 'flex';
        setTimeout(() => {
            this.settingsPanel.style.transform = 'translateX(0)';
        }, 10);
    }

    closeSettings() {
        this.settingsPanel.style.transform = 'translateX(100%)';
        setTimeout(() => {
            this.overlay.style.display = 'none';
        }, 300);
    }

    saveSettings() {
        if (!this.selectedBot) return;

        const settings = {
            autoMessage: {
                enabled: document.getElementById('auto-message-toggle').checked,
                message: document.getElementById('message-content').value,
                interval: parseInt(document.getElementById('message-interval').value) || 5
            },
            autoMine: {
                enabled: document.getElementById('auto-mine-toggle').checked,
                targetBlock: document.getElementById('target-block').value
            }
        };

        this.socket.emit('set_config', {
            username: this.selectedBot,
            type: 'auto_message',
            config: settings.autoMessage
        });

        this.socket.emit('set_config', {
            username: this.selectedBot,
            type: 'auto_mine',
            config: settings.autoMine
        });

        this.showNotification('Ayarlar kaydedildi!', 'success');
        this.closeSettings();
    }

    clearBotDisplay() {
        document.getElementById('bot-stats').innerHTML = `
            <div class="stat-item">
                <span class="stat-icon health">❤️</span>
                <span class="stat-value">-</span>
            </div>
            <div class="stat-item">
                <span class="stat-icon food">🍖</span>
                <span class="stat-value">-</span>
            </div>
        `;
        
        document.getElementById('inv-box').innerHTML = '';
    }

    showNotification(message, type = 'info') {
        // Basit bildirim sistemi
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            background: ${type === 'error' ? '#da3633' : type === 'success' ? '#238636' : '#1f6feb'};
            color: white;
            border-radius: 6px;
            z-index: 9999;
            animation: slideInRight 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    checkConnection() {
        setInterval(() => {
            const statusElement = document.getElementById('connection-status');
            if (this.socket.connected) {
                statusElement.textContent = 'Çevrimiçi';
                statusElement.style.color = '#2ecc71';
            } else {
                statusElement.textContent = 'Çevrimdışı';
                statusElement.style.color = '#ff4757';
            }
        }, 5000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Uygulamayı başlat
let app;

document.addEventListener('DOMContentLoaded', () => {
    app = new AFKClient();
    
    // CSS animasyonları için style ekle
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        
        @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
        }
        
        .notification {
            font-family: inherit;
            font-weight: 600;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }
    `;
    document.head.appendChild(style);
});