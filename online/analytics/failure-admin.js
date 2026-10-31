(()=>{'use strict';
 const $=id=>document.getElementById(id),labels={unsupported:'格式／选择方式不支持',too_large:'文件大小超限',timeout:'解析超时',archive:'压缩包异常',invalid_pad:'焊盘尺寸异常',no_board:'未找到板图／图层',invalid_data:'文件数据异常',parser_error:'解析异常'};
 let page=1,busy=false,pending=false,total=0;
 const tz={timeZone:'Asia/Shanghai',hour12:false},date=value=>new Date(value*1000).toLocaleString('zh-CN',tz);
 const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e};
 const size=bytes=>bytes<1024?bytes+' B':bytes<1048576?(bytes/1024).toFixed(1)+' KB':(bytes/1048576).toFixed(1)+' MB';
 function row(item){
  const tr=node('tr'),time=node('td'),when=new Date(item.created*1000);
  time.append(node('span',when.toLocaleTimeString('zh-CN',tz),'failure-primary'),node('span',when.toLocaleDateString('zh-CN',{timeZone:'Asia/Shanghai'}),'failure-secondary'));
  tr.append(time,node('td',item.ip));const format=node('td');format.append(node('span',item.format.toUpperCase(),'format-badge'));tr.append(format,node('td',size(item.size)));
  const reason=node('td');reason.append(node('span',labels[item.reason]||'解析异常','reason-badge'));tr.append(reason);
  const sample=node('td');
  if(item.saved&&item.expires>Date.now()/1000){
   const a=node('a','下载样本','sample-button');a.href='/stats/failures/'+item.id+'/sample';a.setAttribute('download','');a.title='有效期至 '+date(item.expires);
   const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('aria-hidden','true');const path=document.createElementNS(icon.namespaceURI,'path');path.setAttribute('d','M12 3v12m-4-4 4 4 4-4M4 15v5h16v-5');icon.append(path);a.prepend(icon);sample.append(a,node('span','约 '+Math.max(1,Math.ceil((item.expires-Date.now()/1000)/60))+' 分钟后到期','failure-secondary'));
  }else{sample.append(node('span',item.consent&&item.expires<=Date.now()/1000?'样本已到期':'暂无样本','sample-unavailable'));sample.append(node('span',!item.consent?'未授权上传':item.expires<=Date.now()/1000?'已禁止下载并清理':'超限或上传未完成','failure-secondary'))}
  tr.append(sample);return tr;
 }
 async function load(){if(busy){pending=true;return}busy=true;$('failure-refresh').disabled=true;$('failure-prev').disabled=true;$('failure-next').disabled=true;
  try{const query=new URLSearchParams({page:String(page),start:$('start')?.value||'2000-01-01',end:$('end')?.value||'2099-12-31'});
   const r=await fetch('/stats/failures?'+query,{cache:'no-store',signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('失败记录暂不可用，请刷新重试');const data=await r.json();
   if(!Array.isArray(data.items)||!Number.isSafeInteger(data.total)||data.total<0)throw Error('失败记录格式无效');total=data.total;
   $('failure-body').replaceChildren(...data.items.map(row));
   if(!data.items.length){const tr=node('tr'),td=node('td','所选日期暂无失败记录','admin-empty');td.colSpan=6;tr.append(td);$('failure-body').append(tr)}
   $('failure-total').textContent='共 '+total+' 条记录 · 每页 25 条';$('failure-page').textContent=page+' / '+Math.max(1,Math.ceil(total/25));$('failure-error').hidden=true;
  }catch(e){$('failure-error').textContent=e.message;$('failure-error').hidden=false}finally{busy=false;$('failure-refresh').disabled=false;$('failure-prev').disabled=page<=1;$('failure-next').disabled=page*25>=total;if(pending){pending=false;load()}}}
 $('failure-refresh').onclick=()=>load();$('failure-prev').onclick=()=>{page=Math.max(1,page-1);load()};$('failure-next').onclick=()=>{page++;load()};document.addEventListener('pcb-stats-updated',()=>{page=1;load()});setInterval(()=>{if(!document.hidden)load()},60000);load();
})();
