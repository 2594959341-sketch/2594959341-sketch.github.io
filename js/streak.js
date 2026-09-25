/* ============ 续火花 · 连续打卡天数 + 休息日 + 补签卡 ============ */
/* 纯新增模块（v221）：零侵入——所有打卡数据来自现有专栏日志反查，不新增独立打卡入口。
 * 内置项目（创作/学习/运动）自动从 workLogs / kgLogs.subject / sportLogs.project 反查；
 * 用户用右上角「+」新增的项目需先选「关联板块」（运动/学习/创作/成长/阅读/出行/娱乐/三餐），
 * 关联后同样由对应专栏日志反查自动续火花；只有「自定义」才需每天点格子手动打卡。
 */
// 同义归一：学习科目 / 运动项目 名字变体合并到同一续火花项（根治「言语」与「行测言语」分裂、运动名变体导致天数对不上）
const KG_ALIAS = { '言语理解': '言语', '言语模块': '言语' };
// 归一：去掉「行测」前缀及分隔符（- · 空格 等），使「行测-言语 / 行测言语 / 言语」都归为「言语」同一个火花项
const kgNorm = s => {
  s = (s || '').trim();
  if (KG_ALIAS[s]) return KG_ALIAS[s];
  s = s.replace(/^行测[\s\-－·:：]*/, '').replace(/[\s\-－·:：]/g, '');
  return s;
};
const sportNorm = p => {
  p = (p || '').trim(); if (!p) return p;
  const projs = (window.MUMU_SPORT && window.MUMU_SPORT.projects) || [];
  let m = projs.find(x => x.name === p); if (m) return m.name;
  m = projs.find(x => x.name && x.name.replace(/\s/g, '') === p.replace(/\s/g, '')); if (m) return m.name;
  return p;
};
const Streak = {
  KEY: 'mumu_streak',
  data() { return S.get(this.KEY, { items: [] }); },
  save(d) { S.set(this.KEY, d); },

  // 某天是否「真实打卡」（按项目类型反查现有日志）
  isDone(item, date) {
    // 空数组不算打卡（!![] 为 true，必须判长度）
    if (item.type === 'work') return (S.get('workLogs', {})[date] || []).length > 0;
    if (item.type === 'kg') return (S.get('kgLogs', {})[date] || []).some(l => kgNorm(l.subject) === kgNorm(item.ref));
    if (item.type === 'sport') return (S.get('sportLogs', {})[date] || []).some(l => sportNorm(l.project) === sportNorm(item.ref));
    if (item.type === 'growth') return (S.get('growthLogs', {})[date] || []).some(l => (l.area || '').trim() === (item.ref || '').trim());
    if (item.type === 'read') return (S.get('readLogs', {})[date] || []).length > 0;
    if (item.type === 'travel') return (S.get('travelOut', {})[date] || []).length > 0;
    if (item.type === 'fun') return (S.get('funLogs', {})[date] || []).some(r => !item.ref || r.type === item.ref);
    if (item.type === 'meals') {
      const day = S.get('meals', {})[date]; if (!day) return false;
      return item.ref ? !!day[item.ref] : !!(day.breakfast || day.lunch || day.dinner);
    }
    if (item.type === 'custom') return !!(item.done && item.done[date]);
    return false;
  },
  // 是否覆盖（真实打卡 / 休息日 / 补签日都算续上；休息日含每日计划里的运动/备考休息日）
  covered(item, date) {
    if (isSickLeave(date)) return true; // 病假：保护所有板块续火花，等同月经假/年度假期
    if (isAnnualHoliday(date)) return true; // 年度固定假期（生日/纪念日）：全局保护所有板块续火花，等同月经假
    if ((S.get('menstrualRest', []) || []).indexOf(date) >= 0) return true; // 月经假：保护所有板块续火花
    if (item.type === 'sport' && (S.get('sportRest', []) || []).indexOf(date) >= 0) return true;
    if (item.type === 'kg' && (S.get('kgRest', []) || []).indexOf(date) >= 0) return true;
    if (item.type === 'work' && (S.get('workRest', []) || []).indexOf(date) >= 0) return true;
    return this.isDone(item, date) || !!(item.rest && item.rest[date]) || !!(item.madeup && item.madeup[date]);
  },

  // 收集续火花项目：默认种子 + 从日志自动发现（后续新增学习科目/运动项目自动进入）+ 已存自定义
  ensureItems() {
    const d = this.data();
    if (!d.items) d.items = [];
    const byId = {};
    d.items.forEach(it => byId[it.id] = it);
    const base = () => ({ makeup: 0, rest: {}, madeup: {}, done: {} });
    const seed = [
      { id: 'work', type: 'work', name: '创作', ref: '' },
      { id: 'kg:言语', type: 'kg', name: '学习·言语', ref: '言语' },
      { id: 'sport:大小脸改善', type: 'sport', name: '大小脸改善', ref: '大小脸改善' },
      { id: 'sport:天鹅颈', type: 'sport', name: '天鹅颈', ref: '天鹅颈' }
    ];
    seed.forEach(s => { if (!byId[s.id]) { byId[s.id] = Object.assign(base(), s); d.items.push(byId[s.id]); } });
    // 自动发现：学习各科目、运动各项目（日志里出现过就进续火花，后续新增项目自动进入）
    const kgSubs = {};
    Object.values(S.get('kgLogs', {}) || {}).forEach(arr => (arr || []).forEach(l => { if (l.subject) kgSubs[kgNorm(l.subject)] = 1; }));
    Object.keys(kgSubs).forEach(sub => { const id = 'kg:' + sub; if (!byId[id]) { byId[id] = Object.assign(base(), { id, type: 'kg', name: '学习·' + sub, ref: sub }); d.items.push(byId[id]); } });
    const spProjs = {};
    Object.values(S.get('sportLogs', {}) || {}).forEach(arr => (arr || []).forEach(l => { if (l.project) spProjs[sportNorm(l.project)] = 1; }));
    Object.keys(spProjs).forEach(p => { const id = 'sport:' + p; if (!byId[id]) { byId[id] = Object.assign(base(), { id, type: 'sport', name: p, ref: p }); d.items.push(byId[id]); } });
    // 去重：把已存的同名/同义项目（如「学习·行测言语」）合并到规范化 id，避免重复项与天数分裂
    const canon = it => it.type === 'kg' ? 'kg:' + kgNorm(it.ref) : it.type === 'sport' ? 'sport:' + sportNorm(it.ref) : it.id;
    const byCanon = {}; const merged = [];
    d.items.forEach(it => {
      const c = canon(it);
      if (byCanon[c]) { const keep = byCanon[c]; ['rest', 'madeup', 'done'].forEach(f => { const src = it[f] || {}; const dst = keep[f] || {}; Object.keys(src).forEach(k => { if (!dst[k]) dst[k] = 1; }); keep[f] = dst; }); }
      else { it.id = c; byCanon[c] = it; merged.push(it); }
    });
    d.items = merged;
    // 归一显示名与 ref，确保合并后名称干净（如「学习·言语」而非「学习·行测-言语」）
    d.items.forEach(it => {
      if (it.type === 'kg') { it.ref = kgNorm(it.ref); it.name = '学习·' + it.ref; }
      else if (it.type === 'sport') { it.ref = sportNorm(it.ref); it.name = it.ref; }
    });
    this.save(d);
    return d.items;
  },

  // 累计真实打卡天数（用于发补签卡：每满 30 天发一张）
  doneDays(item) {
    let n = 0; const origin = '2025-01-01'; let cur = todayStr();
    while (cur >= origin) { if (this.isDone(item, cur)) n++; cur = addDays(cur, -1); }
    return n;
  },
  makeupEarned(item) { return Math.floor(this.doneDays(item) / 30); },
  makeupUsed(item) { return Object.keys(item.madeup || {}).length; },
  makeupAvail(item) { return Math.max(0, this.makeupEarned(item) - this.makeupUsed(item)); },

  // 当前连续天数：休息/月经假/补签日不中断连续性，但也不计入连续天数；只有真实打卡日才计入
  curStreak(item) {
    const origin = '2025-01-01';
    let cur = todayStr();
    // covered = 真实打卡 / 休息日 / 月经假 / 补签日，任意一条都算「续上」（不中断）
    while (cur >= origin && !this.covered(item, cur)) cur = addDays(cur, -1);
    let c = 0;
    while (cur >= origin && this.covered(item, cur)) {
      if (this.isDone(item, cur)) c++; // 仅真实打卡日计入；休息/月经假/补签不计入
      cur = addDays(cur, -1);
    }
    return c;
  },
  // 用一张补签卡补最近的一个缺口（从今天往前第一个未覆盖日）
  useMakeup(item) {
    if (this.makeupAvail(item) <= 0) return false;
    let cur = todayStr(); const origin = '2025-01-01';
    while (cur >= origin) {
      if (!this.covered(item, cur)) { item.madeup = item.madeup || {}; item.madeup[cur] = 1; return true; }
      cur = addDays(cur, -1);
    }
    return false;
  },
  // 休息日规则（按项目维度）：一周 <=1、一月 <=4
  restCanAdd(item, date) {
    const wk = mondayOf(date);
    const ym = date.slice(0, 7);
    const rest = item.rest || {};
    let wkN = 0, moN = 0;
    Object.keys(rest).forEach(d => {
      if (!rest[d]) return;
      if (d.slice(0, 7) === ym) moN++;
      if (mondayOf(d) === wk) wkN++;
    });
    if (wkN >= 1) return false;
    if (moN >= 4) return false;
    return true;
  },

  // ================= 渲染 =================
  render(box) {
    const items = this.ensureItems();
    box.innerHTML = '';
    // 自救计划（只显示第几天，与续火花并列更直观；项目与续火花重叠故不列）
    const _sr = S.get('selfRescue');
    const _srStart = (_sr && _sr.start) || '2026-07-13';
    const _srDay = Math.max(1, daysBetween(_srStart, todayStr()) + 1);
    const srIntro = document.createElement('div'); srIntro.style.marginBottom = '12px';
    srIntro.innerHTML = `<div class="branch-title" style="margin:0;padding:0;border:none;font-size:17px">365天自救计划 · 第 ${_srDay} 天</div>`;
    box.appendChild(srIntro);
    const top = document.createElement('div'); top.style.marginBottom = '12px'; box.appendChild(top);
    const bar = document.createElement('div');
    bar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-top:10px';
    bar.innerHTML = `<span class="branch-title" style="margin:0;padding:0;border:none;font-size:17px">续火花</span>
      <div style="display:flex;gap:2px;align-items:center">
        <button class="icon-btn" id="stAdd" title="新增项目">${icon('plus', 18)}</button>
        <button class="icon-btn" id="stBack" title="返回今日计划">${icon('back', 18)}</button>
      </div>`;
    top.appendChild(bar);
    const grid = document.createElement('div'); grid.className = 'stk-grid'; box.appendChild(grid);
    const MAC = ['#F4A6B8', '#8FB8E0', '#7CB390', '#F5B971', '#B8A4D4', '#4FB0AE', '#F6C56E', '#A8B5C4', '#F4A38C', '#C58AB0'];
    items.forEach((item, idx) => {
      const st = this.curStreak(item);
      const mk = this.makeupAvail(item);
      const card = document.createElement('div'); card.className = 'stk-card';
      card.style.setProperty('--mac', MAC[idx % MAC.length]);
      card.innerHTML = `<div class="stk-flame">${icon('fire', 30)}</div>
        <div class="stk-num">${st}</div>
        <div class="stk-name">${esc(item.name)}</div>`;
      card.onclick = () => this.detail(item, box);
      grid.appendChild(card);
    });
    box.querySelector('#stBack').onclick = () => { Daily._sub = null; Daily.render(Daily._root); };
    box.querySelector('#stAdd').onclick = () => this.addDialog(box);
    box.appendChild(Daily.renderSubTabs(box, 'streak'));
  },

  detail(item, box) {
    if (!Daily._monthYm) Daily._monthYm = todayStr().slice(0, 7);
    const ym = Daily._monthYm;
    const [yy, mm] = ym.split('-').map(Number);
    const dim = new Date(yy, mm, 0).getDate();
    box.innerHTML = '';
    const top = document.createElement('div'); top.style.marginBottom = '12px'; box.appendChild(top);
    const bar = document.createElement('div');
    bar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:10px';
    const yearOpts = this.yearOptions(yy);
    bar.innerHTML = `<div style="display:flex;align-items:center;gap:8px;min-width:0">
        <span class="branch-title stk-dt-name" style="margin:0;padding:0;border:none;font-size:17px">${esc(item.name)}</span>
        <div class="stk-ym">
          <button class="stk-ymbtn" id="dtYm" title="切换年月">${yy}年${mm}月${icon('chevronDown', 14)}</button>
          <div class="stk-ymdrop" id="dtYmDrop" style="display:none">
            <div class="stk-ym-yearrow">${yearOpts.map(y => `<div class="stk-ym-opt ${y === yy ? 'on' : ''}" data-ym-year="${y}">${y}</div>`).join('')}</div>
            <div class="stk-ym-months">${Array.from({ length: 12 }, (_, i) => i + 1).map(m => `<div class="stk-ym-opt ${m === mm ? 'on' : ''}" data-ym-month="${m}">${m}月</div>`).join('')}</div>
          </div>
        </div>
      </div>
      <button class="icon-btn" id="dtBack" title="返回">${icon('back', 18)}</button>`;
    top.appendChild(bar);
    const stat = document.createElement('div'); stat.className = 'stk-stat';
    stat.innerHTML = `连续 <b>${this.curStreak(item)}</b> 天 · 补签卡 ×<b>${this.makeupAvail(item)}</b> · 打卡满 30 天得 1 张`;
    box.appendChild(stat);
    const grid = document.createElement('div'); grid.className = 'stk-days'; box.appendChild(grid);
    const catRest = ds => { const mr = (S.get('menstrualRest', []) || []).indexOf(ds) >= 0; return mr || isAnnualHoliday(ds) || isSickLeave(ds) || (item.type === 'sport' ? (S.get('sportRest', []) || []).indexOf(ds) >= 0 : item.type === 'kg' ? (S.get('kgRest', []) || []).indexOf(ds) >= 0 : item.type === 'work' ? (S.get('workRest', []) || []).indexOf(ds) >= 0 : false); };
    for (let dd = 1; dd <= dim; dd++) {
      const ds = ym + '-' + String(dd).padStart(2, '0');
      const done = this.isDone(item, ds);
      const mens = (S.get('menstrualRest', []) || []).indexOf(ds) >= 0;
      const rest = !!(item.rest && item.rest[ds]) || catRest(ds);
      const mu = !!(item.madeup && item.madeup[ds]);
      const cls = mu ? 'mu' : rest ? 'rest' : done ? 'done' : 'gap';
      const cell = document.createElement('div');
      cell.className = 'stk-day ' + cls;
      const lab = done ? '✓' : mu ? '补' : rest ? (mens ? '经' : '休') : '';
      cell.innerHTML = `<span class="d">${dd}</span>${lab ? '<span class="mk">' + lab + '</span>' : ''}`;
      cell.onclick = () => this.toggleDay(item, ds, cls, box);
      grid.appendChild(cell);
    }
    // 解释说明挪到日期格子下方，视觉上更干净
    const tip = document.createElement('div'); tip.className = 'stk-tip';
    tip.textContent = item.type === 'custom' ? '点格子=打卡；再点取消' : '点空格=用补签卡补签；当天已打卡不可改；休息请在板块设置';
    box.appendChild(tip);
    const _hl = holidayLegendHTML(ym); if (_hl) box.insertAdjacentHTML('beforeend', _hl);
    if (item.type === 'custom' || item.user) {
      const del = document.createElement('button'); del.className = 'btn ghost'; del.style.marginTop = '8px'; del.textContent = '删除该项目';
      del.onclick = () => { if (confirm('删除「' + item.name + '」？')) { const d = this.data(); d.items = d.items.filter(x => x.id !== item.id); this.save(d); this.render(box); } };
      box.appendChild(del);
    }
    box.querySelector('#dtBack').onclick = () => this.render(box);
    // 年月切换：点「年月 ▾」下拉，先选年份再点月份直接跳转（取代左右箭头）
    const yb = box.querySelector('#dtYm'), yd = box.querySelector('#dtYmDrop');
    if (yb && yd) {
      let pickY = yy;
      const outside = (ev) => {
        if (!yd.contains(ev.target) && !yb.contains(ev.target)) { yd.style.display = 'none'; document.removeEventListener('click', outside, true); }
      };
      yb.onclick = (e) => {
        e.stopPropagation();
        const open = yd.style.display !== 'none';
        yd.style.display = open ? 'none' : 'block';
        if (open) document.removeEventListener('click', outside, true);
        else setTimeout(() => document.addEventListener('click', outside, true), 0);
      };
      yd.querySelectorAll('[data-ym-year]').forEach(o => o.onclick = (e) => {
        e.stopPropagation();
        pickY = Number(o.dataset.ymYear);
        yd.querySelectorAll('[data-ym-year]').forEach(x => x.classList.toggle('on', Number(x.dataset.ymYear) === pickY));
      });
      yd.querySelectorAll('[data-ym-month]').forEach(o => o.onclick = (e) => {
        e.stopPropagation();
        Daily._monthYm = pickY + '-' + String(Number(o.dataset.ymMonth)).padStart(2, '0');
        this.detail(item, box);
      });
    }
    box.appendChild(Daily.renderSubTabs(box, 'streak'));
  },
  // 下拉可选年份：当年往前 3 年，并保证当前查看年份一定在列
  yearOptions(curY) {
    const now = Number(todayStr().slice(0, 4));
    const max = Math.max(now, curY), min = Math.min(now, curY) - 3;
    const out = [];
    for (let y = max; y >= min; y--) out.push(y);
    return out;
  },

  toggleDay(item, ds, cls, box) {
    const d = this.data();
    const it = d.items.find(x => x.id === item.id) || item;
    if (it.type === 'custom') {
      it.done = it.done || {};
      if (cls === 'done') delete it.done[ds]; else it.done[ds] = 1;
    } else {
      if (cls === 'done') { toast('当天已有打卡'); return; }
      if (cls === 'mu') { toast('补签日不可改'); return; }
      const mensSet = new Set(S.get('menstrualRest', []) || []);
      if (mensSet.has(ds)) { toast('当日为月经假，已是休息，无需补签'); return; }
      const covCat = item.type === 'sport' ? (S.get('sportRest', []) || []).indexOf(ds) >= 0 : item.type === 'kg' ? (S.get('kgRest', []) || []).indexOf(ds) >= 0 : item.type === 'work' ? (S.get('workRest', []) || []).indexOf(ds) >= 0 : false;
      if (covCat && !(it.rest && it.rest[ds])) { toast('当日为每日计划休息日，可在每日计划调整'); return; }
      // 火花页：空格=补签（休息只能在板块设置，不在火花页设置）
      if (cls === 'rest') { toast('休息日请在板块设置'); return; }
      if (this.makeupAvail(it) <= 0) { toast('没有补签卡，无法补签（休息请在板块设置）'); return; }
      it.madeup = it.madeup || {};
      it.madeup[ds] = 1;
      this._syncMakeupToDaily(it, ds);
    }
    this.save(d);
    this.detail(it, box);
  },

  // 补签卡联动每日计划：把 ds 当天对应分类（kg 按科目、sport 按项目）且未完成的任务自动划掉
  _syncMakeupToDaily(item, ds) {
    const D = window.Daily;
    if (!D || !D.list) return;
    // 只处理有具体科目的学习 / 有具体项目的运动（其余按整类匹配会误伤其他任务）
    if (item.type !== 'kg' && item.type !== 'sport') return;
    const cat = item.type === 'kg' ? 'kaogong' : 'sport';
    const arr = D.list(ds);
    let changed = false;
    arr.forEach(t => {
      if (t.abandoned || t.moved || t.cat !== cat) return;
      if (item.type === 'kg') {
        const sub = (t.extra && t.extra.subject) || t.title || '';
        if (kgNorm(sub) !== kgNorm(item.ref)) return;
      } else {
        const proj = (t.link && t.link.split(':')[1]) || (t.extra && t.extra.project) || t.title || '';
        if (sportNorm(proj) !== sportNorm(item.ref)) return;
      }
      t.restDay = true;   // 补签日也按「休息」标划掉，与正常假期/月经假一致
      if (D.effDone && D.effDone(t, ds)) { changed = true; return; }   // 已完成则仅保留休息标
      if (t.steps && t.steps.length) t.steps.forEach(s => { s.done = true; s.doneAt = Date.now(); });
      else t.manualDone = true;
      if (!t.doneAt) t.doneAt = Date.now();
      changed = true;
    });
    if (changed) {
      D.setList(ds, arr);
      if (D._root && document.contains(D._root)) D.render(D._root);
    }
  },

  /* 可关联的板块：新增火花时选择。关联后由对应专栏日志反查（每日计划完成任务会写回专栏，
     所以在每日计划里完成 = 自动续火花），不用手动点格子。 */
  MODULES() {
    return [
      { k: 'sport', label: '运动', sub: 'text', subLabel: '运动项目', ph: '如：天鹅颈、大小脸改善', tip: '在每日计划里完成该运动项目，火花自动续上' },
      { k: 'kg', label: '学习·考编', sub: 'text', subLabel: '学习科目', ph: '如：言语、判断推理、申论', tip: '完成该科目的备考打卡，火花自动续上' },
      { k: 'work', label: '创作', sub: 'none', tip: '当天有创作产出（图文/视频），火花自动续上' },
      { k: 'growth', label: '成长', sub: 'text', subLabel: '成长领域', ph: '如：英语、理财', tip: '完成该领域的成长打卡，火花自动续上' },
      { k: 'read', label: '阅读', sub: 'none', tip: '当天有阅读记录，火花自动续上' },
      { k: 'travel', label: '出行', sub: 'none', tip: '当天有外出/穿搭记录，火花自动续上' },
      {
        k: 'fun', label: '娱乐', sub: 'select', subLabel: '娱乐类型', tip: '记录对应类型的娱乐，火花自动续上',
        options: [['', '任意（小说/影视/漫画/游戏都算）'], ['小说', '小说'], ['影视', '影视'], ['漫画', '漫画'], ['游戏', '游戏']]
      },
      {
        k: 'meals', label: '三餐', sub: 'select', subLabel: '餐次', tip: '打卡对应餐次，火花自动续上',
        options: [['', '任意一餐'], ['breakfast', '早餐'], ['lunch', '午餐'], ['dinner', '晚餐']]
      },
      { k: 'custom', label: '自定义（手动打卡）', sub: 'text', subLabel: '项目名称', ph: '如：冥想', tip: '没有对应板块时用它：每天点一下格子手动打卡' }
    ];
  },
  // 已有子项建议（运动项目/学习科目/成长领域），避免同一件事打错字分裂成两个火花
  subSuggestions(k) {
    const out = [];
    const push = (v) => { v = (v || '').trim(); if (v && out.indexOf(v) < 0) out.push(v); };
    if (k === 'sport') {
      ((window.MUMU_SPORT && window.MUMU_SPORT.projects) || []).forEach(p => push(p.name));
      Object.values(S.get('sportLogs', {}) || {}).forEach(arr => (arr || []).forEach(l => push(l.project)));
    } else if (k === 'kg') {
      Object.values(S.get('kgLogs', {}) || {}).forEach(arr => (arr || []).forEach(l => push(kgNorm(l.subject))));
    } else if (k === 'growth') {
      Object.values(S.get('growthLogs', {}) || {}).forEach(arr => (arr || []).forEach(l => push(l.area)));
    }
    return out;
  },
  addDialog(box) {
    const mods = this.MODULES();
    openModal(`<button class="close-x" onclick="closeModal()">×</button><h3>新增续火花项目</h3>
      <div class="muted" style="font-size:12px;margin:6px 0 12px;line-height:1.6">先选要关联的板块。之后只要在<b>每日计划</b>里完成对应任务（或在专栏里打卡），火花就会自动续上，不用手动点格子。</div>
      <div class="form-row"><label>关联板块</label>
        <select id="stkMod">${mods.map(m => `<option value="${m.k}">${esc(m.label)}</option>`).join('')}</select>
      </div>
      <div class="form-row" id="stkSubRow"><label id="stkSubLab">项目</label>
        <input id="stkSubText" placeholder="" list="stkSubList" autocomplete="off">
        <datalist id="stkSubList"></datalist>
        <select id="stkSubSel" style="display:none"></select>
      </div>
      <div class="muted" id="stkTip" style="font-size:11px;margin-bottom:10px;line-height:1.5"></div>
      <button class="btn" id="stkOk" style="width:100%">添加</button>`);
    const sel = document.getElementById('stkMod');
    const row = document.getElementById('stkSubRow');
    const txt = document.getElementById('stkSubText');
    const selSub = document.getElementById('stkSubSel');
    const lab = document.getElementById('stkSubLab');
    const list = document.getElementById('stkSubList');
    const tip = document.getElementById('stkTip');
    const sync = () => {
      const m = mods.find(x => x.k === sel.value) || mods[0];
      tip.textContent = m.tip || '';
      if (m.sub === 'none') { row.style.display = 'none'; return; }
      row.style.display = '';
      lab.textContent = m.subLabel || '项目';
      if (m.sub === 'select') {
        txt.style.display = 'none'; selSub.style.display = '';
        selSub.innerHTML = (m.options || []).map(o => `<option value="${esc(o[0])}">${esc(o[1])}</option>`).join('');
      } else {
        txt.style.display = ''; selSub.style.display = 'none';
        txt.placeholder = m.ph || ''; txt.value = '';
        list.innerHTML = this.subSuggestions(m.k).map(v => `<option value="${esc(v)}"></option>`).join('');
      }
    };
    sel.onchange = sync; sync();
    document.getElementById('stkOk').onclick = () => {
      const m = mods.find(x => x.k === sel.value) || mods[0];
      let sub = '';
      if (m.sub === 'text') { sub = (txt.value || '').trim(); if (!sub) return toast('请填写' + (m.subLabel || '项目')); }
      else if (m.sub === 'select') sub = (selSub.value || '').trim();
      const d = this.data();
      const ref = m.k === 'kg' ? kgNorm(sub) : m.k === 'sport' ? sportNorm(sub) : sub;
      const name = m.k === 'custom' ? sub
        : m.k === 'kg' ? '学习·' + ref
        : (m.k === 'sport' || m.k === 'growth') ? ref
        : m.k === 'fun' ? (ref ? '娱乐·' + ref : '娱乐')
        : m.k === 'meals' ? ({ breakfast: '早餐', lunch: '午餐', dinner: '晚餐' }[ref] || '三餐')
        : m.label;
      const id = m.k === 'custom' ? 'custom:' + uid() : m.k + ':' + (ref || 'all');
      if (d.items.some(x => x.id === id)) return toast('「' + name + '」已经在续火花里了');
      d.items.push({ id, type: m.k, name, ref, user: 1, makeup: 0, rest: {}, madeup: {}, done: {} });
      this.save(d); closeModal();
      toast(ref ? `已添加「${name}」：完成${m.label}打卡会自动续火花` : `已添加「${name}」：当天有${m.label}记录会自动续火花`);
      this.render(box);
    };
  }
};
window.Streak = Streak;

// 本地辅助：月份加减、周一归属（用于休息日按周计）
function addMonthsYm(ym, n) {
  let [y, m] = ym.split('-').map(Number);
  m += n;
  while (m > 12) { m -= 12; y++; }
  while (m < 1) { m += 12; y--; }
  return y + '-' + String(m).padStart(2, '0');
}
function mondayOf(date) {
  const d = new Date(date + 'T00:00:00');
  const day = (d.getDay() + 6) % 7; // 周一=0
  d.setDate(d.getDate() - day);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
