// Mobile layout is transient: desktop layout preferences are restored on exit.
window.addEventListener('load',()=>{
 const root=document.getElementById('topmostdiv');
 const bar=document.createElement('nav');bar.id='mobile-view-switch';bar.setAttribute('aria-label','触控视图');
 for(const [mode,label] of [['bom','BOM'],['board','板图'],['split','同屏']]){const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.view=mode;b.onclick=()=>select(mode);bar.append(b)}
 document.getElementById('top').after(bar);
 const layoutButton=document.getElementById('lr-btn');if(layoutButton)layoutButton.parentElement.classList.add('mobile-layout-hidden');
 const media=matchMedia('(max-width:1024.98px)');let desktop=null,mode='split';
 function select(next){mode=next;root.classList.remove('mobile-bom','mobile-board','mobile-split');root.classList.add('mobile-'+mode);for(const b of bar.children)b.setAttribute('aria-pressed',String(b.dataset.view===mode));requestAnimationFrame(()=>{window.dispatchEvent(new Event('resize'));resizeAll()})}
 function adapt(){
  if(media.matches){if(!desktop){desktop={bom:settings.bomlayout,canvas:settings.canvaslayout};changeBomLayout('top-bottom');if(settings.canvaslayout==='FB')changeCanvasLayout('F');writeStorage('bomlayout',desktop.bom);writeStorage('canvaslayout',desktop.canvas)}select(mode)}
  else if(desktop){root.classList.remove('mobile-bom','mobile-board','mobile-split');changeBomLayout(desktop.bom);changeCanvasLayout(desktop.canvas);desktop=null;resizeAll()}
 }
 media.addEventListener('change',adapt);adapt();
});
