class AFKClient {
    constructor() {
        this.selectedBot = null;
        this.socket = null;
        this.bots = new Map();
        this.movement = {
            forward: false, back: false, 
            left: false, right: false,
            jump: false, sprint: false, sneak: false
        };
        this.init();
    }

    init() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            this.updateStatus('Çevrimiçi', '#2ecc71');
            this.addLog('✅ Bağlantı kuruldu', 'success');
        });

        this.socket.on('disconnect', () => {
            this.updateStatus('Çevrimdışı', '#ff4757');
            this.addLog('❌ Bağlantı kesildi', 'error');
        });

        this.socket.on('bot_connected', (data) => {
            this.addLog('🤖 Bot bağlandı', 'success');
            this.switchTab('tab-term');
        });

        this.socket.on('bot_log', (data) => {
            if (!this.selectedBot || data.botKey === this.selectedBot) {
                this.addLog(data.log.message, data.log.type);
            }
        });

        this.socket.on('bot_data', (data) => {
            if (data.botKey === this.selectedBot) {
                this.updateBotStats(data.data);
                this.updateInventory(data.data.inventory);
                this.updateConfigDisplay(data.data.config);
            }
        });

        this.socket.on('bot_removed', (data) => {
            if (this.selectedBot === data.botKey) {
                this.selectedBot = null;
                this.clearBotDisplay();
            }
        });

        this.setupUI();
        this.setupControls();
    }

    setupUI() {
        // Bağlantı formu
        document.getElementById('connect-btn').addEventListener('click', () => this.connectBot());
        
        // Mesaj gönderme
        document.getElementById('send-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.sendChat();
        });

        // Sekmeler
        document.querySelectorAll('nav button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabId = e.target.id.replace('btn-', 'tab-');
                this.switchTab(tabId);
            });
        });

        // Ayarlar
        document.getElementById('settings-btn').addEventListener('click', () => this.openSettings());
        document.getElementById('save-settings').addEventListener('click', () => this.saveSettings());
        
        // Yürüme
        document.getElementById('start-walk').addEventListener('click', () => this.startWalking());
        document.getElementById('stop-walk').addEventListener('click', () => this.stopWalking());

        // Shift tık
        document.getElementById('shift-click').addEventListener('click', () => this.shiftClick());

        // Bot listesi
        document.getElementById('bot-list').addEventListener('click', (e) => {
            const card = e.target.closest('.bot-card');
            if (card) this.selectBot(card.dataset.botKey);
            
            const stopBtn = e.target.closest('.stop-btn');
            if (stopBtn) this.stopBot(stopBtn.dataset.botKey);
        });
    }

    setupControls() {
        // Klavye kontrolleri
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT') return;
            
            switch(e.key.toLowerCase()) {
                case 'w': this.setMovement('forward', true); break;
                case 's': this.setMovement('back', true); break;
                case 'a': this.setMovement('left', true); break;
                case 'd': this.setMovement('right', true); break;
                case ' ': this.setMovement('jump', true); break;
                case 'shift': this.setMovement('sprint', true); break;
                case 'control': this.setMovement('sneak', true); break;
                case 'q': this.stopWalking(); break;
                case 'f3': this.switchTab('tab-term'); break;
                case 'f4': this.switchTab('tab-inv'); break;
                case 'f5': this.openSettings(); break;
            }
        });

        document.addEventListener('keyup', (e) => {
            switch(e.key.toLowerCase()) {
                case 'w': this.setMovement('forward', false); break;
                case 's': this.setMovement('back', false); break;
                case 'a': this.setMovement('left', false); break;
                case 'd': this.setMovement('right', false); break;
                case ' ': this.setMovement('jump', false); break;
                case 'shift': this.setMovement('sprint', false); break;
                case 'control': this.setMovement('sneak', false); break;
            }
        });

        // Hareket butonları
        ['forward', 'back', 'left', 'right', 'jump', 'sprint', 'sneak'].forEach(dir => {
            const btn = document.getElementById(`${dir}-btn`);
            if (btn) {
                btn.addEventListener('mousedown', () => this.setMovement(dir, true));
                btn.addEventListener('mouseup', () => this.setMovement(dir, false));
                btn.addEventListener('mouseleave', () => this.setMovement(dir, false));
            }
        });
    }

    connectBot() {
        const host = document.getElementById('host').value.trim();
        const username = document.getElementById('username').value.trim();
        const version = document.getElementById('version').value.trim() || '1.20.1';

        if (!host || !username) {
            this.showNotification('IP ve isim gerekli!', 'error');
            return;
        }

        this.socket.emit('start_bot', {
            host: host.includes(':') ? host : host + ':25565',
            username,
            version
        }, (response) => {
            if (response.success) {
                this.showNotification('🤖 Bot başlatıldı!', 'success');
                document.getElementById('host').value = '';
                document.getElementById('username').value = '';
            } else {
                this.showNotification(`❌ ${response.error}`, 'error');
            }
        });
    }

    selectBot(botKey) {
        if (this.selectedBot === botKey) return;
        this.selectedBot = botKey;
        document.querySelectorAll('.bot-card').forEach(c => c.classList.remove('selected'));
        document.querySelector(`.bot-card[data-bot-key="${botKey}"]`)?.classList.add('selected');
        document.getElementById('selected-bot').textContent = botKey.split('@')[0];
        this.addLog(`✅ ${botKey.split('@')[0]} seçildi`, 'success');
    }

    stopBot(botKey) {
        if (confirm('Botu durdurmak istiyor musunuz?')) {
            this.socket.emit('stop_bot', { botKey });
            this.showNotification('⏹️ Bot durduruldu', 'info');
        }
    }

    sendChat() {
        const input = document.getElementById('chat-input');
        const message = input.value.trim();
        
        if (!message || !this.selectedBot) {
            this.showNotification('Mesaj ve bot seçimi gerekli!', 'warning');
            return;
        }

        this.socket.emit('send_chat', {
            botKey: this.selectedBot,
            message
        });

        input.value = '';
        input.focus();
    }

    setMovement(direction, state) {
        if (!this.selectedBot) return;
        this.movement[direction] = state;
        this.socket.emit('set_movement', {
            botKey: this.selectedBot,
            movement: { [direction]: state }
        });
        
        const btn = document.getElementById(`${direction}-btn`);
        if (btn) {
            if (state) {
                btn.classList.add('active');
                btn.style.transform = 'scale(0.95)';
            } else {
                btn.classList.remove('active');
                btn.style.transform = '';
            }
        }
    }

    startWalking() {
        if (!this.selectedBot) return;
        
        const x = parseFloat(document.getElementById('walk-x').value);
        const y = parseFloat(document.getElementById('walk-y').value);
        const z = parseFloat(document.getElementById('walk-z').value);
        
        if (isNaN(x) || isNaN(y) || isNaN(z)) {
            this.showNotification('Geçerli koordinat girin!', 'warning');
            return;
        }

        this.socket.emit('move_to', {
            botKey: this.selectedBot,
            x, y, z
        }, (response) => {
            if (response.success) {
                this.showNotification('🚶 Yürüme başlatıldı', 'success');
            }
        });
    }

    stopWalking() {
        if (!this.selectedBot) return;
        this.setMovement('forward', false);
        this.setMovement('back', false);
        this.setMovement('left', false);
        this.setMovement('right', false);
    }

    shiftClick() {
        if (!this.selectedBot) return;
        
        const x = parseFloat(document.getElementById('shift-x').value);
        const y = parseFloat(document.getElementById('shift-y').value);
        const z = parseFloat(document.getElementById('shift-z').value);
        
        if (isNaN(x) || isNaN(y) || isNaN(z)) {
            this.showNotification('Koordinat girin!', 'warning');
            return;
        }

        // Bu örnek için basit sağ tık
        this.showNotification('🖱️ Shift+Sağ tık yapıldı', 'info');
    }

    updateBotStats(data) {
        const stats = document.getElementById('bot-stats');
        if (!stats || !data) return;

        stats.innerHTML = `
            <div class="stat">
                <span>❤️ ${Math.round(data.health)}</span>
                <span>🍖 ${Math.round(data.food)}</span>
                <span>📍 ${Math.round(data.position?.x || 0)},${Math.round(data.position?.y || 0)},${Math.round(data.position?.z || 0)}</span>
            </div>
        `;
    }

    updateInventory(inventory) {
        const invBox = document.getElementById('inv-box');
        if (!invBox) return;

        let html = '';
        for (let i = 0; i < 36; i++) {
            const item = inventory?.find(it => it.slot === i);
            html += `<div class="slot" data-slot="${i}">
                ${item ? `<img src="https://mc-heads.net/avatar/${item.name}/32">${item.count > 1 ? `<span>${item.count}</span>` : ''}` : ''}
            </div>`;
        }
        invBox.innerHTML = html;
    }

    updateConfigDisplay(config) {
        if (!config) return;
        
        const msgToggle = document.getElementById('auto-msg-toggle');
        if (msgToggle) {
            msgToggle.checked = config.autoMessage?.enabled || false;
            document.getElementById('msg-content').value = config.autoMessage?.message || '';
            document.getElementById('msg-interval').value = config.autoMessage?.interval || 10;
            document.getElementById('msg-fields').style.display = msgToggle.checked ? 'block' : 'none';
        }

        const mineToggle = document.getElementById('auto-mine-toggle');
        if (mineToggle) {
            mineToggle.checked = config.autoMine?.enabled || false;
            document.getElementById('target-block').value = config.autoMine?.targetBlock || 'diamond_ore';
            document.getElementById('smart-mine').checked = config.autoMine?.smart || true;
            document.getElementById('mine-fields').style.display = mineToggle.checked ? 'block' : 'none';
        }

        const afkToggle = document.getElementById('anti-afk-toggle');
        if (afkToggle) {
            afkToggle.checked = config.antiAfk?.enabled || true;
            document.getElementById('afk-interval').value = config.antiAfk?.interval || 30;
        }
    }

    openSettings() {
        if (!this.selectedBot) {
            this.showNotification('Önce bot seçin!', 'warning');
            return;
        }
        document.getElementById('settings').style.display = 'flex';
    }

    saveSettings() {
        if (!this.selectedBot) return;

        const settings = {
            autoMessage: {
                enabled: document.getElementById('auto-msg-toggle').checked,
                message: document.getElementById('msg-content').value,
                interval: parseInt(document.getElementById('msg-interval').value) || 10
            },
            autoMine: {
                enabled: document.getElementById('auto-mine-toggle').checked,
                targetBlock: document.getElementById('target-block').value,
                smart: document.getElementById('smart-mine').checked
            },
            antiAfk: {
                enabled: document.getElementById('anti-afk-toggle').checked,
                interval: parseInt(document.getElementById('afk-interval').value) || 30
            }
        };

        ['auto_message', 'auto_mine', 'anti_afk'].forEach(type => {
            this.socket.emit('set_config', {
                botKey: this.selectedBot,
                type,
                config: settings[type.replace('_', '')]
            });
        });

        this.showNotification('💾 Ayarlar kaydedildi', 'success');
        document.getElementById('settings').style.display = 'none';
    }

    addLog(message, type = 'info') {
        const logbox = document.getElementById('logbox');
        if (!logbox) return;

        const div = document.createElement('div');
        div.className = `log ${type}`;
        div.innerHTML = `[${new Date().toLocaleTimeString('tr-TR')}] ${message}`;
        logbox.appendChild(div);
        logbox.scrollTop = logbox.scrollHeight;

        if (logbox.children.length > 100) {
            logbox.removeChild(logbox.firstChild);
        }
    }

    showNotification(message, type = 'info') {
        const notif = document.createElement('div');
        notif.className = `notification ${type}`;
        notif.textContent = message;
        notif.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 10px 15px;
            background: ${type === 'error' ? '#ff4757' : type === 'success' ? '#2ecc71' : '#1e90ff'};
            color: white;
            border-radius: 5px;
            z-index: 9999;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        document.body.appendChild(notif);
        setTimeout(() => notif.remove(), 3000);
    }

    switchTab(tabId) {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
        
        document.getElementById(tabId)?.classList.add('active');
        document.getElementById(`btn-${tabId.split('-')[1]}`)?.classList.add('active');
    }

    updateStatus(text, color) {
        const el = document.getElementById('status');
        if (el) {
            el.textContent = text;
            el.style.color = color;
        }
    }

    clearBotDisplay() {
        document.getElementById('bot-stats').innerHTML = '<div class="stat"><span>❤️ -</span><span>🍖 -</span></div>';
        document.getElementById('inv-box').innerHTML = '';
        document.getElementById('selected-bot').textContent = 'Yok';
    }
}

// Global instance
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new AFKClient();
    window.app = app;
});