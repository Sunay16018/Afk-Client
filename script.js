class AFKClient {
    constructor() {
        this.selectedBot = null;
        this.socket = null;
        this.isConnected = false;
        this.activeBots = new Map(); // Bot listesini tut
        this.init();
    }

    init() {
        this.setupSocket();
        this.setupEventListeners();
        this.setupTabs();
        this.setupSettings();
        this.checkConnection();
        this.updateConnectionStatus();
    }

    setupSocket() {
        // Socket.io'yu başlat
        this.socket = io();
        
        this.socket.on('connect', () => {
            console.log('Socket bağlantısı kuruldu');
            this.isConnected = true;
            this.addLog('✅ Sunucuya bağlanıldı', 'success');
            this.updateConnectionStatus();
            
            // Aktif bot listesini iste
            this.socket.emit('get_bot_list');
        });

        this.socket.on('disconnect', () => {
            console.log('Socket bağlantısı kesildi');
            this.isConnected = false;
            this.addLog('❌ Sunucu bağlantısı kesildi', 'error');
            this.updateConnectionStatus();
        });

        this.socket.on('connect_error', (error) => {
            console.error('Socket bağlantı hatası:', error);
            this.addLog(`❌ Bağlantı hatası: ${error.message}`, 'error');
            this.updateConnectionStatus();
        });

        this.socket.on('init', (data) => {
            console.log('Sunucudan ilk mesaj:', data);
            this.addLog(`🌍 ${data.message}`, 'info');
        });

        this.socket.on('new_log', (data) => {
            console.log('Yeni log:', data);
            if (!this.selectedBot || data.username === this.selectedBot) {
                this.addLog(data.log.message, data.log.type, data.log.timestamp);
            }
        });

        this.socket.on('bot_data', (data) => {
            console.log('Bot verisi alındı:', data.username);
            if (data.username === this.selectedBot) {
                this.updateBotStats(data.data);
                this.updateInventory(data.data.inventory);
                this.updateConfigDisplay(data.data.config);
                
                // Bot listesindeki botu da güncelle
                this.updateBotInList(data.username, data.data);
            }
        });

        this.socket.on('bot_stopped', (data) => {
            console.log('Bot durduruldu:', data.username);
            if (data.username === this.selectedBot) {
                this.selectedBot = null;
                this.clearBotDisplay();
                this.addLog(`🛑 ${data.username} botu durduruldu`, 'warning');
            }
            
            // Bot listesinden kaldır
            this.activeBots.delete(data.username);
            this.updateBotListDisplay();
        });

        this.socket.on('bot_list', (data) => {
            console.log('Bot listesi alındı:', data.bots);
            // Bot listesini güncelle
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
    }

    setupEventListeners() {
        // Bağlantı formu
        document.getElementById('connect-btn').addEventListener('click', (e) => {
            e.preventDefault();
            this.connectBot();
        });
        
        // Mesaj gönderme
        document.getElementById('send-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.sendChat();
        });

        // Eşya atma delegasyonu
        document.getElementById('inv-box').addEventListener('click', (e) => {
            const slot = e.target.closest('.slot');
            if (slot && this.selectedBot) {
                const slotIndex = parseInt(slot.dataset.slot);
                if (!isNaN(slotIndex)) {
                    this.dropItem(slotIndex);
                }
            }
        });

        // Klavye kısayolları
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter' && document.activeElement.id !== 'chat-input') {
                document.getElementById('chat-input').focus();
            }
            
            // ESC ile ayarları kapat
            if (e.key === 'Escape' && document.getElementById('settings-overlay').style.display === 'flex') {
                this.closeSettings();
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

        // Shift + Sağ Tık butonu
        document.getElementById('shift-click-btn').addEventListener('click', () => {
            this.performShiftClick();
        });
    }

    updateConnectionStatus() {
        const statusElement = document.getElementById('connection-status');
        if (!statusElement) return;
        
        if (this.isConnected) {
            statusElement.textContent = '✅ Çevrimiçi';
            statusElement.style.color = '#2ecc71';
        } else {
            statusElement.textContent = '❌ Çevrimdışı';
            statusElement.style.color = '#ff4757';
        }
    }

    async connectBot() {
        const host = document.getElementById('host-input').value.trim();
        const username = document.getElementById('username-input').value.trim();
        const version = document.getElementById('version-input').value.trim();

        if (!host) {
            this.showNotification('Lütfen sunucu IP adresi girin!', 'error');
            return;
        }

        if (!username) {
            this.showNotification('Lütfen bot ismi girin!', 'error');
            return;
        }

        if (!this.socket.connected) {
            this.showNotification('Sunucuya bağlı değil!', 'error');
            return;
        }

        try {
            this.showNotification('Bot başlatılıyor...', 'info');
            
            this.socket.emit('start_bot', { 
                host, 
                username, 
                version: version || '1.16.5' 
            });
            
            // Formu temizle
            document.getElementById('host-input').value = '';
            document.getElementById('username-input').value = '';
            
            // 2 saniye sonra botu seç
            setTimeout(() => {
                this.selectBot(username);
                this.switchTab('tab-term');
            }, 2000);
            
        } catch (error) {
            this.showNotification(`Hata: ${error.message}`, 'error');
        }
    }

    selectBot(botName) {
        if (!this.activeBots.has(botName)) {
            this.showNotification('Bu bot bulunamadı!', 'error');
            return;
        }

        // Önceki seçili botu temizle
        document.querySelectorAll('.bot-card').forEach(card => {
            card.classList.remove('selected');
        });

        // Yeni botu seç
        this.selectedBot = botName;
        const selectedCard = document.querySelector(`.bot-card[data-bot-name="${botName}"]`);
        if (selectedCard) {
            selectedCard.classList.add('selected');
            this.addLog(`🤖 ${botName} seçildi`, 'success');
            
            // Seçili bot adını ayarlar panelinde göster
            document.getElementById('selected-bot-name').textContent = botName;
            
            // Bot verilerini iste
            this.socket.emit('request_bot_data', { username: botName });
            
            // Konsolu temizle ve sadece bu bota ait logları göster
            document.getElementById('logbox').innerHTML = '';
            this.addLog(`📡 ${botName} botuna ait loglar yükleniyor...`, 'info');
        }
    }

    stopBot(botName) {
        if (!botName) return;
        
        if (confirm(`${botName} botunu durdurmak istediğinize emin misiniz?`)) {
            this.socket.emit('stop_bot', botName);
            this.showNotification(`${botName} botu durduruluyor...`, 'info');
        }
    }

    updateBotListDisplay() {
        const botListElement = document.getElementById('bot-list');
        if (!botListElement) return;
        
        if (this.activeBots.size === 0) {
            botListElement.innerHTML = `
                <div style="text-align: center; padding: 30px; color: var(--text-secondary);">
                    <div style="font-size: 48px; margin-bottom: 10px;">🤖</div>
                    <div>Aktif bot bulunmuyor</div>
                    <div style="font-size: 12px; margin-top: 5px;">Yukarıdan yeni bot bağlatabilirsiniz</div>
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
                        <div class="bot-name">${botName}</div>
                        <div class="bot-status" style="color: ${bot.online ? '#2ecc71' : '#ff4757'}">
                            ${bot.online ? '🟢 Çevrimiçi' : '🔴 Çevrimdışı'}
                            ${hp > 0 ? ` | ❤️ ${Math.round(hp)}` : ''}
                            ${food > 0 ? ` | 🍖 ${Math.round(food)}` : ''}
                        </div>
                    </div>
                    <div class="bot-actions">
                        <button class="btn btn-secondary btn-small" 
                                onclick="app.selectBot('${botName}')"
                                style="padding: 6px 12px;">
                            ${isSelected ? '✓ SEÇİLİ' : 'SEÇ'}
                        </button>
                        <button class="btn btn-danger btn-small" 
                                onclick="app.stopBot('${botName}')"
                                style="padding: 6px 12px;">
                            🛑 KES
                        </button>
                    </div>
                </div>
            `;
        });
        
        botListElement.innerHTML = html;
    }

    updateBotInList(botName, data) {
        const bot = this.activeBots.get(botName);
        if (bot) {
            bot.data = data;
            this.updateBotListDisplay();
        }
    }

    sendChat() {
        const input = document.getElementById('chat-input');
        const message = input.value.trim();
        
        if (!message) {
            this.showNotification('Lütfen bir mesaj yazın!', 'warning');
            return;
        }

        if (!this.selectedBot) {
            this.showNotification('Lütfen önce bir bot seçin!', 'warning');
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

        // Kendi mesajımızı da log'a ekle
        this.addLog(`[SİZ] ${message}`, 'chat');
        
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
            
            this.addLog(`📦 ${slotIndex}. slot eşyası atılıyor...`, 'info');
        }
    }

    performShiftClick() {
        if (!this.selectedBot) {
            this.showNotification('Lütfen önce bir bot seçin!', 'warning');
            return;
        }

        const x = document.getElementById('x-coord').value;
        const y = document.getElementById('y-coord').value;
        const z = document.getElementById('z-coord').value;

        if (!x || !y || !z) {
            this.showNotification('Lütfen X, Y, Z koordinatlarını girin!', 'warning');
            return;
        }

        this.showNotification(`Shift + Sağ Tık (${x}, ${y}, ${z}) yapılıyor...`, 'info');
        // Bu fonksiyonu server.js'de implement edebilirsiniz
    }

    // ... (diğer metodlar aynı kalacak, sadece yukarıdaki değişiklikleri yapın)
}

// Uygulamayı global erişime aç
window.app = new AFKClient();
