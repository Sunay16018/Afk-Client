const socket = io();

socket.on('log', (htmlMesaj) => {
    const term = document.getElementById('terminal');
    const div = document.createElement('div');
    // HTML'i doğrudan yansıtıyoruz
    div.innerHTML = htmlMesaj;
    term.appendChild(div);
    
    // Otomatik kaydırma
    term.scrollTop = term.scrollHeight;
});

// Bot listesi ve diğer fonksiyonlar...
socket.on('bot-listesi-guncelle', (liste) => {
    const select = document.getElementById('botListesi');
    const mevcutSecim = select.value;
    select.innerHTML = liste.map(bot => `<option value="${bot}">${bot}</option>`).join('');
    if (liste.includes(mevcutSecim)) select.value = mevcutSecim;
    document.getElementById('seciliBotIsmi').innerText = select.value || "YOK";
});
// (Geri kalan hareket, mesaj-gonder, modal fonksiyonları öncekiyle aynıdır)
