const socket = io();

// ---------- Helper ----------
function addLog(message) {
  const log = document.getElementById('log');
  log.textContent += message + '\n';
  log.scrollTop = log.scrollHeight;
}

// ---------- Connection controls ----------
document.getElementById('connect').addEventListener('click', () => {
  socket.emit('connectBot', {
    host: document.getElementById('host').value.trim(),
    port: Number(document.getElementById('port').value) || 25565,
    username: document.getElementById('username').value.trim(),
    password: document.getElementById('password').value
  });
});

document.getElementById('disconnect').addEventListener('click', () => {
  socket.emit('disconnectBot');
});

// ---------- Feature toggles ----------
document.getElementById('autoMine').addEventListener('change', e => {
  socket.emit('toggleMining', e.target.checked);
});

document.getElementById('autoDefend').addEventListener('change', e => {
  // auto‑defend is always on in the bot; this toggle can be used later to enable/disable
  // For now we just inform the server (no implementation needed in current bot)
  socket.emit('autoDefend', e.target.checked);
});

document.getElementById('autoChat').addEventListener('change', e => {
  // placeholder for future auto‑message feature
  socket.emit('autoChat', e.target.checked);
});

// ---------- Send manual chat ----------
document.getElementById('msg').addEventListener('keydown', ev => {
  if (ev.key === 'Enter' && ev.target.value.trim() !== '') {
    const text = ev.target.value;
    socket.emit('sendMessage', text);
    ev.target.value = '';
  }
});

// ---------- Login password ----------
document.getElementById('password').addEventListener('keydown', ev => {
  if (ev.key === 'Enter' && ev.target.value) {
    socket.emit('loginPassword', ev.target.value);
  }
});

// ---------- Radar & Inventory ----------
socket.on('radar', entities => {
  const radarDiv = document.getElementById('radar');
  radarDiv.innerHTML = '<strong>Yakındaki Varlıklar</strong><br>';
  entities.forEach(e => {
    radarDiv.innerHTML += `${e.name} – ${e.dist}m<br>`;
  });
});

socket.on('inventory', items => {
  const invDiv = document.getElementById('inventory');
  invDiv.innerHTML = '<strong>Envanter</strong><br>';
  items.forEach(i => {
    invDiv.innerHTML += `${i.name} × ${i.count}<br>`;
  });
});

// ---------- Bot status ----------
socket.on('status', msg => addLog(`[Durum] ${msg}`));
socket.on('miningResult', msg => addLog(`[Maden] ${msg}`));
socket.on('connect_error', err => addLog(`[Hata] ${err.message}`));
