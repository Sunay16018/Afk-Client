
const socket = io();
const logBox = document.getElementById("log");

function log(m) {
  logBox.innerHTML += m + "<br>";
  logBox.scrollTop = logBox.scrollHeight;
}

socket.on("log", log);

document.getElementById("start").onclick = () => {
  socket.emit("startBot", {
    ip: ip.value,
    port: port.value || 25565,
    username: username.value,
    password: password.value,
    version: version.value
  });
};

document.getElementById("stop").onclick = () => {
  socket.emit("stopBot", username.value);
};

document.getElementById("send").onclick = () => {
  socket.emit("sendChat", {
    username: username.value,
    message: chatMsg.value
  });
  chatMsg.value = "";
};
