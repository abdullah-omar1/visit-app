import {initializeApp} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {initializeFirestore,persistentLocalCache,persistentMultipleTabManager,collection as fcol,doc as fdoc,setDoc as fset,deleteDoc as fdel,onSnapshot as fsnap,query as fquery,orderBy as forder,limit as flimit,getDoc as fget} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {getAuth,signInAnonymously,createUserWithEmailAndPassword,signInWithEmailAndPassword,EmailAuthProvider,linkWithCredential} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {firebaseConfig} from "./config.js";
var KEY="weekly-orders-v1",NAME={cat:"catalog",cur:"cur",vis:"visits",cg:"categories"},LK={cat:"-catalog",cur:"-cur",vis:"-visits",cg:"-categories"};
var S={cat:[],cur:[],vis:[],cg:[]},got={},V={},ensured=false,rnFn=null,armedCat="",CODE="",itemO=null,itemPin=false,itemDel=false,deferredInstall=null,lastFin=null,undoFn=null,toastT,sheetO=null,sheetQ=1,phT=null,dbx=null,curCat="",newMode=false,manage=false,newVal="",needFocus=false,showDone=true,armed="",view="visit",canWrite=true,q={},msgT;
function $(i){return document.getElementById(i)}
function initTheme(){
  var saved=lget("-theme","");
  var root=document.documentElement;
  if(saved==="light"||saved==="dark")root.setAttribute("data-theme",saved);
  var update=function(){
    var b=$("themeBtn");
    if(!b)return;
    var dark=root.getAttribute("data-theme")==="dark"||(root.getAttribute("data-theme")!=="light"&&window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches);
    b.textContent=dark?"☀":"◐";b.title=dark?"الوضع الفاتح":"الوضع الداكن";
  };
  update();
  document.addEventListener("click",function(e){
    var b=e.target&&e.target.closest?e.target.closest("#themeBtn"):null;
    if(b){
      e.preventDefault();e.stopPropagation();
      var dark=root.getAttribute("data-theme")==="dark"||(root.getAttribute("data-theme")!=="light"&&window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches);
      var next=dark?"light":"dark";
      root.setAttribute("data-theme",next);lset("-theme",next);update();
      return;
    }
    var rb=e.target&&e.target.closest?e.target.closest("#reloadBtn"):null;
    if(rb){
      e.preventDefault();e.stopPropagation();
      window.location.reload();
    }
  },true);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initTheme);else initTheme();
function norm(s){return s.trim().replace(/\s+/g," ").replace(/[أإآ]/g,"ا").replace(/ة/g,"ه").replace(/ى/g,"ي").toLowerCase()}
function say(t){var m=$("msg");m.textContent=t;clearTimeout(msgT);msgT=setTimeout(function(){m.textContent=""},3500)}
function el(tag,cls,txt){var e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e}
function W(e){if(!canWrite)e.classList.add("off");return e}
function lget(k,d){try{var r=localStorage.getItem(KEY+k);return r?JSON.parse(r):d}catch(e){return d}}
function lset(k,v){try{localStorage.setItem(KEY+k,JSON.stringify(v))}catch(e){}}
function later(id,fn){q[id]=(q[id]||Promise.resolve()).then(fn,fn)}
function fail(){say("التعديل مثبتش، جرب تاني.")}
function body(o){var b={};for(var k in o)if(k!=="id")b[k]=o[k];return b}
function save(c,o){
  var a=S[c],i=a.findIndex(function(x){return x.id===o.id});if(i<0)a.push(o);else a[i]=o;
  if(dbx)later(c+o.id,function(){return dbx.collection(NAME[c]).doc(o.id).set(body(o)).catch(fail)});else lset(LK[c],a);
}
function rm(c,id){
  S[c]=S[c].filter(function(x){return x.id!==id});
  if(dbx)later(c+id,function(){return dbx.collection(NAME[c]).doc(id).delete().catch(fail)});else lset(LK[c],S[c]);
}
function gid(n){var h=0,k=norm(n);for(var i=0;i<k.length;i++)h=(h*33+k.charCodeAt(i))%2147483647;return"g"+h.toString(36)}
function addCat(n){var k=norm(n),ex=cats().filter(function(c){return norm(c)===k})[0];if(ex)return ex;save("cg",{id:gid(n),name:n,ts:Date.now()});return n}
function ensureCats(){if(!canWrite)return;S.cat.forEach(function(i){if(i.cat&&!S.cg.some(function(g){return norm(g.name)===norm(i.cat)}))save("cg",{id:gid(i.cat),name:i.cat,ts:Date.now()})})}
function uid(p){return p+Date.now().toString(36)+Math.random().toString(36).slice(2,6)}
function fc(n){var k=norm(n);return S.cat.filter(function(i){return norm(i.name)===k})[0]}
function inCur(id){return S.cur.filter(function(i){return i.id===id})[0]}
function cats(){var o=S.cg.slice().sort(function(a,b){return(a.ts||0)-(b.ts||0)}).map(function(g){return g.name});S.cat.forEach(function(i){if(i.cat&&o.indexOf(i.cat)<0)o.push(i.cat)});return o}
function groups(list){var out=[];cats().concat([""]).forEach(function(c){var g=list.filter(function(i){return(i.cat||"")===c});if(g.length)out.push({c:c,g:g})});return out}
function mk(i){return{name:i.name,cat:i.cat||"",qty:i.qty||1,note:i.note||"",at:i.at||0}}
function fmtT(ts){return new Date(ts).toLocaleTimeString("ar-EG",{hour:"numeric",minute:"2-digit"})}
function fmtDate(d){try{return new Date(d+"T12:00:00").toLocaleDateString("ar-EG",{weekday:"long",day:"numeric",month:"long"})}catch(e){return d}}
function setVMeta(p){V=Object.assign({},V,p);if(dbx)later("vmeta",function(){return dbx.doc("meta/visit").set(V).catch(fail)});else lset("-vmeta",V);draw()}
function drawMeta(){
  var st=$("vstat");st.innerHTML="";
  var vd=$("vdate");if(document.activeElement!==vd)vd.value=V.date||"";
  vd.disabled=!canWrite;
  st.className="vstat"+(V.ready?" ok":"");
  if(V.ready){st.appendChild(el("b",null,"الزيارة جاهزة 💛"));if(V.date)st.appendChild(el("span",null,"ميعادها "+fmtDate(V.date)))}
  else st.appendChild(el("span",null,V.date?"لسه بتتجهز · ميعادها "+fmtDate(V.date):"لسه بتتجهز"));
  var b=W(el("button","go2",V.ready?"رجّعها للتجهيز":"الزيارة جاهزة لماما"));
  b.onclick=function(){setVMeta({ready:!V.ready,readyAt:Date.now()})};
  st.appendChild(b);
}
$("vdate").onchange=function(){if(canWrite)setVMeta({date:this.value})};
function toast(m,fn){var t=$("toast");$("tmsg").textContent=m;undoFn=fn||null;$("tund").hidden=!fn;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(function(){t.hidden=true;undoFn=null},3000)}
$("tund").onclick=function(){var f=undoFn;undoFn=null;$("toast").hidden=true;if(f)f()};
/*SUG*/
function dd(ms){var d=Math.max(1,Math.round(ms/864e5));return d<14?(d===1?"يوم":d===2?"يومين":d<=10?d+" أيام":d+" يوم"):Math.round(d/7)+" أسابيع"}
function suggest(cat,vis,curIds,now){
  var vs=vis.slice().sort(function(a,b){return b.ts-a.ts}),out=[],DAY=864e5;
  cat.forEach(function(ci){
    if(curIds[ci.id])return;
    var k=norm(ci.name),best=null;
    function cand(s,w){if(!best||s>best.score)best={ci:ci,score:s,why:w}}
    if(ci.pin)cand(100,"أساسي");
    function had(v){return v.bought.some(function(b){return norm(b.name)===k})}
    var ts=vs.filter(had).map(function(v){return v.ts});
    if(ts.length>=2){
      var g=[];for(var i=0;i<ts.length-1;i++)g.push(ts[i]-ts[i+1]);
      var avg=g.reduce(function(a,b){return a+b},0)/g.length,since=now-ts[0];
      if(avg>=DAY&&since>=avg*0.8)cand(50+Math.min(since/avg,2)*10,"بتجيبها كل حوالي "+dd(avg)+"، وآخر مرة من "+dd(since));
    }
    var rec=vs.slice(0,5),hits=rec.filter(had).length;
    if(rec.length>=3&&hits/rec.length>=0.6)cand(40+hits,"اتجابت في "+hits+" من آخر "+rec.length+" زيارات");
    if(best)out.push(best);
  });
  return out.sort(function(a,b){return b.score-a.score}).slice(0,12);
}
/*END*/
function addToVisit(ci){save("cur",{id:ci.id,name:ci.name,cat:ci.cat||"",note:ci.note||"",qty:1,done:false,na:false,ts:Date.now()})}
function rmCur(o){var c=Object.assign({},o);rm("cur",o.id);draw();toast("اتشالت «"+o.name+"» من الزيارة.",function(){save("cur",c);draw()})}
function add(){
  if(!canWrite)return;
  var inp=$("in"),n=inp.value.trim();
  if(!n)return;
  var ci=fc(n),fresh=!ci;
  if(fresh){ci={id:uid("c"),name:n,cat:curCat,pin:false};save("cat",ci)}
  if(inCur(ci.id))say("«"+ci.name+"» موجودة بالفعل في الزيارة.");
  else{addToVisit(ci);say(fresh?"«"+n+"» اتضافت للقائمة وللزيارة.":"«"+ci.name+"» اتضافت للزيارة.")}
  inp.value="";drawAc();draw();inp.focus();
}
function tick(o){o.done=!o.done;if(o.done)o.na=false;o.at=o.done?Date.now():0;save("cur",o);draw()}
function drawCats(){
  var box=$("cats"),had=document.activeElement&&document.activeElement.classList&&document.activeElement.classList.contains("nc");
  box.innerHTML="";
  var chip=function(label,val){var b=el("button","cc"+(curCat===val&&!newMode?" sel":""),label);b.onclick=function(){curCat=val;newMode=false;drawCats()};box.appendChild(b)};
  chip("بدون قسم","");
  cats().forEach(function(c){
    chip(c,c);
    if(manage){var rb=el("button","cc","✎");rb.setAttribute("aria-label","غيّر اسم القسم "+c);rb.onclick=function(){renameCat(c)};box.appendChild(rb)}
    var gd=S.cg.filter(function(g){return g.name===c})[0];
    if(gd&&!S.cat.some(function(i){return i.cat===c})){
      var x=el("button","cc"+(armedCat===c?" warn":""),armedCat===c?"احذف؟":"✕");x.setAttribute("aria-label","امسح قسم "+c+" الفاضي");
      x.onclick=function(){if(armedCat!==c){armedCat=c;drawCats();return}armedCat="";rm("cg",gd.id);if(curCat===c)curCat="";drawCats();draw()};
      box.appendChild(x);
    }
  });
  if(newMode){
    var inp=el("input","nc");inp.placeholder="اسم القسم";inp.setAttribute("aria-label","اسم القسم الجديد");inp.value=newVal;inp.oninput=function(){newVal=inp.value};
    var ok=function(){var v=inp.value.trim();if(v){var k=norm(v),ex=cats().filter(function(c){return norm(c)===k})[0];if(!ex){addCat(v);say("اتضاف قسم «"+v+"».")}curCat=ex||v}newMode=false;newVal="";drawCats();$("in").focus()};
    inp.addEventListener("keydown",function(e){if(e.key==="Enter")ok()});
    var g=el("button","cc sel","تم");g.onclick=ok;box.appendChild(inp);box.appendChild(g);if(had||needFocus){needFocus=false;setTimeout(function(){inp.focus()},0)}
  }else{var n=el("button","cc","+ قسم جديد");n.onclick=function(){newMode=true;needFocus=true;drawCats()};box.appendChild(n)}
}
function hue(t){var h=0;for(var i=0;i<t.length;i++)h=(h*31+t.charCodeAt(i))%360;return h}
function imgOf(id){var c=S.cat.filter(function(x){return x.id===id})[0];return(c&&c.img)||""}
function tile(o){
  var hx=!!(o.corner||o.edit||o.gear);
  var t=el("div","tile"+(o.cls?" "+o.cls:""));t.style.setProperty("--h",hue(o.name));
  var m=el("button","tmain");m.onclick=o.on;
  var letter=Array.from(o.name)[0]||"•",av=el("span","av"+(o.img&&!o.done?" has loading":""));
  if(o.img&&!o.done){var im=el("img");im.alt="";im.loading="lazy";im.onload=function(){av.classList.remove("loading")};im.onerror=function(){av.className="av";av.textContent=letter};im.src=o.img;av.appendChild(im)}
  else av.textContent=o.done?"✓":letter;
  m.appendChild(av);
  var tx=el("span","ttx"),tn=el("span","tn",o.name);if(o.qty>1)tn.appendChild(el("span","qty"," ×"+o.qty));tx.appendChild(tn);
  if(o.note)tx.appendChild(el("span","nt",o.note));
  m.appendChild(tx);
  if(o.sub)m.appendChild(el("span","tmeta "+(o.subc||"ts"),o.sub));
  t.appendChild(m);
  if(hx){
    var a=el("div","tact"),btn=function(txt,lab,fn){var b=el("button",null,txt);b.setAttribute("aria-label",lab);b.onclick=fn;a.appendChild(b)};
    if(o.edit)btn("✎","كمية وملاحظة",o.edit);
    if(o.corner)btn(o.corner.t,o.corner.l,o.corner.f);
    if(o.gear)btn("⚙","تعديل الحاجة",o.gear);
    t.appendChild(a);
  }
  return t;
}
function tiles(box,list,mkTile,multi){
  groups(list).forEach(function(gr){
    if(multi)box.appendChild(el("div","gt",gr.c||"بدون قسم"));
    var g=el("div","grid");gr.g.forEach(function(i){g.appendChild(mkTile(i))});box.appendChild(g);
  });
}
function drawVisit(){
  drawMeta();
  var cur=S.cur,multi=cats().length>0;
  var pend=cur.filter(function(i){return !i.done&&!i.na}),nal=cur.filter(function(i){return i.na&&!i.done}),dl2=cur.filter(function(i){return i.done});
  $("vcnt").textContent=cur.length?dl2.length+" من "+cur.length+" اتجابت"+(nal.length?" · "+nal.length+" مش لاقياها":""):"";
  $("barf").style.width=(cur.length?dl2.length/cur.length*100:0)+"%";
  var vl=$("vl");vl.innerHTML="";
  var mt=function(o){return tile({name:o.name,img:imgOf(o.id),qty:o.qty,note:o.note,done:o.done,cls:o.done?"done":(o.na?"na":""),sub:o.done?"شكرا يا ماما 💛"+(o.at?" · "+fmtT(o.at):""):(o.na?"مش موجودة ⚠":""),subc:o.done?"tk":"ts",on:function(){tick(o)},edit:function(){openSheet(o)},corner:{t:"✕",l:"شيل من الزيارة",f:function(){rmCur(o)}}})};
  if(!cur.length)vl.appendChild(el("div","empty","الزيارة فاضية. اختار من الترشيحات أو القائمة، أو اكتب حاجة فوق."));
  else if(!pend.length&&!nal.length)vl.appendChild(el("div","empty","كل الحاجات اتجابت. شكرا يا ماما 💛"));
  else if(!pend.length)vl.appendChild(el("div","empty","مفيش حاجة فاضلة غير اللي مش موجودة."));
  tiles(vl,pend,mt,multi);
  if(nal.length){vl.appendChild(el("div","dh na","مش لاقياها ("+nal.length+")"));tiles(vl,nal,mt,multi)}
  if(dl2.length){
    var hd=el("button","dh",(showDone?"▾ ":"◂ ")+"اتجابت ("+dl2.length+")");
    hd.onclick=function(){showDone=!showDone;draw()};
    vl.appendChild(hd);
    if(showDone)tiles(vl,dl2,mt,multi);
  }
  var ids={};cur.forEach(function(o){ids[o.id]=1});
  var sg=suggest(S.cat,S.vis,ids,Date.now()),sb=$("sug");sb.innerHTML="";
  $("sugNote").textContent=S.vis.length<2?"بتظهر أدق بعد كام زيارة":"";
  if(!sg.length)sb.appendChild(el("div","empty",S.vis.length<2?"لسه مفيش سجل كفاية. بعد زيارتين تلاتة هتظهر هنا حاجات محتمل تحتاجها.":"مفيش ترشيحات دلوقتي."));
  var sgrid=el("div","grid");
  sg.forEach(function(s){
    var go=function(){addToVisit(s.ci);draw()};
    sgrid.appendChild(tile({name:s.ci.name,img:s.ci.img,note:s.ci.note,sub:s.why,subc:"ts why",cls:"sg",on:go,corner:{t:"+",l:"أضف للزيارة",f:go}}));
  });
  if(sg.length)sb.appendChild(sgrid);
  var box=$("catBox");box.innerHTML="";
  $("mg").textContent=manage?"تم":"تعديل القائمة";
  if(!S.cat.length)box.appendChild(el("div","empty","القائمة فاضية. أي حاجة تكتبها فوق بتتحفظ هنا."));
  tiles(box,S.cat,function(ci){
    var o=inCur(ci.id);
    return tile({name:ci.name,img:ci.img,note:ci.note,cls:o?(o.done?"done":(o.na?"na":"in")):"",done:o&&o.done,sub:o?(o.done?"اتجابت 💛":(o.na?"مش موجودة ⚠":"في الزيارة ✓")):(ci.pin?"★ أساسي":""),on:function(){if(manage){openItem(ci);return}if(!o)addToVisit(ci);else if(!o.done)rmCur(o);draw()},gear:manage?function(){openItem(ci)}:null});
  },multi);
}
function fmt(ts){var d=new Date(ts);return d.toLocaleDateString("ar-EG",{weekday:"long",day:"numeric",month:"long"})+" - "+d.toLocaleTimeString("ar-EG",{hour:"numeric",minute:"2-digit"})}
function names(a){return a.map(function(x){return x.name+(x.qty>1?" ×"+x.qty:"")+(x.cat?" ("+x.cat+")":"")}).join("، ")}
function drawHist(){
  var h=$("hl");h.innerHTML="";
  var vs=S.vis.slice().sort(function(a,b){return b.ts-a.ts});
  if(!vs.length)h.appendChild(el("div","empty","لسه مفيش زيارات متسجلة."));
  vs.forEach(function(v){
    var c=el("div","vc");c.appendChild(el("b",null,fmt(v.ts)));
    c.appendChild(el("div","ok","اتجاب ("+v.bought.length+"): "+names(v.bought)));
    if(v.na&&v.na.length)c.appendChild(el("div",null,"مكانتش موجودة ("+v.na.length+"): "+names(v.na)));
    if(v.left&&v.left.length)c.appendChild(el("div",null,"فضل ("+v.left.length+"): "+names(v.left)));
    var ats=v.bought.map(function(x){return x.at}).filter(Boolean).sort();
    if(ats.length)c.appendChild(el("div",null,ats[0]===ats[ats.length-1]?"اتعلّمت الساعة "+fmtT(ats[0]):"اتعلّمت من "+fmtT(ats[0])+" لحد "+fmtT(ats[ats.length-1])));
    c.appendChild(el("div","ok","شكرا يا ماما 💛"));
    h.appendChild(c);
  });
}
function draw(){
  ["visit","thanks","hist","setup"].forEach(function(v){$("v"+v[0].toUpperCase()+v.slice(1)).hidden=(v!==view)});
  $("addRow").className="add"+(canWrite?"":" off");$("cats").className="cats"+(canWrite?"":" off");
  $("undoFin").hidden=!lastFin;
  var lb=lget("-lastbk",0);$("bkinfo").textContent=lb?"آخر نسخة احتياطية: "+fmt(lb):"لسه معملتش نسخة احتياطية.";
  if(view==="visit"){drawVisit();drawCats()}else if(view==="hist")drawHist();
}
function go(v){if(v!=="thanks")lastFin=null;view=v;draw();window.scrollTo(0,0)}
document.querySelectorAll("[data-go]").forEach(function(b){b.onclick=function(){go(b.getAttribute("data-go"))}});
$("addBtn").onclick=add;
$("in").addEventListener("keydown",function(e){if(e.key==="Enter")add()});
$("hist").onclick=function(){go("hist")};
$("mg").onclick=function(){manage=!manage;armed="";draw()};
$("finish").onclick=function(){
  if(!canWrite)return;
  var b=S.cur.filter(function(i){return i.done});
  if(!b.length){say("علّموا على حاجة واحدة على الأقل قبل ما تخلصوا الزيارة.");return}
  var left=S.cur.filter(function(i){return !i.done}),nal=left.filter(function(i){return i.na});
  var vid=uid("v");
  save("vis",{id:vid,ts:Date.now(),bought:b.map(mk),left:left.map(mk),na:nal.map(mk)});
  setVMeta({ready:false,date:""});
  lastFin={vid:vid,bought:b.map(function(i){return Object.assign({},i)}),nals:nal.map(function(i){return Object.assign({},i)})};
  b.forEach(function(i){rm("cur",i.id)});
  nal.forEach(function(i){i.na=false;save("cur",i)});
  $("thx").textContent="اتسجلت الزيارة: "+b.length+" حاجة اتجابت"+(left.length?"، و"+left.length+" فاضلين للزيارة الجاية"+(nal.length?" (منهم "+nal.length+" مكانوش موجودين)":"")+".":".");
  go("thanks");
};
$("undoFin").onclick=function(){
  if(!lastFin||!canWrite)return;
  var f=lastFin;lastFin=null;
  f.bought.forEach(function(c){save("cur",c)});f.nals.forEach(function(c){save("cur",c)});
  rm("vis",f.vid);go("visit");say("اتلغت الزيارة ورجعت الحاجات.");
};
function listText(){
  var p=S.cur.filter(function(i){return !i.done&&!i.na});
  return groups(p).map(function(gr){return(cats().length?(gr.c||"بدون قسم")+":\n":"")+gr.g.map(function(i){return"- "+i.name+(i.qty>1?" ×"+i.qty:"")+(i.note?" ("+i.note+")":"")}).join("\n")}).join("\n\n");
}
function copyText(t,msg){
  var ok=function(){toast("تم النسخ ✓");};
  var fb=function(){var a=document.createElement("textarea");a.value=t;document.body.appendChild(a);a.select();try{document.execCommand("copy");ok()}catch(e){say("مقدرتش أنسخ، حددها يدوي.")}document.body.removeChild(a)};
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(t).then(ok,fb);else fb();
}
$("copy").onclick=function(){var t=listText();if(!t){say("مفيش حاجة محتاجة تتطلب.");return}copyText(t,"اتنسخت الزيارة.")};
$("wa").onclick=function(){
  var t=listText();if(!t){say("مفيش حاجة محتاجة تتطلب.");return}
  var full="طلبات الزيارة"+(V.date?" ("+fmtDate(V.date)+")":"")+":\n\n"+t;
  if(navigator.share){
    navigator.share({title:"طلبات الزيارة",text:full}).catch(function(){
      try{var w=window.open("https://wa.me/?text="+encodeURIComponent(full),"_blank");if(!w)copyText(full,"مقدرتش أفتح واتساب، اتنسخت القائمة.")}catch(e){copyText(full,"مقدرتش أفتح واتساب، اتنسخت القائمة.")}
    });
    return;
  }
  var w=null;
  try{w=window.open("https://wa.me/?text="+encodeURIComponent(full),"_blank")}catch(e){}
  if(!w)copyText(full,"مقدرتش أفتح واتساب، اتنسخت القائمة والصقها هناك.");
};
function openRename(t,v,fn){$("rnt").textContent=t;$("rni").value=v;rnFn=fn;$("rn").hidden=false;setTimeout(function(){$("rni").focus()},0)}
function closeRn(){$("rn").hidden=true;rnFn=null}
$("rns").onclick=function(){var v=str($("rni").value.trim(),60),f=rnFn;if(!v){say("اكتب اسم.");return}closeRn();if(f)f(v)};
$("rnc").onclick=closeRn;
$("rn").onclick=function(e){if(e.target===this)closeRn()};
$("rni").addEventListener("keydown",function(e){if(e.key==="Enter")$("rns").onclick()});
function renameItem(ci){openRename("اسم الحاجة",ci.name,function(v){
  var ex=fc(v);if(ex&&ex.id!==ci.id){say("فيه حاجة بنفس الاسم.");return}
  ci.name=v;save("cat",ci);var o=inCur(ci.id);if(o){o.name=v;save("cur",o)}draw();say("اتغير الاسم.");
})}
function renameCat(c){openRename("اسم القسم",c,function(v){
  var ex=cats().filter(function(n){return norm(n)===norm(v)&&n!==c})[0];if(ex){say("فيه قسم بنفس الاسم.");return}
  S.cat.filter(function(i){return i.cat===c}).forEach(function(i){i.cat=v;save("cat",i)});
  S.cur.filter(function(i){return i.cat===c}).forEach(function(i){i.cat=v;save("cur",i)});
  var gd=S.cg.filter(function(g){return g.name===c})[0],ts=gd?gd.ts:Date.now();
  if(gd)rm("cg",gd.id);save("cg",{id:gid(v),name:v,ts:ts});
  if(curCat===c)curCat=v;draw();say("اتغير اسم القسم.");
})}
function openSheet(o){sheetO=o;sheetQ=o.qty||1;$("shn").textContent=o.name;$("qv").textContent=sheetQ;$("shnote").value=o.note||"";$("shna").textContent=o.na?"لقيتها":"مش لاقياها";$("sheet").hidden=false}
function closeSheet(){$("sheet").hidden=true;sheetO=null}
function applySheet(){
  var o=sheetO;if(!o)return;
  o.qty=sheetQ;o.note=str($("shnote").value.trim(),120);
  var ci=S.cat.filter(function(x){return x.id===o.id})[0];
  if(ci&&(ci.note||"")!==o.note){ci.note=o.note;save("cat",ci)}
}
$("qm").onclick=function(){sheetQ=Math.max(1,sheetQ-1);$("qv").textContent=sheetQ};
$("qp").onclick=function(){sheetQ=Math.min(99,sheetQ+1);$("qv").textContent=sheetQ};
$("shsave").onclick=function(){applySheet();if(sheetO)save("cur",sheetO);closeSheet();draw()};
$("shna").onclick=function(){applySheet();var o=sheetO;if(o){o.na=!o.na;if(o.na)o.done=false;save("cur",o)}closeSheet();draw()};
$("shcancel").onclick=closeSheet;
$("sheet").onclick=function(e){if(e.target===this)closeSheet()};
function drawAc(){
  var box=$("acl");box.innerHTML="";
  var q=norm($("in").value);if(!q||!canWrite)return;
  S.cat.filter(function(i){return norm(i.name).indexOf(q)>=0}).slice(0,6).forEach(function(ci){
    var o=inCur(ci.id),b=el("button",null,ci.name);
    b.appendChild(el("span","why",o?"في الزيارة ✓":"+ أضف للزيارة"));
    b.onclick=function(){if(!o)addToVisit(ci);$("in").value="";drawAc();draw();say(o?"«"+ci.name+"» في الزيارة بالفعل.":"اتضافت «"+ci.name+"» للزيارة.")};
    box.appendChild(b);
  });
}
$("in").addEventListener("input",drawAc);
function shrink(file){
  var out=function(src,w,h){
    var m=320,r=Math.min(1,m/Math.max(w,h));
    var c=document.createElement("canvas");
    c.width=Math.max(1,Math.round(w*r));c.height=Math.max(1,Math.round(h*r));
    var ctx=c.getContext("2d");
    ctx.drawImage(src,0,0,c.width,c.height);
    return c.toDataURL("image/jpeg",0.72);
  };
  var viaBitmap=function(){
    return createImageBitmap(file).then(function(bm){
      try{return out(bm,bm.width,bm.height)}finally{if(bm.close)bm.close()}
    });
  };
  var viaReader=function(){
    return new Promise(function(res,rej){
      var fr=new FileReader();
      fr.onload=function(){
        var im=new Image();
        im.onload=function(){res(out(im,im.width,im.height))};
        im.onerror=function(){rej(new Error("image"))};
        im.src=fr.result;
      };
      fr.onerror=function(){rej(new Error("read"))};
      fr.readAsDataURL(file);
    });
  };
  if(window.createImageBitmap){
    return viaBitmap().catch(function(){return viaReader()});
  }
  return viaReader();
}
$("phf").onchange=async function(){
  var f=this.files&&this.files[0],ci=phT;this.value="";if(!f||!ci)return;
  try{
    var url=await shrink(f);
    if(url.length>250000){say("الصورة كبيرة، جرّب صورة تانية.");return}
    ci.img=url;save("cat",ci);if(itemO===ci)prevItem();draw();say("اتحطت الصورة لـ «"+ci.name+"».");
  }catch(e){say("مقدرتش أجهّز الصورة. جرّبي صورة JPG أو PNG (مش HEIC).")}
};
function prevItem(){var p=$("iprev");p.innerHTML="";if(itemO&&itemO.img){var im=el("img");im.alt="";im.src=itemO.img;p.appendChild(im)}$("iphx").hidden=!(itemO&&itemO.img)}
function openItem(ci){
  itemO=ci;itemPin=!!ci.pin;itemDel=false;$("inm").value=ci.name;
  var sl=$("icat");sl.innerHTML="";
  [""].concat(cats()).forEach(function(v){var op=el("option",null,v||"بدون قسم");op.value=v;if((ci.cat||"")===v)op.selected=true;sl.appendChild(op)});
  $("ipin").textContent=itemPin?"★ أساسي":"☆ مش أساسي";
  $("idel").textContent="حذف الحاجة";$("idel").classList.remove("warn");
  prevItem();$("isheet").hidden=false;
}
function closeItem(){$("isheet").hidden=true;itemO=null;itemDel=false}
$("ipin").onclick=function(){itemPin=!itemPin;this.textContent=itemPin?"★ أساسي":"☆ مش أساسي"};
$("iph").onclick=function(){phT=itemO;$("phf").click()};
$("iphx").onclick=function(){if(!itemO)return;itemO.img="";save("cat",itemO);prevItem();draw()};
$("iclose").onclick=closeItem;
$("isheet").onclick=function(e){if(e.target===this)closeItem()};
$("idel").onclick=function(){
  var b=this;
  if(!itemDel){itemDel=true;b.textContent="اضغط تاني للحذف";b.classList.add("warn");return}
  var ci=itemO,o=inCur(ci.id),cc=Object.assign({},ci),oc=o?Object.assign({},o):null;
  rm("cat",ci.id);if(o)rm("cur",ci.id);closeItem();draw();
  toast("اتحذفت «"+cc.name+"» من القائمة.",function(){save("cat",cc);if(oc)save("cur",oc);draw()});
};
$("isave").onclick=function(){
  var ci=itemO;if(!ci)return;
  var v=str($("inm").value.trim(),60);if(!v){say("اكتب اسم الحاجة.");return}
  var ex=fc(v);if(ex&&ex.id!==ci.id){say("فيه حاجة بنفس الاسم.");return}
  ci.name=v;ci.cat=$("icat").value;ci.pin=itemPin;save("cat",ci);
  var o=inCur(ci.id);if(o){o.name=v;o.cat=ci.cat;save("cur",o)}
  closeItem();draw();say("اتحفظت التعديلات.");
};
function hideLoader(){var l=$("bootLoader");if(l){l.classList.add("hide");setTimeout(function(){l.remove()},300)}}
function setMode(t){$("mode").textContent=t}
function str(x,n){return String(x==null?"":x).slice(0,n||200)}
function pairs(a){return(Array.isArray(a)?a:[]).slice(0,500).map(function(x){return{name:str(x&&x.name),cat:str(x&&x.cat),qty:Math.min(99,Math.max(1,Number(x&&x.qty)||1)),note:str(x&&x.note,120),at:Number(x&&x.at)||0}}).filter(function(x){return x.name})}
function restoreFrom(d){
  var n=0,now=Date.now();
  var has=function(c,id){return S[c].some(function(x){return x.id===id})};
  (Array.isArray(d.cg)?d.cg:[]).slice(0,2000).forEach(function(g){var id=str(g&&g.id,60),nm=str(g&&g.name);if(id&&nm&&!has("cg",id)&&!S.cg.some(function(x){return norm(x.name)===norm(nm)})){save("cg",{id:id,name:nm,ts:Number(g.ts)||now});n++}});
  (Array.isArray(d.cat)?d.cat:[]).slice(0,5000).forEach(function(i){var id=str(i&&i.id,60),nm=str(i&&i.name);if(id&&nm&&!has("cat",id)&&!fc(nm)){save("cat",{id:id,name:nm,cat:str(i.cat),pin:!!i.pin,img:(typeof i.img==="string"&&i.img.indexOf("data:image/")===0&&i.img.length<250000)?i.img:"",note:str(i.note,120)});n++}});
  (Array.isArray(d.cur)?d.cur:[]).slice(0,5000).forEach(function(i){var id=str(i&&i.id,60),nm=str(i&&i.name);if(id&&nm&&!has("cur",id)){save("cur",{id:id,name:nm,cat:str(i.cat),note:str(i.note,120),qty:Math.min(99,Math.max(1,Number(i.qty)||1)),done:!!i.done,na:!!i.na,ts:Number(i.ts)||now,at:Number(i.at)||0});n++}});
  (Array.isArray(d.vis)?d.vis:[]).slice(0,2000).forEach(function(v){var id=str(v&&v.id,60);if(id&&!has("vis",id)&&Number(v.ts)){save("vis",{id:id,ts:Number(v.ts),bought:pairs(v.bought),left:pairs(v.left),na:pairs(v.na)});n++}});
  ensureCats();
  return n;
}
$("bk").onclick=function(){
  try{
    var data=JSON.stringify({v:1,ts:Date.now(),cat:S.cat,cur:S.cur,vis:S.vis,cg:S.cg,vm:V});
    var b=new Blob([data],{type:"application/json"}),a=document.createElement("a");
    a.href=URL.createObjectURL(b);a.download="visits-backup-"+new Date().toISOString().slice(0,10)+".json";
    document.body.appendChild(a);a.click();document.body.removeChild(a);
    setTimeout(function(){URL.revokeObjectURL(a.href)},3000);
    lset("-lastbk",Date.now());say("اتحفظت النسخة الاحتياطية.");draw();
  }catch(e){say("مقدرتش أحفظ النسخة.")}
};
$("rs").onclick=function(){if(canWrite)$("rsf").click()};
$("rsf").onchange=function(){
  var f=this.files&&this.files[0];this.value="";if(!f)return;
  if(f.size>20*1024*1024){say("الملف كبير أوي.");return}
  var r=new FileReader();
  r.onload=function(){
    try{var d=JSON.parse(r.result);if(!d||typeof d!=="object"||Array.isArray(d))throw 0;var n=restoreFrom(d);draw();say(n?"اتسترجع "+n+" عنصر ناقص. مفيش حاجة اتمسحت ولا اتغيرت.":"مفيش حاجة ناقصة، كله موجود بالفعل.")}
    catch(e){say("الملف ده مش نسخة احتياطية صالحة.")}
  };
  r.onerror=function(){say("مقدرتش أقرأ الملف.")};
  r.readAsText(f);
};
function makeDb(fs,code){
  var base=["spaces",code];
  var wrap=function(ref){return{
    set:function(d){return fset(ref,d)},
    delete:function(){return fdel(ref)},
    get:function(){return fget(ref).then(function(x){return{exists:x.exists(),data:function(){return x.data()}}})},
    onSnapshot:function(cb,err){return fsnap(ref,function(x){cb({exists:x.exists(),data:function(){return x.data()}})},err)}
  }};
  return{
    collection:function(n){
      var cr=fcol.apply(null,[fs].concat(base,[n]));
      var snap=function(q){return{onSnapshot:function(cb,err){return fsnap(q,function(x){cb({docs:x.docs.map(function(d){return{id:d.id,data:function(){return d.data()}}})})},err)}}};
      var o=snap(cr);
      o.doc=function(id){return wrap(fdoc(cr,id))};
      o.orderBy=function(f,dir){return{limit:function(k){return snap(fquery(cr,forder(f,dir),flimit(k)))}}};
      return o;
    },
    doc:function(p){return wrap(fdoc.apply(null,[fs].concat(base,p.split("/"))))}
  };
}
function netMode(){setMode(navigator.onLine?"متصل ✓ مشترك مع ماما، أي تعديل بيظهر عند الكل.":"مفيش نت دلوقتي. التعديلات هتتبعت أول ما النت يرجع.")}
window.addEventListener("online",netMode);window.addEventListener("offline",netMode);
function isIOS(){return /iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1)}
function isStandalone(){return window.matchMedia("(display-mode: standalone)").matches||window.navigator.standalone===true}
window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();deferredInstall=e;$("inst").hidden=false});
$("inst").onclick=function(){if(deferredInstall){deferredInstall.prompt();deferredInstall=null;$("inst").hidden=true}};
if(isIOS()&&!isStandalone()){var tip=$("iosTip");if(tip)tip.hidden=false}
if(isStandalone()){var ti=$("inst");if(ti)ti.hidden=true;var tp=$("iosTip");if(tp)tp.hidden=true}

function spaceEmail(){return "space_"+CODE+"@visit-app-mama.local"}
function showSpaceGate(auth){
  var g=$("spaceGate"),inp=$("spacePass"),msg=$("spaceMsg");if(!g)return;
  g.hidden=false;inp.value="";msg.textContent="";
  $("spaceJoin").onclick=async function(){
    var p=inp.value.trim();if(p.length<6){msg.textContent="كلمة السر لازم تكون 6 حروف أو أرقام على الأقل.";return}
    msg.textContent="بنفتح المساحة…";
    try{await signInWithEmailAndPassword(auth,spaceEmail(),p);g.hidden=true;location.reload()}
    catch(e){msg.textContent="كلمة السر مش صحيحة أو المساحة لسه محتاجة تعيين كلمة سر."}
  };
  $("spaceSet").onclick=async function(){
    var p=inp.value.trim();if(p.length<6){msg.textContent="كلمة السر لازم تكون 6 حروف أو أرقام على الأقل.";return}
    msg.textContent="بنثبت كلمة السر…";
    try{
      var u=auth.currentUser;
      if(u&&u.isAnonymous){await linkWithCredential(u,EmailAuthProvider.credential(spaceEmail(),p));g.hidden=true;location.reload()}
      else{await createUserWithEmailAndPassword(auth,spaceEmail(),p);g.hidden=true;location.reload()}
    }catch(e){
      if(e&&e.code==="auth/email-already-in-use"){msg.textContent="المساحة ليها كلمة سر بالفعل. استخدم «فتح المساحة»."}
      else if(e&&e.code==="auth/operation-not-allowed")msg.textContent="تسجيل الدخول بكلمة سر مش مفعّل للمساحة لسه.";
      else msg.textContent="تعذر تعيين كلمة السر. جرّب كلمة مختلفة.";
    }
  };
}
function newCode(){var a=new Uint8Array(24);crypto.getRandomValues(a);return Array.from(a,function(b){return b.toString(36).padStart(2,"0")}).join("").slice(0,36)}
function codeFrom(t){t=String(t||"").trim();var m=t.match(/c=([A-Za-z0-9_-]{20,})/)||t.match(/^([A-Za-z0-9_-]{20,})$/);return m?m[1]:""}
function shareLink(){return location.origin+location.pathname.replace(/index\.html$/,"")+"#c="+CODE}
$("codeGo").onclick=function(){var c=codeFrom($("code").value);if(!c){$("smsg").textContent="الرابط أو الكود مش صحيح.";return}lset("-code",c);location.reload()};
$("codeNew").onclick=function(){lset("-code",newCode());location.reload()};
$("shareWa").onclick=function(){
  var link=shareLink();
  var t="افتحي الرابط ده مرة واحدة من المتصفح، وبعدين ثبّتي التطبيق:\n• آيفون (Safari): مشاركة □↑ ← إضافة إلى الشاشة الرئيسية\n• أندرويد (Chrome): القايمة ⋮ ← تثبيت التطبيق\n\n"+link;
  if(navigator.share){
    navigator.share({title:"تجهيز الزيارة",text:t,url:link}).catch(function(){
      try{var w=window.open("https://wa.me/?text="+encodeURIComponent(t),"_blank");if(!w)copyText(t,"اتنسخ الرابط، الصقه في واتساب.")}catch(e){copyText(t,"اتنسخ الرابط، الصقه في واتساب.")}
    });
    return;
  }
  var w=null;
  try{w=window.open("https://wa.me/?text="+encodeURIComponent(t),"_blank")}catch(e){}
  if(!w)copyText(t,"اتنسخ الرابط، الصقه في واتساب.");
};
$("shareCp").onclick=function(){copyText(shareLink(),"اتنسخ رابط الدعوة ✓");};
var lvT;
$("leave").onclick=function(){
  var b=this;
  if(!b.armed){b.armed=true;b.textContent="اضغط تاني للتأكيد (الداتا مش هتتمسح)";b.classList.add("warn");clearTimeout(lvT);lvT=setTimeout(function(){b.armed=false;b.textContent="خروج من المساحة على الجهاز ده";b.classList.remove("warn")},4000);return}
  lset("-code","");location.reload();
};
async function autoImageForCatalog(){
  if(window.__autoImagesBusy||!Array.isArray(S.cat)||!S.cat.length)return;
  var missing=S.cat.filter(function(i){return i&&!i.img&&i.name});
  if(!missing.length)return;
  window.__autoImagesBusy=true;
  var sync=$("syncLoader");if(sync){sync.hidden=false;sync.querySelector("span").textContent="بنجهّز صور المنتجات…"}
  var norm=function(s){return String(s||"").toLowerCase().replace(/[^\\p{L}\\p{N}]+/gu," ").trim().split(/\\s+/).filter(Boolean)};
  var score=function(a,b){
    var x=norm(a),y=norm(b),set={};x.forEach(function(t){set[t]=1});
    var hit=y.filter(function(t){return set[t]}).length;
    return hit/Math.max(1,Math.min(x.length,y.length));
  };
  var aliases={
    "مانجو":["mango","mango fruit","fresh mango"],
    "قرنفل":["clove","cloves","clove spice"],
    "قراقيش":["qarqeesh","qarqish","egyptian crackers","crackers","sesame crackers"],
    "كوبايات تيليو بن بنادول ديكانست":["Tchibo coffee cups","coffee cups","mug","Panadol Decongestant","Panadol Cold and Flu"],
    "كوبايات تيليو بنادول ديكانست":["Tchibo coffee cups","coffee cups","mug","Panadol Decongestant","Panadol Cold and Flu"],
    "بنادول ديكانست":["Panadol Decongestant","Panadol Cold and Flu","Panadol Decongestant tablets"],
    "بنادول ديكونجست":["Panadol Decongestant","Panadol Cold and Flu","Panadol Decongestant tablets"],
    "كوبايات بن تيليو ديكانست":["Tchibo Cafissimo Decaf","Tchibo Cafissimo Decaffeinated","Tchibo Decaf coffee capsules","Tchibo decaf"],
    "كوبايات بن تيليو ديكاف":["Tchibo Cafissimo Decaf","Tchibo Cafissimo Decaffeinated","Tchibo Decaf coffee capsules","Tchibo decaf"],
    "بن تيليو ديكانست":["Tchibo Cafissimo Decaf","Tchibo Cafissimo Decaffeinated","Tchibo Decaf coffee capsules","Tchibo decaf"],
    "بن تيليو ديكاف":["Tchibo Cafissimo Decaf","Tchibo Cafissimo Decaffeinated","Tchibo Decaf coffee capsules","Tchibo decaf"],
    "كوبايات":["coffee cups","tea cups","mug"],
    "كوبايات قهوه":["coffee cups","tea cups","mug"],
    "كوبايات شاي":["tea cups","coffee cups","mug"]
  };
  var terms=function(name,cat){
    var a=[name],k=norm(name).join(" "),ck=norm(cat||"");
    if(aliases[k])a=a.concat(aliases[k]);
    if(/صيدليه|دواء|ادويه|medicine|pharmacy/.test(ck))a=a.concat(["pharmacy medicine","medicine tablets","medical products","pills"]);
    if(/مشروبات|قهوه|شاي|بن/.test(ck))a=a.concat(["coffee cup","coffee beans","tea cup"]);
    if(/ادوات منزليه|مطبخ|كوبايات|اكواب/.test(ck))a=a.concat(["coffee cup","tea cup","mug"]);

    return a.filter(function(v,i,x){return v&&x.indexOf(v)===i});
  };
  var toData=async function(url){
    try{
      var res=await fetch(url,{mode:"cors"});
      if(!res.ok)throw 0;
      var blob=await res.blob();
      var data=await shrink(blob);
      return data&&data.length<250000?data:"";
    }catch(e){return ""}
  };
  var findOFF=async function(name,cat){
    var ts=terms(name,cat);
    for(var z=0;z<ts.length;z++){
      try{
        var u="https://world.openfoodfacts.org/cgi/search.pl?search_terms="+encodeURIComponent(ts[z])+"&search_simple=1&action=process&json=1&page_size=8&fields=product_name,image_front_url,image_url";
        var j=await (await fetch(u,{mode:"cors"})).json();
        var ps=(j.products||[]).filter(function(p){return p&&(p.image_front_url||p.image_url)&&p.product_name});
        ps.sort(function(a,b){return score(ts[z],b.product_name)-score(ts[z],a.product_name)});
        var p=ps[0];
        if(p&&score(ts[z],p.product_name)>=0.5){
          var d=await toData(p.image_front_url||p.image_url);
          if(d)return d;
        }
      }catch(e){}
    }
    return "";
  };
  var findCommons=async function(name,cat){
    var ts=terms(name,cat);
    for(var z=0;z<ts.length;z++){
      try{
        var u="https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch="+encodeURIComponent(ts[z])+"&gsrnamespace=6&gsrlimit=5&prop=imageinfo&iiprop=url&iiurlwidth=320&format=json&origin=*";
        var j=await (await fetch(u,{mode:"cors"})).json();
        var pages=Object.values((j.query&&j.query.pages)||{});
        for(var p=0;p<pages.length;p++){
          var ii=pages[p].imageinfo&&pages[p].imageinfo[0];
          var url=ii&&(ii.thumburl||ii.url);
          if(url){
            var d=await toData(url);
            if(d)return d;
          }
        }
      }catch(e){}
    }
    return "";
  };
  for(var n=0;n<missing.length;n++){
    var ci=missing[n];
    if(sync)sync.querySelector("span").textContent="بنجهّز صورة "+(n+1)+" من "+missing.length+"…";
    var data=await findOFF(ci.name,ci.cat);
    if(!data)data=await findCommons(ci.name,ci.cat);
    if(data&&!ci.img){ci.img=data;save("cat",ci);draw()}
    await new Promise(function(r){setTimeout(r,350)});
  }
  window.__autoImagesBusy=false;
  if(sync)sync.hidden=true;
}
async function init(){
  var m=(location.hash||"").match(/c=([A-Za-z0-9_-]{20,})/);
  if(m){lset("-code",m[1]);try{history.replaceState(null,"",location.pathname)}catch(e){}}
  CODE=lget("-code","");V=lget("-vmeta",{});
  if("serviceWorker" in navigator){
    navigator.serviceWorker.register("./sw.js",{scope:"./"}).catch(function(){});
  }
  if(!CODE){go("setup");hideLoader();return}
  if(/PASTE_|YOUR_/.test(JSON.stringify(firebaseConfig))){setMode("ملف config.js لسه فاضي. اتبع خطوات README.");draw();hideLoader();return}
  var fs,auth;
  try{
    var app=initializeApp(firebaseConfig);
    try{
      fs=initializeFirestore(app,{localCache:persistentLocalCache({tabManager:persistentMultipleTabManager()})});
    }catch(cacheErr){
      fs=initializeFirestore(app);
    }
    auth=getAuth(app);
  }catch(e){setMode("مشكلة في إعداد Firebase: "+((e&&e.message)||e));draw();hideLoader();return}
  try{if(auth.authStateReady)await auth.authStateReady();if(!auth.currentUser)await signInAnonymously(auth)}
  catch(e){if(!auth.currentUser){setMode("محتاج نت أول مرة بس. اتصل بالنت وافتح التطبيق تاني.");draw();hideLoader();return}}
  if(auth.currentUser&&auth.currentUser.isAnonymous){showSpaceGate(auth);hideLoader();return}
  dbx=makeDb(fs,CODE);
  var onErr=function(){
    setMode("مشكلة في الاتصال بالداتا. اتأكد إن قواعد Firestore اتنشرت وإن Anonymous Auth متفعّل.");
    hideLoader();
    draw();
  };
  var sub=function(c,ref){
    ref.onSnapshot(function(sn){
      S[c]=sn.docs.map(function(d){return Object.assign({id:d.id},d.data())});
      got[c]=true;
      if(got.cat&&got.cg&&!ensured){ensured=true;ensureCats()}
      if(got.cat)autoImageForCatalog();
      if(got.cat&&got.cg&&got.cur&&got.vis)hideLoader();
      draw();
    },onErr);
  };
  dbx.doc("meta/visit").onSnapshot(function(d){V=d.exists?Object.assign({},d.data()):{};draw()},onErr);
  sub("cg",dbx.collection("categories"));sub("cat",dbx.collection("catalog"));sub("cur",dbx.collection("cur"));
  sub("vis",dbx.collection("visits").orderBy("ts","desc").limit(60));
  netMode();draw();
}
init();
