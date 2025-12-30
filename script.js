const s = io();
const logBox = document.getElementById("log");
const settings = document.getElementById("settings");

// ANSI'yi HTML'e çeviren nesne (TrueColor desteği aktif)
const Convert = new AnsiConvert({ 
    escapeXML: true, 
    fg: '#fff', 
    bg: '#000',
    newline: true
});

function log(m){
    if(!m) return;
    // Gelen ham ANSI yazısını HTML renklerine çeviriyoruz
    logBox.innerHTML += Convert.toHtml(m) + "<br>";
    logBox.scrollTop = logBox.scrollHeight;
}

s.on("log", log);

document.getElementById("settingsBtn").onclick = ()=>settings.classList.toggle("hidden");

document.getElementById("start").onclick = ()=>{
    logBox.innerHTML = ""; // Terminali temizle
    log("§e[BİLGİ] Bağlanılıyor...");
    s.emit("startBot",{
        ip: document.getElementById("ip").value,
        port: document.getElementById("port").value,
        username: document.getElementById("username").value,
        password: document.getElementById("password").value,
        version: document.getElementById("version").value
    });
};

document.getElementById("send").onclick = ()=>{
    s.emit("sendChat",{username: document.getElementById("username").value, message: document.getElementById("chatMsg").value});
    document.getElementById("chatMsg").value = "";
};

document.getElementById("autoMsgEnable").onchange = ()=>{
    s.emit("autoMsg",{
        username: document.getElementById("username").value,
        enabled: document.getElementById("autoMsgEnable").checked,
        message: document.getElementById("autoMsgText").value,
        delay:Number(document.getElementById("autoMsgDelay").value||5)
    });
};

document.querySelectorAll(".controls button").forEach(b=>{
    const k=b.dataset.k;
    b.onmousedown=()=>s.emit("move",{username: document.getElementById("username").value,key:k,state:true});
    b.onmouseup=()=>s.emit("move",{username: document.getElementById("username").value,key:k,state:false});
});
