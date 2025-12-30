const s = io();
const logBox = document.getElementById("log");
const settings = document.getElementById("settings");
const Convert = new AnsiConvert({escapeXML:true, fg:'#fff', bg:'#000'});

function log(m){
 logBox.innerHTML += Convert.toHtml(m) + "<br>";
 logBox.scrollTop = logBox.scrollHeight;
}

s.on("log", log);

settingsBtn.onclick = ()=>settings.classList.toggle("hidden");

start.onclick = ()=>s.emit("startBot",{
 ip: ip.value, port: port.value, username: username.value,
 password: password.value, version: version.value
});

stop.onclick = ()=>s.emit("stopBot", username.value);

send.onclick = ()=>{
 s.emit("sendChat",{username: username.value, message: chatMsg.value});
 chatMsg.value = "";
};

autoMsgEnable.onchange = ()=>{
 s.emit("autoMsg",{
  username: username.value,
  enabled: autoMsgEnable.checked,
  message: autoMsgText.value,
  delay: Number(autoMsgDelay.value||5)
 });
};

document.querySelectorAll(".controls button").forEach(b=>{
 const k = b.dataset.k;
 b.onmousedown = ()=>s.emit("move",{username: username.value, key: k, state: true});
 b.onmouseup = ()=>s.emit("move",{username: username.value, key: k, state: false});
 b.ontouchstart = ()=>s.emit("move",{username: username.value, key: k, state: true});
 b.ontouchend = ()=>s.emit("move",{username: username.value, key: k, state: false});
});
