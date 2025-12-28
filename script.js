const socket = io();
const logs = document.getElementById('logs');
const chatInput = document.getElementById('chat-input');
const statusInd = document.getElementById('status-indicator');

// BAĞLAN BUTONU
document.getElementById('btn-connect').onclick = function() {
    const host = document.getElementById('host').value;
    const port = document.getElementById('port').value;
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    if (!host || !username) {
        alert("IP ve Bot İsmi boş olamaz!");
        return;
    }

    // Senin server.js dosyan 'join' bekliyor ve 'botId' istiyor
    socket.emit('join', { 
        host: host,
        port: port,
        username: username,
        password: password, // Şifreyi de gönderiyoruz
        botId: "1" // Senin kodun botId beklediği için sabit 1 gönderiyoruz
    });

    addLog('<b style="color:orange;">[SİSTEM] Bağlantı isteği gönderildi...</b>');
};

// MESAJ GÖNDERME
chatInput.onkeypress = function(e) {
    if (e.key === 'Enter' && this.value) {
        // Senin kodun botId: data.botId bekliyor
        socket.emit('send-chat', { botId: "1", msg: this.value });
        this.value = '';
    }
};

document.getElementById('btn-stop').onclick = function() {
    // Kapatma işlemi için sayfayı yenilemek en temizi ya da socket emit
    location.reload();
};

// LOGLARI ALMA
socket.on('log', (d) => {
    addLog(d.msg);
});

socket.on('status', (d) => {
    statusInd.style.color = d.connected ? "#3fb950" : "#f85149";
    statusInd.innerText = d.connected ? "● ONLINE" : "● OFFLINE";
});

function addLog(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    logs.appendChild(div);
    logs.scrollTop = logs.scrollHeight;
}
