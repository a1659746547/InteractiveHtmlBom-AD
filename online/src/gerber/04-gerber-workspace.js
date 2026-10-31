'use strict';
const $=id=>document.getElementById(id),C=GerberCore,canvas=$('canvas'),ctx=canvas.getContext('2d');
const kinds={copper:'铜层',mask:'阻焊',silk:'丝印',paste:'钢网',outline:'板框',drill:'钻孔',adhesive:'胶层',unknown:'未知层'};
const palette={copper:'#e6b45c',mask:'#319f97',silk:'#dde7f1',paste:'#8c9fdc',outline:'#e6edf5',drill:'#f16e93',unknown:'#a5a4bf',adhesive:'#b69bd2'};
let layers=[],active=null,tool='pan',world=[0,0,100,80],view={x:50,y:40,zoom:1},mirror=false,marks=[],pendingPoint=null,overlay=null,overlayBounds=null,busy=false,sequence=0,rasterEpoch=0,parseWorker=null,parserId=0;
const jobs=new Map();let firstImport=true;
function error(message){$('error').textContent=message;$('error').hidden=false;}
$('error').onclick=()=>{$('error').hidden=true};
function parser(){if(parseWorker)return parseWorker;const blob=new Blob([$('g-lib').textContent,'\n',$('g-core').textContent,'\n',$('g-worker').textContent],{type:'text/javascript'}),url=URL.createObjectURL(blob);parseWorker=new Worker(url);URL.revokeObjectURL(url);parseWorker.onmessage=e=>{const j=jobs.get(e.data.id);if(j){clearTimeout(j.timer);jobs.delete(e.data.id);e.data.error?j.reject(Error(e.data.error)):j.resolve(e.data)}};parseWorker.onerror=e=>{for(const j of jobs.values()){clearTimeout(j.timer);j.reject(Error(e.message||'解析进程异常'))}jobs.clear();parseWorker.terminate();parseWorker=null};return parseWorker;}
function parseFile(file){return file.text().then(text=>new Promise((resolve,reject)=>{const id=++parserId,w=parser(),timer=setTimeout(()=>{w.terminate();parseWorker=null;for(const j of jobs.values()){clearTimeout(j.timer);j.reject(Error('解析超过 30 秒，已停止'))}jobs.clear()},30000);jobs.set(id,{resolve,reject,timer});w.postMessage({id,name:file.name,text})}));}
async function unpack(files){let result=[],sum=0;for(const file of files){if(file.size>50*1024*1024)throw Error('单文件最大 50 MB');if(/\.zip$/i.test(file.name)){const bytes=new Uint8Array(await file.arrayBuffer());const entries=listGerberZip(bytes);for(const entry of entries){sum+=entry.size;if(sum>100*1024*1024||result.length>=128)throw Error('图层总大小超过 100 MB 或文件数超过 128');result.push(await extractZipBoard(bytes,entry));}}else{sum+=file.size;if(sum>100*1024*1024||result.length>=128)throw Error('图层总大小或文件数超限');result.push(file);}}return result;}
async function importFiles(files){if(busy||!files.length)return;busy=true;const token=++sequence;$('error').hidden=true;let results=[],failures=[];setBusy(true);
 try{files=await unpack(files);if(!files.length)throw Error('未找到 Gerber 或钻孔文件');for(let i=0;i<files.length;i++){$('operation').textContent=`正在解析 ${i+1}/${files.length} · ${files[i].name}`;try{const l=await parseFile(files[i]);l.key=l.id;l.visible=true;l.opacity=l.info.type==='mask'?.25:.85;l.color=l.info.type==='copper'&&l.info.side==='bottom'?'#6fa9dc':palette[l.info.type];results.push(l)}catch(e){failures.push(files[i].name+'：'+e.message)}}
 if(!results.length)throw Error(failures.join('\n')||'没有可绘制的图层');if(token!==sequence)return;
 layers=results;active=layers.find(l=>l.info.type==='copper')?.key||layers[0].key;marks=[];pendingPoint=null;$('board-title').textContent=files[0].name.replace(/[-_](?:[FB]_)?[^-_]+\.[^.]+$/,'')||files[0].name;
 world=C.union(layers);overlay=null;rasterEpoch++;$('empty').hidden=true;renderSidebar();fit();setTool('pan');
 if(failures.length)error('以下图层未加载：\n'+failures.join('\n'));$('operation').textContent=failures.length?`已加载 ${results.length} 层，${failures.length} 层未加载`:`已加载 ${results.length} 个文件`;
 }catch(e){error(e.message);$('operation').textContent='导入未完成'}finally{busy=false;setBusy(false);$('files').value='';if($('version-files'))$('version-files').value='';}}
function setBusy(v){for(const id of ['open','empty-open','demo'])$(id).disabled=v;}
function renderSidebar(){
 const copper=layers.filter(l=>l.info.type==='copper'),nums=new Set(copper.map(l=>l.info.number).filter(Boolean));
 $('layer-count').textContent=`${layers.length} 个图层 · ${copper.length} 个铜层`+(nums.size&&nums.size<copper.filter(l=>l.info.number).length?'（层号重复）':'');
 const list=$('layers'),scroll=list.scrollTop;list.replaceChildren();
 for(const l of layers){
  const row=document.createElement('div');row.className='layer'+(active===l.key?' active':'');
  const head=document.createElement('div');head.className='layer-head';
  const check=document.createElement('input');check.type='checkbox';check.checked=l.visible;check.setAttribute('aria-label','显示 '+l.name);check.onchange=()=>{l.visible=check.checked;draw()};
  const color=document.createElement('input');color.type='color';color.value=l.color;color.setAttribute('aria-label',l.name+' 颜色');color.oninput=()=>{l.color=color.value;draw()};
  const name=document.createElement('button');name.className='layer-name';name.textContent=l.name;name.title=l.name;name.dataset.layerKey=l.key;name.setAttribute('aria-pressed',String(active===l.key));
  name.onclick=()=>{active=l.key;overlay=null;rasterEpoch++;renderSidebar();draw();for(const button of list.querySelectorAll('.layer-name'))if(button.dataset.layerKey===String(active))button.focus({preventScroll:true})};
  const badge=document.createElement('span');badge.className='layer-badge';badge.textContent=l.info.type==='copper'&&l.info.number?'L'+l.info.number:kinds[l.info.type];badge.title=(l.info.side==='top'?'正面 · ':l.info.side==='bottom'?'背面 · ':'')+kinds[l.info.type];
  head.append(check,color,name,badge);row.append(head);list.append(row);
 }
 list.scrollTop=scroll;
 let settings=$('layer-settings');
 if(!settings){settings=document.createElement('section');settings.id='layer-settings';settings.setAttribute('aria-label','选中图层设置');list.after(settings);}
 settings.replaceChildren();const selected=layers.find(l=>l.key===active);settings.hidden=!selected;if(!selected)return;
 const caption=document.createElement('div');caption.className='layer-settings-caption';caption.textContent='当前图层';
 const label=document.createElement('div');label.className='layer-settings-name';label.textContent=selected.name;label.title=selected.name;
 const controls=document.createElement('div');controls.className='layer-settings-controls';
 const type=document.createElement('select');type.setAttribute('aria-label','当前图层类型');for(const [value,text] of Object.entries(kinds))type.add(new Option(text,value));type.value=selected.info.type;
 type.onchange=()=>{selected.info.type=type.value;overlay=null;rasterEpoch++;renderSidebar();draw()};
 const opacity=document.createElement('input');opacity.type='range';opacity.min=0;opacity.max=100;opacity.value=Math.round(selected.opacity*100);opacity.setAttribute('aria-label','当前图层透明度');
 const percent=document.createElement('output');percent.textContent=opacity.value+'%';
 opacity.oninput=()=>{selected.opacity=Number(opacity.value)/100;percent.textContent=opacity.value+'%';draw()};
 controls.append(type,opacity,percent);settings.append(caption,label,controls);
}

function size(){return {w:canvas.clientWidth,h:canvas.clientHeight};}
function fit(){const {w,h}=size();view={x:world[0]+world[2]/2,y:world[1]+world[3]/2,zoom:Math.min(w/(world[2]*1.15),h/(world[3]*1.15))};draw();}
function screen(p){const {w,h}=size();return [w/2+(p[0]-view.x)*view.zoom*(mirror?-1:1),h/2-(p[1]-view.y)*view.zoom];}
function board(x,y){const {w,h}=size();return [view.x+(x-w/2)/view.zoom*(mirror?-1:1),view.y-(y-h/2)/view.zoom];}
function layerSvg(l,bounds,dx=0,dy=0){const [x,y,w,h]=bounds;return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${x*1000} ${-(y+h)*1000} ${w*1000} ${h*1000}" width="${w}mm" height="${h}mm" color="white" stroke-linecap="round" stroke-linejoin="round" stroke-width="0"><defs>${l.defs}</defs><g transform="translate(${dx*1000},${-dy*1000}) scale(${l.scale},${-l.scale})" fill="currentColor" stroke="currentColor">${l.body}</g></svg>`;}
function image(svg){return new Promise((resolve,reject)=>{const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'})),i=new Image();i.onload=()=>{URL.revokeObjectURL(url);resolve(i)};i.onerror=()=>{URL.revokeObjectURL(url);reject(Error('图层渲染失败'))};i.src=url;});}
async function layerImage(l){if(!l.imagePromise||l.imageColor!==l.color){l.imageColor=l.color;l.imagePromise=image(layerSvg(l,l.bounds).replace('color="white"','color="'+l.color+'"'));}return l.imagePromise;}
let drawEpoch=0;
async function draw(){const epoch=++drawEpoch,{w,h}=size();if(!w||!h)return;const dpr=Math.min(devicePixelRatio||1,2);if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr)}ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
 // Keep sidebar order stable; paint the selected visible layer last.
 const visibleLayers=layers.filter(l=>l.visible&&l.bounds[2]>0&&l.bounds[3]>0);
 const drawLayers=[...visibleLayers.filter(l=>l.key!==active),...visibleLayers.filter(l=>l.key===active)];
 for(const l of drawLayers){try{const img=await layerImage(l);if(epoch!==drawEpoch)return;const [x,y,bw,bh]=l.bounds;const p=screen([x,y+bh]);ctx.save();ctx.globalAlpha=l.opacity;ctx.translate(p[0],p[1]);ctx.scale(mirror?-1:1,1);ctx.drawImage(img,0,0,bw*view.zoom,bh*view.zoom);ctx.restore();}catch(e){$('operation').textContent=e.message}}
 if(overlay&&overlayBounds){const [x,y,bw,bh]=overlayBounds,p=screen([x,y+bh]);ctx.save();ctx.translate(...p);ctx.scale(mirror?-1:1,1);ctx.imageSmoothingEnabled=false;ctx.drawImage(overlay,0,0,bw*view.zoom,bh*view.zoom);ctx.restore();}
 ctx.font='12px Segoe UI';for(const m of marks){const a=screen(m[0]),b=screen(m[1]);ctx.strokeStyle='#79e4ff';ctx.fillStyle='#b3f1ff';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();for(const p of [a,b]){ctx.beginPath();ctx.arc(...p,3,0,Math.PI*2);ctx.fill()}const d=Math.hypot(m[1][0]-m[0][0],m[1][1]-m[0][1]).toFixed(3)+' mm';const tw=ctx.measureText(d).width,tx=(a[0]+b[0])/2,ty=(a[1]+b[1])/2;ctx.fillStyle='#102033ee';ctx.fillRect(tx-4,ty-17,tw+8,21);ctx.fillStyle='#b3f1ff';ctx.fillText(d,tx,ty-2)}if(pendingPoint){const p=screen(pendingPoint);ctx.fillStyle='#79e4ff';ctx.beginPath();ctx.arc(...p,4,0,Math.PI*2);ctx.fill()}
 const mm=10**Math.floor(Math.log10(90/view.zoom));$('scale').textContent=mm+' mm';$('scale').style.width=Math.max(20,mm*view.zoom)+'px';
}
function setTool(t){tool=t;pendingPoint=null;overlay=null;rasterEpoch++;$('result').textContent='';for(const b of document.querySelectorAll('[data-tool]'))b.setAttribute('aria-pressed',String(b.dataset.tool===t));$('hint').textContent=({pan:'滚轮缩放 · 拖动平移 · 双指缩放',measure:'依次点击两点测距 · 拖动仍可平移',region:'依次点击区域两个对角点，放大到该范围',connect:'先在侧栏选择铜层，再点击铜线 · 仅同层采样连通'})[t];draw();}
async function raster(l,box,n,dx=0,dy=0){const step=Math.max(box[2],box[3])/n,w=Math.max(1,Math.ceil(box[2]/step)),h=Math.max(1,Math.ceil(box[3]/step));const c=document.createElement('canvas');c.width=w;c.height=h;const cctx=c.getContext('2d',{willReadFrequently:true});cctx.drawImage(await image(layerSvg(l,box,dx,dy)),0,0,w,h);const raw=cctx.getImageData(0,0,w,h).data,mask=new Uint8Array(w*h);for(let i=0;i<mask.length;i++)mask[i]=raw[i*4+3]>=128?1:0;return {mask,w,h,step};}
function maskCanvas(pixels,w,h){const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').putImageData(new ImageData(pixels,w,h),0,0);return c;}
async function highlight(p){const l=layers.find(l=>l.key===active);if(!l||l.info.type!=='copper'){error('请先在侧栏选中一个铜层');$('sidebar').classList.add('open');return;}const token=++rasterEpoch;$('operation').textContent='正在分析同层连通区域…';try{const r=await raster(l,world,2048),x=Math.floor((p[0]-world[0])/world[2]*r.w),y=Math.floor((world[1]+world[3]-p[1])/world[3]*r.h);if(token!==rasterEpoch)return;const out=C.flood(r.mask,r.w,r.h,x,y);if(!out.count){$('operation').textContent='未点中铜区域，请放大后点击';return;}const pixels=new Uint8ClampedArray(r.w*r.h*4);for(let i=0;i<out.mask.length;i++)if(out.mask[i])pixels.set([77,228,255,240],i*4);overlay=maskCanvas(pixels,r.w,r.h);overlayBounds=world.slice();$('result').textContent=`同层高亮 · 采样约 ${r.step.toFixed(4)} mm/像素 · 不含跨层连接`;$('operation').textContent=l.name;draw();}catch(e){error(e.message)}}
for(const b of document.querySelectorAll('[data-tool]'))b.onclick=()=>setTool(b.dataset.tool);
$('open').onclick=$('empty-open').onclick=()=>$('files').click();$('files').onchange=e=>importFiles([...e.target.files]);
for(const id of ['show-all','hide-all','copper-only'])$(id).onclick=()=>{overlay=null;rasterEpoch++;for(const l of layers)l.visible=id==='show-all'||id==='copper-only'&&l.info.type==='copper';renderSidebar();draw()};
$('fit').onclick=()=>{world=C.union(layers);fit();};$('zoom-in').onclick=()=>{view.zoom=Math.min(100000,view.zoom*1.4);draw()};$('zoom-out').onclick=()=>{view.zoom=Math.max(.001,view.zoom/1.4);draw()};$('mirror').onclick=()=>{mirror=!mirror;$('mirror').setAttribute('aria-pressed',String(mirror));draw()};$('clear').onclick=()=>{marks=[];pendingPoint=null;overlay=null;rasterEpoch++;$('result').textContent='';draw()};
$('help-toggle').onclick=()=>{document.querySelector('.help').open=!document.querySelector('.help').open};
$('layers-toggle').onclick=()=>$('sidebar').classList.toggle('open');$('close-layers').onclick=()=>$('sidebar').classList.remove('open');
let points=new Map(),drag=null,pinch=null;
function local(e){const r=canvas.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top]}
canvas.onpointerdown=e=>{if(e.button!==0)return;canvas.setPointerCapture(e.pointerId);const p=local(e);points.set(e.pointerId,p);drag={p,last:p,moved:false};if(points.size===2){const a=[...points.values()];pinch={distance:Math.hypot(a[1][0]-a[0][0],a[1][1]-a[0][1]),zoom:view.zoom};drag.moved=true;}};
canvas.onpointermove=e=>{const p=local(e),bp=board(...p);$('readout').textContent=`X ${bp[0].toFixed(3)} · Y ${bp[1].toFixed(3)} mm`;if(!points.has(e.pointerId)||!drag)return;points.set(e.pointerId,p);if(points.size===2&&pinch){const a=[...points.values()],d=Math.hypot(a[1][0]-a[0][0],a[1][1]-a[0][1]);view.zoom=Math.max(.001,Math.min(100000,pinch.zoom*d/Math.max(1,pinch.distance)));draw();return;}if(Math.hypot(p[0]-drag.p[0],p[1]-drag.p[1])>4)drag.moved=true;if(drag.moved){view.x-=(p[0]-drag.last[0])/view.zoom*(mirror?-1:1);view.y+=(p[1]-drag.last[1])/view.zoom;draw()}drag.last=p;};
canvas.onpointerup=e=>{const p=local(e),click=points.size===1&&drag&&!drag.moved;points.delete(e.pointerId);pinch=null;if(click&&layers.length){const b=board(...p);if(tool==='region'){if(pendingPoint){const x=Math.min(b[0],pendingPoint[0]),y=Math.min(b[1],pendingPoint[1]),w=Math.abs(b[0]-pendingPoint[0]),h=Math.abs(b[1]-pendingPoint[1]);if(w>.01&&h>.01){world=[x,y,w,h];overlay=null;rasterEpoch++;fit();}pendingPoint=null;}else pendingPoint=b;draw();}else if(tool==='measure'){if(pendingPoint){marks.push([pendingPoint,b]);$('result').textContent=`距离 ${Math.hypot(b[0]-pendingPoint[0],b[1]-pendingPoint[1]).toFixed(3)} mm · ΔX ${(b[0]-pendingPoint[0]).toFixed(3)} · ΔY ${(b[1]-pendingPoint[1]).toFixed(3)} mm`;pendingPoint=null;}else pendingPoint=b;draw()}else if(tool==='connect')highlight(b);}if(points.size){drag={p:[...points.values()][0],last:[...points.values()][0],moved:true}}else drag=null;};canvas.onpointercancel=e=>{points.delete(e.pointerId);drag=null;pinch=null;};
canvas.addEventListener('wheel',e=>{e.preventDefault();const p=local(e),before=board(...p);view.zoom=Math.max(.001,Math.min(100000,view.zoom*Math.exp(-e.deltaY*.001)));const after=board(...p);view.x+=before[0]-after[0];view.y+=before[1]-after[1];draw()},{passive:false});
canvas.onkeydown=e=>{if(e.key==='Escape'){$('clear').click();}else if(e.key==='+'||e.key==='=')$('zoom-in').click();else if(e.key==='-')$('zoom-out').click();else if(e.key==='0')fit();};
document.addEventListener('dragover',e=>e.preventDefault());document.addEventListener('drop',e=>{e.preventDefault();importFiles([...e.dataTransfer.files])});
new ResizeObserver(()=>{if(firstImport){fit();firstImport=false}else draw()}).observe($('stage'));
function sampleText(){return 'G04 Sample board*\n%FSLAX46Y46*%\n%MOMM*%\n%TF.FileFunction,Copper,L1,Top*%\n%ADD10C,0.700000*%\n%ADD11C,2.000000*%\nD10*\nX10000000Y10000000D02*\nX50000000Y10000000D01*\nX50000000Y30000000D01*\nX10000000Y30000000D01*\nD11*\nX10000000Y10000000D03*\nX50000000Y30000000D03*\nX30000000Y20000000D03*\nM02*';}
$('demo').onclick=()=>importFiles([new File([sampleText()],'Demo-F_Cu.gtl')]);
$('export').onclick=()=>{if(!layers.length){error('请先导入文件');return;}const snapshot={a:layers.map(l=>({name:l.name,text:l.text}))};const copy=document.documentElement.cloneNode(true);copy.querySelector('body').classList.remove('embedded');copy.querySelector('#layers').replaceChildren();copy.querySelector('#error').hidden=true;const data=document.createElement('script');data.id='g-snapshot';data.type='application/json';data.textContent=JSON.stringify(snapshot).replace(/</g,'\\u003c');copy.querySelector('#g-snapshot')?.remove();copy.querySelector('#g-app').before(data);const blob=new Blob(['<!doctype html>\n',copy.outerHTML],{type:'text/html'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Gerber-看板.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);};
const snapshot=$('g-snapshot');if(snapshot){(async()=>{try{const data=JSON.parse(snapshot.textContent);await importFiles(data.a.map(f=>new File([f.text],f.name)));}catch(e){error('快照读取失败：'+e.message)}})();}

const embedded=window.parent!==window;
if(embedded){
 document.body.classList.add('embedded');
 window.addEventListener('message',e=>{
  if(e.source!==window.parent)return;
  if(e.data?.type==='gerber-import'&&Array.isArray(e.data.files)){
   importFiles(e.data.files).then(()=>{if(layers.length)window.parent.postMessage({type:'gerber-loaded',name:e.data.files[0].name.replace(/\.[^.]+$/,'')},'*')});
  }else if(e.data?.type==='gerber-export')$('export').click();
 });
}
