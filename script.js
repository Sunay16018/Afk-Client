const socket = io();
const logs = document.getElementById('logs');
const chatInput = document.getElementById('chat-input');
const statusInd = document.getElementById('status-indicator');

// BAĞLAN BUTONU
document.getElementById('btn-connect').onclick = function() {
    const host = document.getElementById('host').value;
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    if (!host || !username) {
        alert("IP ve Kullanıcı adı boş olamaz!");
        return;
    }

    // Verileri backend'e gönder
    socket.emit('start-bot', { host, username, password });
};

// KES BUTONU
document.getElementById('btn-stop').onclick = function() {
    socket.emit('stop-bot');
};

// KOMUT GÖNDERME (Enter tuşu)
chatInput.onkeypress = function(e) {
    if (e.key === 'Enter' && this.value) {
        socket.emit('send-chat', { msg: this.value });
        this.value = '';
    }
};

// LOGLARI YAKALAMA VE KAYDIRMA
socket.on('log', (d) => {
    const div = document.createElement('div');
    div.style.marginBottom = "4px";
    div.innerHTML = d.msg;
    logs.appendChild(div);

    // Kaydırma mantığı: Eğer kullanıcı yukarı çıkmamışsa aşağı kaydır
    const isBottom = logs.scrollHeight - logs.clientHeight <= logs.scrollTop + 100;
    if (isBottom) logs.scrollTop = logs.scrollHeight;
});

// BAĞLANTI DURUMU
socket.on('status', (d) => {
    statusInd.style.color = d.connected ? "#3fb950" : "#f85149";
    statusInd.innerText = d.connected ? "● ONLINE" : "● OFFLINE";
});
