(()=>{
 const dialog=document.getElementById('feedback-dialog'),form=document.getElementById('feedback-form'),send=document.getElementById('feedback-send'),status=document.getElementById('feedback-status');
 let submitting=false,selecting=false,images=[];
 const imageInput=document.getElementById('feedback-images'),addImages=document.getElementById('feedback-add-images'),imageList=document.getElementById('feedback-image-list');
 const imageMime=bytes=>bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':bytes.slice(0,8).join(',')==='137,80,78,71,13,10,26,10'?'image/png':String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP'?'image/webp':null;
 function renderImages(){
  imageList.replaceChildren();addImages.disabled=submitting||selecting||images.length>=3;
  for(const item of images){const card=document.createElement('div');card.className='feedback-image';const img=document.createElement('img');img.src=item.url;img.alt=item.file.name;const name=document.createElement('span');name.textContent=item.file.name;name.title=item.file.name;const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.setAttribute('aria-label','删除图片 '+item.file.name);remove.disabled=submitting;remove.onclick=()=>{URL.revokeObjectURL(item.url);images=images.filter(x=>x!==item);renderImages()};card.append(img,name,remove);imageList.append(card)}
 }
 addImages.onclick=()=>imageInput.click();
 imageInput.onchange=async()=>{
  if(submitting||selecting)return;selecting=true;send.disabled=true;renderImages();const errors=[];
  try{for(const file of imageInput.files){
   if(images.length>=3){errors.push('最多选择 3 张图片。');break;}
   if(file.size>5*1024*1024||!file.size){errors.push(file.name+'：图片须小于 5 MB 且不能为空。');continue;}
   const mime=imageMime(new Uint8Array(await file.slice(0,12).arrayBuffer()));if(!mime){errors.push(file.name+'：仅支持 JPG、PNG、WebP 图片。');continue;}
   const url=URL.createObjectURL(new Blob([file],{type:mime}));
   try{await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>img.naturalWidth*img.naturalHeight>20000000?reject(Error('图片分辨率过高，请缩小后重试。')):resolve();img.onerror=()=>reject(Error('图片无法读取。'));img.src=url});images.push({file,mime,url})}catch(e){URL.revokeObjectURL(url);errors.push(file.name+'：'+e.message)}
  }}finally{selecting=false;imageInput.value='';send.disabled=false;renderImages();}
  setStatus(errors.join('\n'),errors.length?'error':'');
 };
 const encodeImage=item=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve({mime:item.mime,data:String(reader.result).split(',')[1]});reader.onerror=()=>reject(Error('图片读取失败，请重新选择。'));reader.readAsDataURL(item.file)});
 const setStatus=(text,kind='')=>{status.textContent=text;status.dataset.kind=kind};
 for(const trigger of document.querySelectorAll('.feedback-trigger'))trigger.addEventListener('click',()=>{if(!dialog.open)dialog.showModal()});
 document.getElementById('feedback-close').onclick=()=>{if(!submitting)dialog.close()};
 dialog.addEventListener('cancel',e=>{if(submitting)e.preventDefault()});
 form.addEventListener('submit',async e=>{
  e.preventDefault();if(submitting||selecting||!form.reportValidity())return;
  const payload={category:form.elements.category.value,content:form.elements.content.value.trim(),contact:form.elements.contact.value.trim(),website:form.elements.website.value,view:document.body.classList.contains('gerber-mode')?'Gerber 查看':document.body.classList.contains('loaded')?'PCB 装配':'主页'};
  if(payload.content.length<5){setStatus('请填写至少 5 个字的反馈内容。','error');return;}
  if(location.protocol==='file:'||['localhost','127.0.0.1','::1','[::1]'].includes(location.hostname)){
   setStatus('本地检查版：反馈未发送。配置服务器邮件服务后，可正式提交。');return;
  }
  submitting=true;send.disabled=true;send.textContent='正在发送…';setStatus('');renderImages();
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),60000);
  try{
   payload.images=await Promise.all(images.map(encodeImage));
   const response=await fetch('/api/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),credentials:'omit',signal:controller.signal});
   let result;try{result=await response.json()}catch{throw Error('反馈服务暂不可用，请稍后重试。')}
   if(!response.ok||result.ok!==true)throw Error(result.error||'发送失败，请稍后重试。');
   setStatus('反馈已发送，感谢你的建议。','success');form.reset();for(const item of images)URL.revokeObjectURL(item.url);images=[];
  }catch(err){setStatus(err.name==='AbortError'?'请求超时，发送结果未确认；请稍后再试。':err.message||'网络异常，请稍后重试。','error')}
  finally{clearTimeout(timer);submitting=false;send.disabled=false;send.textContent='提交反馈';renderImages()}
 });
})();
