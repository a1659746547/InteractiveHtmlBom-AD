(function(root){
'use strict';
function identify(name,text){
 const x=text.match(/(?:%TF\.FileFunction,|#@!\s*TF\.FileFunction,)([^%*\r\n]+)/i);let type='unknown',number=null,side='';
 if(x){const a=x[1].split(',').map(x=>x.trim());const t=a[0].toLowerCase();
 type=({copper:'copper',soldermask:'mask',legend:'silk',paste:'paste',profile:'outline',plated:'drill',nonplated:'drill',glue:'adhesive'})[t]||'unknown';
 number=Number((a.find(x=>/^L\d+$/i.test(x))||'').slice(1))||null;side=a.some(x=>/^(Bot|Bottom)$/i.test(x))?'bottom':a.some(x=>/^Top$/i.test(x))?'top':'';
 }else{let n=name.toLowerCase();
 if(/\.(drl|xln|exc|nc|tap)$/.test(n)||/^M48/m.test(text))type='drill';
 else if(/\.(gko|gm1|gml)$|edge[._ -]?cuts|outline|profile/.test(n))type='outline';
 else if(/\.(gts|gbs)$|solder.?mask|[._]mask/.test(n))type='mask';
 else if(/\.(gto|gbo)$|silk|legend/.test(n))type='silk';
 else if(/\.(gtp|gbp)$|paste/.test(n))type='paste';
 else if(/\.(gtl|gbl|g\d+)$|[._]cu\b|copper|inner\d*/.test(n))type='copper';
 side=/\.(gb[lspot])$|bottom|b[._-](cu|silk|mask|paste)/.test(n)?'bottom':/\.(gt[lspot])$|top|f[._-](cu|silk|mask|paste)/.test(n)?'top':'';
 const m=n.match(/\.g(\d+)$|inner[._-]?(\d+)/);number=m?Number(m[1]||m[2]):side==='top'&&type==='copper'?1:null;
 }
 return {type,number,side,source:x?'文件属性':'文件名推测'};
}
function union(layers){const b=[Infinity,Infinity,-Infinity,-Infinity];for(const l of layers){const q=l.bounds;if(q[2]<=0||q[3]<=0)continue;b[0]=Math.min(b[0],q[0]);b[1]=Math.min(b[1],q[1]);b[2]=Math.max(b[2],q[0]+q[2]);b[3]=Math.max(b[3],q[1]+q[3]);}return Number.isFinite(b[0])?[b[0],b[1],Math.max(.01,b[2]-b[0]),Math.max(.01,b[3]-b[1])]:[0,0,100,80];}
function flood(mask,w,h,x,y){const start=y*w+x;if(x<0||y<0||x>=w||y>=h||!mask[start])return {mask:new Uint8Array(w*h),count:0};const out=new Uint8Array(w*h),queue=new Uint32Array(w*h);let head=0,tail=1;queue[0]=start;out[start]=1;while(head<tail){let p=queue[head++],xx=p%w;for(const q of [xx>0?p-1:-1,xx<w-1?p+1:-1,p>=w?p-w:-1,p<w*(h-1)?p+w:-1])if(q>=0&&mask[q]&&!out[q]){out[q]=1;queue[tail++]=q;}}return {mask:out,count:tail};}
const api={identify,union,flood};if(typeof module!=='undefined')module.exports=api;root.GerberCore=api;
})(typeof self==='undefined'?globalThis:self);
