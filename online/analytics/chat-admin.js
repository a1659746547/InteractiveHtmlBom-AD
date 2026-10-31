(()=>{
 'use strict';
 const toggle=document.getElementById('chat-admin-toggle');if(!toggle)return;
 const state=document.getElementById('chat-admin-state'),feedback=document.getElementById('chat-admin-feedback'),refresh=document.getElementById('chat-admin-refresh');
 let enabled=null,busy=false;
 function notice(text,error=false){feedback.textContent=text;feedback.dataset.error=String(error)}
 function render(){toggle.disabled=busy||enabled===null;refresh.disabled=busy;toggle.setAttribute('aria-checked',String(enabled===true));state.textContent=enabled===null?'状态不可用':enabled?'已开启':'已关闭';state.dataset.enabled=String(enabled);toggle.setAttribute('aria-busy',String(busy))}
 async function request(value){
  const response=await fetch('/stats/chat-settings',{method:value===undefined?'GET':'POST',headers:value===undefined?undefined:{'Content-Type':'application/json'},body:value===undefined?undefined:JSON.stringify({enabled:value}),cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(7000)});
  let data;try{data=await response.json()}catch{throw Error('无法读取聊天室状态，请稍后重试')}
  if(!response.ok)throw Error(response.status===401?'登录已过期，请重新登录后台':data.error||'聊天室管理暂不可用');
  if(typeof data.enabled!=='boolean')throw Error('聊天室状态无效，请刷新后重试');return data.enabled;
 }
 async function load(){if(busy)return;busy=true;render();try{enabled=await request();notice('状态已同步')}catch(error){enabled=null;notice(error.message,true)}finally{busy=false;render()}}
 toggle.onclick=async()=>{if(busy||enabled===null)return;busy=true;render();notice('正在保存…');try{enabled=await request(!enabled);notice(enabled?'聊天室已开启，用户可以再次加入':'聊天室已关闭，已停止聊天与焊接信息同步')}catch(error){enabled=null;notice(error.message+'；请刷新状态确认。',true)}finally{busy=false;render()}};
 refresh.onclick=load;document.addEventListener('visibilitychange',()=>{if(!document.hidden)load()});setInterval(()=>{if(!document.hidden)load()},30000);load();
})();
