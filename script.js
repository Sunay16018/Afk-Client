const s = io();
const logBox = document.getElementById("log");
const settings = document.getElementById("settings");

// Renk paletini genişlettim
const Convert = new AnsiConvert({ 
    escapeXML: true, 
    fg: '#fff', 
    bg: '#000',
    colors: {
        0: '#000000', 1: '#0000AA', 2: '#00AA00', 3: '#00AAAA',
        4: '#AA0000', 5: '#AA00AA', 6: '#FFAA00', 7: '#AAAAAA',
        8: '#555555', 9: '#5555FF', 10: '#55FF55', 11: '#55FFFF',
        12: '#FF5555', 13: '#FF55FF', 14: '#FFFF55', 15: '#FFFFFF'
    }
});

function log(m){
    logBox.innerHTML += Convert.toHtml(m) + "<br>";
    logBox.scrollTop = logBox.scrollHeight;
}

s.on("log", log);

document.getElementById("settingsBtn").onclick = ()=>settings.classList.toggle("hidden");

document.getElementById("start").onclick = ()=>{
    logBox.innerHTML = ""; // Yeni bağlantıda terminali temizle
    log("§e[BİLGİ] Bağlanılıyor...");
    s.emit("startBot",{
        ip: document.getElementById("ip").value,
        port: document.getElementById("port").value,
        username: document.getElementById("username").value,
        password: document.getElementById("password").value,
        version: document.getElementById("version").value
    });
};

document.getElementById("stop").onclick = ()=>s.emit("stopBot",document.getElementById("username").value);

document.getElementById("send").onclick = ()=>{
    s.emit("sendChat",{username: document.getElementById("username").value,message: document.getElementById("chatMsg").value});
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
