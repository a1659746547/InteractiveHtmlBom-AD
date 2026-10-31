// Public chat carries only messages and the fields explicitly enabled below.
(()=>{
 'use strict';
 const AVATARS=window.PCB_CHAT_AVATARS||[];
 if(document.getElementById('public-chat-launcher'))return;
 const icon='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H7l-4 3v-6a7.5 7.5 0 0 1-1-4.5A7.5 7.5 0 0 1 9.5 4h3A7.5 7.5 0 0 1 20 11.5Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M7 10h8M7 14h5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
 const launcher=document.createElement('button');launcher.type='button';launcher.id='public-chat-launcher';launcher.innerHTML=icon+'<span>聊天室</span><i hidden></i>';launcher.setAttribute('aria-label','打开公共聊天室');launcher.setAttribute('aria-expanded','false');document.body.append(launcher);
 launcher.hidden=true;
 const panel=document.createElement('section');panel.id='public-chat-panel';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-label','公共聊天室');
 panel.innerHTML=`<header class="chat-heading"><div class="chat-heading-title"><strong id="chat-heading-title">聊天室</strong><span id="chat-online">公共聊天室</span></div><div class="chat-heading-actions"><button id="chat-settings" type="button" aria-label="展示设置" title="展示设置" aria-expanded="false"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16M4 17h16M9 4v6M15 14v6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></button><button id="chat-close" type="button" aria-label="收起聊天">×</button></div></header>
 <div id="chat-conversation">
 <form id="chat-join-form"><button id="chat-avatar-before-join" type="button" aria-label="选择头像" title="选择头像"></button><label class="chat-sr-only" for="chat-nickname">昵称</label><input id="chat-nickname" maxlength="20" autocomplete="nickname" placeholder="输入昵称，进入聊天室"><button id="chat-join" type="submit">加入</button></form>
 <div id="chat-people" role="group" aria-label="在线用户，点击头像查看公开信息" hidden></div>
 <section id="chat-person-detail" aria-label="用户公开信息" hidden><div class="chat-person-detail-heading"><strong id="chat-person-title"></strong><button id="chat-person-close" type="button" aria-label="收起用户信息">×</button></div><dl id="chat-person-fields"></dl><p id="chat-person-private" hidden>暂未公开焊接信息</p></section>
 <div id="chat-completion-banner" hidden aria-live="polite"><span aria-hidden="true">✓</span><div class="chat-completion-ticker"><span id="chat-completion-text"></span></div></div>
 <div id="chat-messages" role="log" aria-label="聊天消息" aria-live="polite"><p class="chat-empty">正在连接聊天室…</p></div>
 <form id="chat-compose"><div class="chat-compose-row"><label class="chat-sr-only" for="chat-message">聊天内容</label><textarea id="chat-message" rows="1" maxlength="600" placeholder="先加入聊天" disabled></textarea><button id="chat-send" type="submit" title="Enter 发送，Shift+Enter 换行" disabled>发送</button></div></form>
 </div>
 <div id="chat-preferences" hidden>
 <button id="chat-settings-back" type="button">‹ 返回聊天</button>
 <div id="chat-identity" hidden><span id="chat-self-name"></span><button type="button" id="chat-leave">退出聊天</button></div>
 <button id="chat-avatar-change" type="button"><span id="chat-avatar-preview"></span><span>更换头像</span><span aria-hidden="true">›</span></button>
 <div id="chat-sharing">
 <p class="chat-section-title">公开哪些焊接信息</p>
 <label class="chat-setting-row"><span>焊接进度<small>展示整板装配百分比</small></span><input type="checkbox" id="chat-show-progress"></label>
 <label class="chat-setting-row"><span>板子名称<small>当前 PCB 的名称</small></span><input type="checkbox" id="chat-show-board"></label>
 <label class="chat-setting-row"><span>位号与型号<small>显示当前元件的位号和 BOM 型号</small></span><input type="checkbox" id="chat-show-component"></label>
 <p class="chat-section-title">完成动态</p>
 <label class="chat-setting-row"><span>焊完时播报<small>勾选已装配后，滚动展示元件型号</small></span><input type="checkbox" id="chat-announce"></label>
 <div class="chat-preview"><div>对方可见 <span id="chat-scope-summary">全部隐藏</span></div><p id="chat-own-preview">暂未公开焊接信息</p></div>
 <p class="chat-settings-note">更换 PCB 后恢复隐藏。已发布的完成动态保留在聊天记录中。</p>
 </div></div><section id="chat-avatar-picker" aria-label="选择内置头像" hidden><button id="chat-avatar-back" type="button">‹ 返回</button><p class="chat-avatar-hint">选择一个喜欢的头像</p><div id="chat-avatar-options" role="group" aria-label="20 个内置头像"></div><p class="chat-settings-note">内置头像，无需上传图片。</p></section><div id="chat-status" role="status"></div>`;
 document.body.append(panel);
 const $=id=>document.getElementById(id),frame=document.getElementById('viewer');
 let session=null,open=false,joining=false,sending=false,polling=false,presenceBusy=false,generation=0,lastPresence=0,lastProgress='',lastSnapshot='',lastMessage=0,readMessage=0,boardObject=null,hadBoard=false;
 let previousPlaced=null,announced=new Set(),pendingModels=new Set(),completionJob=null,completionBusy=false,nextCompletionRetry=0,completionSeen=0,completionTimer=null;
 let selectedPerson=null,people=new Map();const personButtons=new Map();
 const ownIds=new Set();let reconnectPromise=null,recovering=false,recoverAt=0,recoverDelay=2000,nextPresenceAt=0,presenceDelay=2000;
 let selectedAvatar=1+Math.floor(Math.random()*20),avatarBusy=false,avatarReturn='chat';
 try{const saved=Number(localStorage.getItem('pcb-chat-avatar-v1'));if(Number.isInteger(saved)&&saved>=1&&saved<=20)selectedAvatar=saved}catch{}
 try{$('chat-nickname').value=localStorage.getItem('pcb-chat-nickname')||''}catch{}
 let statusSource='';
 let serverEnabled=null,configBusy=false,lastConfig=0;
 function availability(enabled){
  if(typeof enabled!=='boolean')return;serverEnabled=enabled;launcher.hidden=!enabled;
  if(enabled)return;
  const focused=panel.contains(document.activeElement);session=null;++generation;close(false);lastSnapshot='';lastProgress='';previousPlaced=null;pendingModels.clear();completionJob=null;selectedPerson=null;people.clear();personButtons.clear();$('chat-people').replaceChildren();$('chat-person-detail').hidden=true;clearTimeout(completionTimer);$('chat-completion-banner').hidden=true;
  for(const id of ['chat-show-progress','chat-show-board','chat-show-component','chat-announce'])$(id).checked=false;
  controls();status('管理员已关闭聊天室');if(focused)document.getElementById('appearance-launcher')?.focus();
 }
 async function checkConfig(force=false){
  if(!document.body.classList.contains('loaded')||configBusy||document.hidden||(!force&&Date.now()-lastConfig<15000))return;
  configBusy=true;lastConfig=Date.now();try{const data=await api('config');availability(data.enabled)}catch{}finally{configBusy=false}
 }
 function status(message,source=''){statusSource=message?source:'';$('chat-status').textContent=message}
 function sizeComposer(){const input=$('chat-message');if(!input.clientWidth)return;input.style.height='32px';const height=input.value?Math.min(104,Math.max(32,input.scrollHeight)):32;input.style.height=height+'px';input.style.overflowY=input.scrollHeight>height?'auto':'hidden'}
 $('chat-message').addEventListener('input',sizeComposer);
 new ResizeObserver(sizeComposer).observe($('chat-compose'));
 function element(tag,className,value){const e=document.createElement(tag);if(className)e.className=className;if(value!==undefined)e.textContent=value;return e}
 async function api(path,body){
  const response=await fetch('/api/chat/'+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,cache:'no-store',signal:AbortSignal.timeout(8000)});
  let data;try{data=await response.json()}catch{throw Error('聊天服务暂不可用，请稍后重试')}
  if(!response.ok){if(data.code==='chat_disabled')availability(false);const error=Error(data.error||'聊天服务暂不可用');error.status=response.status;throw error}return data;
 }
 function controls(){
  $('chat-join-form').hidden=!!session;$('chat-identity').hidden=!session;
  $('chat-self-name').textContent=session?'我 · '+session.nickname:'';
  $('chat-message').disabled=!session||serverEnabled!==true;$('chat-send').disabled=!session||sending||recovering||serverEnabled!==true;
  $('chat-message').placeholder=session?'分享焊接经验，聊聊正在做的板子…':'先进入聊天，再和大家交流';
  $('chat-avatar-before-join').replaceChildren(avatar('', 'local',selectedAvatar));$('chat-avatar-preview').replaceChildren(avatar('', 'local',selectedAvatar));
 }
 function recoverSession(active){
  if(serverEnabled!==true||session!==active||!document.body.classList.contains('loaded'))return Promise.resolve(false);
  if(reconnectPromise)return reconnectPromise;if(Date.now()<recoverAt)return Promise.resolve(false);
  const version=generation;recovering=true;controls();status('正在恢复聊天室连接…','connection');
  reconnectPromise=(async()=>{try{
   const result=await api('join',{nickname:active.nickname,avatar_id:active.avatar_id||selectedAvatar});
   if(session!==active||generation!==version){api('leave',{token:result.token}).catch(()=>{});return false}
   session={...result.participant,token:result.token};ownIds.add(session.id);++generation;lastProgress='';lastPresence=0;lastSnapshot='';recoverAt=0;recoverDelay=2000;nextPresenceAt=0;presenceDelay=2000;
   pendingModels.clear();completionJob=null;previousPlaced=board()?.placed||null;if(statusSource==='connection')status('');return true;
  }catch(error){if(session===active&&generation===version){recoverAt=Date.now()+recoverDelay;recoverDelay=Math.min(30000,recoverDelay*2);status('连接暂时中断，正在自动重连…','connection')}return false}
  finally{recovering=false;reconnectPromise=null;controls()}})();return reconnectPromise;
 }
 function board(){
  try{
   const w=frame?.contentWindow,data=w?.pcbdata;if(!data?.bom?.both||!data?.footprints)return null;
   if(data!==boardObject){if(hadBoard){for(const id of ['chat-show-progress','chat-show-board','chat-show-component','chat-announce'])$(id).checked=false;lastProgress='';if(session)status('已更换 PCB，展示范围已恢复为隐藏')};boardObject=data;hadBoard=true;previousPlaced=null;announced.clear();pendingModels.clear();completionJob=null}
   const indices=new Set(data.bom.both.flatMap(row=>row[3].map(ref=>ref[1]))),placed=typeof w.getStoredCheckboxRefs==='function'?w.getStoredCheckboxRefs('Placed'):new Set();
   const done=[...indices].filter(index=>placed.has(index)).length,total=indices.size;
   const models=new Map();for(const row of data.bom.both)for(const ref of row[3])models.set(ref[1],String(row[1]||''));
   const selected=(w.highlightedFootprints||[]).filter(index=>indices.has(index));
   const refs=selected.slice(0,3).map(index=>String(data.footprints[index].ref||'')).join('、')+(selected.length>3?'…':'');
   const model=[...new Set(selected.map(index=>models.get(index)).filter(Boolean))].slice(0,3).join('、');
   return {total,done,percent:total?Math.round(done*1000/total)/10:0,title:[...String(data.metadata?.title||'')].slice(0,80).join(''),ref:[...refs].slice(0,80).join(''),model:[...model].slice(0,120).join(''),placed:new Set([...indices].filter(index=>placed.has(index))),models};
  }catch{return null}
 }
 function disclosure(){
  const current=board(),level=$('chat-show-progress').checked?'percent':'none',result={level:current?.total?level:'none'};scanCompletions(current);
  if(result.level==='percent')result.percent=current.percent;
  if(current&&$('chat-show-board').checked)result.board=current.title;
  if(current&&$('chat-show-component').checked){result.current={ref:current.ref};result.model=current.model}
  const names=[];if(level!=='none')names.push('百分比');if($('chat-show-board').checked)names.push('板名');if($('chat-show-component').checked)names.push('位号与型号');
  $('chat-scope-summary').textContent=names.join(' · ')||'全部隐藏';
  const preview=describe(result);$('chat-own-preview').textContent=!current&&names.length?'打开 PCB 后可展示所选信息':preview||'暂未公开焊接信息';
  return result;
 }
 function describe(p){
  const bits=[];if(p.board)bits.push(p.board);
  if(p.level==='counts')bits.push('已装 '+p.done+'/'+p.total+' · '+p.percent+'%');else if(p.level==='percent')bits.push('已装 '+p.percent+'%');
  if(p.current)bits.push(p.current.ref?'焊接位号 '+p.current.ref:'尚未选择元件');if(p.model)bits.push('型号 '+p.model);return bits.join(' · ');
 }
 function scanCompletions(current){
  if(!current){previousPlaced=null;return}
  if(previousPlaced&&session&&$('chat-announce').checked)for(const index of current.placed){if(!previousPlaced.has(index)&&!announced.has(index)){const model=current.models.get(index);if(model){pendingModels.add(model);announced.add(index)}}}
  previousPlaced=current.placed;
 }
 async function flushCompletions(){
  if(serverEnabled!==true||!document.body.classList.contains('loaded')||!session||recovering||!$('chat-announce').checked||completionBusy||Date.now()<nextCompletionRetry)return;
  if(!completionJob&&pendingModels.size){const models=[...pendingModels];pendingModels.clear();completionJob={event_id:crypto.randomUUID(),model:[...models.slice(0,3).join('、')+(models.length>3?' 等型号':'')].slice(0,120).join('')}}
  if(!completionJob)return;completionBusy=true;const job=completionJob,active=session;
  try{await api('completions',{token:active.token,...job});if(completionJob===job&&session===active){completionJob=null;nextCompletionRetry=0;status('');poll()}}
  catch(error){if(completionJob===job){nextCompletionRetry=Date.now()+10000;status('完成动态暂未发送，将稍后重试');if(error.status===401)await recoverSession(active)}}
  finally{completionBusy=false}
 }
 function avatar(nickname,id,avatarId){
  const face=element('span','chat-avatar',[...nickname.trim()][0]||'?');face.setAttribute('aria-hidden','true');
  if(Number.isInteger(avatarId)&&AVATARS[avatarId-1]){face.classList.add('chat-avatar-built-in');face.dataset.avatarId=String(avatarId);face.innerHTML=AVATARS[avatarId-1].svg;return face}
  let hash=0;for(const char of String(id))hash=(hash*31+char.codePointAt(0))>>>0;
  face.style.setProperty('--chat-avatar-hue',String([212,164,270,28,334,192][hash%6]));return face;
 }
 function personFace(person){
  const face=element('span','chat-person-face'),p=person.progress||{level:'none'};face.append(avatar(person.nickname,person.id,person.avatar_id));
  if(p.level!=='none'&&Number.isFinite(p.percent)){
   const percent=Math.max(0,Math.min(100,p.percent)),ns='http://www.w3.org/2000/svg',ring=document.createElementNS(ns,'svg');ring.setAttribute('viewBox','0 0 48 48');ring.setAttribute('aria-hidden','true');
   for(const name of ['chat-ring-track','chat-ring-value']){const circle=document.createElementNS(ns,'circle');for(const [key,value]of Object.entries({cx:24,cy:24,r:21,pathLength:100,fill:'none','stroke-width':2.5}))circle.setAttribute(key,String(value));circle.setAttribute('class',name);if(name==='chat-ring-value'){circle.setAttribute('stroke-dasharray','100');circle.setAttribute('stroke-dashoffset',String(100-percent))}ring.append(circle)}face.prepend(ring);
  }
  return face;
 }
 function personDetail(){
  const person=people.get(selectedPerson);$('chat-person-detail').hidden=!person;if(!person)return;
  $('chat-person-title').textContent=person.nickname+(session?.id===person.id?'（我）':'');const p=person.progress||{level:'none'},fields=[];
  if(p.level==='percent')fields.push(['焊接进度',p.percent+'%']);else if(p.level==='counts')fields.push(['焊接进度',p.done+' / '+p.total+' · '+p.percent+'%']);
  if(p.board)fields.push(['板子名称',p.board]);if(p.current)fields.push(['焊接位号',p.current.ref||'尚未选择元件']);if(p.model)fields.push(['元件型号',p.model]);
  $('chat-person-fields').replaceChildren(...fields.flatMap(([label,value])=>[element('dt','',label),element('dd','',value)]));$('chat-person-private').hidden=!!fields.length;
 }
 function selectPerson(id){selectedPerson=selectedPerson===id?null:id;for(const [key,button]of personButtons)button.setAttribute('aria-expanded',String(key===selectedPerson));personDetail()}
 $('chat-person-close').onclick=()=>{const id=selectedPerson;selectPerson(null);personButtons.get(id)?.focus()};
 function renderPeople(participants){
  people=new Map(participants.map(person=>[person.id,person]));if(!people.has(selectedPerson))selectedPerson=null;
  for(const [id,button]of personButtons)if(!people.has(id)){button.remove();personButtons.delete(id)}
  const ordered=[...participants].sort((a,b)=>Number(b.id===session?.id)-Number(a.id===session?.id)||(b.last_spoken||0)-(a.last_spoken||0));
  for(const person of ordered){
   let button=personButtons.get(person.id);if(!button){button=element('button','chat-person');button.type='button';button.dataset.personId=person.id;button.setAttribute('aria-controls','chat-person-detail');button.onclick=()=>selectPerson(person.id);personButtons.set(person.id,button);$('chat-people').append(button)}
   const p=person.progress||{level:'none'},shared=p.level!=='none'&&Number.isFinite(p.percent),name=person.nickname+(session?.id===person.id?'（我）':''),signature=JSON.stringify([name,p.level,p.percent,person.avatar_id]);
   if(button.dataset.signature!==signature){button.replaceChildren(personFace(person),element('span','chat-person-name',name));if(shared)button.append(element('span','chat-person-progress',p.percent+'%'));button.dataset.signature=signature}
   button.setAttribute('aria-label',name+(shared?' · '+p.percent+'%':'')+'，查看公开信息');button.setAttribute('aria-expanded',String(person.id===selectedPerson));
  }
  const strip=$('chat-people'),focused=document.activeElement,previousLeft=strip.scrollLeft;
  for(let i=0;i<ordered.length;i++){const button=personButtons.get(ordered[i].id);if(strip.children[i]!==button)strip.insertBefore(button,strip.children[i]||null)}
  if(strip.contains(focused)&&document.activeElement!==focused)focused.focus({preventScroll:true});strip.scrollLeft=previousLeft;
  $('chat-people').hidden=!participants.length;personDetail();
 }
 function render(data){
  $('chat-online').textContent=data.online+' 人在线';
  const signature=JSON.stringify(data);if(signature===lastSnapshot)return;lastSnapshot=signature;
  const completed=data.messages.findLast(message=>message.kind==='complete'&&Date.now()-message.created*1000<90000);
  if(completed&&completed.id>completionSeen){completionSeen=completed.id;$('chat-completion-text').textContent=completed.nickname+' 焊好了 '+completed.model+' 🎉';$('chat-completion-banner').hidden=false;clearTimeout(completionTimer);completionTimer=setTimeout(()=>{$('chat-completion-banner').hidden=true},40000)}
  renderPeople(data.participants);
  const list=$('chat-messages'),bottom=list.scrollHeight-list.scrollTop-list.clientHeight<70;
  const messages=data.messages.map(message=>{
   const row=element('article','chat-message'+(ownIds.has(message.author)?' chat-mine':'')+(message.kind==='complete'?' chat-complete':'')),meta=element('div','chat-message-meta');
   meta.append(element('strong','',message.nickname),element('time','',new Date(message.created*1000).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})));
   if(message.kind==='complete'){row.append(element('p','chat-message-body','✓ '+message.nickname+' 焊好了 '+message.model));return row}
   const content=element('div','chat-message-content');content.append(meta,element('p','chat-message-body',message.text));const face=avatar(message.nickname,message.author,message.avatar_id);face.classList.add('chat-message-avatar');row.append(face,content);
   return row;
  });
  const previousTop=list.scrollTop;list.replaceChildren(...(messages.length?messages:[element('p','chat-empty','还没有消息，来聊聊正在焊接的项目吧。')]));
  if(bottom||!lastMessage)list.scrollTop=list.scrollHeight;else list.scrollTop=previousTop;
  lastMessage=data.messages.at(-1)?.id||lastMessage;if(open)readMessage=lastMessage;
  launcher.querySelector('i').hidden=lastMessage<=readMessage;
 }
 async function poll(){if(serverEnabled!==true||!document.body.classList.contains('loaded')||polling||(!open&&!session)||document.hidden)return;polling=true;const version=generation;try{const data=await api('snapshot');if(data.enabled===false){availability(false);return}if(version===generation&&serverEnabled===true){render(data);if(statusSource==='poll')status('')}}catch(error){status(error.message||'连接暂时中断，正在重试…','poll')}finally{polling=false}}
 async function publish(force=false){
  if(serverEnabled!==true||!document.body.classList.contains('loaded'))return;
  const value=disclosure(),encoded=JSON.stringify(value);if(!session||recovering||presenceBusy||(!force&&(Date.now()<nextPresenceAt||(encoded===lastProgress&&Date.now()-lastPresence<12000))))return;
  presenceBusy=true;const active=session,version=generation;
  try{await api('presence',{token:active.token,progress:value});if(version===generation){lastProgress=encoded;lastPresence=Date.now();nextPresenceAt=0;presenceDelay=2000;if(statusSource==='presence'||statusSource==='connection')status('');return true}}
  catch(error){if(version===generation){if(error.status===401){await recoverSession(active);nextPresenceAt=Math.max(Date.now()+1000,recoverAt)}else{nextPresenceAt=Date.now()+presenceDelay;presenceDelay=Math.min(30000,presenceDelay*2);status(error.message||'进度同步失败，正在重试…','presence')}}return false}
  finally{presenceBusy=false}
 }
 function preferences(show){$('chat-avatar-picker').hidden=true;$('chat-settings').hidden=false;$('chat-preferences').hidden=!show;$('chat-conversation').hidden=show;panel.dataset.view=show?'settings':'chat';$('chat-heading-title').textContent=show?'展示设置':'聊天室';$('chat-online').hidden=show;$('chat-settings').setAttribute('aria-expanded',String(show));if(show){disclosure();$('chat-settings-back').focus()}else if(open){status('');(session?$('chat-message'):$('chat-nickname')).focus()}}
 function showAvatarPicker(){avatarReturn=$('chat-preferences').hidden?'chat':'settings';panel.dataset.view='avatars';$('chat-conversation').hidden=true;$('chat-preferences').hidden=true;$('chat-avatar-picker').hidden=false;$('chat-settings').hidden=true;$('chat-online').hidden=true;$('chat-heading-title').textContent='选择头像';status('');for(const button of $('chat-avatar-options').children)button.setAttribute('aria-pressed',String(Number(button.dataset.avatarId)===selectedAvatar));$('chat-avatar-options').querySelector('[aria-pressed=true]')?.focus({preventScroll:true})}
 function hideAvatarPicker(){preferences(avatarReturn==='settings');(avatarReturn==='settings'?$('chat-avatar-change'):$('chat-avatar-before-join')).focus()}
 for(const entry of AVATARS){const button=element('button','chat-avatar-option');button.type='button';button.dataset.avatarId=entry.id;button.setAttribute('aria-label',entry.name);button.title=entry.name;button.append(avatar('', 'option',entry.id));button.onclick=async()=>{if(avatarBusy)return;avatarBusy=true;for(const option of $('chat-avatar-options').children)option.disabled=true;const active=session;try{if(active){await api('profile',{token:active.token,avatar_id:entry.id});if(session!==active)return;active.avatar_id=entry.id}selectedAvatar=entry.id;try{localStorage.setItem('pcb-chat-avatar-v1',String(selectedAvatar))}catch{}controls();hideAvatarPicker();lastSnapshot='';poll()}catch(error){status(error.message||'头像更新失败，请重试');if(error.status===401){if(await recoverSession(active))status('连接已恢复，请重新选择头像')}}finally{avatarBusy=false;for(const option of $('chat-avatar-options').children)option.disabled=false}};$('chat-avatar-options').append(button)}
 $('chat-avatar-before-join').onclick=showAvatarPicker;$('chat-avatar-change').onclick=showAvatarPicker;$('chat-avatar-back').onclick=hideAvatarPicker;
 $('chat-settings').onclick=()=>preferences($('chat-preferences').hidden);$('chat-settings-back').onclick=()=>preferences(false);
 function close(focus=true){open=false;panel.hidden=true;preferences(false);launcher.setAttribute('aria-expanded','false');if(focus)launcher.focus()}
 launcher.onclick=()=>{if(serverEnabled!==true||!document.body.classList.contains('loaded'))return;if(open){close();return}open=true;panel.hidden=false;launcher.setAttribute('aria-expanded','true');readMessage=lastMessage;launcher.querySelector('i').hidden=true;disclosure();poll();(session?$('chat-message'):$('chat-nickname')).focus()};
 $('chat-close').onclick=close;panel.addEventListener('keydown',event=>{if(event.key==='Escape'){event.stopPropagation();if(!$('chat-avatar-picker').hidden){hideAvatarPicker();return}close()}});
 let viewerAvailable=document.body.classList.contains('loaded');new MutationObserver(()=>{const available=document.body.classList.contains('loaded');if(available===viewerAvailable)return;viewerAvailable=available;if(!available){close(false);pendingModels.clear();completionJob=null;previousPlaced=null;if(session){lastProgress='';api('presence',{token:session.token,progress:{level:'none'}}).catch(()=>{})}}else{checkConfig(true);if(session){publish(true);poll()}}}).observe(document.body,{attributes:true,attributeFilter:['class']});
 document.getElementById('appearance-launcher')?.addEventListener('click',()=>{if(open)close(false)});
 $('chat-join-form').onsubmit=async event=>{
  event.preventDefault();if(serverEnabled!==true||joining)return;const version=generation;const nickname=$('chat-nickname').value.trim();if(!nickname){status('先起个昵称');return}
  joining=true;$('chat-join').disabled=true;status('正在进入…');
  try{const result=await api('join',{nickname,avatar_id:selectedAvatar});if(serverEnabled!==true||generation!==version){api('leave',{token:result.token}).catch(()=>{});return}session={...result.participant,token:result.token};ownIds.add(session.id);++generation;recoverAt=0;recoverDelay=2000;nextPresenceAt=0;presenceDelay=2000;lastProgress='';lastPresence=0;lastSnapshot='';previousPlaced=null;pendingModels.clear();completionJob=null;try{localStorage.setItem('pcb-chat-nickname',nickname);localStorage.setItem('pcb-chat-avatar-v1',String(selectedAvatar))}catch{}controls();status('');await publish(true);await poll();if(session)$('chat-message').focus()}
  catch(error){status(error.message||'连接失败，请稍后重试')}finally{joining=false;$('chat-join').disabled=false}
 };
 $('chat-leave').onclick=async()=>{if(!session)return;const token=session.token;session=null;++generation;lastSnapshot='';pendingModels.clear();completionJob=null;controls();preferences(false);status('已退出，焊接信息不再展示');try{await api('leave',{token})}catch{}poll()};
 for(const id of ['chat-show-progress','chat-show-board','chat-show-component'])$(id).addEventListener('change',()=>{status(session?'正在更新展示范围…':'进入聊天后，将按所选范围展示');publish(true).then(ok=>{if(session&&ok)status('展示范围已更新')})});
 $('chat-announce').addEventListener('change',()=>{previousPlaced=board()?.placed||null;pendingModels.clear();completionJob=null;status($('chat-announce').checked?'后续勾选已装配时，会公开播报元件型号':'已关闭完成播报')});
 $('chat-compose').onsubmit=async event=>{
  event.preventDefault();const value=$('chat-message').value.trim();if(serverEnabled!==true||!session||sending||recovering||!value)return;
  sending=true;controls();const active=session;status('发送中…');
  try{await api('messages',{token:active.token,text:value});if(session===active){$('chat-message').value='';sizeComposer();status('');await poll()}}
  catch(error){status(error.message||'发送失败，内容已保留');if(error.status===401&&await recoverSession(active))status('连接已恢复，消息已保留，请再次发送')}
  finally{sending=false;controls();if(session)$('chat-message').focus()}
 };
 $('chat-message').addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();$('chat-compose').requestSubmit()}});
 setInterval(()=>{checkConfig();if(open||session){publish();flushCompletions()}},800);setInterval(poll,2000);
 let lastWake=0;function wake(){if(document.hidden||Date.now()-lastWake<1000)return;lastWake=Date.now();nextPresenceAt=0;recoverAt=0;checkConfig(true);publish(true);poll()}
 document.addEventListener('visibilitychange',wake);window.addEventListener('online',wake);window.addEventListener('focus',wake);window.addEventListener('pageshow',wake);window.addEventListener('offline',()=>{if(session)status('网络已断开，恢复后会自动重连','connection')});
 window.addEventListener('pagehide',event=>{if(session&&!event.persisted)navigator.sendBeacon('/api/chat/leave',new Blob([JSON.stringify({token:session.token})],{type:'application/json'}))});
 controls();checkConfig(true);
})();
