const m=require('mineflayer'),h=require('http'),u=require('url'),f=require('fs'),p=require('path')
let s={}
function g(k){if(!s[k])s[k]={b:{},l:{},c:{}};return s[k]}
function b(k,o,t,v){const S=g(k);if(S.b[t])return;const[i,r]=o.split(':')
S.l[t]=["[SİSTEM] Başlatılıyor..."];const B=m.createBot({host:i,port:parseInt(r)||25565,username:t,version:v,auth:'offline'})
S.b[t]=B;S.c[t]={d:false,m:false,st:{r:true,a:false},ci:{h:o,u:t,v:v,s:k}}
B.on('login',()=>S.l[t].push(`[BAĞLANTI] ${t} sunucuya bağlandı!`))
B.on('message',(m)=>{let t=m.toString();t=fix(t);S.l[t].push(t);if(S.l[t].length>100)S.l[t].shift()})
function dig(){const c=S.c[t];if(!c.d||!B)return;const b=B.blockAtCursor(5)
if(b&&b.diggable){B.dig(b,(e)=>{if(!e)S.l[t].push("[KAZMA] Blok kırıldı!");setTimeout(()=>c.d&&dig(),500)})
}else setTimeout(()=>c.d&&dig(),1000)}
B.on('end',()=>{S.l[t].push("[BAĞLANTI] Bağlantı kesildi");const c=S.c[t]
if(!c.m&&c.st.r){S.l[t].push("[SİSTEM] 10sn sonra yeniden bağlanılıyor...");setTimeout(()=>{
if(!S.b[t]&&!c.m&&c.st.r)b(k,c.ci.h,t,c.ci.v)},10000)}delete S.b[t]})
B.on('kicked',(r)=>{S.l[t].push("[ATILDI] "+fix(r.toString()));delete S.b[t]})
B.on('error',(e)=>{S.l[t].push("[HATA] "+e.message);delete S.b[t]})}
function fix(t){const r={'Ã§':'ç','ÄŸ':'ğ','Ä±':'ı','Ã¶':'ö','ÅŸ':'ş','Ã¼':'ü','Ã‡':'Ç','Äž':'Ğ','Ä°':'İ','Ã–':'Ö','Åž':'Ş','Ãœ':'Ü','{text"':'','"text}':'','{text':'','text}':''}
return Object.entries(r).reduce((s,[b,g])=>s.replace(new RegExp(b,'g'),g),t)}
h.createServer((r,e)=>{const q=u.parse(r.url,true).query,n=u.parse(r.url,true).pathname,k=q.sid
e.setHeader('Access-Control-Allow-Origin','*');if(r.method=='OPTIONS'){e.writeHead(200);e.end();return}
if(!k&&n!='/'&&n!='/index.html')return e.end("No SID");const S=g(k),B=S.b[q.user]
if(n=='/start'){if(S.c[q.user])S.c[q.user].m=false;b(k,q.host,q.user,q.ver);return e.end("ok")}
if(n=='/stop'&&B){if(S.c[q.user]){S.c[q.user].m=true;S.l[q.user].push("[SİSTEM] Bot manuel durduruldu.")}B.quit();delete S.b[q.user];return e.end("ok")}
if(n=='/send'&&B){B.chat(decodeURIComponent(q.msg));return e.end("ok")}
if(n=='/dig'&&B){const c=S.c[q.user];if(q.action=='start'){c.d=true;dig();S.l[q.user].push("[KAZMA] Kazma başladı!")
}else if(q.action=='stop'){c.d=false;S.l[q.user].push("[KAZMA] Kazma durdu.")}return e.end("ok")}
if(n=='/control'&&B){const d=q.direction,s=q.state=='true',m={forward:'forward',back:'back',left:'left',right:'right',jump:'jump'}
if(m[d])B.setControlState(m[d],s);return e.end("ok")}
if(n=='/update'&&S.c[q.user]){const c=S.c[q.user];if(q.type=='inv'&&q.status=='drop'&&B){const i=B.inventory.slots[parseInt(q.val)];if(i)B.tossStack(i)
}else if(q.type=='setting')c.st[q.setting]=q.value=='true';return e.end("ok")}
if(n=='/data'&&k){const a=Object.keys(S.b),b={};a.forEach(u=>{const bot=S.b[u]
if(bot)b[u]={hp:bot.health||0,food:bot.food||0,inv:bot.inventory.slots.map((it,idx)=>it?{name:it.name,count:it.count,slot:idx,display:it.displayName}:null).filter(x=>x)}}
);const st={};Object.keys(S.c).forEach(u=>{if(S.c[u])st[u]=S.c[u].st})
e.setHeader('Content-Type','application/json');return e.end(JSON.stringify({active:a,logs:S.l,botData:b,settings:st}))}
let fp=p.join(__dirname,n=='/'?'index.html':n);f.readFile(fp,(err,con)=>{if(err){f.readFile(p.join(__dirname,'index.html'),(e2,c2)=>{e.writeHead(200,{'Content-Type':'text/html'});e.end(c2)})}else{const ex=p.extname(fp),ts={'.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpg'};e.writeHead(200,{'Content-Type':ts[ex]||'text/html'});e.end(con)}})}).listen(process.env.PORT||10000)
