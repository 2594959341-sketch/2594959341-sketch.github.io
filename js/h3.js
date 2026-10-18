/* ============ Human 3.0 复盘模型（融入工作台·复盘模块） ============ */
/* 自包含自评：四象限打分(0/1/2) + 小说时长(自动读娱乐) + 渴求次数 + 逃避对象(必填)
   铁律：无徽章/无安慰文案/无补签联动/逃避必填置灰/UI 极简 */
window.H3 = (function () {
  const DIMS = [
    { key: 'mind',     label: '心智 Mind',     anchor: '面对它做了最低动作' },
    { key: 'body',     label: '身体 Body',     anchor: '手机离床·两顿饭·出门' },
    { key: 'spirit',   label: '精神 Spirit',   anchor: '主动连接·回消息算1' },
    { key: 'vocation', label: '事业 Vocation', anchor: '发了内容·播放0也算' }
  ];
  const WEEK_CN = ['一', '二', '三', '四', '五', '六', '日'];

  // ---------- storage（S 自动加 mumu_ 前缀） ----------
  function reviews() { return S.get('h3_review', {}); }
  function setReview(d, o) { const r = reviews(); r[d] = o; S.set('h3_review', r); }
  function cravings() { return S.get('h3_craving', {}); }
  function levels() { return S.get('h3_levels', { mind: 'L1', body: 'L1', spirit: 'L1', vocation: 'L1' }); }
  function setLevels(o) { S.set('h3_levels', o); }

  // 小说时长：自动读取娱乐模块（funLogs）里「小说」类型记录的总分钟
  function novelMinutesOf(d) {
    const logs = (S.get('funLogs', {}) || {})[d] || [];
    return logs.reduce((s, r) => s + (String(r.type || '').indexOf('小说') >= 0 ? (Number(r.minutes) || 0) : 0), 0);
  }

  // ---------- helpers ----------
  function dimScore(d, key) { const r = reviews()[d]; return r ? (Number(r[key]) || 0) : null; }
  function normalize(s) {
    s = (s == null ? '' : String(s)).trim().replace(/\s+/g, '');
    s = s.replace(/[！-～]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0));
    s = s.replace(/　/g, '');
    return s;
  }

  // 连续天数：从今天往回数，score>=1 记一天；0 即断；无记录不算断（跳过）
  function streak(key) {
    let s = 0, d = todayStr();
    for (let i = 0; i < 2000; i++) {
      const sc = dimScore(d, key);
      if (sc === null) { /* 跳过，不断 */ }
      else if (sc === 0) break;
      else s++;
      const prev = addDays(d, -1);
      if (prev > d) break; // 安全兜底
      d = prev;
    }
    return s;
  }

  // 单维度 28 天窗口统计
  function dimStats(key) {
    const today = todayStr();
    let recorded = 0, full = 0, done = 0;
    for (let i = 0; i < 28; i++) {
      const d = addDays(today, -i);
      const r = reviews()[d]; if (!r) continue;
      recorded++;
      const v = Number(r[key]) || 0;
      if (v === 2) full++;
      if (v >= 1) done++;
    }
    const all = Object.keys(reviews());
    return {
      recorded28: recorded,
      rateFull: recorded ? full / recorded : 0,   // “得2天数”比例（用于等级）
      rateDone: recorded ? done / recorded : 0,    // “做了”比例（用于雷达半径）
      streak: streak(key),
      recordedTotal: all.length
    };
  }

  // 单维度等级状态机
  function computeLevel(key) {
    const st = dimStats(key);
    if (st.recordedTotal < 7) return 'L1';
    const cur = (levels()[key]) || 'L1';
    const rate = st.rateFull, sk = st.streak;
    if (cur === 'L1') {
      if (rate >= 0.8 && sk >= 21) return 'L2观察期';
      return 'L1';
    }
    if (cur === 'L2观察期') {
      if (sk < 21) return 'L1';
      if (sk >= 49) return 'L2';
      return 'L2观察期';
    }
    if (cur === 'L2') {
      if (rate < 0.5) return 'L2观察期';
      return 'L2';
    }
    return 'L1';
  }

  function updateLevels() {
    const lv = levels(); let changed = false;
    DIMS.forEach(d => { const nl = computeLevel(d.key); if (nl !== lv[d.key]) { lv[d.key] = nl; changed = true; } });
    if (changed) setLevels(lv);
    return lv;
  }

  // ---------- 每日复盘页 ----------
  function renderDaily(Review, box, root) {
    H3._root = root; H3._Review = Review;
    const today = todayStr();
    const cur = Review.cur || today;
    const isToday = cur === today;
    const rev = reviews();
    const saved = rev[cur] || null;
    if (!H3._draft) H3._draft = {};
    if (!H3._draft[cur]) {
      const base = { mind: null, body: null, spirit: null, vocation: null, avoidTarget: '', cravingCount: 0 };
      H3._draft[cur] = saved ? Object.assign(base, saved) : base;
    }
    const dft = H3._draft[cur];
    if (isToday) dft.cravingCount = Number((cravings()[cur]) || 0);

    const lv = updateLevels();
    const lvLine = DIMS.map(d => d.label.split(' ')[0] + ' ' + lv[d.key]).join(' · ');
    const novelAuto = novelMinutesOf(cur);

    const quadRows = DIMS.map(dim => {
      const val = dft[dim.key];
      const caps = [0, 1, 2].map(v => {
        const on = (val === v) ? ` on c${v}` : '';
        const dis = isToday ? '' : ' disabled';
        return `<button class="h3-cap${on}" data-h3dim="${dim.key}" data-h3val="${v}"${dis}>${v}</button>`;
      }).join('');
      return `<div class="h3-qrow">
        <div class="h3-qlabel"><b>${esc(dim.label)}</b><span class="h3-qanchor">${esc(dim.anchor)}</span></div>
        <div class="h3-caps">${caps}</div>
      </div>`;
    }).join('');

    const cravingRow = isToday
      ? `<div class="h3-field"><label>渴求次数（今天特别想却没忍住的念头）</label>
          <div class="h3-crav"><span class="cnt" id="h3Crav">${dft.cravingCount || 0}</span>
          <button class="btn sm" id="h3CravAdd">＋</button>
          <span class="muted" style="font-size:11px">点一下记一次，全天可加</span></div></div>`
      : `<div class="h3-field"><label>渴求次数</label><div class="h3-crav"><span class="cnt">${saved ? (saved.cravingCount || 0) : 0}</span></div></div>`;

    const avoidVal = isToday ? dft.avoidTarget : (saved ? (saved.avoidTarget || '') : '');
    const fourDone = [dft.mind, dft.body, dft.spirit, dft.vocation].every(v => v !== null);
    const avoidOk = String(avoidVal || '').trim() !== '';
    const canSubmit = isToday && fourDone && avoidOk;

    box.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding-right:12px">
        <span class="branch-title" style="margin:0;padding:0;border:none">每日复盘</span>
        <button class="icon-btn" id="rDateClick" title="选择日期">${icon('calendar', 18)}</button>
      </div>
      <input type="date" id="rDate" value="${cur}" style="position:absolute;opacity:0;pointer-events:none">
      <div class="card">
        <div class="muted" style="font-size:12px;margin-bottom:8px">当前等级：${esc(lvLine)}</div>
        <div class="h3-quad">${quadRows}</div>
        <div class="h3-field" style="margin-top:12px"><label>小说时长</label>
          <div class="muted">自动读取娱乐模块记录：${novelAuto} 分钟</div>
          ${novelAuto === 0 ? `<div class="muted" style="margin-top:4px"><a href="javascript:void(0)" id="h3FunJump" style="color:#3a7d5d">今日娱乐无记录，去补记 ›</a></div>` : ''}
        ${cravingRow}
        <div class="h3-field"><label>逃避对象（今天在躲什么，必填）</label>
          <input type="text" id="h3Avoid" value="${esc(avoidVal)}" ${isToday ? '' : 'disabled'} placeholder="例如：发视频"></div>
        ${isToday ? `<button class="btn h3-submit" id="h3Save"${canSubmit ? '' : ' disabled'}>保存复盘</button>` : `<div class="muted" style="margin-top:12px">这是过去的记录，已锁定不可改。</div>`}
        ${!isToday && saved ? `<div class="muted" style="margin-top:8px">保存于 ${new Date(saved.ts || 0).toLocaleString('zh-CN')}</div>` : ''}
      </div>
      ${oldDiaryHTML()}`;

    // 日期切换
    const dc = box.querySelector('#rDateClick');
    const di = box.querySelector('#rDate');
    if (dc) dc.onclick = () => di.showPicker ? di.showPicker() : di.click();
    if (di) di.onchange = e => { Review.cur = e.target.value; Review.render(root); };
    const fj = box.querySelector('#h3FunJump');
    if (fj) fj.onclick = () => { if (window.App) App.go('fun'); };

    if (isToday) {
      box.querySelectorAll('[data-h3dim]').forEach(b => b.onclick = () => {
        H3._draft[cur][b.dataset.h3dim] = Number(b.dataset.h3val);
        renderDaily(Review, box, root);
      });
      const avoid = box.querySelector('#h3Avoid');
      if (avoid) avoid.oninput = () => {
        H3._draft[cur].avoidTarget = avoid.value;
        const sb = box.querySelector('#h3Save');
        if (sb) sb.disabled = !([H3._draft[cur].mind, H3._draft[cur].body, H3._draft[cur].spirit, H3._draft[cur].vocation].every(v => v !== null) && String(avoid.value).trim() !== '');
      };
      const add = box.querySelector('#h3CravAdd');
      if (add) add.onclick = () => {
        const c = cravings(); c[cur] = (Number(c[cur]) || 0) + 1; S.set('h3_craving', c);
        H3._draft[cur].cravingCount = c[cur];
        const el = box.querySelector('#h3Crav'); if (el) el.textContent = c[cur];
      };
      const save = box.querySelector('#h3Save');
      if (save) save.onclick = () => submit(cur, Review, root);
    }
  }

  function submit(cur, Review, root) {
    const dft = H3._draft[cur];
    if ([dft.mind, dft.body, dft.spirit, dft.vocation].some(v => v === null)) return;
    if (!String(dft.avoidTarget || '').trim()) return;
    const rec = {
      mind: +dft.mind, body: +dft.body, spirit: +dft.spirit, vocation: +dft.vocation,
      novelMinutes: novelMinutesOf(cur),
      cravingCount: Number((cravings()[cur]) || 0),
      avoidTarget: String(dft.avoidTarget).trim(),
      ts: Date.now()
    };
    setReview(cur, rec);
    updateLevels();
    toast('已保存');
    Review.render(root);
  }

  // 本周 7×4 网格（周一为首），cur 所在周
  function weekGridHTML(cur) {
    const days = weekDates(cur);
    const today = todayStr();
    const head = days.map(d => {
      const dt = new Date(d + 'T12:00:00');
      const wd = WEEK_CN[(dt.getDay() + 6) % 7];
      return `<th>${+d.slice(8)}<br><span class="wg-wd">周${wd}</span></th>`;
    }).join('');
    const rows = DIMS.map(dim => {
      const cells = days.map(d => {
        if (d > today) return `<td class="wg-blank"></td>`;
        const r = reviews()[d];
        if (!r) return `<td class="wg-blank"></td>`;
        const v = Number(r[dim.key]) || 0;
        const cls = v === 2 ? 'wg-2' : v === 1 ? 'wg-1' : 'wg-0';
        return `<td class="${cls}"></td>`;
      }).join('');
      return `<tr><td class="wg-label">${esc(dim.label.split(' ')[0])}</td>${cells}</tr>`;
    }).join('');
    return `<div class="card h3-week"><h3>本周概览</h3>
      <table class="wg"><thead><tr><th></th>${head}</tr></thead><tbody>${rows}</tbody></table>
      <div class="muted" style="font-size:11px;margin-top:4px">深绿=2 浅绿=1 灰=0 空=未记</div></div>`;
  }

  // 旧日记只读折叠（reviews 旧键）
  function oldDiaryHTML() {
    const R = S.get('reviews', {});
    const keys = Object.keys(R).sort().reverse().slice(0, 30);
    if (!keys.length) return '';
    const items = keys.map(k => {
      const r = R[k];
      const mood = ['😊', '🙂', '😐', '😟', '😢'][r.mood != null ? r.mood : 2];
      const txt = (r.text || '').trim();
      return `<div class="od-item"><div class="od-date">${k} ${mood}</div><div class="od-text">${esc(txt || '（无文字）')}</div></div>`;
    }).join('');
    return `<details class="h3-old"><summary>往期日记（只读）</summary><div class="od-list">${items}</div></details>`;
  }

  // ---------- 统计页（延迟加载） ----------
  function appendCharts(Review, body, root, scope) {
    H3._root = root; H3._Review = Review;
    let html = '';
    if (scope === 'week') html += weekGridHTML(todayStr()) + '\n';
    html += `<div class="card h3-card"><h3>Human 3.0 复盘</h3>
      <div class="muted" style="font-size:12px">四象限达标率（28天）与等级</div>
      <div class="h3-chart" data-h3="radar" style="min-height:240px"></div>
      <div class="muted" style="font-size:12px;margin-top:8px">90天趋势（按周·周一始·四色=四维度）</div>
      <div class="h3-chart" data-h3="trend" style="min-height:150px"></div>
      <div class="muted" style="font-size:12px;margin-top:8px">逃避对象词频 Top8</div>
      <div class="h3-chart" data-h3="word" style="min-height:200px"></div>
    </div>`;
    body.insertAdjacentHTML('beforeend', html);
    bindCharts(body);
  }

  function bindCharts(scopeEl) {
    const nodes = scopeEl.querySelectorAll('.h3-chart');
    if (!('IntersectionObserver' in window)) { nodes.forEach(fill); return; }
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { fill(e.target); io.unobserve(e.target); } });
    }, { rootMargin: '120px' });
    nodes.forEach(n => io.observe(n));
  }

  function fill(node) {
    const t = node.dataset.h3;
    if (t === 'radar') node.innerHTML = radarSVG();
    else if (t === 'trend') node.innerHTML = trendSVG();
    else if (t === 'word') node.innerHTML = wordFreqSVG();
  }

  function radarSVG() {
    const size = 230, cx = size / 2, cy = size / 2, R = 80;
    const lv = updateLevels();
    const stats = DIMS.map(d => dimStats(d.key));
    const vals = stats.map(s => s.rateDone);
    const lvs = DIMS.map(d => lv[d.key]);
    const n = 4;
    const ang = i => (-90 + i * 360 / n) * Math.PI / 180;
    let rings = '';
    [0.25, 0.5, 0.75, 1].forEach(f => {
      const pts = DIMS.map((d, i) => { const a = ang(i); return (cx + R * f * Math.cos(a)) + ',' + (cy + R * f * Math.sin(a)); }).join(' ');
      rings += `<polygon points="${pts}" fill="none" stroke="#eee" stroke-width="1"/>`;
    });
    let axes = '';
    DIMS.forEach((d, i) => {
      const a = ang(i);
      const x = cx + R * Math.cos(a), y = cy + R * Math.sin(a);
      axes += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#ddd" stroke-width="1"/>`;
      const lx = cx + (R + 16) * Math.cos(a), ly = cy + (R + 16) * Math.sin(a);
      axes += `<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle" font-size="11" fill="#555">${esc(d.label.split(' ')[0])}</text>`;
      const ly2 = ly + 13;
      axes += `<text x="${lx}" y="${ly2}" text-anchor="middle" font-size="10" fill="#3a7d5d">${esc(lvs[i])}</text>`;
    });
    const dpts = vals.map((v, i) => { const a = ang(i); return (cx + R * v * Math.cos(a)) + ',' + (cy + R * v * Math.sin(a)); }).join(' ');
    const poly = `<polygon points="${dpts}" fill="rgba(58,125,93,0.22)" stroke="#3a7d5d" stroke-width="2"/>`;
    const dots = vals.map((v, i) => { const a = ang(i); const x = cx + R * v * Math.cos(a), y = cy + R * v * Math.sin(a); return `<circle cx="${x}" cy="${y}" r="3" fill="#3a7d5d"/>`; }).join('');
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${rings}${axes}${poly}${dots}</svg>`;
  }

  function trendWeeks() {
    const N = 90, today = todayStr();
    const days = []; for (let i = N - 1; i >= 0; i--) days.push(addDays(today, -i));
    const weeks = []; let cur = [];
    days.forEach(d => {
      const wd = new Date(d + 'T12:00:00').getDay();
      if (wd === 1 && cur.length) { weeks.push(cur); cur = []; }
      cur.push(d);
    });
    if (cur.length) weeks.push(cur);
    return weeks;
  }

  function trendSVG() {
    const weeks = trendWeeks();
    const palette = ['#3a7d5d', '#8FB8E0', '#B8A4D4', '#F4A6B8'];
    const series = DIMS.map(dim => weeks.map(wk => {
      const sc = wk.filter(d => reviews()[d]).map(d => Number(reviews()[d][dim.key]) || 0);
      return sc.length ? sc.reduce((a, b) => a + b, 0) / sc.length : null;
    }));
    const W = 300, H = 130, padL = 22, padR = 8, padT = 10, padB = 18;
    const n = weeks.length, maxV = 2;
    const X = i => padL + (W - padL - padR) * (n <= 1 ? 0.5 : i / (n - 1));
    const Y = v => padT + (H - padT - padB) * (1 - (v || 0) / maxV);
    let grid = '';
    [0, 1, 2].forEach(v => { const yy = Y(v); grid += `<line x1="${padL}" y1="${yy}" x2="${W - padR}" y2="${yy}" stroke="#eee"/><text x="${padL - 4}" y="${yy + 3}" text-anchor="end" font-size="9" fill="#aaa">${v}</text>`; });
    let paths = '';
    series.forEach((s, di) => {
      let dstr = '', started = false;
      s.forEach((v, i) => { if (v == null) { started = false; return; } const px = X(i), py = Y(v); dstr += (started ? ' L' : 'M') + px + ' ' + py; started = true; });
      paths += `<path d="${dstr}" fill="none" stroke="${palette[di]}" stroke-width="2"/>`;
    });
    let xl = '';
    for (let i = 0; i < n; i += Math.max(1, Math.floor(n / 6))) xl += `<text x="${X(i)}" y="${H - 4}" text-anchor="middle" font-size="8" fill="#aaa">${i + 1}</text>`;
    const legend = DIMS.map((d, di) => `<span class="h3-lg" style="color:${palette[di]}">●</span>${esc(d.label.split(' ')[0])}`).join(' ');
    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${grid}${paths}${xl}</svg><div class="h3-legend">${legend} · 横轴=周序号</div>`;
  }

  function wordFreqSVG() {
    const R = reviews(); const cnt = {};
    Object.keys(R).forEach(d => { const t = normalize(R[d].avoidTarget); if (t) cnt[t] = (cnt[t] || 0) + 1; });
    const arr = Object.keys(cnt).map(k => ({ k, c: cnt[k] })).sort((a, b) => b.c - a.c).slice(0, 8);
    if (!arr.length) return '<div class="empty">还没有逃避对象记录</div>';
    const max = arr[0].c, W = 200;
    const rows = arr.map(o => {
      const w = Math.max(6, o.c / max * W);
      return `<div class="h3-wf-row"><span class="h3-wf-k">${esc(o.k)}</span><span class="h3-wf-bar" style="width:${w}px"></span><span class="h3-wf-c">${o.c}</span></div>`;
    }).join('');
    return `<div class="h3-wf">${rows}</div>`;
  }

  // 一次性修正：把已存在的「事业 Vocation」打分 2（满分）改回 1（做了最低动作）。
  // 仅对修正前已写入的数据生效一次，之后新记录不受影响；不新增任何 UI。
  (function migrateVocFix(){
    if (S.get('h3_vocfix_v1')) return;
    const R = S.get('h3_review', {});
    let n = 0;
    Object.keys(R).forEach(d => { if (R[d] && Number(R[d].vocation) === 2) { R[d].vocation = 1; n++; } });
    if (n) S.set('h3_review', R);
    S.set('h3_vocfix_v1', true);
    if (n) console.log('[mumu] 已一次性修正 ' + n + ' 天的事业打分(2→1)');
  })();
  return { renderDaily, appendCharts, updateLevels, _draft: {}, _root: null, _Review: null };
})();
