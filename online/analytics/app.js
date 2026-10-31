'use strict';
const $=id=>document.getElementById(id), fmt=n=>n==null?'—':n.toLocaleString('zh-CN');
let data=Analytics.validateSnapshot(JSON.parse($('initial-data').textContent)), chartMode='home', source='snapshot';
const live=document.body.dataset.live==='true';let serverStats=null,checkedAt='',requestSequence=0,allDates=true;
const svgNS='http://www.w3.org/2000/svg';
const time=t=>new Date(t).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false});
function el(tag,text,className){const e=document.createElement(tag);if(text!=null)e.textContent=text;if(className)e.className=className;return e;}
function s(tag,attrs,text){const e=document.createElementNS(svgNS,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);if(text!=null)e.textContent=text;return e;}
function error(message){$('error').textContent=message;$('error').hidden=!message;}
function reset(){for(const id of ['start','end']){$(id).min=data.daily[0].date;$(id).max=data.daily.at(-1).date;} $('start').value=data.daily[0].date;$('end').value=data.daily.at(-1).date;render();}
function render(){
 const start=$('start').value,end=$('end').value, filtered=$('filter').checked;
 if(!start||!end||start>end){error('请选择有效的日期范围，开始日期不能晚于结束日期。');return;}
 error('');const v=live?serverStats:Analytics.stats(data,start,end,filtered);if(!v)return;
 $('range').textContent=`${time(data.log_first)} — ${time(data.log_last)} · 北京时间 · ${live?'服务器日志 · 每分钟更新':source==='log'?'导入日志，不会自动更新':'统计快照，不会自动更新'}`;
 $('visits').textContent=fmt(v.visits);$('ips').textContent=fmt(v.ip);$('requests').textContent=fmt(v.requests);
 $('visit-label').textContent=filtered?'过滤后的主页访问':'成功获取主页';
 $('visits-hint').textContent=filtered?`原始主页请求 ${fmt(v.home)} 次`:'含爬虫与自动扫描，按请求计数';
 $('ips-hint').textContent=v.ip==null?'快照无法对所选多日跨日去重':'IP 数不等于真实用户数';
 $('errors').textContent=v.status&&v.requests?`${((v.status[404]||0)/v.requests*100).toFixed(1)}%`:'—';
 $('errors-hint').textContent=v.status?`${fmt(v.status[404]||0)} 次 404 · 不代表解析失败`:'快照缺少所选日期的响应分布';
 $('days').textContent=`${v.daily.length} 个有记录的日期`;
 $('table-visit-label').textContent=filtered?'过滤后主页':'主页请求（未过滤）';
 $('tbody').replaceChildren();
 for(const d of v.daily){const row=el('tr'), date=el('td',d.date);if(d.date===new Date(Date.parse(data.log_first)+8*3600000).toISOString().slice(0,10)||d.date===new Date(Date.parse(data.log_last)+8*3600000).toISOString().slice(0,10))date.append(el('span','边界日期','tag'));row.append(date);for(const n of [d.requests,d.home_success,filtered?d.remaining_browser_shaped_requests:d.home_success,filtered?d.remaining_browser_shaped_distinct_ips:d.home_distinct_ips])row.append(el('td',fmt(n)));$('tbody').append(row);}
 if(!v.daily.length){const td=el('td','所选日期没有访问记录');td.colSpan=5;td.style.textAlign='center';const tr=el('tr');tr.append(td);$('tbody').append(tr);}
 const total=el('tr');for(const n of ['区间合计',fmt(v.requests),fmt(v.home),fmt(v.visits),fmt(v.ip)])total.append(el('td',n));$('tfoot').replaceChildren(total);
 $('chart-home').setAttribute('aria-pressed',chartMode==='home');$('chart-all').setAttribute('aria-pressed',chartMode==='all');
 $('chart-subtitle').textContent=chartMode==='home'?'成功获取主页的请求次数':'包含资源、跳转、爬虫与扫描';
 drawChart(v,filtered);drawStatuses(v);
 $('notice').textContent=`${live?'服务器汇总，更新于 '+time(checkedAt)+'。':source==='log'?'导入的访问日志已在浏览器中处理。':'当前展示已核对的日志汇总，数据截止 '+time(data.log_last)+'。'}${data.unparsed?' 有 '+fmt(data.unparsed)+' 行未识别，未计入统计。':''}`;
 $('share-note').textContent=data.active_unexpired_shares_at_query==null?'当前导入数据没有分享统计。访问日志不能推断分享数量。':`原始汇总查询时有 ${fmt(data.active_unexpired_shares_at_query)} 条未过期分享。这是当时的快照，无法反映累计分享次数或当前实时数量。`;
}
function drawChart(v,filtered){
 const host=$('chart');host.replaceChildren();$('legend').replaceChildren();if(!v.daily.length){host.append(el('div','所选日期暂无记录','empty'));return;}
 const svg=s('svg',{viewBox:'0 0 660 236','aria-hidden':'true'}), maxValue=Math.max(...v.daily.map(d=>chartMode==='all'?d.requests:d.home_success),1), step=Math.max(1,Math.ceil(maxValue/4)), top=step*4, plotH=174, left=44, width=595, n=v.daily.length;
 for(let i=0;i<=4;i++){const y=12+plotH-i*plotH/4;svg.append(s('line',{x1:left,y1:y,x2:645,y2:y,stroke:'#edf2f3'}),s('text',{x:left-10,y:y+4,'text-anchor':'end',fill:'#8a9ba3','font-size':10},fmt(i*step)));}
 const slot=width/n, bar=Math.max(.5,Math.min(36,slot*.38));
 v.daily.forEach((d,i)=>{const center=left+slot*(i+.5), original=chartMode==='all'?d.requests:d.home_success, selected=filtered?d.remaining_browser_shaped_requests:d.home_success;
  const rect=(x,value,color,label)=>{const h=value/top*plotH,r=s('rect',{x,y:12+plotH-h,width:bar,height:h,rx:Math.min(4,bar/3),fill:color});r.append(s('title',{},`${d.date} · ${label} ${value} 次`));svg.append(r);};
  if(chartMode==='home'&&filtered){rect(center-bar-2,original,'#dce6e9','原始主页');rect(center+2,selected,'#087f75','过滤后主页');}else rect(center-bar/2,original,'#087f75',chartMode==='all'?'全部请求':'主页请求');
  if(n<=12||i%Math.ceil(n/8)===0||i===n-1)svg.append(s('text',{x:center,y:211,'text-anchor':'middle',fill:'#6a7d88','font-size':10},d.date.slice(5).replace('-','/')));
  const paired=chartMode==='home'&&filtered, labelValue=paired?selected:original;
  if(n<=7)svg.append(s('text',{x:paired?center+2+bar/2:center,y:Math.max(10,12+plotH-labelValue/top*plotH-8),'text-anchor':'middle',fill:paired?'#087f75':'#516973','font-size':11},fmt(labelValue)));
 });host.append(svg);
 const legend=(text,gray=false)=>{const e=el('span'), dot=el('i',null,'dot'+(gray?' gray':''));e.append(dot,document.createTextNode(text));$('legend').append(e);};
 if(chartMode==='home'&&filtered){legend('过滤后主页访问');legend('原始主页请求',true);}else legend(chartMode==='all'?'全部请求':'主页请求（未过滤）');
}
function drawStatuses(v){
 const host=$('statuses');host.replaceChildren();if(!v.status){host.append(el('div','所选日期的响应分布不可用','empty'));$('status-foot').textContent='导入原始日志后即可按日期筛选响应状态。';return;}
 const groups=[['正常响应 · 2xx',n=>n>=200&&n<300,'#087f75'],['跳转 / 缓存 · 3xx',n=>n>=300&&n<400,'#7692dd'],['请求错误 · 4xx',n=>n>=400&&n<500,'#dfa05e'],['服务错误 · 5xx',n=>n>=500,'#bf6d73']];
 for(const [label,match,color] of groups){const count=Object.entries(v.status).reduce((n,[k,c])=>n+(match(Number(k))?c:0),0),row=el('div',null,'status-row'),head=el('div',null,'status-label');head.append(el('span',label),el('span',`${fmt(count)} · ${v.requests?(count/v.requests*100).toFixed(1):'0.0'}%`));const track=el('div',null,'track'),fill=el('div',null,'fill');fill.style.width=(v.requests?count/v.requests*100:0)+'%';fill.style.background=color;track.append(fill);row.append(head,track);host.append(row);}
 $('status-foot').textContent='404 多数来自资源缺失或扫描路径；这些请求不等于用户解析 PCB 失败。';
}
$('all').onclick=()=>{allDates=true;live?refreshLive():reset();};for(const id of ['start','end','filter'])$(id).addEventListener('change',()=>{if(id!=='filter')allDates=false;live?refreshLive():render();});
$('chart-home').onclick=()=>{chartMode='home';render();};$('chart-all').onclick=()=>{chartMode='all';render();};
$('import').onclick=()=>$('file').click();
$('file').onchange=async()=>{
 const file=$('file').files[0];if(!file)return;$('import').disabled=true;$('import').textContent='读取中…';
 try{if(file.size>30*1024*1024)throw Error('文件大于 30 MB，请按天拆分日志后导入。');const text=await file.text();let next,kind;
  if(file.name.toLowerCase().endsWith('.json')||text.trimStart().startsWith('{')){next=Analytics.validateSnapshot(JSON.parse(text));kind='snapshot';}
  else{next=Analytics.parseLog(text,$('exclude').value.split(/[,，\s]+/).filter(Boolean));kind='log';}
  data=next;source=kind;reset();
 }catch(e){error(e instanceof SyntaxError?'JSON 文件无法读取，请选择有效的统计汇总文件。':e.message||'导入失败。');}
 finally{$('file').value='';$('import').disabled=false;$('import').textContent='导入数据';}
};
$('export').onclick=()=>{const blob=new Blob([JSON.stringify(Analytics.exportSnapshot(data),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download=`pcb-usage-${new Date(Date.parse(data.log_last)+8*3600000).toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
async function refreshLive(){
 const sequence=++requestSequence;const btn=$('refresh');btn.disabled=true;btn.textContent='刷新中…';
 const query=new URLSearchParams({filtered:$('filter').checked?'1':'0'});
 if(!allDates){const start=$('start').value,end=$('end').value;if(!start||!end||start>end){error('请选择有效的日期范围。');btn.disabled=false;btn.textContent='刷新数据';return;}query.set('start',start);query.set('end',end);}
 try{const response=await fetch('data?'+query,{cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error(response.status===401?'登录已失效，请重新打开页面登录。':'暂时无法读取服务器统计，请稍后刷新。');const result=await response.json();if(sequence!==requestSequence)return;
  const next=Analytics.validateSnapshot(result.snapshot), selected=result.selected;if(!selected||!Array.isArray(selected.daily)||!['requests','home','visits','ip'].every(k=>Number.isSafeInteger(selected[k])&&selected[k]>=0)||!selected.status||!Number.isFinite(Date.parse(result.checked_at)))throw Error('服务器返回的统计数据无效。');
  data=next;serverStats=selected;checkedAt=result.checked_at;source='server';
  for(const id of ['start','end']){$(id).min=data.daily[0].date;$(id).max=data.daily.at(-1).date;}
  $('start').value=selected.start;$('end').value=selected.end;render();loadVisitors();document.dispatchEvent(new Event('pcb-stats-updated'));
 }catch(e){if(sequence===requestSequence)error(e.message||'更新失败，请重试。');}
 finally{if(sequence===requestSequence){btn.disabled=false;btn.textContent='刷新数据';}}
}
let visitorPage=1,visitorSequence=0,visitorKey='',visitorTimer;
async function loadVisitors(){
 if(!live)return;
 const base={start:$('start').value,end:$('end').value,scope:$('visitor-scope').value,q:$('visitor-search').value.trim(),sort:$('visitor-sort').value,filtered:$('filter').checked?'1':'0'},key=JSON.stringify(base);
 if(key!==visitorKey){visitorPage=1;visitorKey=key;}
 const sequence=++visitorSequence,query=new URLSearchParams({...base,page:String(visitorPage)});
 try{const response=await fetch('visitors?'+query,{cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('暂时无法读取 IP 明细，请刷新重试。');const result=await response.json();if(sequence!==visitorSequence)return;
  if(!Array.isArray(result.items)||!Number.isSafeInteger(result.total)||!Number.isSafeInteger(result.page)||!Number.isSafeInteger(result.page_size))throw Error('IP 明细返回格式无效。');
  visitorPage=result.page;$('visitor-error').hidden=true;$('visitor-body').replaceChildren();
  const kinds={machine:['疑似机器','machine'],test:['已排除测试','test'],browser:['浏览器形式','browser'],unknown:['未识别','unknown']};
  for(const item of result.items){const row=el('tr'),ip=el('td',item.ip);ip.className='ip-address';const location=el('td');location.append(el('div',item.region||'未识别'),el('div',item.isp||'运营商未识别','small'));row.append(ip,location,el('td',fmt(item.requests)),el('td',fmt(item.home_visits)),el('td',time(item.last_visit)));const usage=item.usage,ms=usage?.active_ms||0,minutes=Math.floor(ms/60000),duration=minutes>=60?Math.floor(minutes/60)+'时 '+minutes%60+'分':minutes?minutes+'分':Math.floor(ms/1000)+'秒';row.append(el('td',usage?String(usage.parses):'—'),el('td',!usage?'不可用':usage.active_now?'当前活跃':usage.sessions?'有使用记录':'暂无上报',usage?.active_now?'usage-active-tag':''),el('td',usage?duration:'—'),el('td',usage?.last_parse?time(usage.last_parse*1000):'—'));const kind=el('td'),label=kinds[item.kind]||kinds.unknown;kind.append(el('span',label[0],'source-tag '+label[1]));row.append(kind);$('visitor-body').append(row);}
  if(!result.items.length){const tr=el('tr'),td=el('td','没有匹配的 IP 访问记录');td.colSpan=10;td.style.textAlign='center';tr.append(td);$('visitor-body').append(tr);}
  const pages=Math.max(1,Math.ceil(result.total/result.page_size));$('visitor-total').textContent=`共 ${fmt(result.total)} 个不同 IP · 每页 ${result.page_size} 条`;$('visitor-page').textContent=`${result.page} / ${pages}`;$('visitor-prev').disabled=result.page<=1;$('visitor-next').disabled=result.page>=pages;
  $('geo-status').textContent=result.geo?.ipv4&&result.geo?.ipv6?'离线地址库已就绪（IPv4 / IPv6）':'部分地址库未就绪，地区可能不可用';
 }catch(e){if(sequence===visitorSequence){$('visitor-error').hidden=false;$('visitor-error').textContent=e.message||'明细更新失败。';}}
}
if(live){
 document.addEventListener('pcb-usage-updated',loadVisitors);
 $('refresh').onclick=refreshLive;
 $('visitor-search').addEventListener('input',()=>{clearTimeout(visitorTimer);visitorTimer=setTimeout(loadVisitors,300);});
 for(const id of ['visitor-scope','visitor-sort'])$(id).onchange=loadVisitors;
 $('visitor-prev').onclick=()=>{visitorPage--;loadVisitors();};$('visitor-next').onclick=()=>{visitorPage++;loadVisitors();};
 refreshLive();setInterval(refreshLive,60000);
}else reset();
