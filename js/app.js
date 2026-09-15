/* ============ 首页 + 导航 ============ */
window.APP_VER = 'mumu-v303'; // 当前前端版本（设置页可见，用于确认是否加载到最新代码）
const SR_LINKS = [
  { v: 'sport', n: '运动（任意跟练）' },
  { v: 'sport:', n: '运动（具体项目，选后填名）' },
  { v: 'novel', n: '写小说' },
  { v: 'growth', n: '个人成长' },
  { v: 'meals', n: '三餐记录' },
  { v: 'work', n: '创作产出' },
  { v: 'study', n: '备考学习' },
  { v: 'review', n: '复盘' }
];
const DAILY_QUOTES = [
  '行动是治愈焦虑的良药。',
  '每天进步一点点，坚持带来大改变。',
  '先完成，再完美。',
  '今天的努力，是明天的实力。',
  '不积跬步，无以至千里。',
  '专注当下，未来自来。',
  '自律即自由。',
  '你比自己想象的更强大。',
  '开始吧，最好的时机就是现在。',
  '慢一点没关系，别停下。',
  '把想做的事，变成在做的事。',
  '每一个平凡的日子，都在闪闪发光。',
  '坚持下去，时间会给你答案。',
  '不怕慢，就怕站。',
  '你的未来藏在现在的努力里。',
  '少一点比较，多一点行动。',
  '生活明朗，万物可爱。',
  '心怀希望，步履不停。',
  '做三四月的事，八九月自有答案。',
  '愿每一天都值得被记录。'
];
function getDailyQuote() {
  const d = todayStr();
  let h = 0;
  for (let i = 0; i < d.length; i++) h = ((h * 31) + d.charCodeAt(i)) >>> 0;
  return DAILY_QUOTES[h % DAILY_QUOTES.length];
}
function greetingWord() {
  const h = new Date().getHours();
  if (h < 12) return '上午好';
  if (h < 18) return '下午好';
  return '晚上好';
}
const Home = {
  render(root) {
    const d = todayStr();
    const plan = Daily.statsOf(d);
    const work = (S.get('workLogs', {})[d] || []).length;
    const study = (S.get('kgLogs', {})[d] || []).reduce((s, l) => s + l.minutes, 0);
    const growth = (S.get('growthLogs', {})[d] || []).length;
    const sport = (S.get('sportLogs', {})[d] || []).reduce((s, l) => s + l.minutes, 0);
    const meals = S.get('meals', {})[d];
    const mealsN = meals ? ['breakfast', 'lunch', 'dinner'].filter(k => meals[k]).length : 0;
    const funAll = S.get('funLogs', {});
    const funN = Object.keys(funAll).reduce((s, dd) => s + (funAll[dd] ? funAll[dd].length : 0), 0);
    const travelPhotosToday = (S.get('travelPhotos', []) || []).filter(p => p.date === d && p.kind === 'out').length;
    /* 计数口径：每张照片都对应 travelOut 里某个 entry 的 photoIds，
       travelOut[date].length 已经包含全部 entry，travelPhotosToday 重复了。
       只算 entry 数（= 用户实际创建了几条出行/随记/OOTD 记录）。 */
    const travel = (S.get('travelOut', {})[d] || []).length;
    const review = (S.get('reviews', {})[d] || {}).text;
    // 倒计时聚合
    const counts = [];
    (S.get('workActs', [])).forEach(a => { if (a.deadline) { const l = daysBetween(d, a.deadline); if (l >= 0) counts.push({ n: a.name, l, key: 'work:' + a.id }); } });
    (S.get('kgPlans', [])).forEach(p => { const l = daysBetween(d, p.date); if (l >= 0) counts.push({ n: p.name, l, key: 'kg:' + p.id }); });
    (window.MUMU_INCENTIVES ? MUMU_INCENTIVES.campaigns : []).forEach(c => { if (/^\d{4}/.test(c.deadline)) { const l = daysBetween(d, c.deadline); if (l >= 0 && l <= 30) counts.push({ n: c.title, l, key: 'inc:' + c.title }); } });
    counts.sort((a, b) => a.l - b.l);
    const hidden = S.get('countdownHidden', []);
    const visible = counts.filter(c => !hidden.includes(c.key));
    // === 自救365天角落视图 ===
    const sr = S.get('selfRescue') || (() => { const d = { start: '2026-07-13', items: [{ id: uid(), name: '改善大小脸', days: 9 }, { id: uid(), name: '天鹅颈跟练', days: 2 }] }; S.set('selfRescue', d); return d; })();
    // 字段迁移 + 关联工作台自动累计
    if (!sr.items) sr.items = [];
    sr.items.forEach(it => { if (it.base == null) it.base = it.days || 0; if (it.link == null) it.link = 'sport'; if (it.goal == null) it.goal = 0; });
    let srChanged = false;
    // v82：修复历史专项累计——旧版把 synced 钉死导致停在底数；重置为 0 让其从挑战开始日重新累计
    if (!sr._v82) { sr.items.forEach(it => { it.synced = 0; }); sr._v82 = true; srChanged = true; }
    // v83：每个专项可有独立开始日期（非全部同一天）；累计从各自开始日算起
    if (!sr._v83) {
      sr.items.forEach(it => {
        if (!it.start) {
          if (it.name && it.name.indexOf('大小脸') >= 0) it.start = '2026-07-13';
          else if (it.name && it.name.indexOf('天鹅颈') >= 0) it.start = '2026-07-26';
          else it.start = sr.start || '2026-07-13';
        }
      });
      sr._v83 = true; srChanged = true;
    }
    // v124：补一个「创作产出」专项（按产出条数算，非按天）
    if (!sr._vSR) {
      if (!sr.items.some(it => it.mode === 'output')) {
        sr.items.push({ id: uid(), name: '创作产出', mode: 'output', link: 'work', base: 0, goal: 365, start: sr.start, auto: 0, synced: 0 });
      }
      sr._vSR = true; srChanged = true;
    }
    sr.items.forEach(it => {
      if (it.mode === 'output') {
        it.auto = this.srCountOutputs(it.link);
        it.synced = 0;
      } else if (it.link) {
        const total = this.srCountLink(sr, it.link, it.start);
        if (it.synced == null) { it.synced = 0; srChanged = true; }
        it.auto = Math.max(0, total - it.synced);
      } else { it.auto = 0; }
    });
    if (srChanged) S.set('selfRescue', sr);
    const srDay = Math.max(1, daysBetween(sr.start, d) + 1);
    const srPct = Math.min(100, Math.round(srDay / 365 * 100));
    const wk7 = weekDates(d);
    const srActive = wk7.filter(dd => dd <= d && ((S.get('plans', {})[dd] || []).length || (S.get('workLogs', {})[dd] || []).length || (S.get('kgLogs', {})[dd] || []).length || (S.get('growthLogs', {})[dd] || []).length || (S.get('sportLogs', {})[dd] || []).length || (S.get('meals', {})[dd]) || (S.get('reviews', {})[dd] && S.get('reviews', {})[dd].text))).length;
    const srItemHTML = sr.items.map(it => {
      const isOut = it.mode === 'output';
      const cur = (it.base || 0) + (it.auto || 0);
      const goal = it.goal || 365;
      const pct = Math.min(100, Math.round(cur / goal * 100));
      const unit = isOut ? '条' : '天';
      return `<div class="sr-item-row" style="margin:9px 0">
        <div style="display:flex;justify-content:space-between;font-size:13px;align-items:baseline">
          <span>${esc(it.name)}</span>
          <span class="muted" style="font-size:12px">${cur}${unit}${goal ? ` / ${goal}` : ''}</span>
        </div>
        <div class="progress-bar" style="height:8px;margin-top:5px"><i style="width:${pct}%"></i></div>
      </div>`;
    }).join('');
    const srHTML = `
      <div class="card" id="srCard" style="margin-top:14px;cursor:pointer">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <h3>${icon('rescue',18)} 365天自救计划 · 第 ${srDay} 天</h3>
          <button class="btn sm ghost" id="srEdit">${icon('settings',16)} 设置</button>
        </div>
        ${srItemHTML || '<div class="muted">还没有专项，点设置添加</div>'}
        <div class="muted" style="margin-top:10px">本周工作台活跃 <b>${srActive}</b>/7 天 · 这些专栏就是你的自救内容</div>
      </div>`;

    const name = esc(S.get('name') || '木木');
    const hello = greetingWord();
    const planPct = plan.total ? Math.round(plan.done / plan.total * 100) : 0;
    const funToday = (funAll[todayStr()] || []).length;
    const cards = [
      { img: 'section-plan.png',    em: '📅', n: '计划',     val: `${plan.done}/${plan.total}`, sub: '已完成', progress: planPct, ok: plan.total > 0, go: 'daily' },
      { img: 'section-work.png',    em: '🎮', n: '创作产出', val: String(work), sub: work ? '条产出' : '待产出', progress: 0, ok: work > 0, go: 'work' },
      { img: 'section-study.png',   em: '📚', n: '备考学习', ok: study > 0, txt: study ? study + ' 分钟' : '待开始', go: 'kaogong' },
      { img: 'section-growth.png',  em: '🌿', n: '个人成长', ok: growth > 0, txt: growth ? growth + ' 次打卡' : '待学习', go: 'growth' },
      { img: 'section-finance.png', em: '💰', n: '理财',     val: `${(S.get('finStage', 1) || 1)}/6`, sub: '理财阶段', go: 'finance' },
      { img: 'section-sport.png',   em: '🏃', n: '运动',     ok: sport > 0, txt: sport ? sport + ' 分钟' : '待运动', go: 'sport' },
      { img: 'section-meals.png',   em: '🍚', n: '三餐',     ok: mealsN > 0, txt: mealsN + '/3 餐', go: 'meals' },
      { img: 'section-travel.png',  em: '🧭', n: '出行',     ok: travel > 0, txt: travel ? travel + ' 条记录' : '待出门', go: 'travel:out' },
      { img: 'section-fun.png',      em: '🎮', n: '娱乐',     ok: funToday > 0, txt: funToday ? funToday + ' 部在记录' : '待娱乐', go: 'fun' },
      { img: 'section-review.png',  em: '🌙', n: '复盘', ok: !!review, txt: review ? '已写' : '睡前写', go: 'review:daily' }
    ];
    const isZhiyaHome = !!(window.MUMU_THEME_IS_ZHIYA && window.MUMU_THEME_IS_ZHIYA());
    root.innerHTML = `
      <div class="home-greeting">
        <div class="home-hello">${hello}，${name}</div>
        <div class="home-datetime" id="homeDateTime"></div>
      </div>
      <div class="home-grid">
        ${cards.map(c => `
          <div class="card home-card" data-go="${c.go}">
            <div class="hc-icon" style="${c.ok ? '' : 'opacity:.4'}">${isZhiyaHome ? '<span class="em-ico" aria-label="' + esc(c.n) + '">' + c.em + '</span>' : '<img src="' + KITTY_RES(c.img) + '" alt="' + esc(c.n) + '" decoding="async"/>'}</div>
            <div class="hc-body">
              <div class="hc-name">${c.n}</div>
              <div class="hc-stat">${c.val ? c.val + ' ' + c.sub : (c.ok ? icon('check',11) + ' ' + c.txt : '○ ' + c.txt)}</div>
              ${c.n === '计划' ? `<div class="progress-bar hc-progress"><i style="width:${c.progress}%"></i></div>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
      <div class="card"><h3 id="cdHead" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;-webkit-tap-highlight-color:transparent">${icon('clock',18)} 倒计时看板 <span class="muted" style="font-weight:400" id="cdChev">▾</span></h3>
        <div id="cdBody">
        ${visible.slice(0, 6).map(c => `<div class="list-row"><span style="flex:1">${esc(c.n)}</span><span class="tag ${c.l <= 7 ? 'red' : c.l <= 30 ? 'amber' : 'green'}">${c.l === 0 ? '就是今天!' : '剩 ' + c.l + ' 天'}</span><button class="del" data-cdel="${esc(c.key)}" title="从看板隐藏">✕</button></div>`).join('') || '<div class="empty">暂无临近事项。去工作/考编板块建立计划后，这里会自动汇总。</div>'}
        ${hidden.length ? `<div class="muted" style="margin-top:8px;cursor:pointer" id="cdRestore">已隐藏 ${hidden.length} 项 · 点击恢复 ↺</div>` : ''}
        </div>
      </div>
      ${srHTML}`;
    this.updateDateTime();
    if (!this._dtTimer) this._dtTimer = setInterval(() => this.updateDateTime(), 30000);
    root.querySelectorAll('[data-go]').forEach(c => c.onclick = () => App.go(c.dataset.go));
    root.querySelectorAll('[data-cdel]').forEach(b => b.onclick = () => {
      const h = S.get('countdownHidden', []); if (!h.includes(b.dataset.cdel)) h.push(b.dataset.cdel);
      S.set('countdownHidden', h); this.render(root); toast('已从倒计时看板隐藏');
    });
    const cdRestore = root.querySelector('#cdRestore');
    if (cdRestore) cdRestore.onclick = () => { S.set('countdownHidden', []); this.render(root); toast('已恢复全部倒计时 ↺'); };
    const srCard = root.querySelector('#srCard');
    if (srCard) srCard.onclick = (e) => { if (e.target.closest('#srEdit')) return; this.srDetail(root); };
    const srEditBtn = root.querySelector('#srEdit');
    if (srEditBtn) srEditBtn.onclick = (e) => { e.stopPropagation(); this.srEdit(root); };
    const cdHead = root.querySelector('#cdHead');
      if (cdHead) cdHead.onclick = () => {
      const b = root.querySelector('#cdBody'); const ch = root.querySelector('#cdChev');
      if (b.style.display === 'none') { b.style.display = ''; ch.textContent = '▾'; } else { b.style.display = 'none'; ch.textContent = '▸'; }
    };
  },
  updateDateTime() {
    const el = document.getElementById('homeDateTime');
    if (!el) return;
    const n = new Date();
    const wd = '日一二三四五六'[n.getDay()];
    const time = String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0');
    el.textContent = n.getFullYear() + '年' + (n.getMonth() + 1) + '月' + n.getDate() + '日 星期' + wd + ' ' + time;
  },
  srDaysOf(sr, it) { return (it.base || 0) + (it.auto || 0); },
  _dayMatches(link, d) {
    if (!link) return false;
    if (link === 'sport') return (S.get('sportLogs', {})[d] || []).length > 0;
    if (link.startsWith('sport:')) { const p = link.slice(6); return (S.get('sportLogs', {})[d] || []).some(l => l.project === p); }
    if (link === 'novel') return ((S.get('novel', {}).daily) || {})[d] > 0;
    if (link === 'growth') return (S.get('growthLogs', {})[d] || []).length > 0;
    if (link === 'meals') return !!S.get('meals', {})[d];
    if (link === 'work') return (S.get('workLogs', {})[d] || []).length > 0;
    if (link === 'study') return (S.get('kgLogs', {})[d] || []).length > 0;
    if (link === 'review') { const r = S.get('reviews', {})[d]; return !!(r && r.text); }
    return false;
  },
  srCountLink(sr, link, since) {
    const start = since || sr.start || todayStr();
    const isSport = link === 'sport' || (link || '').startsWith('sport:');
    const rest = isSport ? (S.get('sportRest', []) || []) : [];
    let n = 0;
    for (let i = 0; i <= daysBetween(start, todayStr()); i++) {
      const d = addDays(start, i);
      if (this._dayMatches(link, d)) { n++; continue; }
      if (rest.includes(d)) n++; // 运动专项：休息日也算一天（不中断连续天数）
    }
    return n;
  },
  // 产出模式：统计专栏「条产出」（如创作每条打卡 = 1 条产出）。只要专栏打卡就自动增加。
  srCountOutputs(link) {
    if (!link) return 0;
    if (link === 'work') { const logs = S.get('workLogs', {}); let n = 0; Object.keys(logs).forEach(d => { n += (logs[d] || []).length; }); return n; }
    return 0;
  },
  srEdit(root) {
    const sr = S.get('selfRescue');
    const linkSel = it => `<select class="srLink" data-id="${it.id}" style="flex:1;min-width:140px">
      ${SR_LINKS.map(o => `<option value="${o.v}" ${it.link === o.v ? 'selected' : ''}>${o.n}</option>`).join('')}
    </select>`;
    openModal(`<button class="close-x" onclick="closeModal()">×</button><h3>${icon('rescue',18)} 自救365天 · 设置</h3>
      <div class="form-row"><label>开始日期（第1天）</label><input type="date" id="srStart" value="${esc(sr.start)}"></div>
      <div class="muted">专项进度：关联工作台后自动累计（初始底数手动设，之后按工作台每日完成情况增加）。用 ↑/↓ 调整顺序。</div>
      <div id="srItems">${sr.items.map((it, idx) => `<div class="sr-item" data-id="${it.id}" data-lp style="border:1px solid #ececec;padding:8px;border-radius:8px;margin:8px 0">
        <div style="display:flex;gap:6px;align-items:center">
          <button class="btn sm ghost" data-up="${it.id}" ${idx === 0 ? 'disabled' : ''}>↑</button>
          <button class="btn sm ghost" data-down="${it.id}" ${idx === sr.items.length - 1 ? 'disabled' : ''}>↓</button>
          <input class="srName" data-id="${it.id}" value="${esc(it.name)}" style="flex:1" placeholder="专项名">
        </div>
        <div style="display:flex;gap:6px;align-items:center;margin-top:6px;flex-wrap:wrap">
          ${linkSel(it)}
          <select class="srMode" data-id="${it.id}" style="flex:1;min-width:120px">
            <option value="day" ${!it.mode || it.mode === 'day' ? 'selected' : ''}>按天累计</option>
            <option value="output" ${it.mode === 'output' ? 'selected' : ''}>按产出条数</option>
          </select>
          <label style="font-size:12px">底数<input type="number" class="srBase" data-id="${it.id}" value="${it.base || 0}" style="width:60px;margin-left:4px"></label>
          <label style="font-size:12px">目标<input type="number" class="srGoal" data-id="${it.id}" value="${it.goal || 0}" style="width:64px;margin-left:4px"></label>
          <label style="font-size:12px">开始<input type="date" class="srStartItem" data-id="${it.id}" value="${it.start || sr.start}" style="width:132px;margin-left:4px"></label>
        </div>
        <input class="srProj" data-id="${it.id}" value="${it.link && it.link.startsWith('sport:') ? it.link.slice(6) : ''}" placeholder="运动项目名（如：改善大小脸）" style="width:100%;margin-top:6px;${it.link && it.link.startsWith('sport:') ? '' : 'display:none'}">
        ${it.link ? `<div class="muted" style="margin-top:4px">${icon('link',12)} 已关联，自动累计中（当前 ${this.srDaysOf(sr, it)} ${it.mode === 'output' ? '条' : '天'}）</div>` : ''}
        <div style="text-align:right;margin-top:4px"><button class="del" data-delitem="${it.id}">删除</button></div>
      </div>`).join('')}</div>
      <button class="btn sm" id="srAddItem" style="margin:6px 0">＋ 加一个专项</button>
      <button class="btn" id="srOk" style="width:100%">保存</button>`);
    document.querySelectorAll('.srLink').forEach(s => s.onchange = () => { const proj = s.closest('.sr-item').querySelector('.srProj'); if (s.value === 'sport:') proj.style.display = 'block'; else proj.style.display = 'none'; });
    document.querySelectorAll('.srMode').forEach(s => s.onchange = () => { if (s.value === 'output') { const ls = s.closest('.sr-item').querySelector('.srLink'); if (ls) ls.value = 'work'; } });
    document.getElementById('srAddItem').onclick = () => { const items = S.get('selfRescue').items; items.push({ id: uid(), name: '新专项', link: 'sport', base: 0, start: todayStr() }); S.set('selfRescue', { ...S.get('selfRescue'), items }); this.srEdit(root); };
    document.querySelectorAll('[data-delitem]').forEach(b => b.onclick = () => { const items = S.get('selfRescue').items.filter(x => x.id !== b.dataset.delitem); S.set('selfRescue', { ...S.get('selfRescue'), items }); this.srEdit(root); });
    document.querySelectorAll('[data-up]').forEach(b => b.onclick = () => { const items = S.get('selfRescue').items; const i = items.findIndex(x => x.id === b.dataset.up); if (i > 0) { [items[i - 1], items[i]] = [items[i], items[i - 1]]; S.set('selfRescue', { ...S.get('selfRescue'), items }); this.srEdit(root); } });
    document.querySelectorAll('[data-down]').forEach(b => b.onclick = () => { const items = S.get('selfRescue').items; const i = items.findIndex(x => x.id === b.dataset.down); if (i >= 0 && i < items.length - 1) { [items[i + 1], items[i]] = [items[i], items[i + 1]]; S.set('selfRescue', { ...S.get('selfRescue'), items }); this.srEdit(root); } });
    document.getElementById('srOk').onclick = () => {
      const start = document.getElementById('srStart').value; if (!start) return toast('选个开始日期');
      const items = sr.items.map(it => {
        const name = (document.querySelector('.srName[data-id="' + it.id + '"]') || {}).value || '';
        let link = (document.querySelector('.srLink[data-id="' + it.id + '"]') || {}).value || '';
        const proj = (document.querySelector('.srProj[data-id="' + it.id + '"]') || {}).value || '';
        if (link === 'sport:' && proj.trim()) link = 'sport:' + proj.trim();
        const mode = (document.querySelector('.srMode[data-id="' + it.id + '"]') || {}).value || 'day';
        const base = Number((document.querySelector('.srBase[data-id="' + it.id + '"]') || {}).value) || 0;
        const goal = Number((document.querySelector('.srGoal[data-id="' + it.id + '"]') || {}).value) || 0;
        const istart = (document.querySelector('.srStartItem[data-id="' + it.id + '"]') || {}).value || it.start || sr.start;
        const ni = { id: it.id, name: name.trim() || it.name, link: link || 'sport', base, goal, start: istart, auto: it.auto || 0, synced: it.synced };
        if (mode === 'output') { ni.link = 'work'; ni.mode = 'output'; ni.synced = 0; }
        else { ni.mode = 'day'; if (it.link !== link) ni.synced = this.srCountLink(sr, link, istart); }
        return ni;
      });
      S.set('selfRescue', { start, items }); closeModal(); this.render(root); toast('已保存');
    };
  },
  srDetail(root) {
    const sr = S.get('selfRescue');
    const d = todayStr();
    const srDay = Math.max(1, daysBetween(sr.start, d) + 1);
    const pct = Math.min(100, Math.round(srDay / 365 * 100));
    const rows = (sr.items || []).map(it => {
      const isOut = it.mode === 'output';
      const days = this.srDaysOf(sr, it);
      const goal = it.goal || 0;
      const unit = isOut ? '条' : '天';
      const ip = goal > 0 ? Math.min(100, Math.round(days / goal * 100)) : 0;
      return `<div style="border:1px solid #ececec;border-radius:10px;padding:10px;margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:center"><b>${esc(it.name)}</b>${it.link ? '<span class="tag blue" style="font-size:11px">🔗 自动累计</span>' : ''}${isOut ? '<span class="tag" style="font-size:11px">按产出</span>' : ''}</div>
        <div style="display:flex;gap:8px;align-items:baseline;margin:6px 0">
          <span style="font-size:20px;font-weight:700;color:var(--ink)">${days}</span><span class="muted">${unit}</span>
          ${goal > 0 ? `<span class="muted" style="margin-left:auto">目标 ${goal} ${unit} · 完成 ${ip}%</span>` : '<span class="muted" style="margin-left:auto">未设目标，慢慢来</span>'}
        </div>
        ${goal > 0 ? `<div class="progress-bar" style="height:10px"><i style="width:${ip}%"></i></div>` : ''}
        ${it.start ? `<div class="muted" style="font-size:11px;margin-top:4px">始于 ${it.start}</div>` : ''}
      </div>`;
    }).join('') || '<div class="empty">还没有专项，点「⚙ 设置」添加</div>';
    openModal(`<button class="close-x" onclick="closeModal()">×</button><h3>${icon('rescue',18)} 365天自救计划 · 第 ${srDay} 天</h3>
      <div class="progress-bar" style="height:12px;margin:6px 0 4px"><i style="width:${pct}%"></i></div>
      <div class="muted" style="margin-bottom:12px">总进度 ${pct}% · 满格 365 天（创作产出按条数算）</div>
      ${rows}
      <div class="muted" style="margin-top:8px">点「${icon('settings',12)} 设置」可以给每个专项设目标与累计方式，这里就会显示完成百分比。</div>`);
  }
};
window.Modules.home = { render: r => Home.render(r) };

const App = {
  navs: [
    { id:'home', icon:'home', label:'首页' },
    { id:'daily', icon:'calendar', label:'计划' },
    { id:'work', icon:'creation', label:'创作', noSideBranch: true, branches:[
      { id:'work', label:'创作打卡' },
      { id:'work:tool:radar', label:'激励雷达' },
      { id:'work:tool:edit', label:'剪辑灵感' },
      { id:'work:writing', label:'写作' }
    ]},
    { id:'kaogong', icon:'book', label:'考公', noSideBranch: true, branches:[
      { id:'kaogong', label:'备考打卡' },
      { id:'kaogong:shizheng', label:'每日时政' },
      { id:'kaogong:info', label:'报考资讯' },
      { id:'kaogong:plan', label:'备考规划' }
    ]},
    { id:'growth', icon:'sprout', label:'成长', noSideBranch: true, branches:[
      { id:'growth:english', label:'英语' },
      { id:'growth:skill', label:'技能' },
      { id:'growth:reading', label:'阅读' }
    ]},
    { id:'finance', icon:'finance', label:'理财', noSideBranch: true, branches:[
      { id:'finance:snapshot', label:'财务快照' },
      { id:'finance:fund', label:'基金分析' },
      { id:'finance:learn', label:'理财学习' },
      { id:'finance:system', label:'理财体系' }
    ]},
    { id:'sport', icon:'running', label:'运动', noSideBranch: true, branches:[
      { id:'sport', label:'运动打卡' },
      { id:'sport:photo', label:'拍照' }
    ]},
    { id:'meals', icon:'meal', label:'三餐' },
    { id:'travel', icon:'map', label:'出行', noSideBranch: true, branches:[
      { id:'travel:out', label:'日常外出' },
      { id:'travel:trip', label:'旅行' }
    ]},
    { id:'fun', icon:'fun', label:'娱乐' },
    { id:'review', icon:'moon', label:'复盘' }
  ],
  titles: {
    home: '木木的工作台', daily: '计划', work: '创作产出', finance: '理财',
    'finance:snapshot': '财务快照', 'finance:fund': '基金分析', 'finance:learn': '理财学习', 'finance:system': '理财体系',
    'work:writing': '写作',
    kaogong: '考公考编', growth: '个人成长', sport: '运动',
    meals: '三餐记录', review: '复盘', settings: '设置',
    'growth:english': '英语', 'growth:reading': '阅读', 'growth:skill': '技能',
    'travel': '出行', 'travel:out': '日常外出', 'travel:trip': '旅行',
    'fun': '娱乐'
  },
  cur: 'home',
  updateQuote() {
    const el = document.getElementById('topbarQuote');
    if (el) el.textContent = getDailyQuote();
  },
  toggleSidebar(open) {
    const sb = document.getElementById('sidebar');
    const ov = document.getElementById('sidebarOverlay');
    if (open === undefined) open = !sb.classList.contains('open');
    sb.classList.toggle('open', open);
    ov.classList.toggle('show', open);
  },
  go(key, opts) {
    opts = opts || {};
    if (this._history === undefined) this._history = [];
    if (!opts.fromBack && key !== this.cur) this._history.push(this.cur);
    this.cur = key;
    this.toggleSidebar(false);
    const base = key.includes(':') ? key.split(':')[0] : key;
    // 更新导航高亮
    document.querySelectorAll('#nav .nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('#nav .nav-branch-item').forEach(n => n.classList.remove('active'));
    const mainNav = document.querySelector('#nav .nav-item[data-key="' + base + '"]');
    if (mainNav) mainNav.classList.add('active');
    if (base !== key) {
      const br = document.querySelector('#nav .nav-branch-item[data-key="' + key + '"]');
      if (br) br.classList.add('active');
    }
    const root = document.getElementById('main');
    root.scrollTop = 0; window.scrollTo(0, 0);
    if (key === 'settings' || base === 'settings') { this.renderSettings(root); return; }
    // 考公分支：提前设置子标签
    if (base === 'kaogong' && window.KG) {
      if (key === 'kaogong:shizheng') window.KG.tab = 'sz';
      else if (key === 'kaogong:info') window.KG.tab = 'news';
      else if (key === 'kaogong:plan') window.KG.tab = 'plan';
      else window.KG.tab = 'log';
    }
    // 创作分支
    if (base === 'work' && window.Work) {
      window.Work._actHistory = false;
      if (key === 'work:tool:radar') window.Work.tool = 'radar';
      else if (key === 'work:tool:copy') window.Work.tool = 'copy';
      else if (key === 'work:tool:edit') window.Work.tool = 'clip';
      else if (key === 'work:writing') window.Work.tool = 'writing';
      else window.Work.tool = null;
    }
    // 成长分支
    if (base === 'growth' && window.Growth) {
      window.Growth._rdYear = false;
      if (key === 'growth:english') window.Growth.sub = 'english';
      else if (key === 'growth:reading') window.Growth.sub = 'reading';
      else if (key === 'growth:skill') window.Growth.sub = 'skill';
      else window.Growth.sub = null;
    }
    // 理财分支
    if (base === 'finance' && window.Finance) {
      if (key === 'finance:snapshot') window.Finance.sub = 'snapshot';
      else if (key === 'finance:fund') window.Finance.sub = 'fund';
      else if (key === 'finance:learn') window.Finance.sub = 'learn';
      else if (key === 'finance:system') window.Finance.sub = 'system';
      else window.Finance.sub = 'snapshot';
    }
    // 运动分支
    if (base === 'sport' && window.Sport) {
      if (key === 'sport:photo') window.Sport.sub = 'photo';
      else window.Sport.sub = null;
    }
    // 复盘分支（内部 tab：每日/周/月/年）
    if (base === 'review' && window.Review) { window.Review.sub = null; if (!window.Review._rtab) window.Review._rtab = 'daily'; }
    // 出行分支
    if (base === 'travel' && window.Travel) {
      if (key === 'travel:out') window.Travel.sub = 'out';
      else if (key === 'travel:trip') window.Travel.sub = 'trip';
      else window.Travel.sub = 'out';
      window.Travel._year = false; window.Travel._yearMonth = null; window.Travel._tripId = null;
    }
    // 娱乐分支（无子分支，直接进「全部」页）
    if (base === 'fun' && window.Entertainment) { window.Entertainment.activeType = '全部'; window.Entertainment._view = 'main'; }
    if (window.Modules[base]) window.Modules[base].render(root);
  },
  back() {
    const root = document.getElementById('main');
    const E = window.Entertainment;
    if (E && E._view && E._view !== 'main') { E.backSub(); return; }
    const G = window.Growth, W = window.Work, D = window.Daily;
    // 优先退出内部子视图
    if (G && G._rdYear) { G._rdYear = false; G.render(root); return; }
    if (W && W._actHistory) { W._actHistory = false; W.render(root); return; }
    if (D && D._sub === 'monthCal') { D._sub = null; D.render(D._root); return; }
    const T = window.Travel;
    if (T && T._year) { T._year = false; T._yearMonth = null; T.render(root); return; }
    if (T && T._tripId) { T._tripId = null; T.render(root); return; }
    if (G && G.sub) { G.sub = null; G.render(root); return; }
    // 否则返回历史栈中的上一页
    if (this._history && this._history.length) {
      const prev = this._history.pop();
      this.go(prev, { fromBack: true });
    }
  },
  _bindEdgeBack() {
    const EDGE = 28, THRESH = 55;
    let sx = 0, sy = 0, tracking = false, fromRight = false;
    const sidebarOpen = () => { const s = document.getElementById('sidebar'); return s && s.classList.contains('open'); };
    const pt = e => {
      if (e.clientX != null) return e;
      const t = e.touches && e.touches[0] ? e.touches[0] : (e.changedTouches && e.changedTouches[0]);
      return t ? { clientX: t.clientX, clientY: t.clientY } : { clientX: -1, clientY: 0 };
    };
    const onDown = e => {
      if (sidebarOpen()) { tracking = false; return; }
      const p = pt(e);
      if (p.clientX >= window.innerWidth - EDGE) { sx = p.clientX; sy = p.clientY; tracking = true; fromRight = true; }
      else if (p.clientX <= EDGE) { sx = p.clientX; sy = p.clientY; tracking = true; fromRight = false; }
      else tracking = false;
    };
    const onMove = e => {
      if (!tracking) return;
      const p = pt(e);
      const dx = p.clientX - sx, dy = p.clientY - sy;
      if (Math.abs(dy) > 60) { tracking = false; return; }
      if (fromRight && dx < -THRESH) { tracking = false; this.back(); }
      else if (!fromRight && dx > THRESH) { tracking = false; this.back(); }
    };
    const onUp = () => { tracking = false; };
    // 同时监听 pointer（鼠标/触控笔）与 touch（手机滑动），覆盖更多设备
    document.addEventListener('pointerdown', onDown, { passive: true });
    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerup', onUp, { passive: true });
    document.addEventListener('pointercancel', onUp, { passive: true });
    document.addEventListener('touchstart', onDown, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: true });
    document.addEventListener('touchend', onUp, { passive: true });
    document.addEventListener('touchcancel', onUp, { passive: true });
  },
  renderSettings(root) {
    root.innerHTML = `
      <div class="card settings-page">
        <h3 style="margin-bottom:16px">${icon('settings',18)} 设置</h3>
        <div class="setting-row">
          <div><div class="setting-label">${icon('download',16)} 导出全部数据</div><div class="setting-desc" style="font-size:11px">下载 JSON 文件，含打卡/日记/照片/计划等所有数据</div></div>
          <div class="setting-actions"><button class="btn sm" id="btnExport">导出</button></div>
        </div>
        <div class="setting-row">
          <div><div class="setting-label">${icon('upload',16)} 导入恢复数据</div><div class="setting-desc" style="font-size:11px">选择之前导出的 JSON 文件，一键还原</div></div>
          <div class="setting-actions"><button class="btn sm ghost" id="btnImport">导入</button></div>
        </div>
        <div class="setting-row">
          <div><div class="setting-label">${icon('refresh',16)} 数据自检修复</div><div class="setting-desc" style="font-size:11px">清理各板块已删但每日计划/月时间轴残留的孤儿任务，并移除过去日期里误加的固定每日任务</div></div>
          <div class="setting-actions"><button class="btn sm" id="btnRepair">修复</button></div>
        </div>
        <div class="setting-row">
          <div><div class="setting-label">${icon('sun',16)} 每日精力上限</div><div class="setting-desc" style="font-size:11px">精力系统：每天累计的任务精力消耗达到这个数，就提醒你充电、别再硬加任务</div></div>
          <div class="setting-actions"><input id="loadCapInput" type="number" min="1" max="60" value="${S.get('loadCap', 12)}" style="width:64px;text-align:center"></div>
        </div>
        <div class="setting-row">
          <div><div class="setting-label">${icon('sun',16)} 精力评估 / 重新评估</div><div class="setting-desc" style="font-size:11px">花 10 秒了解你的精力，设定或调整精力上限；每月复盘也会自动给建议</div></div>
          <div class="setting-actions"><button class="btn sm" id="btnAssess">评估</button></div>
        </div>
        <div class="setting-row">
          <div><div class="setting-label">🌱 枝枝喵主题</div><div class="setting-desc" style="font-size:11px">新版=当前枝枝喵形象；旧版=枝丫（绿芽）。切换后页面会刷新生效，可一键换回</div></div>
          <div class="setting-actions" id="themeOpts" style="display:flex;gap:8px">
            <button class="btn sm ghost theme-opt" data-t="cat">新版</button>
            <button class="btn sm ghost theme-opt" data-t="zhiya">旧版</button>
          </div>
        </div>
        <div class="setting-row">
          <div><div class="setting-label">版本 / 检查更新</div><div class="setting-desc" style="font-size:11px">当前前端版本：<b id="appVer">检测中…</b>。若导入仍异常，点「检查更新」强制拉取最新代码后重试</div></div>
          <div class="setting-actions"><button class="btn sm" id="btnCheckUpdate">检查更新</button></div>
        </div>
      </div>`;
    const btnExport = root.querySelector('#btnExport');
    if (btnExport) btnExport.onclick = async () => {
      btnExport.disabled = true; btnExport.textContent = '导出中…';
      try {
        const data = await exportData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url;
        a.download = '木木工作台备份_' + todayStr() + '.json'; a.click();
        URL.revokeObjectURL(url); toast('已导出全部数据（含 ' + (data.photos ? data.photos.length : 0) + ' 张照片）');
      } catch (e) { toast('导出失败：' + e.message); }
      btnExport.disabled = false; btnExport.textContent = '导出';
    };
    const appVerEl = root.querySelector('#appVer');
    if (appVerEl) appVerEl.textContent = window.APP_VER || '未知';
    const btnCheckUpdate = root.querySelector('#btnCheckUpdate');
    if (btnCheckUpdate) btnCheckUpdate.onclick = async () => {
      btnCheckUpdate.disabled = true; btnCheckUpdate.textContent = '更新中…';
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.update()));
        try { await fetch('index.html', { cache: 'no-store' }); } catch (e) {}
        toast('已请求最新代码，即将刷新…');
        setTimeout(() => location.reload(), 600);
      } catch (e) {
        toast('检查更新失败：' + e.message);
      } finally {
        btnCheckUpdate.disabled = false; btnCheckUpdate.textContent = '检查更新';
      }
    };
    const btnImport = root.querySelector('#btnImport');
    if (btnImport) btnImport.onclick = () => {
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/json,.json';
      inp.onchange = () => {
        const f = inp.files[0]; if (!f) return;
        btnImport.disabled = true;
        const setLabel = (t) => { btnImport.textContent = t; };
        setLabel('导入中…');
        importFromFile(f, (p) => {
          if (p && p.phase === 'reading') {
            const pct = p.total ? Math.min(99, Math.floor(p.done / p.total * 100)) : 50;
            setLabel('导入中 ' + pct + '%');
          }
        }).then(st => {
          let msg = '已导入 ' + st.keys + ' 项；照片 备份' + st.photosInBackup + '张 → 写入' + st.photosAdded + '张';
          if (st.photosFailed > 0) msg += '，' + st.photosFailed + '张写入失败(多为存储空间不足)';
          if (st.photosTooBig > 0) msg += '，' + st.photosTooBig + ' 张因体积过大(>12MB)已跳过';
          if (st.skipped > 0) msg += '，' + st.skipped + ' 项因空间不足跳过';
          toast(msg);
          setTimeout(() => location.reload(), 1800);
        }).catch(e => { toast('导入失败：' + e.message); })
        .finally(() => { btnImport.disabled = false; btnImport.textContent = '导入'; });
      }; inp.click();
    };
    const btnRepair = root.querySelector('#btnRepair');
    if (btnRepair) btnRepair.onclick = async () => {
      btnRepair.disabled = true; btnRepair.textContent = '修复中…';
      try {
        const n1 = (window.Daily && Daily.reconcileAllOrphans) ? Daily.reconcileAllOrphans() : 0;
        const removed = (window.repairAll ? repairAll() : 0);
        try { if (window.menstrualReconcile) menstrualReconcile(); } catch (e) {}
        toast('自检完成：清理 ' + removed + ' 条重复' + (n1 ? '，孤儿任务 ' + n1 + ' 条' : '') + '，刷新中…');
        setTimeout(() => location.reload(), 1200);
      } catch (e) { toast('修复失败：' + e.message); }
      btnRepair.disabled = false; btnRepair.textContent = '修复';
    };
    const capInput = root.querySelector('#loadCapInput');
    if (capInput) capInput.onchange = () => {
      const v = Number(capInput.value) || 12;
      S.set('loadCap', v); toast('每日精力上限已设为 ' + v);
    };
    const btnAssess = root.querySelector('#btnAssess');
    if (btnAssess) btnAssess.onclick = () => { if (window.Daily && Daily.assessLoadProfile) Daily.assessLoadProfile(); };
    // 枝枝喵主题切换（cat 新版 / zhiya 旧版枝丫，一键换回）
    const curT = window.MUMU_THEME || 'cat';
    root.querySelectorAll('#themeOpts .theme-opt').forEach(b => {
      if (b.dataset.t === curT) { b.style.borderColor = '#111'; b.style.color = '#111'; b.style.fontWeight = '600'; }
      b.onclick = () => {
        if (b.dataset.t === curT) return;
        try { localStorage.setItem('mumu_theme', b.dataset.t); } catch (e) {}
        toast(b.dataset.t === 'cat' ? '已切到枝枝喵新版 🌱' : '已切到枝丫旧版 🌱');
        setTimeout(() => location.reload(), 450);
      };
    });
  },
  async init() {
    await S.boot();   // 启动先把 IndexedDB 历史数据载入内存（首次自动迁移旧 localStorage 数据），确保后续 reconcile/render 基于最新数据
    if (window.Daily && Daily.fixWorkVideoType) Daily.fixWorkVideoType();
    if (window.Daily && Daily.reconcileReadingPlans) Daily.reconcileReadingPlans();
    if (window.Daily && Daily.reconcileAllOrphans) Daily.reconcileAllOrphans(); // 清理各专栏已删但每日计划残留的孤儿任务
    if (window.menstrualReconcile) menstrualReconcile(); // 月经假对账：给历史月经假日补休息标、清理与其他休息的重叠
    migrateNovelsV188(); // 一次性把阅读里的娱乐小说迁到娱乐专栏（阅读今后只放知识/严肃阅读）
    if (window.Meals && Meals.backfillJunkTags) Meals.backfillJunkTags();
    const sb = document.getElementById('nav');
    sb.innerHTML = this.navs.map(n => {
      const hasBranches = n.branches && n.branches.length > 0;
      const item = `<button class="nav-item${(hasBranches && !n.noSideBranch) ? ' has-branch' : ''}" data-key="${n.id}"><span class="ic">${icon(n.icon)}</span><span class="txt">${n.label}</span></button>`;
      if (hasBranches && !n.noSideBranch) {
        const branches = n.branches.map(b =>
          `<button class="nav-branch-item" data-key="${b.id}">${b.label}</button>`
        ).join('');
        return item + `<div class="nav-branch-wrap" data-parent="${n.id}">${branches}</div>`;
      }
      return item;
    }).join('');
    // 带分支的导航项：点击展开/折叠子菜单
    sb.querySelectorAll('.nav-item.has-branch').forEach(b => {
      b.onclick = () => {
        const parentKey = b.dataset.key;
        const wrap = sb.querySelector('.nav-branch-wrap[data-parent="' + parentKey + '"]');
        if (wrap) {
          const isOpen = wrap.classList.contains('open');
          // 关闭其他打开的分支
          sb.querySelectorAll('.nav-branch-wrap.open').forEach(w => w.classList.remove('open'));
          sb.querySelectorAll('.nav-item.has-branch.open').forEach(n => n.classList.remove('open'));
          if (!isOpen) {
            wrap.classList.add('open');
            b.classList.add('open');
          }
        }
      };
    });
    // 分支子项：点击导航
    sb.querySelectorAll('.nav-branch-item').forEach(b => {
      b.onclick = (e) => { e.stopPropagation(); this.go(b.dataset.key); };
    });
    // 无分支的导航项：直接跳转
    sb.querySelectorAll('.nav-item:not(.has-branch)').forEach(b => {
      if (b.dataset.key !== 'settings') b.onclick = () => this.go(b.dataset.key);
    });
    // 底部设置按钮（在 sidebar-footer 中，单独处理）
    const setBtn = document.querySelector('#sidebar .sidebar-footer .nav-item[data-key="settings"]');
    if (setBtn) setBtn.onclick = () => this.go('settings');
    // 汉堡按钮
    const ham = document.getElementById('hamburger');
    if (ham) ham.onclick = () => this.toggleSidebar();
    // 遮罩点击关闭
    const ov = document.getElementById('sidebarOverlay');
    if (ov) ov.onclick = () => this.toggleSidebar(false);
    // 每日金句
    this.updateQuote();
    this._bindEdgeBack();
    this.go('home');
  }
};

/* 一次性迁移：阅读里的「娱乐」分类小说 → 娱乐专栏（类型=小说）。
   与阅读删除路径保持一致：清 readLogs + readNotes + 每日计划 autoGen 任务，避免留孤儿。 */
function migrateNovelsV188() {
  try {
    if (S.get('migratedNovelsV188')) return;
    const rLogs = S.get('readLogs', {});
    const funLogs = S.get('funLogs', {}) || {};
    let moved = 0; const newRLogs = {};
    Object.keys(rLogs).forEach(d => {
      const kept = [];
      (rLogs[d] || []).forEach(l => {
        const isFun = l && (l.cat === 'fun' || (window.Growth && Growth.readCat(l).key === 'fun'));
        if (isFun) {
          const rec = {
            id: 'mig_' + (l.id || uid()),
            type: '小说',
            title: l.book || '未命名',
            cover: l.cover || '',
            total: '',
            progress: l.pages || '',
            status: l.finished ? '看完' : '在看',
            rating: Number(l.rating) || 0,
            review: l.review || '',
            minutes: '', purpose: '',
            epMin: '', speed: 1, skip: 0, episodes: '', imgs: [],
            tags: (l.tags || []), icon: '',
            createdAt: Date.now()
          };
          if (!funLogs[d]) funLogs[d] = [];
          funLogs[d].push(rec);
          moved++;
          try { if (window.Daily) window.Daily.removePlanBySrc('growth:阅读', l.id); } catch (e) {}
          try {
            const notes = S.get('readNotes', []);
            const filtered = notes.filter(n => n.eid !== l.id);
            if (filtered.length !== notes.length) S.set('readNotes', filtered);
          } catch (e) {}
        } else kept.push(l);
      });
      if (kept.length) newRLogs[d] = kept;
    });
    S.set('readLogs', newRLogs);
    S.set('funLogs', funLogs);
    S.set('migratedNovelsV188', true);
    if (moved) toast('已把阅读里的娱乐小说迁移到娱乐专栏（' + moved + ' 本）');
  } catch (e) { console.warn('migrateNovelsV188 failed', e); }
}

document.addEventListener('DOMContentLoaded', () => App.init());
