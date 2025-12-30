const socket = io();

// ---------- UI Elements ----------
const terminal = document.getElementById('terminal');
const chatInput = document.getElementById('chatInput');
const sendChatBtn = document.getElementById('sendChatBtn');

const ipInput = document.getElementById('ip');
const portInput = document.getElementById('port');
const userInput = document.getElementById('username');
const passInput = document.getElementById('password');
const versionInput = document.getElementById('version');

const connectBtn = document.getElementById('connectBtn');
const disconnectBtn = document.getElementById('disconnectBtn');

const autoMsgArea = document.getElementById('autoMessages');
const autoDelayInput = document.getElementById('autoDelay');
const autoStartBtn = document.getElementById('autoStartBtn');
const autoStopBtn = document.getElementById('autoStopBtn');

const toggleSettingsBtn = document.getElementById('toggleSettings');
const toggleAutoMsgBtn = document.getElementById('toggleAutoMsg');
const settingsPanel = document.getElementById('settings');
const autoMsgPanel = document.getElementById('autoMsgPanel');

const moveButtons = document.querySelectorAll('.moveBtn');

// ---------- Helper: Append to terminal ----------
function addLine(html) {
  const line = document.createElement('div');
  line.innerHTML = html;
  terminal.appendChild(line);
  terminal.scrollTop = terminal.scrollHeight;
}

// ---------- Socket listeners ----------
socket.on('chat', (html) => addLine(html));
socket.on('status', (html) => addLine(html));

// ---------- Connection controls ----------
connectBtn.addEventListener('click', () => {
  const data = {
    host: ipInput.value.trim(),
    port: parseInt(portInput.value, 10) || 25565,
    username: userInput.value.trim(),
    password: passInput.value,
    version: versionInput.value.trim() || false
  };
  socket.emit('startBot', data);
});

disconnectBtn.addEventListener('click', () => {
  socket.emit('stopBot');
});

// ---------- Chat ----------
sendChatBtn.addEventListener('click', sendChat);
chatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendChat();
});
function sendChat() {
  const msg = chatInput.value.trim();
  if (msg) {
    socket.emit('sendChat', msg);
    chatInput.value = '';
  }
}

// ---------- Auto‑Message ----------
autoStartBtn.addEventListener('click', () => {
  const msgs = autoMsgArea.value
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);
  const delay = parseInt(autoDelayInput.value, 10) || 5000;
  if (msgs.length) {
    socket.emit('autoMessageStart', { messages: msgs, delay });
  }
});
autoStopBtn.addEventListener('click', () => {
  socket.emit('autoMessageStop');
});

// ---------- Panels toggle ----------
toggleSettingsBtn.addEventListener('click', () => {
  settingsPanel.classList.toggle('hidden');
});
toggleAutoMsgBtn.addEventListener('click', () => {
  autoMsgPanel.classList.toggle('hidden');
});

// ---------- Movement controls ----------
function sendMove(dir, state) {
  socket.emit('move', { direction: dir, state });
}

// Mouse / touch handling
moveButtons.forEach(btn => {
  const dir = btn.dataset.dir;

  // Desktop
  btn.addEventListener('mousedown', () => sendMove(dir, true));
  btn.addEventListener('mouseup', () => sendMove(dir, false));
  btn.addEventListener('mouseleave', () => sendMove(dir, false));

  // Mobile
  btn.addEventListener('touchstart', (e) => {
    e.preventDefault(); // prevent ghost click
    sendMove(dir, true);
  });
  btn.addEventListener('touchend', (e) => {
    e.preventDefault();
    sendMove(dir, false);
  });
});
      
