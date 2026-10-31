// Navigate the current BOM order without changing assembly progress.
(function () {
  Object.assign(i18nDict.en, {
    pending_previous: 'Prev unplaced', pending_next: 'Next unplaced',
    pending_navigation: 'Unplaced component navigation', pending_order: 'Current table order',
    pending_complete: 'All items in this view are placed', pending_empty: 'No matching components',
    pending_netlist: 'Switch to a BOM view to navigate', pending_group_hint: 'Grouped view navigates BOM groups; detail view navigates individual components. Respects filters, sorting and board side.',
    pending_count: 'unplaced'
  });
  Object.assign(i18nDict.zh, {
    pending_previous: '上一个未装', pending_next: '下一个未装',
    pending_navigation: '未装元件跳转', pending_order: '按当前表格顺序',
    pending_complete: '当前范围已全部装配', pending_empty: '没有匹配的元件',
    pending_netlist: '请切换到 BOM 视图', pending_group_hint: '分组视图按 BOM 组跳转，明细视图逐个跳转；遵循当前筛选、排序和正反面范围。',
    pending_count: '个未装'
  });

  window.addEventListener('load', function () {
    const $ = id => document.getElementById(id);
    const nav = document.createElement('nav'); nav.id = 'pending-navigation'; nav.className = 'hideonprint';
    nav.innerHTML = '<button id="pending-previous" type="button"><svg class="pending-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m14 6-6 6 6 6"/></svg><span data-i18n="pending_previous"></span></button><button id="pending-next" type="button"><span data-i18n="pending_next"></span><svg class="pending-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m10 6 6 6-6 6"/></svg></button><span id="pending-status" role="status" aria-live="polite" aria-atomic="true"></span>';
    function rows() {
      const placed = getStoredCheckboxRefs('Placed');
      return [...$('bombody').children].map(row => ({
        row, pending: JSON.parse(row.dataset.progressRefs || '[]').filter(index => !placed.has(index))
      }));
    }
    function update() {
      const items = rows(), netlist = settings.bommode === 'netlist';
      const anyPending = !netlist && items.some(item => item.pending.length);
      nav.setAttribute('aria-label', t('pending_navigation')); nav.title = t('pending_group_hint');
      for (const [id, key] of [['pending-previous','pending_previous'],['pending-next','pending_next']]) {
        $(id).disabled = !anyPending;
        $(id).querySelector('[data-i18n]').textContent = t(key);
      }
      const selected = items.find(item => item.row.id === currentHighlightedRowId);
      const names = selected ? selected.pending.map(index => pcbdata.footprints[index].ref) : [];
      let status = netlist ? t('pending_netlist') : !items.length ? t('pending_empty') : !anyPending ? t('pending_complete') : t('pending_order');
      if (anyPending && names.length) {
        status = names.slice(0,2).join(', ') + (names.length > 2 ? '…' : '') + ' · ' + names.length + ' ' + t('pending_count');
      }
      $('pending-status').textContent = status;
      $('pending-status').title = names.length ? names.join(', ') : status;
    }
    // Preserve zoom while making a selected footprint/group visible after a pan.
    function reveal(indices) {
      for (const layer of [allcanvas.front, allcanvas.back]) {
        const canvas = layer.bg, transform = layer.transform, points = [];
        if (!canvas.width || !canvas.height) continue;
        for (const index of indices) {
          const fp = pcbdata.footprints[index]; if (fp.layer !== layer.layer) continue;
          const box = fp.bbox;
          for (const dx of [0,box.size[0]]) for (const dy of [0,box.size[1]]) {
            const offset = rotateVector([box.relpos[0]+dx,box.relpos[1]+dy],-box.angle);
            const point = rotateVector([box.pos[0]+offset[0],box.pos[1]+offset[1]],settings.boardRotation);
            points.push([(layer.layer === 'B' ? -1 : 1)*(transform.x+point[0]*transform.s), transform.y+point[1]*transform.s]);
          }
        }
        if (!points.length || points.some(point => !point.every(Number.isFinite))) continue;
        const bounds = points.reduce((b,p)=>[Math.min(b[0],p[0]),Math.max(b[1],p[0]),Math.min(b[2],p[1]),Math.max(b[3],p[1])],[Infinity,-Infinity,Infinity,-Infinity]);
        const [minX,maxX,minY,maxY] = bounds;
        const margin = 10*devicePixelRatio;
        if ((minX+transform.panx)*transform.zoom >= margin && (maxX+transform.panx)*transform.zoom <= canvas.width-margin &&
            (minY+transform.pany)*transform.zoom >= margin && (maxY+transform.pany)*transform.zoom <= canvas.height-margin) continue;
        transform.zoom = Math.min(transform.zoom,canvas.width*.85/Math.max(1,maxX-minX),canvas.height*.85/Math.max(1,maxY-minY));
        transform.panx = canvas.width/(2*transform.zoom)-(minX+maxX)/2;
        transform.pany = canvas.height/(2*transform.zoom)-(minY+maxY)/2;
        redrawCanvas(layer);
      }
    }
    function move(direction) {
      if (settings.bommode === 'netlist') return;
      const items = rows(), count = items.length;
      let start = items.findIndex(item => item.row.id === currentHighlightedRowId);
      if (start < 0) start = direction > 0 ? -1 : 0;
      for (let step = 1; step <= count; step++) {
        const item = items[(start+direction*step+count)%count];
        if (!item.pending.length) continue;
        const refs = item.pending.map(index => [pcbdata.footprints[index].ref,index]);
        clearHighlightedFootprints();
        createRowHighlightHandler(item.row.id,refs,null)();
        // Scroll the BOM panel only, keeping its controls and outer page in place.
        const panel = $('bomdiv'), rowBox = item.row.getBoundingClientRect(), panelBox = panel.getBoundingClientRect();
        panel.scrollTop += rowBox.top-panelBox.top-panel.clientHeight/2+rowBox.height/2;
        reveal(item.pending);
        update();
        return;
      }
      update();
    }
    const top = $('top');
    top.append(nav);
    $('pending-previous').onclick = () => move(-1);
    $('pending-next').onclick = () => move(1);
    const media = matchMedia('(max-width:1249.98px)');
    function adapt() {
      if (media.matches) top.after(nav); else top.append(nav);
      requestAnimationFrame(resizeAll);
    }
    media.addEventListener('change',adapt); adapt();
    for (const event of [IBOM_EVENT_TYPES.BOM_BODY_CHANGE_EVENT,IBOM_EVENT_TYPES.CHECKBOX_CHANGE_EVENT,IBOM_EVENT_TYPES.HIGHLIGHT_EVENT]) EventHandler.registerCallback(event,update);
    update();
  });
})();
