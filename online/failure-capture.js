// Failure handling follows the existing parsing explanation; successful files stay local.
(()=>{
 'use strict';
 const notice=document.getElementById('failure-notice');
 let attempt=null;
 function begin(files){
  attempt={files:[...files],consent:true,reported:false};
  notice.textContent='';
 }
 function reason(message){
  if(/50 MB|超过.*MB|超限/.test(message))return 'too_large';
  if(/30 秒|超时|timeout/i.test(message))return 'timeout';
  if(/不支持|请选择|格式不|一次选择/.test(message))return 'unsupported';
  if(/焊盘.*尺寸/.test(message))return 'invalid_pad';
  if(/ZIP|CRC|解压|压缩|加密/i.test(message))return 'archive';
  if(/未找到|没有.*(PCB|图层)|无.*PCB/.test(message))return 'no_board';
  if(/无效|损坏|校验|JSON|invalid/i.test(message))return 'invalid_data';
  return 'parser_error';
 }
 function format(file){const ext=file.name.split('.').at(-1).toLowerCase();return ['pcbdoc','kicad_pcb','eprj2','epro','epro2','json','asc','pcb','zip'].includes(ext)?ext:/^(gbr|ger|gerber|g[a-z0-9]+|drl|xln|exc|nc|tap)$/.test(ext)?'gerber':'unknown'}
 async function report(message){
  const current=attempt;if(!current||current.reported||!message)return;
  current.reported=true;
  // A multi-layer selection reports the attempt once and does not upload unrelated layers.
  const file=current.files[0];if(!file)return;
  const allowed=current.consent&&current.files.length===1;
  const event=Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('');
  try{
   const response=await fetch('/api/failures',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event,format:format(file),size:file.size,reason:reason(message),consent:allowed}),signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw Error();const result=await response.json();
   if(attempt===current)notice.textContent='失败记录已提交。'+(allowed&&result.sample_allowed?'正在上传排查样本…':'未上传原文件。');
   if(allowed&&result.sample_allowed){
    const upload=await fetch('/api/failures/'+result.id+'/sample',{method:'POST',headers:{'Content-Type':'application/octet-stream','X-Failure-Token':result.upload_token},body:file,signal:AbortSignal.timeout(90000)});
    if(!upload.ok)throw Error('sample');
    if(attempt===current)notice.textContent='失败记录和排查样本已提交；样本将在 1 小时到期后不可访问并自动清理。';
   }
  }catch(e){if(attempt===current)notice.textContent=e.message==='sample'?'失败记录已提交，样本上传未完成。':'失败记录提交未完成，请稍后重试或通过网站反馈联系我们。'}
 }
 window.pcbFailureReport=report;
 const original=importSelection;
 importSelection=async files=>{begin(files);try{return await original(files)}catch(error){report(error.message);throw error}};
 // Project switching / ZIP board selection bypass importSelection, but remain part of that attempt.
 const hostError=document.getElementById('error');
 new MutationObserver(()=>{if(hostError.textContent)report(hostError.textContent)}).observe(hostError,{childList:true,subtree:true,characterData:true});
 const frame=document.getElementById('viewer');
 frame.addEventListener('load',()=>{try{
  if(!document.body.classList.contains('gerber-mode'))return;
  const doc=frame.contentDocument,error=doc?.getElementById('error'),operation=doc?.getElementById('operation');
  if(!error||!operation)return;
  const check=()=>{if(!error.hidden&&/导入未完成|未加载/.test(operation.textContent))report(error.textContent)};
  new MutationObserver(check).observe(doc.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['hidden']});check();
 }catch{}});
})();
