(function(root) {
  'use strict';
  const bot = /bot|crawler|spider|censys|palo alto|zgrab|nmap|l9tcp|l9explore|urlscan|research|forestengine|python|curl|wget|okhttp|libredtail/i;
  const probe = /[.]env|[.]git|wp-|phpinfo|phpunit|cgi-bin|actuator|HNAP|nmap|\/sdk|\/auth$|\/webui|geoserver|\/wiki$|sellers.json|security.txt|ReportServer|containers\/json|developmentserver|secrets|ssh\/|config[.](php|py)|Dr0v|kmonbase/i;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const unique = rows => new Set(rows.map(r => r.ip)).size;
  function parseLog(text, excluded = []) {
    const rows = []; let unparsed = 0;
    const rx = /^(\S+) \S+ \S+ \[([^\]]+)\] "([^"]*)" (\d{3}) (\d+|-) "([^"]*)" "([^"]*)"/;
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const m = rx.exec(line);
      if (!m) { unparsed++; continue; }
      const tm = /^(\d{2})\/([A-Za-z]{3})\/(\d{4}):(\d{2}:\d{2}:\d{2}) ([+-]\d{4})$/.exec(m[2]);
      const month = tm ? months.indexOf(tm[2]) : -1;
      const t = tm && month >= 0 ? Date.parse(`${tm[3]}-${String(month+1).padStart(2,'0')}-${tm[1]}T${tm[4]}${tm[5].slice(0,3)}:${tm[5].slice(3)}`) : NaN;
      if (!Number.isFinite(t)) { unparsed++; continue; }
      const parts = m[3].split(' '), path = (parts[1] || '').split('?')[0];
      rows.push({ip:m[1], t, date:new Date(t + 8*3600000).toISOString().slice(0,10), method:parts[0], path, status:Number(m[4]), ref:m[6], ua:m[7]});
      if (rows.length > 200000) throw Error('日志超过 20 万条，请按天拆分后导入。');
    }
    if (!rows.length) throw Error('没有识别到访问记录。请导入 Nginx combined 格式的访问日志。');
    rows.sort((a,b)=>a.t-b.t);
    const scanIps = new Set(rows.filter(r=>bot.test(r.ua) || probe.test(r.path)).map(r=>r.ip));
    const excludedIps = new Set(excluded);
    for (const r of rows) {
      r.home = r.method === 'GET' && ['/', '/index.html'].includes(r.path) && [200,304].includes(r.status);
      r.candidate = r.home && !scanIps.has(r.ip) && !excludedIps.has(r.ip) && r.ua.includes('Mozilla/');
    }
    const buckets = new Map();
    for(const row of rows) {if(!buckets.has(row.date)) buckets.set(row.date,[]);buckets.get(row.date).push(row);}
    const days = [...buckets.keys()].sort();
    const daily = days.map(date=> {
      const d=buckets.get(date), h=d.filter(r=>r.home), c=d.filter(r=>r.candidate);
      return {date,requests:d.length,home_success:h.length,home_distinct_ips:unique(h),remaining_browser_shaped_requests:c.length,remaining_browser_shaped_distinct_ips:unique(c)};
    });
    const status_counts={}; for (const r of rows) status_counts[r.status]=(status_counts[r.status]||0)+1;
    const h=rows.filter(r=>r.home), c=rows.filter(r=>r.candidate);
    return {site:'https://pcb.kn21.xyz/', timezone:'+08:00', log_first:new Date(rows[0].t).toISOString(),log_last:new Date(rows.at(-1).t).toISOString(), requests:rows.length,unparsed,status_counts,
      homepage_success_requests:h.length,homepage_success_distinct_ips:unique(h),remaining_browser_shaped_homepage_requests:c.length,remaining_browser_shaped_distinct_ips:unique(c),daily,
      active_unexpired_shares_at_query:null, production_modified:false, _rows:rows};
  }
  function validateSnapshot(value) {
    if (!value || !Array.isArray(value.daily) || !value.daily.length || value.daily.length>3700) throw Error('统计文件缺少有效的每日汇总。');
    const number = (n,label) => { if (!Number.isSafeInteger(n) || n<0) throw Error(`${label}无效。`); return n; };
    const daily=value.daily.map(d=>{
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date) || !Number.isFinite(Date.parse(d.date)) || new Date(d.date).toISOString().slice(0,10)!==d.date) throw Error('统计日期无效。');
      const out={date:d.date}; for(const k of ['requests','home_success','home_distinct_ips','remaining_browser_shaped_requests','remaining_browser_shaped_distinct_ips']) out[k]=number(d[k],k);
      if (out.home_success>out.requests || out.home_distinct_ips>out.home_success || out.remaining_browser_shaped_requests>out.home_success || out.remaining_browser_shaped_distinct_ips>out.remaining_browser_shaped_requests) throw Error('统计数量不一致。');
      return out;
    }).sort((a,b)=>a.date.localeCompare(b.date));
    if (new Set(daily.map(d=>d.date)).size!==daily.length) throw Error('统计日期重复。');
    const out={site:'https://pcb.kn21.xyz/',timezone:'+08:00',daily,production_modified:false};
    for(const k of ['requests','unparsed','homepage_success_requests','homepage_success_distinct_ips','remaining_browser_shaped_homepage_requests','remaining_browser_shaped_distinct_ips']) out[k]=number(value[k],k);
    const status_counts={}; for(const [k,v] of Object.entries(value.status_counts||{})) {if(!/^[1-5]\d{2}$/.test(k)) throw Error('响应状态无效。');status_counts[k]=number(v,k);}
    out.status_counts=status_counts;
    for(const k of ['log_first','log_last']) {if (typeof value[k]!=='string' || !Number.isFinite(Date.parse(value[k]))) throw Error('统计时间无效。');out[k]=value[k];}
    const sum=k=>daily.reduce((n,d)=>n+d[k],0);
    if(sum('requests')!==out.requests || sum('home_success')!==out.homepage_success_requests || sum('remaining_browser_shaped_requests')!==out.remaining_browser_shaped_homepage_requests || Object.values(status_counts).reduce((a,b)=>a+b,0)!==out.requests || Date.parse(out.log_first)>Date.parse(out.log_last)) throw Error('汇总数量或时间不一致。');
    if(out.homepage_success_distinct_ips>out.homepage_success_requests || out.remaining_browser_shaped_distinct_ips>out.remaining_browser_shaped_homepage_requests) throw Error('IP 数量不一致。');
    out.active_unexpired_shares_at_query=value.active_unexpired_shares_at_query==null?null:number(value.active_unexpired_shares_at_query,'分享数量');
    return out;
  }
  function stats(data, start, end, filtered=true) {
    const daily=data.daily.filter(d=>d.date>=start && d.date<=end);
    const sum=k=>daily.reduce((n,d)=>n+d[k],0), all=daily.length===data.daily.length;
    const rows=data._rows?.filter(r=>r.date>=start && r.date<=end);
    const selected=rows?.filter(r=>filtered?r.candidate:r.home);
    const ip=rows?unique(selected):all?(filtered?data.remaining_browser_shaped_distinct_ips:data.homepage_success_distinct_ips):daily.length===1?daily[0][filtered?'remaining_browser_shaped_distinct_ips':'home_distinct_ips']:daily.length===0?0:null;
    const status={}; if(rows) for(const r of rows) status[r.status]=(status[r.status]||0)+1; else if(all) Object.assign(status,data.status_counts);
    return {daily,requests:sum('requests'),home:sum('home_success'),visits:sum(filtered?'remaining_browser_shaped_requests':'home_success'),ip,status:rows||all?status:null};
  }
  function exportSnapshot(data) {
    const out=validateSnapshot(data);
    out.limitations=['IP counts are not confirmed users','request Host is absent from access log','browser-side actions are not instrumented','share lifetime history is unavailable'];
    return out;
  }
  const api={parseLog,validateSnapshot,stats,exportSnapshot};
  if(typeof module!=='undefined' && module.exports) module.exports=api;
  else root.Analytics=api;
})(typeof globalThis!=='undefined'?globalThis:this);
