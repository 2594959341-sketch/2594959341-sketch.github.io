/* ============ 契约模块（Human 3.0 修正·只读聚合视图） ============ */
/* 设计铁律（修正1）：契约不是独立第二套系统，只做三件事——
   ① 聚合现有数据 ② 承载一句书面承诺 ③ 到期自动结算。
   不新增任务、不改火花逻辑、不改现有任务豁免规则、不反向写入。
   契约读取现有数据：task=绑定创作发布/每日计划发内容；review=当日 h3_review 逃避非空；
   metric=读取现有数值仅展示不参与判定；manual=无对应系统的动作才由用户在契约内勾选。 */
window.Contract = (function () {
  const DEFAULT_ITEMS = [
    { key: 'video',  label: '发内容',   sourceType: 'task' },
    { key: 'phone',  label: '手机离床', sourceType: 'manual' },
    { key: 'meal',   label: '两顿饭',   sourceType: 'manual' },
    { key: 'review', label: '复盘四项', sourceType: 'review' }
  ];

  function get() { return S.get('contract', null); }
  function set(c) { S.set('contract', c); }

  // —— 豁免判定（修正4）：休息日 / 经期假 / 年度假期 不计入分母；病假计入（用户承认存在没病也请的情况）——
  function isExempt(d) {
    if (isSickLeave && isSickLeave(d)) return false;          // 病假：计入分母
    if (isAnnualHoliday && isAnnualHoliday(d)) return true;    // 生日/纪念日等全局假期
    if ((S.get('menstrualRest', []) || []).indexOf(d) >= 0) return true; // 经期假
    const rest = [].concat(restDatesOfType('sport'), restDatesOfType('kaogong'), restDatesOfType('work'));
    if (rest.indexOf(d) >= 0) return true;                    // 各板块休息日
    return false;
  }

  // 单条目当日是否满足
  function itemDone(c, item, d) {
    if (item.sourceType === 'metric') return true; // 仅展示不参与判定
    if (item.sourceType === 'manual') return !!(c.manual && c.manual[d] && c.manual[d][item.key]);
    if (item.sourceType === 'review') {
      const r = S.get('h3_review', {})[d];
      return !!(r && r.avoidTarget && String(r.avoidTarget).trim() !== '');
    }
    if (item.sourceType === 'task') {
      // 两者任一满足：创作发布记录 或 每日计划发内容任务 done
      const wl = S.get('workLogs', {})[d] || [];
      if (wl.length) return true;
      const plans = S.get('plans', {})[d] || [];
      return plans.some(t => !t.abandoned && (t.link || '').indexOf('work:') === 0 && (window.Daily ? Daily.effDone(t, d) : !!t.done));
    }
    return false;
  }

  // 当日契约完成（豁免日返回 null 跳过）；非豁免日需所有非 metric 条目满足
  function dayComplete(c, d) {
    if (isExempt(d)) return null;
    const items = c.items.filter(it => it.sourceType !== 'metric');
    if (!items.length) return true;
    return items.every(it => itemDone(c, it, d));
  }

  function endDate(c) { return addDays(c.start, c.duration - 1); }

  // 结算（修正4）：完成率 = 完成天数 ÷ 应执行天数；≥80% pass
  function computeSettle(c) {
    let req = 0, done = 0, d = c.start;
    const end = endDate(c);
    while (d <= end) {
      if (!isExempt(d)) { req++; if (dayComplete(c, d)) done++; }
      d = addDays(d, 1);
    }
    const rate = req ? done / req : 1;
    const pass = rate >= 0.8;
    return { req, done, rate, pass, text: done + '/' + req + (pass ? ' · 可续签' : ' · 未达标·可重签') };
  }

  function ensureSettled(c) {
    if (c.status === 'active' && todayStr() > endDate(c)) {
      c.settle = computeSettle(c);
      c.status = 'settled';
      set(c);
    }
    return c;
  }

  // ================= 渲染 =================
  function render(Review, box, root) {
    const c = get();
    if (!c) return signForm(Review, box, root);
    ensureSettled(c);
    activeView(Review, box, root, get());
  }

  function typeBadge(t) {
    const map = { task: '绑现有任务', review: '读复盘', metric: '读数值', manual: '手动勾选' };
    return `<span class="ct-badge ct-${t}">${map[t] || t}</span>`;
  }

  function signForm(Review, box, root) {
    box.innerHTML = `
      <div class="card">
        <div class="branch-title" style="margin:0 0 10px">签署一份契约</div>
        <div class="muted" style="font-size:12px;margin-bottom:12px">契约只聚合你已有的数据（发内容/复盘/手动勾选），不新建任务、不重复记录。签署后条目与期限锁定，到期自动结算。无补签。</div>
        <div class="form-row"><label>周期</label>
          <div style="display:flex;gap:8px">
            <button class="chip ct-dur" data-dur="14" style="background:#111;color:#fff;border-color:#111">14 天</button>
            <button class="chip ct-dur" data-dur="30">30 天</button>
          </div>
        </div>
        <div class="form-row"><label>手写一句承诺（必填）</label>
          <textarea id="ctPromise" rows="3" placeholder="例如：这 14 天，每天发一条内容、读完书、写下逃避对象"></textarea></div>
        <div class="form-row"><label>契约条目（签署后锁定）</label>
          <div class="ct-items">${DEFAULT_ITEMS.map(it => `<div class="ct-item"><b>${esc(it.label)}</b>${typeBadge(it.sourceType)}</div>`).join('')}</div>
        </div>
        <button class="btn ct-sign" id="ctSign" disabled style="width:100%;margin-top:6px">签署契约</button>
        <div class="muted" style="font-size:11px;margin-top:6px">发内容 = 创作发布记录 或 每日计划发内容任务完成，任一即可。</div>
      </div>`;
    let dur = 14;
    box.querySelectorAll('.ct-dur').forEach(b => b.onclick = () => {
      dur = Number(b.dataset.dur);
      box.querySelectorAll('.ct-dur').forEach(x => { const on = x === b; x.style.background = on ? '#111' : ''; x.style.color = on ? '#fff' : ''; x.style.borderColor = on ? '#111' : ''; });
    });
    const pr = box.querySelector('#ctPromise');
    const sign = box.querySelector('#ctSign');
    const upd = () => { sign.disabled = String(pr.value).trim() === ''; };
    pr.oninput = upd;
    sign.onclick = () => {
      if (!String(pr.value).trim()) return;
      const nc = {
        id: String(Date.now()), start: todayStr(), duration: dur,
        promise: String(pr.value).trim(), items: DEFAULT_ITEMS.map(x => ({ key: x.key, label: x.label, sourceType: x.sourceType })),
        signedAt: Date.now(), status: 'active', manual: {}, settle: null
      };
      set(nc);
      render(Review, box, root);
    };
  }

  function activeView(Review, box, root, c) {
    const end = endDate(c);
    const expired = todayStr() > end;
    const st = c.status;
    // 实时进度（截至今天）
    let reqT = 0, doneT = 0, d = c.start;
    while (d <= Math.min(todayStr(), end)) { if (!isExempt(d)) { reqT++; if (dayComplete(c, d)) doneT++; } d = addDays(d, 1); }
    const live = reqT ? Math.round(doneT / reqT * 100) : 100;

    const itemsHTML = c.items.map(it => `<div class="ct-item"><b>${esc(it.label)}</b>${typeBadge(it.sourceType)}</div>`).join('');

    // 每日网格
    let gd = c.start, rows = '';
    while (gd <= end) {
      const ex = isExempt(gd);
      const cpl = dayComplete(c, gd);
      const cell = it => {
        if (it.sourceType === 'metric') return `<span class="ct-dot ct-m" title="${esc(it.label)}（仅展示）">·</span>`;
        const ok = itemDone(c, it, gd);
        if (ex) return `<span class="ct-dot ct-x" title="${esc(it.label)} 豁免">–</span>`;
        if (it.sourceType === 'manual' && gd <= todayStr()) {
          return `<button class="ct-dot ${ok ? 'ct-on' : 'ct-off'}" data-mdate="${gd}" data-mkey="${it.key}" title="${esc(it.label)}（点按记录）">${ok ? '✓' : ''}</button>`;
        }
        return `<span class="ct-dot ${ok ? 'ct-on' : 'ct-off'}">${ok ? '✓' : ''}</span>`;
      };
      const dayDone = ex ? '' : (cpl ? '<span class="ct-day ct-day-on">完成</span>' : '<span class="ct-day">—</span>');
      rows += `<div class="ct-row"><span class="ct-date">${gd.slice(5)}${ex ? ' <span class="muted">豁免</span>' : ''}</span>${c.items.map(cell).join('')}${dayDone}</div>`;
      gd = addDays(gd, 1);
    }

    const settleHTML = (st === 'settled' && c.settle)
      ? `<div class="card ct-settle"><div class="branch-title" style="margin:0 0 6px">结算</div>
           <div style="font-size:22px">${esc(c.settle.text)}</div>
           <div class="muted" style="font-size:12px;margin-top:4px">完成率 ${Math.round(c.settle.rate * 100)}%${c.settle.pass ? '，达标可续签' : '，未达 80%，可重签'}</div>
           <button class="btn ct-resign" id="ctResign" style="width:100%;margin-top:10px">${c.settle.pass ? '续签新契约' : '重签新契约'}</button></div>`
      : '';

    box.innerHTML = `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div class="branch-title" style="margin:0">契约 · ${c.duration} 天</div>
          <span class="muted" style="font-size:12px">${c.start.slice(5)} ~ ${end.slice(5)}</span>
        </div>
        <div style="margin:8px 0;padding:10px;background:#fafafa;border-radius:8px;font-size:14px">${esc(c.promise)}</div>
        <div class="ct-items" style="margin-bottom:8px">${itemsHTML}</div>
        <div class="ct-prog"><div class="ct-prog-bar" style="width:${live}%"></div></div>
        <div class="muted" style="font-size:12px;margin-top:4px">实时完成 ${doneT}/${reqT}（${live}%）${expired ? ' · 已到期' : ''}</div>
      </div>
      <div class="card">
        <div class="ct-head"><span>日期</span>${c.items.map(it => `<span title="${esc(it.label)}">${esc(it.label.slice(0,2))}</span>`).join('')}<span>日结</span></div>
        <div class="ct-grid">${rows}</div>
      </div>
      ${settleHTML}`;

    box.querySelectorAll('[data-mdate]').forEach(b => b.onclick = () => {
      const c2 = get(); if (!c2) return;
      const dt = b.dataset.mdate, k = b.dataset.mkey;
      c2.manual[dt] = c2.manual[dt] || {};
      c2.manual[dt][k] = !c2.manual[dt][k];
      set(c2); render(Review, box, root);
    });
    const rs = box.querySelector('#ctResign');
    if (rs) rs.onclick = () => { set(null); render(Review, box, root); };
  }

  return { render };
})();
