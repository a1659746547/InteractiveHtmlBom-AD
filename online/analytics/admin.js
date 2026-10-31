(()=>{'use strict';
 const views={overview:['数据概览','了解访问、解析与活跃情况'],visitors:['访问明细','按 IP 查看访问来源、解析次数与活跃时间'],failures:['失败排查','查看转换异常，在样本到期前下载分析'],settings:['网站设置','管理聊天室开关与统计说明']};
 const buttons=[...document.querySelectorAll('.admin-nav [data-view]')];
 function show(name,focus=false){
  if(!views[name])name='overview';
  for(const [key] of Object.entries(views))document.getElementById('admin-view-'+key).hidden=key!==name;
  for(const button of buttons){if(button.dataset.view===name)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current')}
  document.getElementById('admin-page-title').textContent=views[name][0];document.getElementById('admin-page-description').textContent=views[name][1];
  document.querySelector('.admin-filter').hidden=name==='settings';
  document.querySelector('.filter').hidden=name==='failures'||name==='settings';
  document.querySelector('.actions').hidden=name==='failures'||name==='settings';
  document.getElementById('export').hidden=name!=='overview';
  document.title=views[name][0]+' · PCB 焊接助手后台';
  if(focus)window.scrollTo({top:0,behavior:'instant'});
 }
 for(const button of buttons)button.onclick=()=>{history.replaceState(null,'','#'+button.dataset.view);show(button.dataset.view,true)};
 window.addEventListener('hashchange',()=>show(location.hash.slice(1)));
 for(const wrapper of document.querySelectorAll('.table-wrap')){wrapper.tabIndex=0;wrapper.setAttribute('aria-label','数据表格，可横向滚动')}
 show(location.hash.slice(1));
})();
