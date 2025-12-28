const socket = io();
const logs = document.getElementById('logs');
const chatInput = document.getElementById('chat-input');
const statusInd = document.getElementById('status-indicator');

let currentSettings = { aiEnabled: true, mathEnabled: true, delay: 2000 };

// Ayar butonları
document.getElementById('toggle-ai').onclick = function() {
    currentSettings.aiEnabled = !currentSettings.aiEnabled;
    this.className = currentSettings.aiEnabled ? "btn btn-on" : "btn btn-off";
    this.innerText = currentSettings.aiEnabled ? "AI: AÇIK" : "AI: KAPALI";
    socket.emit('update-settings', currentSettings);
};

document.getElementById('toggle-math').onclick = function() {
    currentSettings.mathEnabled = !currentSettings.mathEnabled;
    this.className = currentSettings.mathEnabled ? "btn btn-on" : "btn btn-off";
    this.innerText = currentSettings.mathEnabled ? "MAT: AÇIK" : "MAT: KAPALI";
    socket.emit('update-settings', currentSettings);
};

document.getElementById('delay-range').oninput = function() {
    currentSettings.delay = parseInt(this.value);
    document.getElementById('delay-val').innerText = this.value;
    socket.emit('update-settings', currentSettings);
};

// BAĞLANMA FONKSİYONU
document.getElementById('btn-connect').onclick = function() {
    const host = document.getElementById('host').value;
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    if (!host || !username) {
        addLog('§cHata: IP ve Bot Adı kısımlarını doldur!');
        return;
    }

    socket.emit('start-bot', { host, username, password });
};

document.getElementById('btn-stop').onclick = function() {
    socket.emit('stop-bot');
};

// Sohbet Girişi
chatInput.onkeypress = function(e) {
    if (e.key === 'Enter' && this.value) {
        socket.emit('send-chat', { msg: this.value });
        this.value = '';
    }
};

// Logları Terminale Basma
socket.on('log', (d) => {
    const div = document.createElement('div');
    div.style.marginBottom = "4px";
    
    // Minecraft renklerini işle veya HTML bas
    if (d.msg.includes('<span')) {
        div.innerHTML = d.msg;
    } else {
        // Sistem mesajları için basit renk kodlayıcı
        div.innerHTML = d.msg.replace(/§([0-9a-fk-or])/g, (match, code) => {
            const colors = {
                '0':'#000','1':'#00A','2':'#0A0','3':'#0AA','4':'#A00','5':'#A0A','6':'#FA0','7':'#AAA',
                '8':'#555','9':'#55F','a':'#5F5','b':'#5FF','c':'#F55','d':'#F5F','e':'#FF5','f':'#FFF'
            };
            return `</span><span style="color:${colors[code] || '#fff'}">`;
        });
    }
    
    const isBottom = logs.scrollHeight - logs.clientHeight <= logs.scrollTop + 60;
    logs.appendChild(div);
    if (isBottom) logs.scrollTop = logs.scrollHeight;
});

socket.on('status', (d) => {
    statusInd.style.color = d.connected ? "#3fb950" : "#f85149";
    statusInd.innerText = d.connected ? "● ONLINE" : "● OFFLINE";
});

function addLog(msg) {
    socket.emit('log', { msg }); // Kendi logunu da terminale basar
}
