class AFKClient {
    constructor() {
        this.selectedBot = null;
        this.socket = null;
        this.activeBots = new Map();
        this.selectedSlot = null;
        this.showTimestamps = true;
        this.currentSettings = {
            autoMessage: { enabled: false, message: '', interval: 10 },
            autoMine: { enabled: false, targetBlock: 'diamond_ore' }
        };
        this.init();
    }

    init() {
        this.setupSocket();
        this.setupEventListeners();
        this.setupTabs();
        this.setupNotifications();
        this.setupMovementControls();
    }

    setupSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            console.log('✅ Socket bağlantısı kuruldu');
            this.updateStatus('✅ Çevrimiçi', '#2ecc71');
            this.showNotification('Sunucuya bağlanıldı', 'success', 2000);
            this.socket.emit('get_bot_list');
        });

        this.socket.on('disconnect', () => {
            console.log('❌ Socket bağlantısı kesildi');
            this.updateStatus('❌ Çevrimdışı', '#ff4757');
            this.showNotification('Sunucu bağlantısı kesildi', 'error', 3000);
        });

        this.socket.on('connect_error', (error) => {
            console.error('Socket hatası:', error);
            this.updateStatus('⚠️ Bağlantı Hatası', '#ffa502');
            this.showNotification(`Bağlantı hatası: ${error.message}`, 'error', 3000);
        });

        this.socket.on('connected', (data) => {
            console.log('Sunucu mesajı:', data);
            this.addLog(data.message, 'info');
        });

        this.socket.on('new_log', (data) => {
            if (!this.selectedBot || data.username === this.selectedBot) {
                this.addLog(data.log.message, data.log.type, data.log.timestamp);
            }
        });

        this.socket.on('bot_data', (data) => {
            if (data.username === this.selectedBot) {
                this.updateBotStats(data.data);
                this.updateInventory(data.data.inventory);
                this.updateBotInList(data.username, data.data);
            }
        });

        this.socket.on('bot_list', (data) => {
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

        this.socket.on('bot_stopped', (data) => {
            if (this.selectedBot === data.username) {
                this.selectedBot = null;
                this.clearBotDisplay();
                this.addLog(`${data.username} botu durduruldu`, 'warning');
                document.getElementById('selected-bot-name').textContent = 'Bot Seçilmedi';
                document.getElementById('bot-name-display').textContent = 'Bot Seçilmedi';
            }
            this.activeBots.delete(data.username);
            this.updateBotListDisplay();
            this.showNotification(`${data.username} botu durduruldu`, 'info', 2000);
        });

        this.socket.on('notification', (data) => {
            this.showNotification(data.message, data.type, 3000);
        });

        this.socket.on('item_action_result', (data) => {
            if (data.success) {
                this.showNotification(data.message, 'success', 2000);
            }
        });

        this.socket.on('settings_updated', (data) => {
            if (data.success) {
                this.showNotification('Ayarlar kaydedildi!', 'success', 2000);
            }
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

        // Enter tuşu ile mesaj gönder
        document.getElementById('chat-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.sendChat();
            }
        });

        // Konsol kontrolleri
        document.getElementById('clear-logs').addEventListener('click', () => {
            document.getElementById('logbox').innerHTML = `
                <div class="welcome-message">
                    <i class="fas fa-info-circle"></i> Konsol temizlendi<br>
                    <small>Yeni mesajlar burada görünecek</small>
                </div>
            `;
            this.addLog('Konsol temizlendi', 'info');
        });

        document.getElementById('toggle-timestamp').addEventListener('click', () => {
            this.showTimestamps = !this.showTimestamps;
            const button = document.getElementById('toggle-timestamp');
            button.innerHTML = this.showTimestamps ? 
                '<i class="fas fa-clock"></i> Zaman' : 
                '<i class="fas fa-clock"></i> Zaman (Kapalı)';
            this.showNotification(
                this.showTimestamps ? 'Zaman damgaları açık' : 'Zaman damgaları kapalı',
                'info',
                1500
            );
        });

        // Bot listesini yenile
        document.getElementById('refresh-bots').addEventListener('click', () => {
            this.socket.emit('get_bot_list');
            this.showNotification('Bot listesi yenilendi', 'info', 1500);
        });

        // Envanteri yenile
        document.getElementById('update-inv').addEventListener('click', () => {
            if (this.selectedBot) {
                this.socket.emit('request_bot_data', { username: this.selectedBot });
                this.showNotification('Envanter yenilendi', 'info', 1500);
            }
        });

        // Ayarlar butonu
        document.getElementById('settings-btn').addEventListener('click', () => {
            this.openSettings();
        });

        // Modal kapatma
        document.querySelectorAll('.close-modal, .close-menu').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal, .item-menu');
                if (modal) {
                    modal.classList.add('hidden');
                }
            });
        });

        // Ayarlar kaydetme
        document.getElementById('save-settings').addEventListener('click', () => {
            this.saveSettings();
        });

        // Oto mesaj toggle
        document.getElementById('auto-message-toggle').addEventListener('change', (e) => {
            const fields = document.getElementById('auto-message-fields');
            fields.classList.toggle('hidden', !e.target.checked);
        });

        // Oto kazma toggle
        document.getElementById('auto-mine-toggle').addEventListener('change', (e) => {
            const fields = document.getElementById('auto-mine-fields');
            fields.classList.toggle('hidden', !e.target.checked);
        });

        // Overlay tıklama
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('overlay')) {
                document.querySelectorAll('.modal, .item-menu').forEach(el => {
                    el.classList.add('hidden');
                });
                document.querySelectorAll('.overlay').forEach(el => {
                    el.classList.add('hidden');
                });
            }
        });

        // Klavye kısayolları
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal, .item-menu').forEach(el => {
                    el.classList.add('hidden');
                });
                document.querySelectorAll('.overlay').forEach(el => {
                    el.classList.add('hidden');
                });
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

    setupMovementControls() {
        // Hareket butonları
        document.querySelectorAll('.btn-movement').forEach(btn => {
            btn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                if (!this.selectedBot) {
                    this.showNotification('Önce bir bot seçin!', 'warning', 2000);
                    return;
                }

                const direction = btn.dataset.direction;
                const action = btn.dataset.action;
                
                if (action === 'toggle') {
                    // Eğilme için toggle
                    const isActive = btn.classList.contains('active');
                    const state = !isActive;
                    this.socket.emit('movement', {
                        username: this.selectedBot,
                        direction: direction,
                        state: state
                    });
                    btn.classList.toggle('active', state);
                } else {
                    // Normal hareket
                    this.socket.emit('movement', {
                        username: this.selectedBot,
                        direction: direction,
                        state: true
                    });
                    btn.classList.add('active');
                }
            });

            btn.addEventListener('mouseup', (e) => {
                e.preventDefault();
                if (!this.selectedBot) return;

                const direction = btn.dataset.direction;
                const action = btn.dataset.action;
                
                if (action !== 'toggle') {
                    this.socket.emit('movement', {
                        username: this.selectedBot,
                        direction: direction,
                        state: false
                    });
                    btn.classList.remove('active');
                }
            });

            btn.addEventListener('mouseleave', (e) => {
                if (!this.selectedBot) return;
                
                const direction = btn.dataset.direction;
                const action = btn.dataset.action;
                
                if (action !== 'toggle' && btn.classList.contains('active')) {
                    this.socket.emit('movement', {
                        username: this.selectedBot,
                        direction: direction,
                        state: false
                    });
                    btn.classList.remove('active');
                }
            });
        });

        // Tüm hareketleri durdur
        document.getElementById('stop-all-movement').addEventListener('click', () => {
            if (!this.selectedBot) {
                this.showNotification('Önce bir bot seçin!', 'warning', 2000);
                return;
            }

            const directions = ['forward', 'back', 'left', 'right', 'jump', 'sneak', 'sprint'];
            directions.forEach(direction => {
                this.socket.emit('movement', {
                    username: this.selectedBot,
                    direction: direction,
                    state: false
                });
            });

            document.querySelectorAll('.btn-movement').forEach(btn => {
                btn.classList.remove('active');
            });

            this.showNotification('Tüm hareketler durduruldu', 'info', 1500);
        });
    }

    setupNotifications() {
        // Bildirim konteyneri yoksa oluştur
        if (!document.getElementById('notification-container')) {
            const container = document.createElement('div');
            container.id = 'notification-container';
            document.body.appendChild(container);
        }
    }

    switchTab(tabId) {
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active-tab');
        });
        
        document.querySelectorAll('nav button').forEach(btn => {
            btn.classList.remove('active');
        });
        
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
            this.showNotification('Sunucu IP adresi gerekli!', 'error', 3000);
            return;
        }

        if (!username) {
            this.showNotification('Bot ismi gerekli!', 'error', 3000);
            return;
        }

        if (!this.socket.connected) {
            this.showNotification('Sunucuya bağlı değil!', 'error', 3000);
            return;
        }

        if (this.activeBots.has(username)) {
            this.showNotification('Bu isimle zaten bir bot var!', 'warning', 3000);
            return;
        }

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
            this.showNotification('Bot bulunamadı!', 'error', 2000);
            return;
        }

        document.querySelectorAll('.bot-card').forEach(card => {
            card.classList.remove('selected');
        });

        this.selectedBot = botName;
        
        const selectedCard = document.querySelector(`.bot-card[data-bot-name="${botName}"]`);
        if (selectedCard) {
            selectedCard.classList.add('selected');
        }

        document.getElementById('selected-bot-name').textContent = botName;
        document.getElementById('bot-name-display').textContent = botName;
        
        this.addLog(`${botName} botu seçildi`, 'success');
        
        this.socket.emit('request_bot_data', { username: botName });
        
        this.showNotification(`${botName} botu seçildi`, 'success', 2000);
    }

    stopBot(botName) {
        if (!botName || !this.activeBots.has(botName)) {
            this.showNotification('Bot bulunamadı!', 'error', 2000);
            return;
        }

        // ALERT YERİNE ONAY MODALI
        const confirmModal = document.createElement('div');
        confirmModal.className = 'notification';
        confirmModal.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 2000;
            background: var(--bg-secondary);
            padding: 25px;
            border-radius: 12px;
            border: 2px solid var(--accent-danger);
            text-align: center;
            min-width: 300px;
            box-shadow: 0 15px 50px rgba(0, 0, 0, 0.6);
        `;
        
        confirmModal.innerHTML = `
            <h3 style="margin-bottom: 15px; color: var(--text-danger);">
                <i class="fas fa-exclamation-triangle"></i> Onay
            </h3>
            <p style="margin-bottom: 20px; color: var(--text-primary);">
                "${botName}" botunu durdurmak istediğinize emin misiniz?
            </p>
            <div style="display: flex; gap: 15px; justify-content: center;">
                <button id="confirm-stop" class="btn btn-danger" 
                        style="padding: 10px 20px;">
                    <i class="fas fa-stop"></i> Durdur
                </button>
                <button id="cancel-stop" class="btn btn-secondary"
                        style="padding: 10px 20px;">
                    <i class="fas fa-times"></i> İptal
                </button>
            </div>
        `;
        
        document.body.appendChild(confirmModal);
        
        document.getElementById('confirm-stop').addEventListener('click', () => {
            this.socket.emit('stop_bot', botName);
            confirmModal.remove();
            this.showNotification(`${botName} durduruluyor...`, 'info', 2000);
        });
        
        document.getElementById('cancel-stop').addEventListener('click', () => {
            confirmModal.remove();
        });
        
        // Dışarı tıklayınca kapat
        setTimeout(() => {
            confirmModal.addEventListener('click', (e) => {
                if (e.target === confirmModal) {
                    confirmModal.remove();
                }
            });
        }, 100);
    }

    sendChat() {
        const input = document.getElementById('chat-input');
        const message = input.value.trim();
        
        if (!message) {
            this.showNotification('Mesaj yazın!', 'warning', 2000);
            return;
        }

        if (!this.selectedBot) {
            this.showNotification('Önce bir bot seçin!', 'warning', 2000);
            return;
        }

        if (!this.socket.connected) {
            this.showNotification('Sunucuya bağlı değilsiniz!', 'error', 3000);
            return;
        }

        this.socket.emit('send_chat', {
            username: this.selectedBot,
            message: message
        });

        // "[SİZ]" ÖNEKİNİ KALDIRIYORUZ - sadece mesajı gösteriyoruz
        // Mesaj zaten sunucudan gelecek
        
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
                            <i class="fas fa-check"></i> ${isSelected 
