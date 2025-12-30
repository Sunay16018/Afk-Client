const socket = io();
let selBot = "";
const el = (id) => document.getElementById(id);

function toggleModal(id, show) { el(id).style.display = show ? 'flex' : 'none'; }

function connect() {
    const data = { host: el('ip').value, username: el('nick').value, pass: el('pass').value };
    if(!data.host || !data.username) return alert("Bilgileri doldur!");
    socket.emit('start-bot', data);
    toggleModal('bot-modal', false);
}

function disconnect() { 
    if(selBot) {
        socket.emit('quit', selBot);
        socket.emit('log', { user: 'SİSTEM', msg: `<span style="color:red">Bağlantı kesme emri verildi: ${selBot}</span>` });
    } 
}

function saveSettings() {
    if(!selBot) return alert("Önce botu seçmelisin!");
    const config = {
        autoRevive: el('rev-on').checked,
        math: el('math-on').checked,
        autoMsg: el('msg-on').checked,
        msgText: el('msg-text').value,
        msgDelay: parseInt(el('msg-sec').value) || 30
    };
    socket.emit('update-config', { user: selBot, config });
    toggleModal('set-modal', false);
}

function sendChat() {
    const msg = el('cin').value;
    if(selBot && msg) { socket.emit('chat', { user: selBot, msg }); el('cin').value = ""; }
}

socket.on('status', d => {
    const s = el('bot-sel');
    if (d.online) {
        if (!el("opt-"+d.user)) {
            let o = document.createElement('option'); o.value = d.user; o.id = "opt-"+d.user; o.innerText = d.user;
            s.appendChild(o);
        }
        selBot = d.user; s.value = d.user;
    } else {
        const o = el("opt-"+d.user); if(o) o.remove();
        selBot = s.value;
    }
});

socket.on('log', d => {
    const l = el('logs');
    const msgDiv = document.createElement('div');
    msgDiv.style.marginBottom = "4px";
    msgDiv.innerHTML = `<span style="color:#888">[${new Date().toLocaleTimeString()}]</span> <b style="color:#00ff41">${d.user}:</b> ${d.msg}`;
    l.appendChild(msgDiv);
    
    // Terminali otomatik en aşağı kaydır
    l.scrollTop = l.scrollHeight;
});

el('cin').onkeydown = (e) => { if(e.key === 'Enter') sendChat(); };
