// ZIP files are read in memory only; no archive path is written to disk.
function listGerberZip(bytes){
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);const need=(p,n)=>{if(p<0||p+n>bytes.length)throw Error('ZIP 文件被截断')};const u=(p)=>{need(p,4);return v.getUint32(p,true)},s=p=>{need(p,2);return v.getUint16(p,true)};
 let end=-1;for(let p=bytes.length-22;p>=Math.max(0,bytes.length-65557);p--)if(u(p)===0x06054b50&&p+22+s(p+20)===bytes.length){end=p;break}if(end<0)throw Error('不是有效 ZIP 文件');
 if(s(end+4)||s(end+6)||s(end+8)!==s(end+10))throw Error('不支持分卷 ZIP');const count=s(end+10),central=u(end+16),length=u(end+12);if(count>5000||central===0xffffffff||length===0xffffffff)throw Error('ZIP 条目过多或使用了 ZIP64');need(central,length);if(central+length>end)throw Error('ZIP 目录越界');
 let p=central,total=0;const entries=[];for(let i=0;i<count;i++){
  need(p,46);if(u(p)!==0x02014b50)throw Error('ZIP 目录损坏');const flags=s(p+8),method=s(p+10),crc=u(p+16),compressed=u(p+20),size=u(p+24),nl=s(p+28),extra=s(p+30),comment=s(p+32),offset=u(p+42);need(p+46,nl+extra+comment);
  const name=new TextDecoder(flags&2048?'utf-8':'gb18030').decode(bytes.subarray(p+46,p+46+nl)).replace(/\\/g,'/');total+=size;if(total>200*1024*1024)throw Error('ZIP 解压后总大小超过 200 MB');
  if(/\.(gbr|ger|gerber|gtl|gbl|gts|gbs|gto|gbo|gtp|gbp|gko|gm\d+|gml|gta|gba|g\d+|drl|xln|exc|nc|tap)$/i.test(name)&&!name.startsWith('__MACOSX/')&&!name.split('/').includes('..')){
   if(flags&1)throw Error('不支持加密的 PCB ZIP');if(![0,8].includes(method))throw Error('ZIP 使用了不支持的压缩方式');if(size>50*1024*1024)throw Error('ZIP 中 PCB 超过 50 MB');need(offset,30);if(u(offset)!==0x04034b50||s(offset+8)!==method||(s(offset+6)&1))throw Error('ZIP 文件头不一致');const start=offset+30+s(offset+26)+s(offset+28);need(start,compressed);if(start+compressed>central)throw Error('ZIP 数据越界');entries.push({name,size,compressed,start,method,crc});
  }p+=46+nl+extra+comment;
 }if(p!==central+length)throw Error('ZIP 目录长度错误');return entries;
}
async function extractZipBoard(bytes,entry){
 let out;if(entry.method===0)out=bytes.slice(entry.start,entry.start+entry.compressed);else{
  if(typeof DecompressionStream==='undefined')throw Error('当前浏览器不支持 ZIP 解压，请解压后选择 PCB 文件');
  let stream;try{stream=new DecompressionStream('deflate-raw')}catch(e){throw Error('当前浏览器不支持 ZIP 解压，请解压后选择 PCB 文件')}
  const reader=new Blob([bytes.subarray(entry.start,entry.start+entry.compressed)]).stream().pipeThrough(stream).getReader(),parts=[];let size=0;try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>entry.size||size>50*1024*1024){await reader.cancel();throw Error('ZIP 解压大小不一致')}parts.push(value)}}finally{reader.releaseLock()}out=new Uint8Array(size);let p=0;for(const part of parts){out.set(part,p);p+=part.length}
 }
 if(out.length!==entry.size)throw Error('ZIP 文件大小校验失败');let crc=0xffffffff;for(const b of out){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}if(((crc^0xffffffff)>>>0)!==entry.crc)throw Error('ZIP 文件校验失败');return new File([out],entry.name.split('/').at(-1),{lastModified:0});
}
