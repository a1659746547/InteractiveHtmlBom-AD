(()=>{
 'use strict';
 const $=id=>document.getElementById(id);if(!$('usage-refresh'))return;let busy=false,again=false;
 const duration=ms=>{const seconds=Math.floor(ms/1000);if(seconds<60)return seconds+' 秒';const minutes=Math.floor(seconds/60);return minutes<60?minutes+' 分钟':Math.floor(minutes/60)+' 小时 '+minutes%60+' 分钟'};
 async function load(){if(busy){again=true;return}busy=true;$('usage-refresh').disabled=true;
  const query=new URLSearchParams();for(const id of ['start','end'])if($(id).value)query.set(id,$(id).value);
  try{const response=await fetch('/stats/usage?'+query,{cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(7000)});if(!response.ok)throw Error('使用情况暂时不可用，请稍后刷新');const data=await response.json();
   if(!['parses','used_ips','active_ips','active_ms'].every(k=>Number.isFinite(data[k])&&data[k]>=0))throw Error('使用统计格式无效');
   $('usage-parses').textContent=data.parses.toLocaleString('zh-CN');$('usage-used').textContent=data.used_ips.toLocaleString('zh-CN');$('usage-active').textContent=data.active_ips.toLocaleString('zh-CN');$('usage-duration').textContent=duration(data.active_ms);
   $('usage-since').textContent=(data.since?'最早记录 '+new Date(data.since*1000).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false}):'暂未收到使用记录')+' · 仅有更新上线后的数据，保留最近 90 天'+(data.capped?' · 当前汇总最多包含 10,000 个 IP':'');$('usage-error').hidden=true;document.dispatchEvent(new Event('pcb-usage-updated'));
  }catch(error){for(const id of ['usage-parses','usage-used','usage-active','usage-duration'])$(id).textContent='—';$('usage-error').textContent=error.message;$('usage-error').hidden=false}
  finally{busy=false;$('usage-refresh').disabled=false;if(again){again=false;load()}}
 }
 $('usage-refresh').onclick=load;document.addEventListener('pcb-stats-updated',load);setInterval(()=>{if(!document.hidden)load()},15000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)load()});load();
})();
