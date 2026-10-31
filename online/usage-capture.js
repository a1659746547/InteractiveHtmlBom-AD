// Anonymous counters only. Never send names, PCB data, BOM values, selections or chat.
(()=>{
 'use strict';
 const session=Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('');
 let seq=0,activeMs=0,parses=0,lastTick=performance.now(),lastAction=performance.now(),sending=false,lastSent=0;
 const boards=new WeakSet(),gerberDocuments=new WeakSet(),frame=document.getElementById('viewer');
 function action(event){if(event.isTrusted)lastAction=performance.now()}
 for(const name of ['pointerdown','pointermove','keydown','wheel','touchstart'])window.addEventListener(name,action,{capture:true,passive:true});
 const watched=new WeakSet();
 function observeFrame(){try{const doc=frame?.contentDocument;if(!doc||watched.has(doc))return;watched.add(doc);for(const name of ['pointerdown','pointermove','keydown','wheel','touchstart'])doc.addEventListener(name,action,{capture:true,passive:true})}catch{}}
 function countParsed(){
  if(!document.body.classList.contains('loaded'))return;
  try{const win=frame?.contentWindow,data=win?.pcbdata,doc=frame?.contentDocument;
   if(data?.bom&&data?.footprints){if(!boards.has(data)){boards.add(data);++parses;lastAction=performance.now();flush()}}
   else if(document.body.classList.contains('gerber-mode')&&doc?.querySelector('.layer-name')&&!gerberDocuments.has(doc)){gerberDocuments.add(doc);++parses;lastAction=performance.now();flush()}
  }catch{}
 }
 function tick(){const now=performance.now(),delta=now-lastTick;if(delta>0&&delta<=2500&&!document.hidden&&document.hasFocus()&&now-lastAction<60000)activeMs+=delta;lastTick=now;observeFrame();countParsed()}
 function payload(){return {session,seq:++seq,active_ms:Math.min(604800000,Math.floor(activeMs)),parses}}
 async function flush(beacon=false){
  if(sending&&!beacon)return;const body=JSON.stringify(payload());lastSent=performance.now();
  if(beacon){navigator.sendBeacon('/api/usage',new Blob([body],{type:'application/json'}));return}
  sending=true;try{await fetch('/api/usage',{method:'POST',headers:{'Content-Type':'application/json'},body,cache:'no-store',signal:AbortSignal.timeout(5000)})}catch{}finally{sending=false}
 }
 frame?.addEventListener('load',()=>{observeFrame();countParsed()});
 new MutationObserver(countParsed).observe(document.body,{attributes:true,attributeFilter:['class']});
 setInterval(()=>{tick();if(!document.hidden&&performance.now()-lastSent>=15000)flush()},1000);
 document.addEventListener('visibilitychange',()=>{tick();if(document.hidden)flush(true);else{lastTick=performance.now();flush()}});
 window.addEventListener('pagehide',()=>{tick();flush(true)});
 observeFrame();countParsed();if(!document.hidden)flush();
})();
