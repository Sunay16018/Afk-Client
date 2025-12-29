const socket = io();

function botuBaslat() {
    const veri = {
        ip: document.getElementById('ip').value,
        port: document.getElementById('port').value,
        isim: document.getElementById('isim').value,
        sifre: document.getElementById('sifre').value
    };
    socket.emit('bot-baslat', veri);
    modalKapat('baglanModal');
}

function baglantiyiKes() {
    const secili = document.getElementById('botListesi').value;
    if (secili) socket.emit('bot-durdur', secili);
}

function mesajGonder() {
    const isim = document.getElementById('botListesi').value;
    const mesaj = document.getElementById('sohbetInput').value;
    if (isim && mesaj) {
        socket.emit('mesaj-gonder', { isim, mesaj });
        document.getElementById('sohbetInput').value = '';
    }
}

function hareket(yon, durum) {
    const isim = document.getElementById('botListesi').value;
    if (isim) socket.emit('hareket', { isim, yon, durum });
}

function ayarlariKaydet() {
    const isim = document.getElementById('botListesi').value;
    if (!isim) return alert("Önce bir bot seçmelisiniz!");

    const yeniAyarlar = {
        kazmaAktif: document.getElementById('kazmaTik').checked,
        otoMesajAktif: document.getElementById('otoMesajTik').checked,
        otoMesajMetni: document.getElementById('otoMesajMetin').value,
        otoMesajSuresi: parseInt(document.getElementById('otoMesajSure').value) || 30,
        matematikAktif: document.getElementById('matTik').checked,
        matematikGecikme: parseInt(document.getElementById('matGecikme').value) || 2
    };

    socket.emit('ayarlari-uygula', { isim, yeniAyarlar });
    modalKapat('ayarModal');
}

socket.on('bot-listesi-guncelle', (liste) => {
    const select = document.getElementById('botListesi');
    select.innerHTML = liste.map(bot => `<option value="${bot}">${bot}</option>`).join('');
    botDegisti();
});

socket.on('bilgi-guncelle', (veri) => {
    const secili = document.getElementById('botListesi').value;
    if (veri.isim === secili) {
        document.getElementById('oyuncuSayisi').innerText = veri.oyuncuSayisi;
    }
});

socket.on('log', (msg) => {
    const term = document.getElementById('terminal');
    const div = document.createElement('div');
    const renkler = { 'a': '#0f9', 'b': '#0cf', 'c': '#f33', 'e': '#ff0', 'f': '#fff', '7': '#aaa' };
    div.innerHTML = msg.replace(/§([0-9a-f])/g, (m, c) => `</span><span style="color:${renkler[c] || '#fff'}">`);
    term.appendChild(div);
    term.scrollTop = term.scrollHeight;
});

function botDegisti() {
    const isim = document.getElementById('botListesi').value;
    document.getElementById('seciliBotIsmi').innerText = isim || "YOK";
}

function ayarModalAc() { document.getElementById('ayarModal').style.display = 'flex'; }
function baglanModalAc() { document.getElementById('baglanModal').style.display = 'flex'; }
function modalKapat(id) { document.getElementById(id).style.display = 'none'; }
