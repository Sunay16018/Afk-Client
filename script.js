const socket = io();

const ip = document.getElementById("ip");
const port = document.getElementById("port");
const username = document.getElementById("username");
const version = document.getElementById("version");

const logBox = document.getElementById("log");

document.getElementById("startBtn").onclick = () => {
  if (!ip.value || !username.value) {
    log("⚠️ IP ve Bot İsmi gerekli");
    return;
  }

  socket.emit("startBot", {
    ip: ip.value,
    port: port.value || 25565,
    username: username.value,
    version: version.value
  });
};

document.getElementById("stopBtn").onclick = () => {
  socket.emit("stopBot");
};

socket.on("log", msg => {
  log(msg);
});

function log(msg) {
  logBox.innerHTML += msg + "<br>";
  logBox.scrollTop = logBox.scrollHeight;
}
