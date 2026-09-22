/* ============ 运动 · 体态改善优先 ============ */
const Sport = {
  tab: 'train',
  sub: null,
  logs() { return S.get('sportLogs', {}); },
  photos() { return S.get('sportPhotos', []); }, // {id,date,part,idbKey}
  photoParts() { let ps = S.get('sportParts', null); if (!ps) { ps = this.defaultParts(); S.set('sportParts', ps); } return (ps && ps.length) ? ps : this.defaultParts(); },
  defaultParts() { return ['正脸', '侧面颈部', '背部/富贵包', '体态全身(侧面)', '腿型(正面)']; },

  render(root) {
    if (this.sub) {
      root.innerHTML = `<div id="spBody"></div>`;
      const body = root.querySelector('#spBody');
      if (this.sub === 'photo') { this.render_photo(body, root); this.appendSportNav(root); return; }
      this.sub = null; this.render(root); return;
    }
    // 主运动页：只放打卡 + 统计 + 视图
    root.innerHTML = `<div id="spBody"></div>`;
    this.render_main_checkin(root.querySelector('#spBody'), root);
    this.appendSportNav(root);
  },
  sportNavHTML() {
    const cur = this.sub === 'photo' ? 'photo' : 'train';
    const items = [['train', '运动打卡'], ['photo', '拍照打卡']];
    return `<div class="subnav">${items.map(([k, l]) => `<button class="${cur === k ? 'on' : ''}" data-ssub="${k}">${l}</button>`).join('')}</div>`;
  },
  appendSportNav(root) {
    root.insertAdjacentHTML('beforeend', this.sportNavHTML());
    root.querySelectorAll('[data-ssub]').forEach(b => b.onclick = () => { this.sub = (b.dataset.ssub === 'photo' ? 'photo' : null); this.render(root); });
  },

  // 项目配色：分类 → 稳定颜色（已知项目按库序固定，自定义项目按名哈希）
  sportColor(name) {
    if (!this._cc) this._cc = {};
    if (this._cc[name]) return this._cc[name];
    const P = (window.MUMU_SPORT && window.MUMU_SPORT.projects) || [];
    const palette = ['#E8746B', '#4A90D9', '#F0A45B', '#9B7FD4', '#5FB58E', '#D98CC4', '#E0C44B', '#7FB069', '#5BC0BE', '#C9A66B'];
    let idx = P.findIndex(p => p.name === name);
    let c;
    if (idx >= 0) c = palette[idx % palette.length];
    else { let h = 0; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0; c = palette[h % palette.length]; }
    this._cc[name] = c; return c;
  },

  render_main_checkin(box, root) {
    const logs = this.logs();
    const restSet = new Set([].concat(S.get('sportRest', []) || [], S.get('menstrualRest', []) || [], annualHolidaySet('2020-01-01', '2050-12-31')));
    const todayIsRest = (S.get('sportRest', []) || []).indexOf(todayStr()) >= 0;
    let streak = 0; let d = todayStr();
    if (!((logs[d] && logs[d].length) || restSet.has(d))) d = addDays(d, -1);
    while ((logs[d] && logs[d].length) || restSet.has(d)) { streak++; d = addDays(d, -1); }
    const todayLogs = logs[todayStr()] || [];
    const todayMin = todayLogs.reduce((s, l) => s + l.minutes, 0);
    const P = window.MUMU_SPORT.projects;
    const projOpts = P.map(p => `<option value="${esc(p.name)}">${p.icon} ${esc(p.name)}</option>`).join('');

    // 当月运动日历：每天按所做项目显示分类彩色圆点（Proxy 随翻月动态取色）
    const ym = todayStr().slice(0, 7);
    const marksProxy = new Proxy({}, { get(t, ds) {
      const arr = logs[ds] || [];
      if (!arr.length) return [];
      const seen = {}; const out = [];
      arr.forEach(l => { const c = Sport.sportColor(l.project); if (!seen[c]) { seen[c] = 1; out.push(c); } });
      return out;
    }});
    const allNames = new Set(P.map(p => p.name));
    Object.values(logs).flat().forEach(l => { if (l.project) allNames.add(l.project); });
    const legendHTML = [...allNames].map(n => `<span class="sp-leg"><span class="sp-leg-dot" style="background:${this.sportColor(n)}"></span>${esc(n)}</span>`).join('');

    box.innerHTML = `
      <div class="card">
        <div class="sp-today-head"><h3>今日打卡记录</h3><span style="display:flex;align-items:center;gap:4px"><button class="icon-btn" id="spAdd" title="去打卡">${icon('plus',18)}</button><button class="icon-btn" id="spRestBtn" title="${todayIsRest ? '取消今日休息' : '今日休息'}（长按日历里那一天可补记）" style="${todayIsRest ? 'color:#e74c3c' : ''}">${icon(todayIsRest ? 'sun' : 'moon',18)}</button></span></div>
        <div id="spTodayLog">
          ${todayLogs.length ? todayLogs.map(l => `<div class="list-row" data-lp><span style="flex:1">${esc(l.project)}</span><span class="tag">${l.minutes} 分钟</span><span class="muted" style="font-size:12px">${esc((l.feel || '').replace(/^[^\s]+\s/, ''))}</span><button class="del" data-spdellog="${l.id}">✕</button></div>`).join('') : '<div class="empty">今天还没打卡，点右上角 ＋ 记一笔</div>'}
        </div>
        <div id="spFormBox" style="display:none;margin-top:12px;padding-top:12px;border-top:1px dashed var(--line)">
          <div class="form-row"><label>选择项目</label><select id="spProj">${projOpts}</select></div>
          <div class="grid2" style="gap:10px">
            <div class="form-row" style="margin:0"><label>练了几分钟</label><input type="number" id="spMin" value="10" style="width:100%"></div>
            <div class="form-row" style="margin:0"><label>感受</label><select id="spFeel"><option>轻松</option><option>有点酸爽</option><option>很累但爽</option><option>不舒服（注意动作或停练）</option></select></div>
          </div>
          <div style="display:flex;gap:8px;margin-top:12px">
            <button class="btn" id="spDo" style="flex:1">打卡</button>
            <button class="btn ghost" id="spMakeup" style="flex:0 0 auto">${icon('clock',14)} 补打卡</button>
          </div>
        </div>
      </div>

      <div class="sp-squares">
        <div class="sp-square"><div class="sp-sq-num">${streak}</div><div class="sp-sq-lab">连续运动天数</div></div>
        <div class="sp-square"><div class="sp-sq-num">${todayMin}</div><div class="sp-sq-lab">今日运动分钟</div></div>
      </div>

      <div class="card">
        <div class="sp-today-head"><h3>当月运动打卡</h3><button class="icon-btn" id="spLegendToggle" title="折叠/展开项目图例">▾</button></div>
        <div id="spMonthCal"></div>
        <div class="sp-rest-note"><span class="sp-rest-sq"></span>休息<span class="muted" style="font-size:11px;margin-left:6px">· 长按日历某天可补记</span></div>
        <div class="sp-mens-note"><span class="sp-mens-sq"></span>月经假<span class="muted" style="font-size:11px;margin-left:6px">· 连续两天 · 与其他假不重叠</span></div>
        <div class="sp-legend collapsed" id="spLegend">${legendHTML}</div>
      </div>

      <div class="card"><h3>视图</h3>
        <div style="display:flex;gap:6px;margin-bottom:10px">
          <button class="btn sm ghost sp-view active" data-view="week">周视图</button>
          <button class="btn sm ghost sp-view" data-view="year">热力图</button>
        </div>
        <div id="spView"></div>
      </div>`;

    const formBox = box.querySelector('#spFormBox');
    box.querySelector('#spAdd').onclick = () => {
      formBox.style.display = formBox.style.display === 'none' ? '' : 'none';
    };
    const restBtn = box.querySelector('#spRestBtn');
    if (restBtn) restBtn.onclick = () => this.toggleRest(root);
    box.querySelector('#spDo').onclick = () => {
      const proj = box.querySelector('#spProj').value;
      const minutes = Number(box.querySelector('#spMin').value) || 0;
      const feel = box.querySelector('#spFeel').value;
      const lg = this.logs(); lg[todayStr()] = lg[todayStr()] || [];
      lg[todayStr()].push({ id: uid(), project: proj, minutes, feel, time: new Date().toTimeString().slice(0, 5) });
      S.set('sportLogs', lg);
      if (window.Daily) window.Daily.autoFromColumn('sport:' + proj, todayStr(), proj, null, { '项目': proj, '运动时长': minutes + '分钟', '程度': feel });
      this.render(root); toast('打卡成功！身体会记住今天');
    };
    box.querySelector('#spMakeup').onclick = () => this.makeupDialog(root);
    box.querySelectorAll('[data-spdellog]').forEach(b => b.onclick = e => {
      e.stopPropagation();
      const lg = this.logs(); const d = todayStr(); if (!lg[d]) return;
      lg[d] = lg[d].filter(l => l.id !== b.dataset.spdellog); S.set('sportLogs', lg); this.render(root); toast('已删除该条记录');
    });
    box.querySelectorAll('.sp-view').forEach(b => b.onclick = () => {
      box.querySelectorAll('.sp-view').forEach(x => x.classList.remove('active'));
      b.classList.add('active'); this.spView(box.querySelector('#spView'), b.dataset.view);
    });
    this.spView(box.querySelector('#spView'), 'week');

    // 当月运动日历（彩色圆点 + 可翻月）；长按某一天可把那天设为/取消休息（补记，长按防误触）
    renderMonthCal(box.querySelector('#spMonthCal'), { ym, marks: marksProxy, restSet, menstrualSet: menstrualSet(), onLongPress: ds => openRestMenu(ds, 'sport', () => this.render(root), d => this.toggleRest(root, d)) });

    // 项目图例折叠
    const legendEl = box.querySelector('#spLegend');
    const legendTgl = box.querySelector('#spLegendToggle');
    if (legendTgl) legendTgl.onclick = () => {
      legendEl.classList.toggle('collapsed');
      legendTgl.textContent = legendEl.classList.contains('collapsed') ? '▾' : '▸';
    };
  },

  // 运动打卡页「今日休息」：直接写 sportRest 数组，不计入连续运动中断（一周最多 1 天，一月最多 4 天）
  // ds 缺省为今天；传入过去日期即可「补记」休息（连续运动天数自动续上）
  toggleRest(root, ds) {
    ds = ds || todayStr();
    if (ds > todayStr()) { toast('不能给未来的日期设休息'); return; }
    const set = _restSet('sport');
    const D = window.Daily;
    if (set.has(ds)) {
      restRemove('sport', ds);
      if (D) { const arr = D.list(ds); arr.forEach(t => { if (t.cat === 'sport') t.restDay = false; }); D.setList(ds, arr); }
      toast('已取消 ' + fmtCN(ds) + ' 的休息 · 连续运动重新计算');
    } else {
      if (menstrualSet().has(ds)) { toast(fmtCN(ds) + ' 已是月经假，不再叠加其他休息'); return; }
      const lg = this.logs();
      if (lg[ds] && lg[ds].length) { toast(fmtCN(ds) + ' 已经有运动打卡，不能设为休息'); return; }
      const chk = restCanAdd('sport', ds);
      if (!chk.ok) { toast(chk.msg); return; }
      restAdd('sport', ds);
      if (D) { const arr = D.list(ds); arr.forEach(t => { if (t.cat === 'sport') t.restDay = true; }); D.setList(ds, arr); }
      toast('已将 ' + fmtCN(ds) + ' 设为休息日 · 连续运动不受影响');
    }
    this.render(root);
  },

  makeupDialog(root) {
    const P = window.MUMU_SPORT.projects;
    const projOpts = P.map(p => `<option value="${esc(p.name)}">${p.icon} ${esc(p.name)}</option>`).join('');
    openModal(`<button class="close-x" onclick="closeModal()">×</button><h3>${icon('clock',18)} 补打卡</h3>
      <div class="muted" style="margin-bottom:8px">补打之前的打卡，选好日期就行，一样记到那天。</div>
      <div class="form-row"><label>日期</label><input type="date" id="mkDate" value="${todayStr()}"></div>
      <div class="form-row"><label>选择项目</label><select id="mkProj">${projOpts}</select></div>
      <div class="grid2" style="gap:10px">
        <div class="form-row" style="margin:0"><label>练了几分钟</label><input type="number" id="mkMin" value="10" style="width:100%"></div>
        <div class="form-row" style="margin:0"><label>感受</label><select id="mkFeel"><option>轻松</option><option>有点酸爽</option><option>很累但爽</option><option>不舒服（注意动作或停练）</option></select></div>
      </div>
      <button class="btn" id="mkOk" style="width:100%;margin-top:12px">补上这条打卡</button>`);
    document.getElementById('mkOk').onclick = () => {
      const d = document.getElementById('mkDate').value || todayStr();
      const proj = document.getElementById('mkProj').value;
      const minutes = Number(document.getElementById('mkMin').value) || 0;
      const feel = document.getElementById('mkFeel').value;
      const lg = this.logs(); lg[d] = lg[d] || [];
      lg[d].push({ id: uid(), project: proj, minutes, feel, time: new Date().toTimeString().slice(0, 5) });
      S.set('sportLogs', lg); closeModal();
      if (window.Daily) window.Daily.autoFromColumn('sport:' + proj, d, proj, null, { '项目': proj, '运动时长': minutes + '分钟', '程度': feel });
      this.render(root);
      toast(d === todayStr() ? '补卡成功' : '已补到 ' + fmtCN(d));
    };
  },

  render_photo(box, root) {
    const ps = this.photos().sort((a, b) => b.date.localeCompare(a.date));
    const byPart = {}; ps.forEach(p => { (byPart[p.part] = byPart[p.part] || []).push(p); });
    const parts = this.photoParts();
    box.innerHTML = `
      <div class="card"><div class="sp-today-head"><h3>${icon('camera',16)} 新增打卡照片</h3><button class="icon-btn" id="spAddPhotoToggle" title="展开/收起">▸</button></div>
        <div id="spAddPhotoBody" style="display:none">
          <div style="display:flex;gap:8px;flex-wrap:wrap">${parts.map(p => `<button class="btn ghost sm" data-shoot="${esc(p)}">＋ ${esc(p)}</button>`).join('')}</div>
          <button class="btn sm ghost" id="spParts" style="margin-top:8px;border:none;background:transparent;color:#111;padding:4px 8px">${icon('edit',14)} 部位管理</button>
        </div>
      </div>
      <div class="card sp-photo-cal"><h3>${icon('camera',16)} 照片日历 <button class="icon-btn" id="spCalToggle" style="margin-left:auto">▾</button></h3>
        <div id="spCalBody"></div>
        <div style="display:flex;gap:6px;margin-top:10px">
          <button class="btn sm ghost sp-cal-mode active" data-cm="day">每日</button>
          <button class="btn sm ghost sp-cal-mode" data-cm="week">每周</button>
          <button class="btn sm ghost sp-cal-mode" data-cm="month">每月</button>
          <button class="btn sm ghost sp-cal-mode" data-cm="year">每年</button>
        </div>
      </div>
      <div class="card"><h3>${icon('search',16)} 变化对比</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
          <select id="cmpPart">${parts.map(p => `<option>${esc(p)}</option>`).join('')}</select>
          <button class="btn sm" id="doCmp">对比该部位最早 vs 最新</button>
          <button class="icon-btn" id="cmpTwoToggle" title="选任意两天对比">▾</button>
        </div>
        <div id="cmpTwo" style="display:none;margin-bottom:12px;padding:10px;border:1px solid var(--line);border-radius:10px">
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <select id="cmpA"></select><span class="muted">vs</span><select id="cmpB"></select>
            <button class="btn sm" id="doCmpTwo">对比</button>
          </div>
        </div>
        <div id="cmpBox" class="grid2"></div>
      </div>
      <div class="card"><h3>${icon('stats',16)} 照片墙</h3>
        ${Object.keys(byPart).map(part => `<div class="sp-pw open" data-part="${esc(part)}">
          <div class="sp-pw-h"><span class="sp-caret">${icon('chevronDown',16)}</span><b>${esc(part)}</b><span class="muted" style="margin-left:5px">${byPart[part].length}张</span></div>
          <div class="sp-pw-b"><div class="grid4" style="margin-top:2px">${byPart[part].slice(0, 8).map(p => `<div data-lp style="position:relative">
            <img class="photo-thumb" data-pid="${p.id}" alt="${p.date}">
            <span class="tag grey" style="position:absolute;top:5px;left:5px">${p.date.slice(5)}</span>
            <button class="del" data-delp="${p.id}" style="position:absolute;top:3px;right:5px;background:#fff;border-radius:50%;width:20px;height:20px">✕</button>
          </div>`).join('')}</div></div>
        </div>`).join('') || '<div class="empty">还没有照片，拍下第一张「之前」，未来的你会感谢现在</div>'}
      </div>`;
    ps.forEach(async p => {         const rec = await IDB.get(p.id); box.querySelectorAll(`[data-pid="${p.id}"]`).forEach(img => { if (rec) img.src = rec.data; }); });
    box.querySelectorAll('[data-shoot]').forEach(b => b.onclick = () => {
      const part = b.dataset.shoot;
      openModal(`<button class="close-x" onclick="closeModal()">×</button><h3>${icon('camera',18)} ${esc(part)}</h3>
        <div class="form-row"><label>日期</label><input type="date" id="phDate" value="${todayStr()}"></div>
        <button class="btn" id="phGo" style="width:100%">去拍照</button>`);
      document.getElementById('phGo').onclick = () => {
        const dt = document.getElementById('phDate').value || todayStr();
        pickPhoto(async dataURL => { const id = uid(); await IDB.put({ id, data: dataURL }); const arr = this.photos(); arr.push({ id, date: dt, part }); S.set('sportPhotos', arr); closeModal(); this.render(root); toast('已保存'); });
      };
    });
    box.querySelector('#spParts').onclick = () => this.partsManage(root);
    const addPhotoToggle = box.querySelector('#spAddPhotoToggle');
    if (addPhotoToggle) addPhotoToggle.onclick = () => {
      const b = box.querySelector('#spAddPhotoBody'); const t = addPhotoToggle;
      if (b.style.display === 'none') { b.style.display = ''; t.textContent = '▾'; } else { b.style.display = 'none'; t.textContent = '▸'; }
    };
    let cmMode = 'day';
    const drawCal = () => this.drawPhotoCal(box.querySelector('#spCalBody'), cmMode, root);
    drawCal();
    box.querySelectorAll('.sp-cal-mode').forEach(b => b.onclick = () => { box.querySelectorAll('.sp-cal-mode').forEach(x => x.classList.remove('active')); b.classList.add('active'); cmMode = b.dataset.cm; drawCal(); });
    box.querySelector('#spCalToggle').onclick = () => { const body = box.querySelector('#spCalBody'); const t = box.querySelector('#spCalToggle'); if (body.style.display === 'none') { body.style.display = ''; t.textContent = '▾'; } else { body.style.display = 'none'; t.textContent = '▸'; } };
    box.querySelector('#doCmp').onclick = async () => {
      const part = box.querySelector('#cmpPart').value;
      const arr = this.photos().filter(p => p.part === part).sort((a, b) => a.date.localeCompare(b.date));
      const cb = box.querySelector('#cmpBox');
      if (arr.length < 2) return cb.innerHTML = '<div class="empty" style="grid-column:1/-1">该部位至少需要2张照片才能对比</div>';
      const first = await IDB.get(arr[0].id), last = await IDB.get(arr[arr.length - 1].id);
      cb.innerHTML = `<div><div class="tag" style="margin-bottom:6px">之前 · ${arr[0].date}</div><img src="${first.data}" style="width:100%;border-radius:10px"></div>
        <div><div class="tag" style="margin-bottom:6px">现在 · ${arr[arr.length - 1].date}</div><img src="${last.data}" style="width:100%;border-radius:10px"></div>`;
    };
    const partDates = part => this.photos().filter(p => p.part === part).map(p => p.date).sort();
    const fillTwo = () => {
      const part = box.querySelector('#cmpPart').value;
      const ds = partDates(part);
      const a = box.querySelector('#cmpA'), b = box.querySelector('#cmpB');
      a.innerHTML = ds.map(d => `<option>${d}</option>`).join(''); b.innerHTML = ds.map(d => `<option>${d}</option>`).join('');
      if (ds.length) b.value = ds[ds.length - 1];
    };
    if (box.querySelector('#cmpPart')) box.querySelector('#cmpPart').onchange = fillTwo;
    if (box.querySelector('#cmpTwoToggle')) box.querySelector('#cmpTwoToggle').onclick = () => {
      const p = box.querySelector('#cmpTwo'); const show = p.style.display === 'none'; p.style.display = show ? '' : 'none'; if (show) fillTwo();
    };
    if (box.querySelector('#doCmpTwo')) box.querySelector('#doCmpTwo').onclick = async () => {
      const part = box.querySelector('#cmpPart').value;
      const a = box.querySelector('#cmpA').value, b = box.querySelector('#cmpB').value;
      const cb = box.querySelector('#cmpBox');
      if (!a || !b) return;
      const pa = this.photos().find(p => p.part === part && p.date === a);
      const pb = this.photos().find(p => p.part === part && p.date === b);
      if (!pa || !pb) return cb.innerHTML = '<div class="empty" style="grid-column:1/-1">该部位这两天没有照片</div>';
      const ra = await IDB.get(pa.id), rb = await IDB.get(pb.id);
      cb.innerHTML = `<div><div class="tag" style="margin-bottom:6px">${a}</div><img src="${ra.data}" style="width:100%;border-radius:10px"></div>
        <div><div class="tag" style="margin-bottom:6px">${b}</div><img src="${rb.data}" style="width:100%;border-radius:10px"></div>`;
    };
    box.querySelectorAll('.sp-pw-h').forEach(h => h.onclick = () => {
      const sec = h.parentElement, body = sec.querySelector('.sp-pw-b'), caret = h.querySelector('.sp-caret');
      const open = sec.classList.toggle('open');
      body.style.display = open ? '' : 'none';
      if (caret) caret.innerHTML = icon(open ? 'chevronDown' : 'chevronRight', 16);
    });
    box.querySelectorAll('[data-delp]').forEach(b => b.onclick = async () => { await IDB.del(b.dataset.delp); S.set('sportPhotos', this.photos().filter(x => x.id !== b.dataset.delp)); this.render(root); });
  },

  spView(el, mode) {
    const logs = this.logs();
    if (mode === 'week') {
      const week = weekDates(todayStr()).map(d => ({ d, n: (logs[d] || []).reduce((s, l) => s + l.minutes, 0) }));
      const projCount = {}; Object.values(logs).flat().forEach(l => projCount[l.project] = (projCount[l.project] || 0) + 1);
      el.innerHTML = `<div class="muted" style="margin-bottom:6px">本周每日运动分钟</div>${svgBars(week.map(x => x.n), week.map(x => x.d.slice(8) + '日'))}
        <div class="muted section-gap" style="margin-bottom:6px">项目坚持榜</div>${Object.entries(projCount).sort((a, b) => b[1] - a[1]).map(([p, n]) => `<div class="list-row"><span style="flex:1">${esc(p)}</span><span class="tag">${n} 次</span></div>`).join('') || '<div class="empty">开始第一次跟练吧</div>'}`;
    } else if (mode === 'month') {
      const ym = todayStr().slice(0, 7);
      const [yy, mm] = ym.split('-').map(Number); const dim = new Date(yy, mm, 0).getDate();
      let totMin = 0, daysN = 0; const marks = {};
      for (let dd = 1; dd <= dim; dd++) { const ds = ym + '-' + String(dd).padStart(2, '0'); const arr = logs[ds] || []; if (arr.length) { totMin += arr.reduce((s, l) => s + l.minutes, 0); daysN++; marks[ds] = [...new Set(arr.map(l => Sport.sportColor(l.project)))]; } }
      el.innerHTML = `<div class="muted" style="margin-bottom:6px">本月已运动 <b>${daysN}</b> 天 · 共 <b>${totMin}</b> 分钟</div><div id="spMonthViewCal"></div>`;
      renderMonthCal(el.querySelector('#spMonthViewCal'), { ym, marks, restSet });
    } else {
      const y = todayStr().slice(0, 4); const yy = Number(y);
      const countMap = {};
      for (let m = 1; m <= 12; m++) { const dim = new Date(yy, m, 0).getDate(); for (let dd = 1; dd <= dim; dd++) { const ds = y + '-' + String(m).padStart(2, '0') + '-' + String(dd).padStart(2, '0'); countMap[ds] = (logs[ds] || []).reduce((s, l) => s + l.minutes, 0); } }
      if (!el._hm) el._hm = { months: 3 };
      renderHeatmap(el, countMap, n => Math.min(4, Math.ceil(n / 15)));
    }
  },

  drawPhotoCal(body, mode, root) {
    const all = this.photos();
    if (mode === 'day') {
      if (!this._calYm) this._calYm = todayStr().slice(0, 7);
      const byDate = {}; all.forEach(p => { (byDate[p.date] = byDate[p.date] || []).push(p); });
      const marks = {}; all.forEach(p => { (marks[p.date] = marks[p.date] || []).push('#e8a33d'); });
      const load = el => el.querySelectorAll('.cal-photo').forEach(async pe => { const cell = pe.closest('.cal-cell'); if (cell) cell.classList.add('has-photo'); const rec = await IDB.get(pe.dataset.pid); if (rec) { const img = new Image(); img.src = rec.data; img.className = 'pc-img'; pe.appendChild(img); } });
      renderMonthCal(body, {
        ym: this._calYm, marks,
        cellHTML: ds => { const arr = byDate[ds]; if (!arr || !arr.length) return ''; return `<div class="cal-photo" data-pid="${arr[0].id}"></div>${arr.length > 1 ? `<span class="pc-count">${arr.length}</span>` : ''}`; },
        onClick: ds => this.photoListModal(this.photos().filter(p => p.date === ds), fmtCN(ds), root),
        afterRender: load
      });
    } else if (mode === 'week') {
      let html = '<div class="cal-list">';
      // 以当前周（周一开始）为第0周，往上回溯
      const curStart = weekStart(todayStr());
      for (let i = 0; i < 10; i++) {
        const start = addDays(curStart, -i * 7); const end = addDays(start, 6);
        const arr = all.filter(p => p.date >= start && p.date <= end).sort((a, b) => b.date.localeCompare(a.date));
        html += `<div class="cal-row" data-range="${start}|${end}"><div class="cr-label">${start.slice(5)} ~ ${end.slice(5)}</div><div class="cr-thumbs">${arr.slice(0, 6).map(p => `<span class="cr-ph" data-pid="${p.id}"></span>`).join('') || '<span class="muted">无</span>'}</div><span class="cr-n">${arr.length}张</span></div>`;
      }
      html += '</div>'; body.innerHTML = html;
      body.querySelectorAll('.cr-ph').forEach(async el => { const rec = await IDB.get(el.dataset.pid); if (rec) { const img = new Image(); img.src = rec.data; img.className = 'pc-img'; el.appendChild(img); } });
      body.querySelectorAll('.cal-row').forEach(r => r.onclick = () => { const [s, e] = r.dataset.range.split('|'); this.photoListModal(all.filter(p => p.date >= s && p.date <= e), s.slice(5) + ' ~ ' + e.slice(5), root); });
    } else if (mode === 'month') {
      const y = Number(todayStr().slice(0, 4)); const mNow = Number(todayStr().slice(5, 7));
      let html = '<div class="cal-list">';
      for (let i = 0; i < 12; i++) { let mm = mNow - i; let yy = y; if (mm < 1) { mm += 12; yy--; } const ym = yy + '-' + String(mm).padStart(2, '0'); const arr = all.filter(p => p.date.startsWith(ym)); const rep = arr.length ? arr[0] : null; html += `<div class="cal-row" data-ym="${ym}"><div class="cr-label">${mm}月</div><div class="cr-thumbs">${rep ? `<span class="cr-ph" data-pid="${rep.id}"></span>` : '<span class="muted">无</span>'}</div><span class="cr-n">${arr.length}张</span></div>`; }
      html += '</div>'; body.innerHTML = html;
      body.querySelectorAll('.cr-ph').forEach(async el => { const rec = await IDB.get(el.dataset.pid); if (rec) { const img = new Image(); img.src = rec.data; img.className = 'pc-img'; el.appendChild(img); } });
      body.querySelectorAll('.cal-row[data-ym]').forEach(r => r.onclick = () => this.photoListModal(all.filter(p => p.date.startsWith(r.dataset.ym)), r.dataset.ym.slice(5) + ' 月', root));
    } else {
      const y = todayStr().slice(0, 4); let html = '<div class="year-scroll">';
      for (let m = 1; m <= 12; m++) {
        const ym = y + '-' + String(m).padStart(2, '0'); const dim = new Date(Number(y), m, 0).getDate(); const first = new Date(Number(y), m - 1, 1).getDay();
        const byDate = {}; all.filter(p => p.date.startsWith(ym)).forEach(p => { (byDate[p.date] = byDate[p.date] || []).push(p); });
        html += `<div class="mini-month"><div class="mm-h">${m}月</div><div class="mm-grid">${['日', '一', '二', '三', '四', '五', '六'].map(w => `<span class="mm-wd">${w}</span>`).join('')}`;
        for (let i = 0; i < first; i++) html += '<span></span>';
        for (let dd = 1; dd <= dim; dd++) { const ds = ym + '-' + String(dd).padStart(2, '0'); const arr = byDate[ds]; html += arr ? `<span class="mm-d has" data-day="${ds}">${dd}</span>` : `<span class="mm-d">${dd}</span>`; }
        html += '</div></div>';
      }
      html += '</div>'; body.innerHTML = html;
      body.querySelectorAll('.mm-d.has').forEach(el => el.onclick = () => this.photoListModal(all.filter(p => p.date === el.dataset.day), fmtCN(el.dataset.day), root));
    }
  },

  photoListModal(arr, title, root) {
    const ov = openModal(`<button class="close-x" onclick="closeModal()">×</button><h3>${icon('camera',18)} ${esc(title)}（${arr.length}）</h3><div class="grid3" style="gap:8px">${arr.map(p => `<div data-lp data-pid="${p.id}" style="position:relative;cursor:pointer"><img class="photo-thumb" data-pid="${p.id}"><span class="tag" style="position:absolute;top:5px;left:5px">${esc(p.part)}</span><button class="del" data-delp="${p.id}" style="position:absolute;top:3px;right:5px;background:#fff;border-radius:50%;width:20px;height:20px">✕</button></div>`).join('')}</div>`);
    arr.forEach(async p => { const rec = await IDB.get(p.id); ov.querySelectorAll(`img[data-pid="${p.id}"]`).forEach(img => { if (rec) img.src = rec.data; }); });
    ov.querySelectorAll('[data-delp]').forEach(b => b.onclick = async () => { await IDB.del(b.dataset.delp); S.set('sportPhotos', this.photos().filter(x => x.id !== b.dataset.delp)); closeModal(); this.render(root); });
  },

  partsManage(root) {
    const parts = this.photoParts();
    openModal(`<button class="close-x" onclick="closeModal()">×</button><h3>${icon('edit',18)} 拍照部位管理</h3>
      <div class="muted" style="margin-bottom:6px">部位就是你想拍照对比的身体位置，可随意增删改名。</div>
      <div id="pmList">${parts.map((p, i) => `<div class="list-row" data-lp><input class="pmName" data-i="${i}" value="${esc(p)}" style="flex:1"><button class="del pmDel" data-delp="${i}">✕</button></div>`).join('')}</div>
      <div style="display:flex;gap:8px;margin-top:8px"><input id="pmNew" placeholder="新部位名" style="flex:1"><button class="btn sm" id="pmAdd">＋ 添加</button></div>
      <button class="btn" id="pmOk" style="width:100%;margin-top:12px">保存</button>`);
    document.getElementById('pmAdd').onclick = () => { const v = document.getElementById('pmNew').value.trim(); if (!v) return; const arr = this.photoParts(); arr.push(v); S.set('sportParts', arr); this.partsManage(root); };
    document.querySelectorAll('.pmDel').forEach(b => b.onclick = () => { const arr = this.photoParts(); arr.splice(Number(b.dataset.delp), 1); S.set('sportParts', arr); this.partsManage(root); });
    document.getElementById('pmOk').onclick = () => { const arr = [...document.querySelectorAll('.pmName')].map(i => i.value.trim()).filter(Boolean); S.set('sportParts', arr); closeModal(); this.render(root); toast('部位已更新'); };
  }
};
window.Modules.sport = { render: r => Sport.render(r) };
window.Sport = Sport;
