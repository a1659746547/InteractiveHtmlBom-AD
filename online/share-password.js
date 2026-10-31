// Passwords are sent in POST bodies only, never in links or browser storage.
function resetSharePassword(id) {
 const input=$(id);input.value='';input.type='password';
 const toggle=document.querySelector('[data-password-target="'+id+'"]');
 if(toggle){toggle.textContent='显示';toggle.setAttribute('aria-label','显示密码');toggle.setAttribute('aria-pressed','false')}
}
for(const button of document.querySelectorAll('[data-password-target]'))button.onclick=()=>{
 const input=$(button.dataset.passwordTarget),show=input.type==='password';input.type=show?'text':'password';
 button.textContent=show?'隐藏':'显示';button.setAttribute('aria-label',show?'隐藏密码':'显示密码');button.setAttribute('aria-pressed',String(show));
};
function sharePasswordValid(value,optional=false){return optional&&value===''||typeof value==='string'&&[...value].length>=4&&[...value].length<=64&&value.trim()!==''&&!/[\x00-\x1f\x7f]/.test(value)&&!/[\ud800-\udfff]/u.test(value)}
function resetShareResult(){const changed=!!$('share-link').value;$('share-link').value='';$('share-copy').disabled=true;$('share-message').textContent=changed?'设置已更改，请重新生成链接':''}
let shareCreateSequence=0,shareCreateController=null;
$('share-password').addEventListener('input',resetShareResult);$('share-ttl').addEventListener('change',resetShareResult);
$('share').onclick=()=>{resetSharePassword('share-password');$('share-dialog').showModal();$('share-link').value='';$('share-message').textContent='';$('share-copy').disabled=true;};
$('share-dialog').addEventListener('close',()=>{++shareCreateSequence;shareCreateController?.abort();resetSharePassword('share-password');$('share-create').disabled=false;$('share-password').disabled=false;$('share-ttl').disabled=false});
$('share-close').onclick=()=>$('share-dialog').close();
$('share-create').onclick=async()=>{
 const password=$('share-password').value;
 if(!sharePasswordValid(password,true)){$('share-message').textContent='访问密码须为 4～64 个字符，留空则无需密码';$('share-password').focus();return}
 const requestSequence=++shareCreateSequence;shareCreateController=new AbortController();
 const button=$('share-create');button.disabled=true;$('share-password').disabled=true;$('share-ttl').disabled=true;resetShareResult();$('share-message').textContent='正在生成链接…';
 try{
  // This snapshot contains PCB data and progress, never the password.
  const data=snapshotCurrentProgress('share');
  const body={ttl:$('share-ttl').value,data};if(password)body.password=password;
  // An older service rejects this endpoint instead of silently creating a public link.
  const response=await fetch(password?'/api/shares/protected':'/api/shares',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:shareCreateController.signal});
  const result=await response.json();
  if(requestSequence!==shareCreateSequence)return;
  if(password&&response.status===404)throw Error('服务器尚未启用密码分享，请更新分享服务后重试');
  if(!response.ok)throw Error(result.error||'生成失败');
  if(password&&result.password_protected!==true)throw Error('未确认密码保护，未显示分享链接，请联系管理员');
  if(!/^[a-f0-9]{48}$/.test(result.id)||!Number.isFinite(result.expires))throw Error('分享服务响应无效');
  $('share-link').value=location.origin+'/#share='+result.id;$('share-copy').disabled=false;
  $('share-message').textContent=(password?'链接已生成，需要密码访问。请将密码另行告知接收方。':'链接已生成，无需密码。')+' 到期时间：'+new Date(result.expires*1000).toLocaleString();
 }catch(e){if(requestSequence===shareCreateSequence)$('share-message').textContent='分享失败：'+e.message}finally{if(requestSequence===shareCreateSequence){button.disabled=false;$('share-password').disabled=false;$('share-ttl').disabled=false}}
};
$('share-copy').onclick=async()=>{try{if(!$('share-link').value)return;await navigator.clipboard.writeText($('share-link').value);shareNotice('链接已复制')}catch(e){$('share-link').select();shareNotice('请手动复制链接')}};

function unlockShared(token){
 const dialog=$('share-unlock-dialog'),form=$('share-unlock-form'),input=$('share-unlock-password'),button=$('share-unlock-submit'),message=$('share-unlock-message');
 resetSharePassword('share-unlock-password');message.textContent='';button.disabled=false;
 return new Promise((resolve,reject)=>{
  let finished=false,controller=null;
  function finish(result,error){if(finished)return;finished=true;controller?.abort();dialog.onclose=null;form.onsubmit=null;if(dialog.open)dialog.close();resetSharePassword('share-unlock-password');button.disabled=false;error?reject(error):resolve(result)}
  dialog.onclose=()=>finish(null,Error('已取消打开分享'));
  $('share-unlock-cancel').onclick=()=>dialog.close();
  form.onsubmit=async event=>{
   event.preventDefault();if(button.disabled)return;
   const password=input.value;if(!sharePasswordValid(password)){message.textContent='密码不正确，请重新输入';input.focus();return}
   button.disabled=true;message.textContent='正在解锁…';controller=new AbortController();
   try{
    const response=await fetch('/api/shares/'+token+'/unlock',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({password}),signal:controller.signal});
    const result=await response.json();if(finished)return;
    if(response.status===410){finish(null,Error(result.error||'分享链接已过期'));return}
    if(!response.ok){message.textContent=result.error||'解锁失败，请重试';input.focus();input.select();return}
    finish(result);
   }catch(error){if(!finished)message.textContent='网络连接失败，请重试'}finally{if(!finished)button.disabled=false}
  };
  dialog.showModal();input.focus();
 });
}
async function loadShared(){
 const match=/^#share=([a-f0-9]{48})$/.exec(location.hash);if(!match)return;
 $('status').textContent='正在打开分享…';$('choose').disabled=true;
 try{
  const response=await fetch('/api/shares/'+match[1],{cache:'no-store'});let result=await response.json();
  if(response.status===401&&result.password_required===true)result=await unlockShared(match[1]);
  else if(!response.ok)throw Error(result.error||'分享无法打开');
  if(!result.data||!result.data.metadata||!Number.isFinite(result.expires))throw Error('分享内容无效');
  viewerHtml=makeViewer(result.data);$('viewer').srcdoc=viewerHtml.replace('<body ', '<body data-embedded="true" ');
  $('board-name').textContent=result.data.metadata.title||'分享的 PCB';
  $('summary').textContent='分享有效至 '+new Date(result.expires*1000).toLocaleString()+' · 修改进度仅保存到此浏览器';
  document.body.classList.add('loaded');for(const id of ['share','html','more','warnings'])$(id).hidden=true;
  function expire(){const remaining=result.expires*1000-Date.now();if(remaining>0){sharedExpiryTimer=setTimeout(expire,Math.min(remaining,2147483647));return}document.body.classList.remove('loaded');$('viewer').srcdoc='';$('error').textContent='分享链接已过期';$('status').textContent=''}expire();
 }catch(e){$('error').textContent=e.message}finally{$('choose').disabled=false;$('status').textContent=''}
}
loadShared();
