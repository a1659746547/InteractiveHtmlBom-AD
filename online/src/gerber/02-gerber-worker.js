self.onmessage=function(e){const {id,name,text}=e.data;
 try{const info=GerberCore.identify(name,text),warnings=[];if(!/%FS|%MO|^M48|^G04|%ADD/m.test(text))throw Error('未识别到 Gerber / Excellon 文件内容');
 let converter=GerberToSvg(text,{id:'g'+id,filetype:info.type==='drill'?'drill':'gerber'},(err,svg)=>{
 if(err)return postMessage({id,error:err.message});const scale=converter.units==='in'?25.4:1;
 const bounds=converter.viewBox.map(x=>x*scale/1000);
 if(!bounds.every(Number.isFinite)||bounds.some(x=>Math.abs(x)>100000))return postMessage({id,error:'图层尺寸异常，请检查单位与坐标格式'});
 if(bounds[2]<=0||bounds[3]<=0)warnings.push('空图层，没有可绘制图形');
 postMessage({id,name,text,info,warnings,bounds,scale,defs:converter.defs.join(''),body:converter.layer.join('')});
 });converter.on('warning',w=>{if(warnings.length<20)warnings.push(w.message)});
 }catch(err){postMessage({id,error:err.message})}
};
