/* Global appearance only. PCB rendering controls remain in the viewer menu. */
(()=>{
 'use strict';
 const KEY='pcb-appearance-v1', themes=['light','apple','blue','green'], languages={zh:'中文',en:'English',ja:'日本語',ko:'한국어',fr:'Français',de:'Deutsch',es:'Español',ru:'Русский',pt:'Português',it:'Italiano'};
 const defaults={theme:'light',language:'zh',font:'default',glass:'soft',shadow:'light',radius:18,accent:null,lastLight:'light'};
 let state={...defaults};
 try{const saved=JSON.parse(localStorage.getItem(KEY));if(saved&&typeof saved==='object')state={...state,...saved}}catch{}
 if(![...themes,'dark'].includes(state.theme))state.theme='light';
 if(!Object.hasOwn(languages,state.language))state.language='zh';
 if(!['compact','default','large'].includes(state.font))state.font='default';
 if(!['clear','soft','glass'].includes(state.glass))state.glass='soft';
 if(!['none','light','deep'].includes(state.shadow))state.shadow='light';
 // Corner radius is a fixed design token, not a user-facing preference.
 state.radius=defaults.radius;
 if(!/^#[\da-f]{6}$/i.test(state.accent||''))state.accent=null;
 if(!themes.includes(state.lastLight))state.lastLight='light';
 const locale=window.PCB_SITE_LOCALES||{}, body=document.body, media=matchMedia('(prefers-color-scheme: dark)'), frame=document.getElementById('viewer');
 const t=source=>locale[state.language]?.[source]||locale.en?.[source]||source;
 const palettes={light:['#f7faff','#f7faff','#ffffff','#c9d7e8','#2d425c','#60758e','#2868d6','#deebff','#f4f8fd'],apple:['#f7f7fa','#f9f9fc','#ffffff','#d4d6df','#282a34','#686b7c','#146ee3','#e0ebff','#f0f1f5'],blue:['#edf4fb','#f1f7fd','#f7fbff','#b9cddd','#243e54','#526e85','#23628e','#d0e5f8','#e5eef7'],green:['#f1f7ed','#f4f9f1','#fafff7','#bdcfb7','#29452f','#56745a','#327247','#d7eaca','#e8f1e2'],dark:['#1d2734','#253140','#182330','#42536a','#e5edf8','#acbdd2','#9dc4ff','#344e70','#24303f'],appleDark:['#22232b','#2c2d37','#1c1d24','#4c4e5f','#f1f1f8','#b8b9ca','#a8c7ff','#394b6c','#292a34']};
 const paletteKeys=['panel','elevated','input','line','text','muted','accent','selected','alt'];
 const svg='<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m9.2 4 .6-2h4.4l.6 2 1.8 1 2-.5 2.2 3.8-1.4 1.5v2.1l1.4 1.5-2.2 3.8-2-.5-1.8 1-.6 2H9.8l-.6-2-1.8-1-2 .5-2.2-3.8L4.6 12V9.8L3.2 8.3l2.2-3.8 2 .5z" transform="translate(0 1)"/><circle cx="12" cy="12" r="3"/></svg>';
 const launcher=document.createElement('button');launcher.id='appearance-launcher';launcher.type='button';launcher.innerHTML=svg;launcher.setAttribute('aria-controls','appearance-panel');launcher.setAttribute('aria-expanded','false');launcher.setAttribute('aria-haspopup','dialog');body.append(launcher);
 const panel=document.createElement('dialog');panel.id='appearance-panel';panel.setAttribute('aria-labelledby','appearance-title');
 panel.innerHTML=`<div class="appearance-heading"><div><span class="appearance-eyebrow">PERSONALIZE</span><h2 id="appearance-title">外观设置</h2></div><button type="button" id="appearance-close" aria-label="关闭设置">×</button></div>
 <div class="appearance-scroll"><fieldset class="appearance-themes"><legend>主题</legend><div class="appearance-theme-grid">${themes.map((value,i)=>`<button type="button" data-theme-choice="${value}" aria-pressed="false"><span class="appearance-theme-sample sample-${value}" aria-hidden="true"><i></i><i></i></span><span>${['浅色','柔光','蓝灰','护眼绿'][i]}</span></button>`).join('')}</div></fieldset>
 <label class="appearance-row"><span>夜间模式</span><input id="appearance-night" type="checkbox" role="switch"><span class="appearance-switch" aria-hidden="true"></span></label>
 <label class="appearance-row" for="appearance-language"><span>语言</span><select id="appearance-language">${Object.entries(languages).map(([v,n])=>`<option value="${v}" lang="${v}">${n}</option>`).join('')}</select></label>
 <fieldset class="appearance-row"><legend>字体大小</legend><div class="appearance-segments" data-choice="font">${['compact','default','large'].map((v,i)=>`<button type="button" data-value="${v}">${['紧凑','默认','较大'][i]}</button>`).join('')}</div></fieldset>
 <fieldset class="appearance-row"><legend>玻璃效果</legend><div class="appearance-segments" data-choice="glass">${['clear','soft','glass'].map((v,i)=>`<button type="button" data-value="${v}">${['清晰','轻透','通透'][i]}</button>`).join('')}</div></fieldset>
 <fieldset class="appearance-row"><legend>阴影</legend><div class="appearance-segments" data-choice="shadow">${['none','light','deep'].map((v,i)=>`<button type="button" data-value="${v}">${['无','浅','深'][i]}</button>`).join('')}</div></fieldset>
 <div class="appearance-row"><span id="appearance-color-label">主题色</span><div class="appearance-colors">${['#2868eb','#168779','#915bc1','#c07732'].map(c=>`<button type="button" class="appearance-color" data-color="${c}" style="--swatch:${c}" aria-labelledby="appearance-color-label" aria-label="${c}"></button>`).join('')}<input id="appearance-color" type="color" aria-labelledby="appearance-color-label"></div></div>
 </div><div class="appearance-footer"><span id="appearance-saved" role="status">自动保存</span><button type="button" id="appearance-reset">恢复默认</button></div>`;
 body.append(panel);
 // The same interaction feedback is shared by the host and embedded viewers.
 const interactionCSS=`
 :is(body,#topmostdiv) :is(button,summary,select,input[type=color],input[type=checkbox],input[type=radio],input[type=range],a[href]){transition:background-color .2s ease,border-color .2s ease,color .2s ease,box-shadow .2s ease,transform .2s cubic-bezier(.2,.8,.2,1),opacity .2s ease!important}
 :is(button,summary,select,input[type=color]):not(:disabled){cursor:pointer}
 .appearance-theme-sample,.appearance-switch,.feedback-type-option span{transition:background-color .2s ease,border-color .2s ease,box-shadow .2s ease,transform .2s ease}
 @media(hover:hover) and (pointer:fine){
 :is(button,summary):not(:disabled):not([aria-disabled=true]):hover{transform:translateY(-1px);box-shadow:0 4px 12px color-mix(in srgb,var(--host-accent,#2868d6) 16%,transparent)!important}
 :is(select,input[type=color]):not(:disabled):hover{border-color:var(--host-accent,#2868d6)!important;box-shadow:0 0 0 3px color-mix(in srgb,var(--host-accent,#2868d6) 10%,transparent)}
 #appearance-panel .appearance-theme-grid button:hover .appearance-theme-sample{transform:translateY(-2px);box-shadow:0 5px 14px color-mix(in srgb,var(--host-accent) 18%,transparent)}
 #appearance-panel .appearance-segments button:hover{background:var(--host-selected)!important;color:var(--host-accent)!important}
 .feedback-type-option:hover span{background:var(--host-selected)!important}
 #appearance-night:hover+.appearance-switch{box-shadow:0 0 0 4px color-mix(in srgb,var(--host-accent) 12%,transparent)}
 :is(input[type=checkbox],input[type=radio]):not(:disabled):not(#appearance-night):not([type=radio]):hover{box-shadow:0 0 0 3px color-mix(in srgb,var(--host-accent,#2868d6) 14%,transparent)}
 input[type=range]:not(:disabled):hover{opacity:.85}
 }
 :is(button,summary):not(:disabled):not([aria-disabled=true]):active{transform:translateY(0) scale(.97)}
 #topmostdiv input[type=radio]{transition:color .15s ease!important;box-shadow:none!important;transform:none!important}
 @media(prefers-reduced-motion:reduce){:is(body,#topmostdiv) :is(button,summary,select,input,a[href]),.appearance-theme-sample,.appearance-switch,.appearance-switch:before,.feedback-type-option span{transition:none!important;animation:none!important}:is(body,#topmostdiv) :is(button,summary),.appearance-theme-sample{transform:none!important}#appearance-panel[open]{animation:none!important}}
 `;
 const interactionStyle=document.createElement('style');interactionStyle.id='appearance-interaction-style';interactionStyle.textContent=interactionCSS;document.head.append(interactionStyle);
 let viewerDoc=null, viewerRoot=null, viewerObserver=null,viewerTextObserver=null;
 const ids=id=>document.getElementById(id), isDark=()=>state.theme==='dark';
 function persist(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch{ids('appearance-saved').textContent=t('仅本次有效')}}
 function vars(target){
  const colors=palettes[isDark()?(state.theme==='apple'?'appleDark':'dark'):state.theme]||palettes.light;
  const accent=state.accent||colors[6], rgb=accent.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);
  target.style.setProperty('--appearance-on-accent',.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]>.45?'#14243b':'#ffffff');
  paletteKeys.forEach((k,i)=>target.style.setProperty('--host-'+k,k==='accent'?accent:colors[i]));
  target.dataset.appearanceTheme=state.theme;target.dataset.appearanceDark=String(isDark());target.dataset.appearanceFont=state.font;target.dataset.appearanceGlass=state.glass;target.dataset.appearanceShadow=state.shadow;
  target.style.setProperty('--appearance-radius',state.radius+'px');
 }
 function controls(){
  panel.querySelectorAll('[data-theme-choice]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.themeChoice===(state.theme==='dark'?state.lastLight:state.theme))));
  ids('appearance-night').checked=isDark();ids('appearance-language').value=state.language;
  panel.querySelectorAll('[data-choice]').forEach(group=>group.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(state[group.dataset.choice]===b.dataset.value))));
  ids('appearance-color').value=state.accent||palettes[isDark()?'dark':state.theme][6];
  panel.querySelectorAll('[data-color]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.color===state.accent)));
  launcher.setAttribute('aria-label',t('外观设置'));launcher.title=t('外观设置');
 }
 const embeddedStyle=`body[data-embedded] .menu-label:has(#themeSelect),body[data-embedded] .menu-label:has(#langSelect),body[data-embedded] .menu-label:has(#darkmodeCheckbox){display:none!important}
 body[data-embedded] .menu-grid-top>.menu-label:last-child{grid-column:1/-1}
 body[data-appearance-theme]{--ink:var(--host-text);--muted:var(--host-muted);--line:var(--host-line);--blue:var(--host-accent);background:var(--host-panel);color:var(--host-text)}
 body[data-appearance-dark=true]{color-scheme:dark}
 body[data-appearance-theme] :is(.top,.tools,aside,.layer-settings,.selection-settings){background:var(--host-panel)!important;color:var(--host-text);border-color:var(--host-line)!important}
 body[data-appearance-theme] button{border-color:var(--host-line);background:var(--host-input);color:var(--host-text)}
 body[data-appearance-theme] button[aria-pressed=true]{background:var(--host-selected);color:var(--host-accent)}
 #topmostdiv[data-appearance-theme] button,#topmostdiv[data-appearance-theme] .textbox,#topmostdiv[data-appearance-theme] select{border-radius:var(--appearance-radius)!important}
 #topmostdiv[data-appearance-theme] .menu-content{border-radius:var(--appearance-radius)!important;box-shadow:var(--appearance-shadow)!important}
 #topmostdiv[data-appearance-font=compact] :is(#top,#bom-search-tools,#board-progress-tools,.bom){font-size:11px!important}
 #topmostdiv[data-appearance-font=large] :is(#top,#bom-search-tools,#board-progress-tools,.bom){font-size:15px!important}
 #topmostdiv[data-appearance-font=large] .bom :is(td,th){font-size:15px!important}
 #topmostdiv[data-appearance-font=compact] .bom :is(td,th){font-size:11px!important}`;
 function viewerAppearance(){
  if(!viewerRoot)return;vars(viewerRoot);
  viewerRoot.style.setProperty('--gv-accent',state.accent||palettes[isDark()?(state.theme==='apple'?'appleDark':'dark'):state.theme][6]);
  viewerRoot.style.setProperty('--appearance-shadow',getComputedStyle(body).getPropertyValue('--appearance-shadow'));
 }
 function applyViewer(){
  if(!viewerDoc)return;
  const w=frame.contentWindow;
  // Reuse original handlers: parsing, geometry and per-board settings are untouched.
  if(viewerRoot){if(typeof w.setTheme==='function'&&w.settings?.theme!==state.theme)w.setTheme(state.theme);if(typeof w.setLanguage==='function'&&w.settings?.lang!==state.language)w.setLanguage(state.language);viewerAppearance();translateDocument(viewerDoc)}
  else{vars(viewerDoc.body);translateDocument(viewerDoc);}
 }
 function apply(save=true){vars(body);body.dataset.viewerTheme=state.theme;body.dataset.viewerDark=String(isDark());controls();translateDocument(document);applyViewer();if(save)persist()}
 function close(){if(panel.open)panel.close();launcher.setAttribute('aria-expanded','false')}
 function open(){if(panel.open){close();return}controls();translateDocument(document);panel.show();launcher.setAttribute('aria-expanded','true');ids('appearance-close').focus()}
 launcher.addEventListener('click',open);ids('appearance-close').addEventListener('click',()=>{close();launcher.focus()});
 panel.addEventListener('cancel',e=>{e.preventDefault();close();launcher.focus()});
 // Capture runs before toolbar handlers that stop event propagation.
 const dismissOutside=e=>{if(panel.open&&!e.composedPath().includes(panel)&&!e.composedPath().includes(launcher))close()};
 for(const event of ['pointerdown','click'])document.addEventListener(event,dismissOutside,true);
 // A cross-origin frame cannot share DOM events; focusing it still dismisses the panel.
 window.addEventListener('blur',()=>{if(panel.open&&document.activeElement?.tagName==='IFRAME')close()});
 document.addEventListener('keydown',e=>{if(!panel.open)return;if(e.key==='Escape'){e.preventDefault();close();launcher.focus()}else if(e.key==='Tab'){const list=[...panel.querySelectorAll('button,input,select')].filter(e=>!e.disabled&&e.getClientRects().length);const first=list[0],last=list.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});
 panel.addEventListener('click',e=>{
  const theme=e.target.closest('[data-theme-choice]'), choice=e.target.closest('[data-choice] button'), color=e.target.closest('[data-color]');
  if(theme){state.theme=theme.dataset.themeChoice;state.lastLight=state.theme;apply()}
  if(choice){state[choice.closest('[data-choice]').dataset.choice]=choice.dataset.value;apply()}
  if(color){state.accent=color.dataset.color;apply()}
 });
 ids('appearance-night').addEventListener('change',e=>{if(e.target.checked){if(state.theme!=='dark')state.lastLight=state.theme;state.theme='dark'}else state.theme=state.lastLight;apply()});
 ids('appearance-language').addEventListener('change',e=>{state.language=e.target.value;apply()});
 ids('appearance-color').addEventListener('input',e=>{state.accent=e.target.value;apply()});
 ids('appearance-reset').addEventListener('click',()=>{state={...defaults};apply()});
 media.addEventListener('change',()=>{if(state.theme==='apple')apply(false)});

 // Translate UI text only. File names, PCB values and user-entered text are excluded.
 const nodeSources=new WeakMap(),attributeSources=new WeakMap();
 const excluded='script,style,textarea,pre,code,svg,.bom tbody,#board-name,#warning-list,#zip-select,#project-select,#feedback-image-list,#layers,#readout,#result,#operation,#langSelect option,#themeSelect option';
 function translateText(source){
  if(state.language==='zh')return source;
  const trim=source.trim();if(!trim)return source;
  let result=locale[state.language]?.[trim]||locale.en?.[trim];
  if(!result){const summary=/^(\d+) 个元件 · (\d+) 个焊盘 · (.+)$/.exec(trim);if(summary)result=summary[1]+' '+t('元件')+' · '+summary[2]+' '+t('焊盘')+' · '+summary[3];}
  if(!result&&/^已装配 \d+\/\d+$/.test(trim))result=t('已装配')+' '+trim.slice(4);
  return result?source.replace(trim,result):source;
 }
 function translateDocument(doc){
  if(!doc.body)return;doc.documentElement.lang=state.language==='zh'?'zh-CN':state.language;
  const walker=doc.createTreeWalker(doc.body,NodeFilter.SHOW_TEXT);let n;
  while(n=walker.nextNode()){
   if(!n.parentElement||n.parentElement.closest(excluded)||n.parentElement.closest('option')?.parentElement.id==='appearance-language')continue;
   let record=nodeSources.get(n);if(!record||n.nodeValue!==record.last)record={source:n.nodeValue,last:n.nodeValue};
   const next=translateText(record.source);if(n.nodeValue!==next)n.nodeValue=next;record.last=next;nodeSources.set(n,record);
  }
  for(const e of doc.body.querySelectorAll('[placeholder],[title],[aria-label],[alt]')){
   if(e.closest(excluded))continue;let records=attributeSources.get(e)||{};
   for(const a of ['placeholder','title','aria-label','alt']){if(!e.hasAttribute(a))continue;const value=e.getAttribute(a);let r=records[a];if(!r||value!==r.last)r={source:value,last:value};const next=translateText(r.source);if(value!==next)e.setAttribute(a,next);r.last=next;records[a]=r}attributeSources.set(e,records);
  }
  if(doc===document)document.title=t('PCB 焊接助手');
 }
 function connect(){
  viewerObserver?.disconnect();viewerTextObserver?.disconnect();viewerDoc=null;viewerRoot=null;
  try{
   const doc=frame.contentDocument;if(!doc?.body)return;viewerDoc=doc;viewerRoot=doc.getElementById('topmostdiv');
   if(!doc.getElementById('appearance-embedded-style')){const s=doc.createElement('style');s.id='appearance-embedded-style';s.textContent=embeddedStyle+'\n'+interactionCSS;doc.head.append(s)}
   for(const event of ['pointerdown','click','focusin'])doc.defaultView.addEventListener(event,close,true);
   doc.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
   const w=frame.contentWindow;
   if(typeof w.applyTheme==='function'&&!w.applyTheme.manualNight){
    const original=w.applyTheme;
    const manual=function(theme){original(theme);if(theme==='apple'){doc.getElementById('topmostdiv')?.classList.remove('dark');if(w.settings)w.settings.darkMode=false;const check=doc.getElementById('darkmodeCheckbox');if(check)check.checked=false}};
    manual.manualNight=true;w.applyTheme=manual;if(w.settings?.theme==='apple')manual('apple');
   }
   applyViewer();
   if(viewerRoot){viewerObserver=new MutationObserver(()=>{viewerAppearance()});viewerObserver.observe(viewerRoot,{attributes:true,attributeFilter:['class']})}
   let textQueued=false;viewerTextObserver=new MutationObserver(records=>{if(textQueued||records.every(r=>r.target.parentElement?.closest('.bom tbody')))return;textQueued=true;queueMicrotask(()=>{textQueued=false;if(viewerDoc===doc)translateDocument(doc)})});
   viewerTextObserver.observe(doc.body,{subtree:true,childList:true,characterData:true});
  }catch{/* A foreign origin never receives settings or a bridge. */}
 }
 let queued=false;
 new MutationObserver(records=>{
  if(records.some(r=>r.type==='attributes'&&r.target.tagName==='DIALOG'&&r.target!==panel&&r.target.open))close();
  if(queued)return;queued=true;queueMicrotask(()=>{queued=false;translateDocument(document)})
 }).observe(body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['placeholder','title','aria-label','open']});
 if(frame){frame.addEventListener('load',connect);connect()}
 apply(false);
})();
