/* ============ 每日计划 · all-in-one（不分类，直接添加） ============ */
window.Modules = window.Modules || {};

// 充电换算（v230 全局；v277 改为按「总时长」一次性折算，避免逐条 floor 吞零头）
// 单条等效分钟：有 mins 用 mins，旧数据无 mins 时回退 val*30（val 直接是电数）
function rechMins(r) {
  const m = Number(r && r.mins) || 0;
  return m > 0 ? m : (Number(r && r.val) || 0) * 30;
}
function rechPower(r) {
  return Math.floor(rechMins(r) / 30);
}
// 某天/某段时间的充电总电量：先汇总所有记录等效分钟，再一次性 ÷30（零散零头只在最后一段舍去）
function rechPowerOf(arr) {
  let total = 0;
  (arr || []).forEach(r => { total += rechMins(r); });
  return Math.floor(total / 30);
}

const Daily = {
  cur: todayStr(),
  _root: null,
  _sub: null, // 'monthCal' | 'streak' | 'freq'
  _monthYm: null, // 月视图当前年月 '2026-07'
  _mtCats: null, // 月时间轴分类筛选：null=全部；数组=仅显示这些分类
  _mtChipsOpen: false, // 分类筛选面板是否展开
  _openTasks: {},
  _tlOpen: true,
  _inboxOpen: false,
  _doneCollapsed: false,
  all() { return S.get('plans', {}); },
  save(all) { S.set('plans', all); },
  list(date) { return this.all()[date] || []; },
  setList(date, arr) { const a = this.all(); a[date] = arr; this.save(a); },

  // 任务分类（可编辑）
  taskCats() {
    let cats = S.get('taskCats', null);
    if (!cats || !cats.length) {
      cats = [
        { id: 'meals', name: '三餐', emoji: 'meal' },
        { id: 'sport', name: '跟练', emoji: 'running' },
        { id: 'work', name: '赚钱', emoji: 'money' },
        { id: 'kaogong', name: '学习', emoji: 'book' },
        { id: 'growth', name: '成长', emoji: 'sprout' },
        { id: 'travel', name: '出行', emoji: 'map' },
        { id: 'improve', name: '改善', emoji: 'heart' },
        { id: 'daily', name: '日常', emoji: 'check' }
      ];
      S.set('taskCats', cats);
    } else if (!cats.some(c => c.id === 'travel')) {
      // v112 迁移：老用户 mumu_taskCats 已落盘，默认数组无效，需显式补出行分类
      const idx = cats.findIndex(c => c.id === 'daily');
      if (idx >= 0) cats.splice(idx, 0, { id: 'travel', name: '出行', emoji: 'map' });
      else cats.push({ id: 'travel', name: '出行', emoji: 'map' });
      S.set('taskCats', cats);
    }
    return cats;
  },
  saveCats(cats) { S.set('taskCats', cats); },
  catFromLink(link) {
    if (!link) return '';
    if (link.startsWith('meals:')) return 'meals';
    if (link.startsWith('sport:')) return 'sport';
    if (link.startsWith('work:')) return 'work';
    if (link.startsWith('kaogong:')) return 'kaogong';
    if (link.startsWith('growth:')) return 'growth';
    if (link.startsWith('travel:')) return 'travel';
    return '';
  },
  // 成长领域：把 link 里的英文 key 归一为中文领域名
  GROWTH_AREA_MAP: { english: '英语', reading: '阅读', writing: '写作', ai: 'AI', finance: '理财' },
  growthArea(link) {
    const sub = (link || '').split(':')[1] || '';
    return this.GROWTH_AREA_MAP[sub] || sub;
  },
  // 细分类：成长按其下领域（阅读/英语…）单独成类，其余同 catFromLink
  catFine(linkOrTask) {
    const link = typeof linkOrTask === 'string' ? linkOrTask : ((linkOrTask && linkOrTask.link) || '');
    if (link.startsWith('growth:')) { const a = this.growthArea(link); return a ? 'g:' + a : 'growth'; }
    return this.catFromLink(link);
  },
  catBase(cat) { return (cat && cat.indexOf('g:') === 0) ? 'growth' : cat; },
  GROWTH_AREA_ICON: { '阅读': 'book', '英语': 'globe', '写作': 'pen', 'AI': 'sparkle', '理财': 'money' },
  catEmoji(cat) {
    if (cat && cat.indexOf('g:') === 0) {
      const nm = this.GROWTH_AREA_ICON[cat.slice(2)];
      return icon(nm && icons[nm] ? nm : 'sprout', 16);
    }
    const c = this.taskCats().find(x => x.id === cat);
    if (!c) return '';
    return icons[c.emoji] ? icon(c.emoji, 16) : c.emoji;
  },
  catName(cat) {
    if (cat && cat.indexOf('g:') === 0) return cat.slice(2);
    const c = this.taskCats().find(x => x.id === cat);
    return c ? c.name : (cat || '未分类');
  },

  // 固定每日任务（模板）
  dailyTmpl() { return S.get('plansDaily', []) || []; },
  saveDaily(arr) { S.set('plansDaily', arr); },
  ensureDaily(date) {
    const tmpl = this.dailyTmpl();
    if (date < todayStr()) return; // 固定任务只部署到今天与未来，绝不往过去补（避免「穿越处理」）
    if (typeof isSickLeave === 'function' && isSickLeave(date)) return; // 病假日：不部署固定任务（当天未打卡任务已被清空）
    const all = this.all();
    const isNew = !all[date]; // 这一天才刚出现、尚无任何计划 -> 全新一天
    const list = this.list(date);
    const have = new Set(list.filter(t => t._tmpl).map(t => t._tmpl));
    let changed = false;
    tmpl.forEach(t => {
      if (have.has(t.id)) return;
      list.push({ id: uid(), title: t.title, steps: (t.steps || []).map(s => ({ id: uid(), text: s.text, done: false })),
        manualDone: false, abandoned: false, moved: false, createdAt: Date.now(), link: t.link || '', linkApp: t.linkApp || '', cat: t.cat || this.catFromLink(t.link || ''), extra: (function(){ var e = t.extra ? Object.assign({}, t.extra) : {}; if (t.cat === 'kaogong' && !e.subject) { var s = (typeof kgSubjectFromTitle === 'function') ? kgSubjectFromTitle(t.title) : ''; if (s) e.subject = s; } return e; })(), estMin: t.estMin || 0, _tmpl: t.id,
        taskLoad: (t.taskLoad && t.taskLoad >= 1 && t.taskLoad <= 5) ? t.taskLoad : 1, taskType: t.taskType === 'invest' ? 'invest' : 'consume', studyType: (t.studyType === '刷题' || t.studyType === '网课') ? t.studyType : undefined });
      changed = true;
    });
    if (isNew) { this.applyInheritedOrder(date, list); changed = true; } // 全新一天：按昨天顺序排，免去每天重排
    if (changed && list.length) this.setList(date, list);
  },

  // 任务排序继承用的稳定键：固定任务用 _tmpl（跨天相同），其余用 link+title+cat（moveTmr 拷贝的也认得出）
  orderKey(t) {
    if (t && t._tmpl) return 'tmpl:' + t._tmpl;
    return 'key:' + ((t && t.link || '') + '|' + (t && t.title || '') + '|' + (t && t.cat || ''));
  },
  // 全新一天：把当天待办按「昨天列表的顺序」排好；昨天没有的新任务追加在末尾（保持原相对顺序）
  applyInheritedOrder(date, list) {
    if (!list || !list.length) return;
    const prevList = this.list(addDays(date, -1));
    if (!prevList.length) return;
    const pos = {};
    prevList.forEach((t, i) => { const k = this.orderKey(t); if (!(k in pos)) pos[k] = i; });
    list.sort((a, b) => {
      const pa = pos[this.orderKey(a)], pb = pos[this.orderKey(b)];
      if (pa !== undefined && pb !== undefined) return pa - pb;
      if (pa !== undefined) return -1;
      if (pb !== undefined) return 1;
      return 0;
    });
  },

  // 重排后：把固定任务的相对顺序写回模板，并同步到所有未来日期，让"后一天跟着前一天的顺序走"
  propagateOrder(date, arr) {
    if (date < todayStr()) return; // 仅当重排的是今天或未来的日期才向前传播（避免改动过去影响今天）
    const fixedOrder = arr.filter(t => t._tmpl).map(t => t._tmpl);
    if (fixedOrder.length < 2) return; // 固定任务不足 2 个，无需传播
    // 1) 把模板的固定任务顺序刷新成这次重排后的顺序（作为后续新生成日子的顺序基准）
    const tmpl = this.dailyTmpl();
    const byId = {}; tmpl.forEach(x => byId[x.id] = x);
    const reordered = fixedOrder.map(id => byId[id]).filter(Boolean);
    const rest = tmpl.filter(x => fixedOrder.indexOf(x.id) < 0);
    if (reordered.length) this.saveDaily(reordered.concat(rest));
    // 2) 同步到所有严格晚于今天的日期：固定任务按新模板顺序重排，非固定任务保持原位
    const all = S.get('plans', {});
    let ch = false;
    Object.keys(all).forEach(dd => {
      if (dd <= todayStr()) return;
      const lst = all[dd] || [];
      const slots = []; lst.forEach((t, i) => { if (t._tmpl) slots.push(i); });
      if (!slots.length) return;
      const pos = {}; fixedOrder.forEach((id, i) => pos[id] = i);
      const sortedFixed = lst.filter(t => t._tmpl).sort((a, b) => {
        const pa = pos[a._tmpl], pb = pos[b._tmpl];
        if (pa !== undefined && pb !== undefined) return pa - pb;
        if (pa !== undefined) return -1;
        if (pb !== undefined) return 1;
        return 0;
      });
      slots.forEach((p, idx) => { lst[p] = sortedFixed[idx]; });
      ch = true;
    });
    if (ch) S.set('plans', all);
  },

  isDone(t) { if (!t) return false; return (Array.isArray(t.steps) && t.steps.length) ? t.steps.every(s => s && s.done) : !!t.manualDone; },

  // ===== 精力系统 =====
  // 精力上限（小配置，留 localStorage）；段式进度条按此分成等长的段
  loadCap() { const v = Number(S.get('loadCap', 10)); return (v && v > 0) ? v : 10; },
  // 精力档 1–5：轻松/一般/中等/较重/大工程（越大占的段越多）
  LOAD_LABELS: ['', '轻松', '一般', '中等', '较重', '大工程'],
  // 状态词下的解释语池（每次渲染随机抽一条，符合状态即可）
  MOOD_CAPS: {
    st0: ['今天节奏刚刚好，稳稳的', '今天状态挺放松', '精力满满，慢慢来', '今天能量充沛', '今天是个好节奏'],
    st1: ['稳步推进，状态不错', '今日状态还可以', '今天做了不少', '稳稳地推了一把', '今天的状态很在线'],
    st2: ['有点累了，该充个电啦', '今天做得够多了', '有点累了充会儿电吧', '今天消耗了不少能量', '身体在提醒你歇一歇'],
    st3: ['已经做了很多，记得歇歇、充充电', '今天做的任务够多了', '电量告急，记得充电', '今天扛的有点重', '该好好歇一会儿了']
  },
  pickMoodCap(c) {
    var p = this.MOOD_CAPS[c] || [];
    return p.length ? p[Math.floor(Math.random() * p.length)] : '';
  },
  taskLoad(t) { if (t.taskLoad == null) return 1; const v = Number(t.taskLoad); return (v >= 1 && v <= 5) ? v : 1; },
  /* 平台字段归一化（v283）：历史数据是字符串，新数据是数组 —— 统一读成数组，避免字符串/数组混用崩 */
  appArr(v) {
    if (v == null || v === '') return [];
    if (Array.isArray(v)) return v.filter(Boolean);
    return [String(v)];
  },
  /* 两个平台集合是否等价（用于「同 link + 同平台」的任务配对，兼容字符串/数组） */
  appEq(a, b) { return this.appArr(a).join('|') === this.appArr(b).join('|'); },
  loadLabel(v) { return this.LOAD_LABELS[Number(v)] || '轻松'; },
  // 单任务类型：'invest' 主动投资 / 'consume' 系统消耗
  // 运动 / 学习考编 / 成长（英语·技能·阅读）默认算主动投资；在任务详情里手动改过的（taskTypeManual）以手动为准
  INVEST_MODS: ['sport', 'kaogong', 'growth', 'read'],
  INVEST_CATS: ['sport', 'kaogong', 'growth', 'read'],
  taskType(t) {
    if (!t) return 'consume';
    if (t.taskTypeManual) return t.taskType === 'invest' ? 'invest' : 'consume';
    if (t.taskType === 'invest') return 'invest';
    const mod = (t.link || '').split(':')[0];
    if (mod && this.INVEST_MODS.indexOf(mod) >= 0) return 'invest';
    if (t.cat && this.INVEST_CATS.indexOf(t.cat) >= 0) return 'invest';
    return 'consume';
  },
  isMealTask(t) { return !!(t && t.link && t.link.startsWith('meals:')); },
  // 阅读·娱乐类打卡：纯放松不耗神，在每日计划里不计入精力消耗（不占额度、不显示消耗值）
  isLoadFree(t) {
    return !!(t && t.link === 'growth:阅读' && t.colExtra && t.colExtra['分类'] === '娱乐');
  },

  // 某天精力聚合（仅统计每日计划任务，三餐打卡等不计入）
  // plannedLoad = 已排入的精力（灰：还没做，没消耗）；doneLoad = 已完成任务的精力（彩：已消耗）
  dayLoadInfo(date) {
    date = date || this.cur;
    const cap = this.loadCap();
    const tasks = this.list(date);
    // 三餐（meals:*）不进精力系统；阅读·娱乐（纯放松）也不消耗精力
    const counted = tasks.filter(t => !t.abandoned && !t.moved && !t.restDay && !isAnnualHoliday(date) && !isSickLeave(date) && !this.isMealTask(t) && !this.isLoadFree(t));
    let plannedLoad = 0, doneLoad = 0, investLoad = 0, consumeLoad = 0;
    const allTasks = [], doneTasks = [], plannedTasks = [];
    counted.forEach(t => {
      const l = this.taskLoad(t);
      plannedLoad += l;
      allTasks.push(t);
      if (this.effDone(t, date)) { doneLoad += l; doneTasks.push(t); } else { plannedTasks.push(t); }
      if (this.taskType(t) === 'invest') investLoad += l; else consumeLoad += l;
    });
    // 今天被「移到明天」的任务，其已消耗部分仍算今日精力（在弹窗里填的 今日已消耗）
    let consumedMoved = 0;
    tasks.forEach(t => { if (t.moved && t.taskLoadConsumed != null) consumedMoved += (Number(t.taskLoadConsumed) || 0); });
    doneLoad += consumedMoved;
    const pendingLoad = Math.max(0, plannedLoad - doneLoad);
    const rechArr = (S.get('recharge', {})[date] || []);
    const recharge = rechPowerOf(rechArr);
    // 净已消耗：完成消耗的电，减去充电还回的电（充电从进度条右边减）
    const netConsumed = Math.max(0, doneLoad - recharge);
    const doneRatio = cap ? netConsumed / cap : 0;
    const full = plannedLoad >= cap && cap > 0;   // 灰已填满：今天别再加
    const over = plannedLoad > cap && cap > 0;     // 排超了：超过上限
    return { cap, plannedLoad, doneLoad, netConsumed, pendingLoad, investLoad, consumeLoad, recharge, doneRatio, full, over, date, allTasks, doneTasks, plannedTasks, consumedMoved };
  },
  // 格子进度条：每段=一个任务（按待办顺序），宽度=消耗值；空格=还没做，完成时填上对应档位色（浅灰→黑）
  // 充电从右边还回精力：从最右的已完成格往左减，减到哪格哪格右侧空出来
  loadBarHTML(li) {
    const cap = li.cap || 1;
    const denom = Math.max(cap, li.plannedLoad) || 1;
    const scale = 100 / denom;
    // 超载区分界：跟着「精力上限」走，而不是固定在整条进度条的 70%
    // 进度条总长 = denom(=max(上限,已排精力))，所以上限的 70% 在整条里占 (0.7*cap/denom)
    const breakPct = cap > 0 ? Math.min(100, (0.7 * cap / denom) * 100) : 70;
    const capPct = cap > 0 ? Math.min(100, (cap / denom) * 100) : 100;
    // 按待办顺序建格子（含「挪到明天」已消耗段）
    let cells = (li.allTasks || []).map(t => ({ load: this.taskLoad(t), done: this.effDone(t, li.date), t }));
    if (li.consumedMoved > 0) cells.push({ load: li.consumedMoved, done: true, moved: true });
    // 与「今日待办」排序关联：已完成（含挪到明天已消耗）归到左侧、按完成时间从左往右排列
    // （越早完成越靠左，进度从左往右涨）；未完成归到右侧，保持待办拖拽顺序。
    // 这样完成一个任务会自动从左往右排到左侧，拖拽排序待办也会同步体现在进度条右侧。
    const _done = cells.filter(c => c.done).sort((a, b) => ((a.t && a.t.doneAt) || 0) - ((b.t && b.t.doneAt) || 0));
    const _pend = cells.filter(c => !c.done);
    cells = _done.concat(_pend);
    // 充电抵扣：从已完成区右边缘（靠近待办区一侧）往左，把「已消耗」还回去
    let cr = li.recharge || 0;
    for (let i = cells.length - 1; i >= 0; i--) {
      const c = cells[i];
      if (!c.done || cr <= 0) continue;
      if (cr >= c.load) { c.fill = 0; cr -= c.load; }
      else { c.fill = 1 - cr / c.load; cr = 0; }
    }
    cells.forEach(c => { if (c.fill == null) c.fill = c.done ? 1 : 0; });
    if (!cells.length) return `<div class="load-bar" title="今天还没排任务"><span class="lb-cell empty" style="width:100%"></span><i class="lb-break" style="left:${breakPct}%"></i><i class="lb-overzone" style="left:${breakPct}%;right:0"></i><i class="lb-capline" style="left:${capPct}%"></i></div>`;
    const segs = cells.map(c => {
      const L = c.load, w = (L * scale).toFixed(2);
      const tier = Math.max(1, Math.min(5, Math.round(L)));
      const full = c.fill >= 0.999;
      const clsCell = 'lb-cell' + (full ? ' done' : '');
      const label = c.moved ? '今日已消耗（挪到明天）' : esc((c.t && c.t.title) || '任务');
      const stateTxt = c.fill >= 0.999 ? '已完成·已消耗' : (c.fill > 0 ? '部分消耗' : (c.done ? '已充电退回' : '待做'));
      return `<span class="${clsCell}" style="width:${w}%" title="${label} · ${this.loadLabel(tier)} · ${stateTxt}"><i class="lb-fill lv${tier}" style="width:${(c.fill * 100).toFixed(1)}%"></i></span>`;
    }).join('');
    return `<div class="load-bar" title="空格=还没做；完成时填上对应档位色（越深越费精力）。充电从右边还回精力。精力上限的 70% 处到「超载区」，进去了就记得充电。">${segs}<i class="lb-break" style="left:${breakPct}%"></i><i class="lb-overzone" style="left:${breakPct}%;right:0"></i><i class="lb-capline" style="left:${capPct}%"></i></div>`;
  },
  // 由不成熟 idea 加入今日计划（growth.js 调用）
  addTaskFromIdea(i) {
    if (!i) return null;
    const d = this.cur;
    const arr = this.list(d);
    const id = uid();
    const steps = (i.steps || []).map(s => ({ id: uid(), text: (s && s.text) || s, done: false }));
    const load = Math.max(1, Math.min(5, (steps.length || 2)));
    arr.push({ id, title: i.title, steps, cat: 'growth', link: '', linkApp: '', extra: null, estMin: 0, manualDone: false, abandoned: false, moved: false, createdAt: Date.now(), taskLoad: load, taskType: 'invest', _fromIdea: i.id });
    this.setList(d, arr);
    return id;
  },


  // 关联完成（由其他专栏打卡触发），渲染时实时计算，不写回存储
  effDone(t, date) {
    date = date || this.cur;
    return this.isDone(t) || this.linkSatisfied(t, date);
  },
  // 某天是否算「打卡日」：有完成的每日计划任务，或任一专栏有真实打卡记录（考公/运动/创作/成长/出行）
  _dayChecked(dd) {
    const tasks = this.list(dd);
    if (tasks.some(t => !t.abandoned && this.effDone(t, dd))) return true;
    if ((S.get('kgLogs', {})[dd] || []).length) return true;
    if ((S.get('sportLogs', {})[dd] || []).length) return true;
    if ((S.get('workLogs', {})[dd] || []).length) return true;
    if ((S.get('growthLogs', {})[dd] || []).length) return true;
    if ((S.get('travelOut', {})[dd] || []).length) return true;
    return false;
  },
  linkSatisfied(t, date) {
    if (!t || !t.link) return false;
    date = date || this.cur;
    const [mod, sub] = t.link.split(':');
    try {
      if (mod === 'meals') {
        const day = S.get('meals', {})[date]; if (!day) return false;
        if (sub === 'all') return !!(day.breakfast || day.lunch || day.dinner);
        const slot = { b: 'breakfast', l: 'lunch', d: 'dinner' }[sub] || sub;
        return !!day[slot];
      }
      if (mod === 'sport') {
        const logs = S.get('sportLogs', {})[date] || [];
        return logs.some(l => (l.project || '') === sub);
      }
      if (mod === 'kaogong') {
        // 历史日期保留旧兜底（当天任意学习打卡即视为完成），避免 v323 去掉兜底后旧任务突然变未完成、凭空冒出"未解决"；今天/未来严格按科目，杜绝跨科目串味
        if (date < todayStr()) return ((S.get('kgLogs', {})[date]) || []).length > 0;
        const ts = (t.extra && (t.extra.subject || t.extra['科目']) || '').trim().replace(/^(行测|申论|面试)-/, '');
        if (!ts) return false; // 无科目：今天/未来不再用"任一日志即满足"，改为手动完成
        const logs = (S.get('kgLogs', {})[date]) || [];
        return logs.some(l => (l.subject || '').trim().replace(/^(行测|申论|面试)-/, '') === ts);
      }
      if (mod === 'work') {
        if (sub === 'act') {
          const actId = t.link.split(':')[2];
          const all = (S.get('workLogs', {})[date]) || [];
          const app = this.appArr(t.linkApp);
          // 同 link + 同 linkApp 的同行任务按创建顺序排，第 i 个需要第 i+1 条打卡（一对一）
          const matched = all.filter(l => l.actId === actId && (!app.length || app.some(p => (l.app || []).includes(p))));
          const peers = this.list(date).filter(x => !x.abandoned && x.link === t.link && this.appEq(x.linkApp, app));
          const idx = peers.findIndex(x => x.id === t.id);
          return matched.length > idx;
        }
        return ((S.get('workLogs', {})[date]) || []).length > 0;
      }
      if (mod === 'growth') {
        const logs = (S.get('growthLogs', {})[date]) || [];
        return logs.some(l => (l.area || '') === sub);
      }
    } catch (e) {}
    return false;
  },
  linkLabel(t) {
    if (!t || !t.link) return '';
    const map = {
      'meals:b': '三餐·早餐', 'meals:l': '三餐·午餐', 'meals:d': '三餐·晚餐', 'meals:all': '三餐·任意一餐',
      'kaogong:study': '考编·学习打卡', 'work:today': '创作·今日产出打卡'
    };
    if (map[t.link]) return map[t.link];
    const [mod, sub] = t.link.split(':');
    if (mod === 'sport') return '运动·' + sub;
    if (mod === 'growth') return '成长·' + sub;
    if (mod === 'work' && sub === 'act') {
      const actId = t.link.split(':')[2];
      const a = (window.Work && window.Work.acts ? window.Work.acts() : []).find(x => x.id === actId);
      const nm = '创作·活动：' + (a ? a.name : '未知活动');
      const ap = this.appArr(t.linkApp);
      return ap.length ? nm + ' · ' + ap.join('、') : nm;
    }
    return t.link;
  },
  // 进行中的活动（未完成且未截止），用于关联下拉过滤
  activeActs() {
    const acts = (window.Work && window.Work.acts ? window.Work.acts() : []) || [];
    const today = todayStr();
    return acts.filter(a => {
      if (a.done) return false;
      if (a.deadline && daysBetween(today, a.deadline) < 0) return false;
      if (window.Work && window.Work.finOf) return !window.Work.finOf(a);
      return true;
    });
  },
  // 关联活动时选择具体平台（按平台一对一）
  appWrapHTML(link, linkApp) {
    if (!link || !link.startsWith('work:act:')) return '';
    const actId = link.split(':')[2];
    const a = (window.Work && window.Work.acts ? window.Work.acts() : []).find(x => x.id === actId);
    if (!a) return '';
    const apps = [...new Set((a.targets || []).map(t => t.app).filter(Boolean))];
    if (!apps.length) return '';
    const cur = this.appArr(linkApp);
    const opts = ['<option value="">整个活动（不限平台）</option>'].concat(apps.map(p => `<option value="${esc(p)}" ${cur.indexOf(p) >= 0 ? 'selected' : ''}>${esc(p)}</option>`));
    return `<div class="form-row" id="linkAppRow" style="margin-top:-6px"><label>关联平台（可选，指定后按平台一对一）</label><select id="npApp">${opts.join('')}</select></div>`;
  },
  linkOptionsHTML(sel) {
    sel = sel || '';
    const opts = ['<option value="">不关联（手动完成）</option>'];
    const sp = ((window.MUMU_SPORT && window.MUMU_SPORT.projects) || []);
    if (sp.length) {
      opts.push('<optgroup label="运动·跟练">');
      sp.forEach(p => opts.push(`<option value="sport:${esc(p.name)}" ${sel === 'sport:' + p.name ? 'selected' : ''}>${esc(p.name)}</option>`));
      opts.push('</optgroup>');
    }
    opts.push('<optgroup label="三餐">');
    [['b', '早餐'], ['l', '午餐'], ['d', '晚餐'], ['all', '任意一餐']].forEach(([k, n]) =>
      opts.push(`<option value="meals:${k}" ${sel === 'meals:' + k ? 'selected' : ''}>${n}</option>`));
    opts.push('</optgroup>');
    opts.push('<optgroup label="考编">');
    opts.push(`<option value="kaogong:study" ${sel === 'kaogong:study' ? 'selected' : ''}>学习打卡</option>`);
    opts.push('</optgroup>');
    opts.push('<optgroup label="创作·活动规划">');
    const actsAll = (window.Work && window.Work.acts ? window.Work.acts() : []) || [];
    let acts = this.activeActs();
    // 若当前选中的活动已不在进行中，仍保留它以免下拉丢值
    if (sel && sel.startsWith('work:act:')) {
      const sid = sel.split(':')[2];
      if (!acts.find(a => a.id === sid)) { const a = actsAll.find(x => x.id === sid); if (a) acts = acts.concat([a]); }
    }
    if (acts.length) {
      acts.forEach(a => opts.push(`<option value="work:act:${esc(a.id)}" ${sel === 'work:act:' + a.id ? 'selected' : ''}>${esc(a.name)}</option>`));
    }
    opts.push(`<option value="work:today" ${sel === 'work:today' ? 'selected' : ''}>今日产出打卡（不指定活动）</option>`);
    opts.push(`<option value="work:video" ${sel === 'work:video' ? 'selected' : ''}>剪视频打卡（记录类型/平台/活动/时长）</option>`);
    opts.push(`<option value="work:write" ${sel === 'work:write' ? 'selected' : ''}>写作打卡（只记字数）</option>`);
    opts.push('</optgroup>');
    const ga = S.get('growthAreas', []);
    opts.push('<optgroup label="成长·领域">');
    ga.forEach(a => opts.push(`<option value="growth:${esc(a)}" ${sel === 'growth:' + a ? 'selected' : ''}>${esc(a)}</option>`));
    if (!ga.includes('英语')) opts.push(`<option value="growth:english"${sel === 'growth:english' ? ' selected' : ''}>英语（多邻国·技能）</option>`);
    opts.push('</optgroup>');
    return opts.join('');
  },
  // 每日计划完成 → 反向写专栏半条记录（方案B双向互写）
  // 第5参数 extra 可携带 minutes / where(progress) / subject 等；第6参数 srcId 用于反向同步删除
  pushToColumn(date, link, title) {
    if (!link) return;
    const extra = arguments[4] || null;
    const srcId = arguments[5] || null;
    const [mod, sub] = link.split(':');
    try {
      if (mod === 'meals') {
        const slot = { b: 'breakfast', l: 'lunch', d: 'dinner' }[sub];
        if (!slot) return;
        const data = S.get('meals', {}); const day = data[date] || (data[date] = {});
        if (day[slot]) return; // 已有则跳过
        day[slot] = { desc: '', tags: [], time: this._nowHM(), autoGen: true, srcId: srcId || undefined };
        S.set('meals', data);
      } else if (mod === 'sport') {
        const logs = S.get('sportLogs', {}); logs[date] = logs[date] || [];
        if (logs[date].some(l => l.project === sub && l.autoGen)) return;
        logs[date].push({ id: uid(), project: sub, minutes: (extra && extra.minutes) || 10, feel: (extra && extra.feel) || '轻松', time: this._nowHM(), autoGen: true, srcId: srcId || undefined });
        S.set('sportLogs', logs);
      } else if (mod === 'kaogong') {
        const logs = S.get('kgLogs', {}); logs[date] = logs[date] || [];
        const km = (extra && extra.subject) || '言语';
        if (logs[date].some(l => l.subject === km && (l.srcId === srcId || l.id === srcId))) return;
        const kmode = (extra && extra.mode) || '网课';
        const kqt = (extra && extra.qTotal != null) ? extra.qTotal : 0;
        const kqc = (extra && extra.qCorrect != null) ? extra.qCorrect : 0;
        logs[date].push({ id: uid(), subject: km, content: title, mode: kmode, progress: (extra && (extra.where != null ? extra.where : extra.progress)) || '', minutes: (extra && extra.minutes != null) ? extra.minutes : 25, qTotal: kqt, qCorrect: kqc, qWrongTypes: (extra && extra.qWrongTypes) || undefined, time: this._nowHM(), autoGen: true, srcId: srcId || undefined });
        S.set('kgLogs', logs);
      } else if (mod === 'work') {
        const logs = S.get('workLogs', {}); logs[date] = logs[date] || [];
        // 按 srcId 去重：同一每日计划任务只记一次；不同任务各自记录（修复「一天完成多个创作任务却只记一条」的 bug）
        if (srcId && logs[date].some(l => l.autoGen && l.srcId === srcId)) return;
        const actId = (sub === 'act') ? link.split(':')[2] : undefined;
        const appArg = this.appArr(arguments[3]);
        // v283：extra.app 可能是数组（多平台）也可能是历史字符串 —— 统一归一化后再写入
        const appOut = (extra && extra.app) ? this.appArr(extra.app) : appArg;
        logs[date].push({ id: uid(), type: (extra && extra.type === 'video') ? 'video' : 'article', topic: title, app: appOut, actId, note: '', req: {}, extra: extra || null, time: this._nowHM(), autoGen: true, srcId: srcId || undefined });
        S.set('workLogs', logs);
      } else if (mod === 'growth') {
        const area = this.growthArea(link) || sub;
        const logs = S.get('growthLogs', {}); logs[date] = logs[date] || [];
        if (logs[date].some(l => l.area === area && l.autoGen)) return;
        const mins = (extra && extra.minutes != null) ? extra.minutes : 20;
        const rec = { id: uid(), area, content: title, minutes: mins, takeaway: (extra && extra.takeaway) || '', time: this._nowHM(), autoGen: true, srcId: srcId || undefined };
        if (extra && extra.read) rec.read = extra.read; // 阅读基本信息（书名/分类/进度/评分）
        logs[date].push(rec);
        S.set('growthLogs', logs);
        // 英语 → 同步写入技能日志（让「技能·英语」分钟数随每日计划打卡增长）+ 多邻国分数模型
        if (area === '英语') {
          const sl = S.get('mumu_skillLogs', {}); sl[date] = sl[date] || [];
          sl[date].push({ id: uid(), skill: '英语', minutes: mins, note: '每日计划·' + (title || '英语学习'), autoGen: true, srcId: srcId || undefined });
          S.set('mumu_skillLogs', sl);
          const d = (extra && extra.delta != null) ? Number(extra.delta) || 0 : 0;
          if (window.Growth && window.Growth.recordEngCheckIn) window.Growth.recordEngCheckIn(date, mins, d);
        }
      } else if (mod === 'travel') {
        const out = S.get('travelOut', {}); out[date] = out[date] || [];
        if (out[date].some(l => l.autoGen && l.srcId === srcId)) return;
        out[date].push({ id: uid(), date, text: title, place: (extra && extra.place) || '', time: this._nowHM(), autoGen: true, srcId: srcId || undefined });
        S.set('travelOut', out);
      }
    } catch (e) { console.warn('pushToColumn failed', e); }
  },
  // 一次性校正：把每日计划同步的创作记录 type 修正为任务实际产出类型（修复「选视频却记成图文」历史数据）
  fixWorkVideoType() {
    try {
      const wl = S.get('workLogs', {});
      let changed = false;
      Object.keys(wl).forEach(d => {
        const arr = this.list(d);
        wl[d].forEach(l => {
          if (l.autoGen && l.srcId) {
            const t = arr.find(x => x.id === l.srcId);
            if (t && t.extra && t.extra.type === 'video' && l.type !== 'video') { l.type = 'video'; changed = true; }
          }
        });
      });
      if (changed) S.set('workLogs', wl);
    } catch (e) { console.warn('fixWorkVideoType failed', e); }
  },
  // 学习任务（kaogong）：用实际时长/学到哪里覆盖 extra，使备考打卡统计实际而非预估
  _kgExtra(t) {
    if (!t || t.cat !== 'kaogong') return t ? t.extra : null;
    const e = Object.assign({}, t.extra);
    if (t.actMin != null) e.minutes = t.actMin;
    if (t.actWhere != null) e.where = t.actWhere;
    if (t.studyType) e.mode = t.studyType;            // 网课 / 刷题
    if (t.qTotal != null) e.qTotal = t.qTotal;
    if (t.qCorrect != null) e.qCorrect = t.qCorrect;
    if (t.qWrongTypes != null) e.qWrongTypes = t.qWrongTypes;
    if (t.kgSubject) e.subject = t.kgSubject;         // v282：刷题时改过科目则同步，避免日志科目与错题科目不一致
    return e;
  },
  // 删除每日计划任务时，同步删除其自动写入关联专栏的记录（按 srcId 匹配）
  removeFromColumn(date, link, srcId, colId) {
    if (!link || !srcId) return;
    const [mod] = link.split(':');
    const kill = (arr) => arr.filter(l => !(l.srcId === srcId || (colId && l.id === colId)));
    try {
      if (mod === 'sport') { const logs = S.get('sportLogs', {}); if (logs[date]) { logs[date] = kill(logs[date]); S.set('sportLogs', logs); } }
      else if (mod === 'kaogong') { const logs = S.get('kgLogs', {}); if (logs[date]) { logs[date] = kill(logs[date]); S.set('kgLogs', logs); } }
      else if (mod === 'work') { const logs = S.get('workLogs', {}); if (logs[date]) { logs[date] = kill(logs[date]); S.set('workLogs', logs); } }
      else if (mod === 'growth') { const logs = S.get('growthLogs', {}); if (logs[date]) { logs[date] = kill(logs[date]); S.set('growthLogs', logs); } }
      else if (mod === 'travel') { const out = S.get('travelOut', {}); if (out[date]) { out[date] = kill(out[date]); S.set('travelOut', out); } }
      else if (mod === 'meals') {
        const slot = { b: 'breakfast', l: 'lunch', d: 'dinner' }[link.split(':')[1]];
        if (slot) { const data = S.get('meals', {}); const day = data[date]; if (day && day[slot] && (day[slot].srcId === srcId || day[slot].id === srcId)) { delete day[slot]; S.set('meals', data); } }
      }
    } catch (e) { console.warn('removeFromColumn failed', e); }
  },
  // 专栏删条目时调用：清除每日计划里 link 匹配 + srcId 匹配的 autoGen 任务
  // 反向删除（专栏 → 每日计划），与 removeFromColumn 方向相反
  removePlanBySrc(link, srcId) {
    if (!link || !srcId) return 0;
    const all = S.get('plans', {});
    let n = 0;
    Object.keys(all).forEach(d => {
      const before = all[d].length;
      all[d] = all[d].filter(t => !(t.link === link && t.srcId === srcId));
      n += before - all[d].length;
    });
    S.set('plans', all);
    return n;
  },
  // 专栏自由打卡 → 自动建每日计划任务并沉底（🔗标记）
  // 第4参数 linkApp（创作平台）；第5参数 extra 携带该次打卡的基本信息，供时间轴/复盘展示
  autoFromColumn(link, date, title) {
    if (!link) return;
    // 成长类 link 统一归一为中文领域（growth:reading → growth:阅读），保证与手工任务/专栏日志互通
    if (link.startsWith('growth:')) { const a = this.growthArea(link); if (a) link = 'growth:' + a; }
    const colExtra = arguments[4] || null;
    const srcId = arguments[5] || null;
    date = date || todayStr();
    const list = this.list(date);
    // 创作类关联（work:today / work:act:ID）按平台一对一标记，避免一条打卡完成多个任务
    if (link.startsWith('work:')) {
      const apps = Array.isArray(arguments[3]) ? arguments[3] : (arguments[3] ? [arguments[3]] : []);
      const markOne = (pa) => {
        const peers = list.filter(t => !t.abandoned && !this.effDone(t, date) && t.link && (
          (t.link === link) ||
          (link === 'work:today' && t.link.startsWith('work:')) ||
          (link.startsWith('work:act:') && t.link === 'work:today')
        ) && (() => {
          const ta = this.appArr(t.linkApp); const pp = pa || null;
          return !ta.length || pp === null || ta.indexOf(pp) >= 0; // 平台兼容：未指定平台的任务可被任意打卡吸收
        })());
        const target = peers[0];
        if (target) {
          target.autoDone = true; target.manualDone = true; target.doneAt = target.doneAt || Date.now();
          if (colExtra) target.colExtra = Object.assign({}, target.colExtra || {}, colExtra, pa ? { '平台': pa } : {});
          return true;
        }
        return false;
      };
      let marked = false;
      if (apps.length) apps.forEach(pa => { if (markOne(pa)) marked = true; });
      else marked = markOne(null);
      if (marked) { this.setList(date, list); return; }
      // 没有任何可标记的创作任务 → 仅当当天完全没有 work: 任务时才自动建一条
      if (!list.some(t => t.link && t.link.startsWith('work:'))) {
        // v283：创作板块单独打卡自动建的任务默认算 2 精力（taskLoad 缺省只有 1，剪片/写稿实际更耗神）
        const wt = { id: uid(), title: title || '创作产出', steps: [], manualDone: true, abandoned: false, moved: false, createdAt: Date.now(), link, cat: this.catFromLink(link), autoGen: true, doneAt: Date.now(), srcId: srcId || undefined, taskLoad: 2 };
        if (colExtra) wt.colExtra = colExtra;
        list.push(wt);
        this.setList(date, list);
      }
      return;
    }
    // 非创作类：原有逻辑（精确匹配 link）
    // —— meals 特例：手工三餐任务优先，清理冗余的 autoGen 三餐任务，避免「固定早餐任务 + 早餐打卡」出现两条 ——
    if (link.startsWith('meals:')) {
      const manualMeals = list.filter(t => !t.autoGen && !t.abandoned && t.link && t.link.startsWith('meals:'));
      if (manualMeals.length) {
        const exact = manualMeals.find(t => t.link === link);
        const allT = (link !== 'meals:all') ? manualMeals.find(t => t.link === 'meals:all') : null;
        const target = exact || allT;
        if (target && !this.effDone(target, date)) {
          target.autoDone = true; target.manualDone = true; target.doneAt = target.doneAt || Date.now();
        }
        if (target) {
          for (let i = list.length - 1; i >= 0; i--) {
            const it = list[i];
            if (it.autoGen && it.link && it.link.startsWith('meals:') && !it.abandoned) list.splice(i, 1);
          }
          this.setList(date, list);
          return;
        }
        // 手工三餐任务与本次打卡餐别不对应（如手工仅早餐、本次是午餐）→ 不清理，走下方原逻辑
      }
    }
    const have = list.find(t => t.link === link);
    if (have) {
      // 已有同关联任务，标记完成（若未完成）
      if (!this.effDone(have, date) && !have.abandoned) {
        have.autoDone = true; have.manualDone = true; have.doneAt = have.doneAt || Date.now();
        if (colExtra) have.colExtra = Object.assign({}, have.colExtra || {}, colExtra);
        this.setList(date, list);
      } else if (colExtra) {
        have.colExtra = Object.assign({}, have.colExtra || {}, colExtra);
        this.setList(date, list);
      }
      return;
    }
    const nt = { id: uid(), title: title || '完成专栏打卡', steps: [], manualDone: true, abandoned: false, moved: false, createdAt: Date.now(), link, cat: this.catFromLink(link), autoGen: true, doneAt: Date.now(), srcId: srcId || undefined };
    if (colExtra) nt.colExtra = colExtra;
    list.push(nt);
    this.setList(date, list);
  },
  // 清理阅读孤儿任务：每日计划里 link=growth:阅读 的 autoGen 任务，
  // 若其 srcId 在所有 readLogs 中找不到对应打卡记录，则删除（阅读条目删/改/移后同步清理）。
  reconcileReadingPlans() {
    try {
      const rLogs = S.get('readLogs', {});
      const ids = new Set();
      Object.keys(rLogs).forEach(d => (rLogs[d] || []).forEach(l => { if (l.id) ids.add(l.id); }));
      const all = S.get('plans', {});
      let changed = false;
      Object.keys(all).forEach(d => {
        const before = all[d].length;
        all[d] = all[d].filter(t => !(t.link && (t.link === 'growth:reading' || t.link === 'growth:阅读') && t.autoGen && t.srcId && !ids.has(t.srcId)));
        if (all[d].length !== before) changed = true;
      });
      if (changed) S.set('plans', all);
    } catch (e) { console.warn('reconcileReadingPlans failed', e); }
  },
  // 按 id 删除某条每日计划任务（用于专栏删条目时反向清理生成它的任务）
  removePlanById(id) {
    if (!id) return 0;
    try {
      const all = S.get('plans', {}); let n = 0;
      Object.keys(all).forEach(d => { const b = all[d].length; all[d] = all[d].filter(t => t.id !== id); n += b - all[d].length; });
      if (n) S.set('plans', all);
      return n;
    } catch (e) { return 0; }
  },
  // 清理所有模块的孤儿 autoGen 任务：每日计划里由专栏打卡自动生成的任务，
  // 若其 srcId 对应的专栏记录已不存在（被删/移动/迁移前缺 srcId），则删除，避免月时间轴/今日列表留孤儿块。
  reconcileAllOrphans() {
    try {
      const all = S.get('plans', {});
      const collect = (store) => { const s = new Set(); const o = S.get(store, {}) || {}; Object.keys(o).forEach(d => (o[d] || []).forEach(l => { if (l.id) s.add(l.id); })); return s; };
      const readIds = collect('readLogs'), sportIds = collect('sportLogs'), kgIds = collect('kgLogs'), workIds = collect('workLogs'), outIds = collect('travelOut');
      let n = 0;
      Object.keys(all).forEach(d => {
        const before = all[d].length;
        all[d] = all[d].filter(t => {
          if (!t.autoGen || !t.link) return true;
          const [mod] = t.link.split(':');
          if (mod === 'growth') {
            if (t.link === 'growth:reading' || t.link === 'growth:阅读') return !!(t.srcId && readIds.has(t.srcId)); // 含迁移前缺 srcId 的孤儿
            return true;
          }
          if (mod === 'sport')   return !!(t.srcId && sportIds.has(t.srcId));
          if (mod === 'kaogong') return !!(t.srcId && kgIds.has(t.srcId));
          if (mod === 'work')    return !!(t.srcId && workIds.has(t.srcId));
          if (mod === 'travel')  return !!(t.srcId && outIds.has(t.srcId));
          return true;
        });
        n += before - all[d].length;
      });
      if (n) S.set('plans', all);
      return n;
    } catch (e) { console.warn('reconcileAllOrphans failed', e); return 0; }
  },
  // 注：prunePastFixed 已移除——保留过去日期的固定任务，以维持月时间轴与连续打卡的完整性（v124）。
  _nowHM() { const n = new Date(); return String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0'); },
  // 当日时间轴的一行式基本信息摘要（各版块数据互通）
  _briefInfo(t, d) {
    const f = Object.assign({}, this._colFields(t, d), t && t.colExtra ? t.colExtra : {});
    if (t) {
      if (t.sportMin != null) f['运动时长'] = t.sportMin + '分钟';
      if (t.sportFeel) f['程度'] = t.sportFeel;
      if (t.actMin != null) f['时长'] = t.actMin + '分钟';
      if (t.actWhere) f['学到哪里'] = t.actWhere;
    }
    const order = ['分类', '进度', '评分', '科目', '学到哪里', '项目', '运动时长', '程度', '类型', '平台', '时长', '收获', '地点', '同行', '花费'];
    const parts = [];
    order.forEach(k => { if (f[k] && String(f[k]).trim() && k !== '书名' && k !== '内容' && k !== '选题') parts.push(String(f[k]).trim()); });
    if (!parts.length) return '';
    return ' · ' + parts.slice(0, 3).join(' · ');
  },
  // 回查专栏原始打卡记录，为每日计划时间轴补齐「基本信息」（各版块数据互通）
  _colFields(t, d) {
    const out = {};
    if (!t || !t.link) return out;
    const [mod, sub] = t.link.split(':');
    try {
      if (mod === 'sport') {
        const logs = S.get('sportLogs', {})[d] || [];
        const l = logs.find(x => x.srcId === t.id) || logs.find(x => (x.project || '') === sub) || logs.find(x => (x.project || '') === t.title);
        if (l) {
          if (l.project) out['项目'] = l.project;
          if (l.minutes != null) out['运动时长'] = l.minutes + '分钟';
          if (l.feel) out['程度'] = l.feel;
          if (l.note) out['备注'] = l.note;
        }
      } else if (mod === 'kaogong') {
        const logs = S.get('kgLogs', {})[d] || [];
        const l = logs.find(x => x.srcId === t.id) || logs[0];
        if (l) {
          if (l.subject) out['科目'] = l.subject;
          if (l.content) out['内容'] = l.content;
          if (l.progress) out['学到哪里'] = l.progress;
          if (l.minutes != null) out['时长'] = l.minutes + '分钟';
        }
      } else if (mod === 'work') {
        const logs = S.get('workLogs', {})[d] || [];
        const la = this.appArr(t.linkApp);
        const l = logs.find(x => x.srcId === t.id)
          || logs.find(x => (x.topic || '') === t.title)
          || logs.find(x => la.length && la.some(p => (x.app || []).includes(p)));
        if (l) {
          out['类型'] = l.type === 'video' ? '视频' : '图文';
          if ((l.app || []).length) out['平台'] = l.app.join('、');
          if (l.topic) out['选题'] = l.topic;
          if (l.note) out['备注'] = l.note;
        }
      } else if (mod === 'growth') {
        const area = this.growthArea(t.link);
        if (area === '阅读') {
          const rl = S.get('readLogs', {})[d] || [];
          const l = rl.find(x => (x.book || '') === t.title) || rl[rl.length - 1];
          if (l) {
            if (l.book) out['书名'] = l.book;
            const G = window.Growth;
            if (G && G.readCat) out['分类'] = G.readCat(l).name;
            out['进度'] = l.finished ? '已读完' : (l.pages || '在读');
            if (l.rating) out['评分'] = l.rating + ' 星';
            if ((l.tags || []).length) out['标签'] = l.tags.join('、');
          }
        } else {
          const logs = S.get('growthLogs', {})[d] || [];
          const l = logs.find(x => x.srcId === t.id) || logs.find(x => (x.area || '') === area);
          if (l) {
            if (l.content) out['内容'] = l.content;
            if (l.minutes != null) out['时长'] = l.minutes + '分钟';
            if (l.takeaway) out['收获'] = l.takeaway;
          }
        }
      } else if (mod === 'travel') {
        const outs = S.get('travelOut', {})[d] || [];
        const l = outs.find(x => x.srcId === t.id) || outs.find(x => (x.place || '') === t.title) || outs[0];
        if (l) {
          if (l.place) out['地点'] = l.place;
          if (l.text) out['内容'] = l.text;
          if (l.thought) out['感想'] = l.thought;
          if (l.note) out['备注'] = l.note;
        }
        const photos = (S.get('travelPhotos', []) || []).filter(p => p.date === d && p.kind === 'out');
        if (photos.length) out['照片'] = photos.length + ' 张';
      }
    } catch (e) { /* 静默 */ }
    return out;
  },
  // 时间轴显示的真实完成时间：优先任务 doneAt，其次回查对应专栏打卡记录的时间
  taskTime(t, d) {
    if (t.doneAt) return new Date(t.doneAt).toTimeString().slice(0, 5);
    const ct = this._colTime(t, d);
    if (ct) return ct;
    return null;
  },
  // 专栏记录中可推导的时间（用于时间轴显示）：按 link 类型回查对应打卡记录的 time 字段
  _colTime(t, d) {
    if (!t || !t.link) return null;
    const [mod, sub] = t.link.split(':');
    if (mod === 'meals') {
      const slot = ({ b: 'breakfast', l: 'lunch', d: 'dinner' })[sub] || sub;
      const m = (S.get('meals', {})[d] || {})[slot];
      return m && m.time ? m.time : null;
    }
    if (mod === 'sport') {
      const logs = (S.get('sportLogs', {})[d]) || [];
      const l = logs.find(x => (x.project || '') === sub);
      return l && l.time ? l.time : null;
    }
    if (mod === 'kaogong') {
      const ts = (t.extra && (t.extra.subject || t.extra['科目']) || '').trim().replace(/^(行测|申论|面试)-/, '');
      const logs = (S.get('kgLogs', {})[d]) || [];
      if (!ts) return logs[0] && logs[0].time ? logs[0].time : null; // 旧任务无科目兜底
      const l = logs.find(x => (x.subject || '').trim().replace(/^(行测|申论|面试)-/, '') === ts);
      return l && l.time ? l.time : null;
    }
    if (mod === 'work') {
      const actId = t.link.split(':')[2];
      const logs = (S.get('workLogs', {})[d]) || [];
      const la = this.appArr(t.linkApp);
      const l = logs.find(x => x.actId === actId && (!la.length || la.some(p => (x.app || []).includes(p))));
      return l && l.time ? l.time : null;
    }
    if (mod === 'growth') {
      const area = this.growthArea(t.link);
      if (area === '阅读') {
        const rl = (S.get('readLogs', {})[d]) || [];
        const r = rl.find(x => (x.book || '') === t.title) || rl[rl.length - 1];
        if (r && r.time) return r.time;
      }
      const logs = (S.get('growthLogs', {})[d]) || [];
      const l = logs.find(x => x.area === area || x.area === sub);
      return l && l.time ? l.time : null;
    }
    return null;
  },
  // 时间轴排序用的时间戳：优先 doneAt，其次专栏记录的时间
  _effTime(t, d) {
    if (t.doneAt) return t.doneAt;
    const ct = this._colTime(t, d);
    if (ct) { const dt = new Date(d + 'T' + ct); if (!isNaN(dt.getTime())) return dt.getTime(); }
    return 0;
  },
  // 三餐「没吃」的任务不进时间轴
  _mealSkipped(t, d) {
    if (!t || !t.link || !t.link.startsWith('meals:')) return false;
    const sub = t.link.split(':')[1];
    const day = S.get('meals', {})[d];
    if (!day) return true;
    if (sub === 'all') return !['breakfast', 'lunch', 'dinner'].some(s => day[s] && !day[s].skipped);
    const slot = ({ b: 'breakfast', l: 'lunch', d: 'dinner' })[sub] || sub;
    return !day[slot] || day[slot].skipped;
  },

  // 3 段式子导航（月历 / 火花 / 频率）—— 纯新增（v221）
  renderSubTabs(box, active) {
    const tabs = [['monthCal', '月历'], ['streak', '火花'], ['freq', '频率']];
    const el = document.createElement('div');
    el.className = 'subtabs subnav';
    el.innerHTML = tabs.map(([s, n]) => `<button class="subtab ${active === s ? 'active' : ''}" data-s="${s}">${n}</button>`).join('');
    el.querySelectorAll('.subtab').forEach(b => b.onclick = () => { this._sub = b.dataset.s; this.render(this._root); });
    if (box) box.style.paddingBottom = '72px';
    return el;
  },

  render(root) {
    this._root = root;
    if (window.__modalOpen) return; // 编辑弹窗打开期间不重渲染底层页面，避免半透明遮罩后的内容闪烁
    // 子页面路由：月日历 / 续火花 / 频率（v221 新增后两者，纯增加）
    if (this._sub && (this._sub === 'monthCal' || this._sub === 'streak' || this._sub === 'freq' || this._sub === 'goalYear' || this._sub === 'goalMonth' || this._sub === 'goalWeek')) {
      root.innerHTML = `<div id="dSubPage"></div>`;
      const box = root.querySelector('#dSubPage');
      if (this._sub === 'streak') { Streak.render(box); return; }
      if (this._sub === 'freq') { Freq.render(box); return; }
      if (this._sub === 'monthCal') { this.renderMonthCalPage(box); return; }
      if (this._sub === 'goalYear') { this.renderGoalYearPage(box); return; }
      if (this._sub === 'goalMonth') { this.renderGoalMonthPage(box); return; }
      if (this._sub === 'goalWeek') { this.renderGoalWeekPage(box); return; }
    }
    const d = this.cur;
    const isToday = d === todayStr();
    const isHol = isAnnualHoliday(d) || isSickLeave(d);
    this.ensureDaily(d);
    let tasks = this.list(d);
    // 三餐类显示去重：当天有手工三餐任务（meals:任意/具体餐）时，隐藏自动生成的重复三餐任务，避免「固定早餐 + 打卡早餐」显示两条
    const hasManualMeals = tasks.some(t => !t.autoGen && !t.abandoned && t.link && t.link.startsWith('meals:'));
    if (hasManualMeals) tasks = tasks.filter(t => !(t.autoGen && t.link && t.link.startsWith('meals:') && !t.abandoned));
    const active = tasks.filter(t => !this.effDone(t, d) && !t.moved && !t.abandoned && !t.restDay && !isAnnualHoliday(d) && !isSickLeave(d));
    const term = tasks.filter(t => this.effDone(t, d) || t.moved || t.abandoned || t.restDay).sort((a, b) => (b.doneAt || b.createdAt || 0) - (a.doneAt || a.createdAt || 0));
    const doneN = tasks.filter(t => !t.abandoned && this.effDone(t, d)).length;
    const totalN = tasks.filter(t => !t.moved).length; // 含放弃/请假：均计为"未完成"，不再从分母剔除（修复 100% 虚高）
    const pendN = totalN - doneN;
    const pct = totalN ? Math.round(doneN / totalN * 100) : 0;
    // 连续打卡天数：累积制——只要当天或往前连续每天都有「任意完成/打卡」记录就一直增长，不受周月年影响
    let streak = 0;
    const todayDone = this._dayChecked(d);
    if (todayDone) streak = 1;
    for (let i = 0; i < 365; i++) {
      const dd = addDays(d, -(i + 1));
      if (isAnnualHoliday(dd) || isSickLeave(dd)) continue; // 年度假期/病假：不中断、不计入连续天数
      if (!this._dayChecked(dd)) break;
      streak++;
    }
    // 昨日及更早未处理任务
    const overdue = [];
    const all = this.all();
    Object.keys(all).filter(k => k < todayStr()).forEach(k => {
      all[k].forEach(t => { if (!this.effDone(t, k) && !t.abandoned && !t.moved && !t.restDay && !isAnnualHoliday(k) && !isSickLeave(k)) overdue.push({ date: k, t }); });
    });

    // 精力能量槽（格子进度条：空格=还没做，完成时填上档位色；充电从右边还回精力）
    const li = this.dayLoadInfo(d);
    // 枝枝随"净消耗"动态：枝枝喵 4 态——cat 主题用 PNG 状态图，zhiya 主题用 emoji 🌱🌳🍂🪵
    const MOOD_NAME = { st0: 'great', st1: 'ok', st2: 'tired', st3: 'over' };
    const isZhiya = !!(window.MUMU_THEME_IS_ZHIYA && window.MUMU_THEME_IS_ZHIYA());
    const moodFig = (c, alt) => isZhiya
      ? '<span class="lm-emoji" title="' + alt + '" aria-label="' + alt + '">' + (window.MOOD_EMOJI && window.MOOD_EMOJI[c] || '🌱') + '</span>'
      : '<img src="' + KITTY_RES('mood-' + MOOD_NAME[c] + '.png') + '" alt="' + alt + '" class="lm-img" decoding="async"/>';
    const _mood = li.doneRatio < 0.25 ? { f: moodFig('st0', '精神挺好'), t: '精神挺好', c: 'st0', cap: this.pickMoodCap('st0'), remind: false }
                : li.doneRatio < 0.5 ? { f: moodFig('st1', '还行'),     t: '还行',     c: 'st1', cap: this.pickMoodCap('st1'), remind: false }
                : li.doneRatio < 0.7 ? { f: moodFig('st2', '有点累'),   t: '有点累',   c: 'st2', cap: this.pickMoodCap('st2'), remind: true }
                :                       { f: moodFig('st3', '超载'),     t: '超载',     c: 'st3', cap: this.pickMoodCap('st3'), remind: true };
    const cap = li.cap, done = li.doneLoad, planned = li.plannedLoad;
    const overExtra = Math.max(0, planned - cap);
    const loadHTML = `
      <div class="load-bar-card" id="loadCard">
        <div class="lb-top">
          <div class="load-mascot ${_mood.c}">${_mood.f}</div>
          <div class="lb-info">
            <div class="lb-mood">${_mood.t}</div>
            <div class="lb-cap">${_mood.cap}</div>
            <div class="lb-sub">今日已消耗 <b>${done}</b> · 共排 ${planned}${li.over ? '（超出 ' + overExtra + '）' : ''} · 上限 ${cap}${li.recharge ? ` · 已充电 ${li.recharge} 电` : ''}</div>
          </div>
          <button class="btn sm ghost ${_mood.remind ? 'lb-recharge-hint' : ''}" id="rechargeBtn">${icon('moon',16)} 充电${_mood.remind ? ' · 该充了' : ''}</button>
        </div>
        ${this.loadBarHTML(li)}
        <div class="lb-overlabel">超载区 ›</div>
        <div class="lb-explain">
          <div class="lb-legend">
            <span class="lg-pending"><i class="sw sw-p"></i> 空格：还没做</span>
            <span class="lg-done"><i class="sw sw-d"></i> 颜色越深＝越费精力</span>
          </div>
          <div class="lb-legend" style="margin-top:6px">
            <span class="lg-invest clickable" data-loadview="invest" title="点击查看主动投资明细">主动投资 ${li.investLoad}</span>
            <span class="lg-consume clickable" data-loadview="consume" title="点击查看系统消耗明细">系统消耗 ${li.consumeLoad}</span>
          </div>
        </div>
        ${li.over ? `<div class="banner warn" style="margin-top:8px">${icon('bell',14)} 今天排超了上限（${planned}/${cap}）。先别硬加，把一些事挪到明天，累了就充个电 💤</div>`
          : li.full ? `<div class="banner warn" style="margin-top:8px">${icon('bell',14)} 今天已经排满了（${planned}/${cap}）——进度条快满了：做不了那么多，先做完这些或挪到明天 💤</div>` : ''}
        ${!S.get('loadProfile') ? `<div class="banner info" style="margin-top:8px">${icon('sprout',14)} 还没做过精力评估？<button class="btn sm" id="assessNow" style="margin-left:8px">花 10 秒评估一下 →</button></div>` : ''}
      </div>`;

    root.innerHTML = `
      <div class="branch-title" style="display:flex;align-items:center;gap:8px">每日计划<button class="btn sm ghost" id="dCal" style="padding:5px 9px;font-size:12.5px;font-weight:500">${icon('calendar',16)}</button></div>
      ${isHol ? '<div class="banner info" style="margin-bottom:10px">' + icon('sun', 14) + (isSickLeave(d) ? ' 今天是病假，已自动设为休息日，所有板块连续天数与续火花不受影响，好好休息 🌿' : ' 今天是' + annualHolidayLabel(d) + '，已自动设为休息日，所有板块续火花不受影响，不用完成任何任务 🎂') + '</div>' : ''}
      <!-- 合并统计卡片 -->
      <div class="stat-combined">
        <div class="sc-half">
          <div class="sc-val">${streak}<small>天</small></div>
          <div class="sc-lab">${icon('fire',14)} 连续打卡</div>
        </div>
        <div class="sc-half">
          <div class="sc-val">${pct}<small>%</small></div>
          <div class="sc-lab">${icon('check',14)} ${doneN}/${totalN} 项</div>
        </div>
      </div>
      ${loadHTML}
      ${overdue.length ? `<div class="banner warn" style="margin-bottom:10px;padding:8px 12px;border-radius:10px">${icon('clock',14)} 有 <b>${overdue.length}</b> 个之前的任务没完成：${overdue.slice(0,3).map(o => esc(o.t.title)).join('、')}${overdue.length > 3 ? '…' : ''}
        <button class="btn sm" id="dealOverdue" style="margin-left:auto">去处理</button></div>` : ''}
      <!-- 今日待办大卡片 -->
      <div class="todo-card">
        <div class="todo-card-header">
          <h3>${icon('clipboard',16)} 今日待办</h3>
          <span style="display:flex;gap:6px">
            <button class="btn sm" id="dAdd" style="border-radius:20px;padding:4px 14px;font-size:16px;line-height:1">＋</button>
            <button class="btn sm ghost" id="dReorder" title="拖动排序（长按任务也能进入）">☰</button>
          </span>
        </div>
        <div class="todo-card-body"><div id="taskList"></div></div>
      </div>
      ${this.dayTimelineHTML(d)}
      ${this.todayGoalsHTML(d)}${this.goalQuickHTML(d)}`;

    root.querySelector('#dAdd').onclick = () => this.addDialog(root);
    const rcBtn = root.querySelector('#rechargeBtn');
    if (rcBtn) rcBtn.onclick = () => this.rechargeDialog(root);
    const anBtn = root.querySelector('#assessNow');
    if (anBtn) anBtn.onclick = () => this.assessLoadProfile();
    const rb = root.querySelector('#dReorder');
    if (rb) rb.onclick = () => { this._reorder = !this._reorder; this.render(this._root); };
    const calBtn = root.querySelector('#dCal');
    if (calBtn) calBtn.onclick = () => { this._sub = 'monthCal'; this.render(this._root); };
    const gad = root.querySelector('#goalAddDay');
    if (gad) gad.onclick = () => this.openGoalAdd(null, { scope: 'day', period: d });
    const gcal = root.querySelector('#goalCal');
    if (gcal) gcal.onclick = () => { this._sub = 'goalYear'; this.render(this._root); };
    root.querySelectorAll('[data-goaladd]').forEach(b => b.onclick = () => {
      const g = S.get('mumu_goals', []).find(x => x.id === b.dataset.goaladd);
      if (g) this.addDialog(this._root, { title: g.title, link: g.link, goalId: g.id });
    });
    root.querySelectorAll('#todayGoalsCard [data-gtoggle]').forEach(b => b.onclick = e => { e.stopPropagation(); this.toggleGoal(b.dataset.gtoggle); this.goalRerender(); });
    const ob = root.querySelector('#dealOverdue');
    if (ob) ob.onclick = () => this.overdueDialog(root, overdue);
    // 进度条解释折叠：点击进度条展开/收起说明（默认隐藏，更美观）
    const lbBar = root.querySelector('#loadCard .load-bar');
    if (lbBar) lbBar.onclick = () => root.querySelector('#loadCard').classList.toggle('show-explain');
    root.querySelectorAll('[data-loadview]').forEach(b => b.onclick = () => this.loadViewModal(b.dataset.loadview));

    this.renderList(root.querySelector('#taskList'), active, term);
  },

  // 点击精力卡「主动投资 / 系统消耗」查看当日明细（#680）
  loadViewModal(type) {
    const d = this.cur;
    const tasks = (this.list(d) || []).filter(t => !t.abandoned && !t.moved && !t.restDay && !this.isMealTask(t) && !this.isLoadFree(t) && this.taskType(t) === type);
    const tot = tasks.reduce((s, t) => s + this.taskLoad(t), 0);
    const rows = tasks.map(t => '<div class="rech-row"><span class="rech-name">' + esc(t.title) + '</span><span class="rech-date">精力 ' + this.taskLoad(t) + '</span></div>').join('');
    openModal('<button class="close-x" onclick="closeModal()">×</button><h3>' + icon('fire', 18) + ' ' + (type === 'invest' ? '主动投资' : '系统消耗') + ' · 今日明细</h3>'
      + '<div class="muted" style="margin-bottom:8px">今天这类共 <b>' + tot + '</b> 点精力' + (tasks.length ? '，' + tasks.length + ' 件事' : '') + '</div>'
      + '<div class="rech-list">' + (rows || '<div class="empty">今天还没有这类任务</div>') + '</div>');
  },
  dayTimelineHTML(d) {
    const list = this.list(d);
    const items = list.filter(t => !t.abandoned && !t.moved && this.effDone(t, d) && !(t.link && t.link.startsWith('meals:')))
      .map(t => ({ t, time: this.taskTime(t, d), ts: this._effTime(t, d) }))
      .filter(x => x.time)
      .sort((a, b) => a.ts - b.ts);
    const rows = items.map(x => {
      const t = x.t;
      const cat = this.catFine(t) || t.cat || '';
      const brief = this.catName(cat);
      return '<div class="tl-item">'
        + '<span class="tl-dot"></span>'
        + '<span class="tl-time">' + x.time + '</span>'
        + '<span class="tl-text">' + esc(t.title) + '</span>'
        + (brief ? '<span class="tl-brief">' + esc(brief) + '</span>' : '')
        + '</div>';
    }).join('');
    return '<div class="tl-card">'
      + '<div class="tl-card-header"><h3>' + icon('clock', 16) + ' 今日时间轴</h3><span class="muted">' + items.length + ' 项完成</span></div>'
      + '<div class="timeline">' + (rows || '<div class="empty" style="padding:14px 4px">今天还没有完成的任务，勾掉一项就会按时间排在这里 🕒</div>') + '</div>'
      + '</div>';
  },

  renderList(box, active, term) {
    const d = this.cur;
    if (!active.length && !term.length) {
      box.innerHTML = `<div class="empty card" style="text-align:center;padding:22px">今天还没有待办，点「＋ 新任务」加一个，圆点可以完成任务或移到明天。</div>`;
      return;
    }
    let html = active.map(t => this.taskBlock(t, this._reorder)).join('');
    if (this._reorder) html = `<div class="banner" style="justify-content:center;margin-bottom:10px">☰ 排序模式：按住右侧三条横线上下拖动排序，点任意任务退出</div>` + html;
    if (term.length) {
      const collapsed = !!this._doneCollapsed;
      html += `<div class="task-sep" id="doneToggle" style="cursor:pointer;user-select:none;display:flex;align-items:center;justify-content:center;gap:4px">已完成 / 已划掉（${term.length}）<span class="done-chev" style="font-size:11px;color:var(--sub)">${collapsed ? '▸' : '▾'}</span></div>`;
      if (!collapsed) {
        html += term.map(t => this.taskBlock(t)).join('');
      }
    }
    box.innerHTML = html;
    const doneToggle = box.querySelector('#doneToggle');
    if (doneToggle) doneToggle.onclick = () => {
      this._doneCollapsed = !this._doneCollapsed;
      this.render(this._root);
    };
    box.querySelectorAll('.task-item').forEach(el => {
      const id = el.dataset.task;
      el.onclick = () => {
        if (this._reorder) {
          if (this._suppressClick) { this._suppressClick = false; return; }
          this._reorder = false; this.render(this._root); return;
        }
        this._openTasks[id] = !this._openTasks[id];
        this.render(this._root);
      };
      // 长按进入排序模式
      let lpTimer = null;
      const startLP = (e) => { if (e.target.closest && e.target.closest('.drag-handle')) return; lpTimer = setTimeout(() => { this._reorder = true; this.render(this._root); toast('排序模式：按住右侧横线拖动调整顺序'); }, 500); };
      const cancelLP = () => { if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; } };
      el.addEventListener('touchstart', startLP, { passive: true });
      el.addEventListener('touchend', cancelLP);
      el.addEventListener('touchmove', cancelLP);
      el.addEventListener('mousedown', startLP);
      el.addEventListener('mouseup', cancelLP);
      el.addEventListener('mouseleave', cancelLP);
    });
    box.querySelectorAll('.drag-handle').forEach(h => {
      h.addEventListener('pointerdown', e => this.startDrag(e, h.closest('.task-item'), box));
    });
    box.querySelectorAll('[data-dot]').forEach(b => b.onclick = e => {
      e.stopPropagation();
      if (this._reorder || b.disabled) return;
      const t = this.list(d).find(x => x.id === b.closest('.task-item').dataset.task);
      if (t) this.openDotMenu(box, t);
    });
    box.querySelectorAll('[data-step]').forEach(cb => {
      cb.onchange = e => {
        e.stopPropagation();
        if (this._reorder) return;
        // 复选框在 .t-steps 内，与 .task-item 是兄弟节点，必须用 .t-steps 取任务 id
        const wrap = cb.closest('.t-steps');
        if (!wrap) return;
        const id = wrap.dataset.task;
        const done = this.toggleStep(this.cur, id, cb.dataset.step, cb.checked);
        this.render(this._root);
        if (done) toast('所有步骤划完，任务完成！');
      };
    });
    box.querySelectorAll('[data-delstep]').forEach(b => b.onclick = e => {
      e.stopPropagation();
      if (this._reorder) return;
      // 删除按钮同在 .t-steps 内，与 .task-item 是兄弟节点
      const wrap = b.closest('.t-steps');
      if (!wrap) return;
      const id = wrap.dataset.task;
      const arr = this.list(this.cur); const t = arr.find(x => x.id === id);
      t.steps = t.steps.filter(x => x.id !== b.dataset.delstep); this.setList(this.cur, arr);
      this.render(this._root);
    });
    box.querySelectorAll('[data-edit]').forEach(b => b.onclick = e => { e.stopPropagation(); if (this._reorder) return; this.detail(this._root, b.dataset.edit); });
  },

  taskBlock(t, reorder) {
    const holiday = isAnnualHoliday(this.cur) || isSickLeave(this.cur);
    const linked = this.linkSatisfied(t, this.cur);
    const done = this.effDone(t, this.cur);
    const byLink = (linked && !this.isDone(t)) || t.autoGen;
    const total = t.steps.length, dn = t.steps.filter(s => s.done).length;
    const open = !!this._openTasks[t.id];
    const cls = [done ? 'done' : '', t.abandoned ? 'abandoned' : '', t.moved ? 'moved' : '', (t.restDay || holiday) ? 'rest' : '', open ? 'open' : ''].filter(Boolean).join(' ');
    let dotCls = 't-dot', dotIc = '●';
    if (t.abandoned) { dotCls += ' abandoned'; dotIc = '×'; }
    else if (t.moved) { dotCls += ' moved'; dotIc = '›'; }
    else if (t.restDay || holiday) { dotCls += ' rest'; dotIc = '休'; }
    else if (done) { dotCls += ' done'; dotIc = '✓'; }
    const active = !done && !t.moved && !t.abandoned;
    const stepsHTML = t.steps.map(s => `<div class="step-row ${s.done ? 'done' : ''}" data-lp>
      <input type="checkbox" ${s.done ? 'checked' : ''} data-step="${s.id}">
      <span class="stext">${esc(s.text)}</span>
      <button class="del" data-delstep="${s.id}">✕</button>
    </div>`).join('');
    const catTag = this.catEmoji(t.cat || this.catFromLink(t.link || ''));
    const goalTag = (t.goalId && !t.abandoned) ? (() => { const g = S.get('mumu_goals', []).find(x => x.id === t.goalId); return g ? `<span class="task-goal-tag" title="关联目标：${esc(g.title)}">🎯 ${esc(g.title)}</span>` : ''; })() : '';
    return `<div class="task-item ${cls}" data-task="${t.id}">
        <button class="${dotCls}" data-dot ${active ? '' : 'disabled'} title="${active ? '点击：完成 / 移到明天 / 无法完成' : ''}">${dotIc}</button>
        <span class="tt">${catTag ? `<span class="task-cat-tag">${catTag}</span>` : ''}${esc(t.title)}${goalTag}${t.cat === 'kaogong' && t.studyType ? `<span class="task-study-tag">${esc(t.studyType)}</span>` : ''}</span>
        ${reorder && !this.isMealTask(t) && !this.isLoadFree(t) ? `<span class="task-load ${this.taskType(t)}" title="${this.taskType(t) === 'invest' ? '主动投资' : '系统消耗'}">${this.taskType(t) === 'invest' ? '投' : '耗'}${this.taskLoad(t)}</span>` : ''}
        ${(t.restDay || holiday) ? '<span class="rest-badge">休息</span>' : ''}
        ${reorder && !done ? `<span class="drag-handle" data-drag="${t.id}" title="按住拖动排序"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="5" y1="7" x2="19" y2="7"/><line x1="5" y1="12" x2="19" y2="12"/><line x1="5" y1="17" x2="19" y2="17"/></svg></span>` : ''}
        ${total ? `<span class="prog">${dn}/${total}</span>` : ''}
        ${t.cat === 'kaogong' && t.actMin != null ? `<span class="ltime">实际${t.actMin}分钟</span>` : ''}
        ${t.steps.length ? `<span class="t-caret">${open ? '▾' : '▸'}</span>` : ''}
      </div>
      <div class="t-steps" data-task="${t.id}" ${open ? '' : 'style="display:none"'}>
        ${t._tmpl ? `<div class="muted" style="padding:2px 0 6px">${icon('refresh',12)} 固定每日任务</div>` : ''}
        ${stepsHTML || '<div class="muted" style="padding:4px 0">还没拆步骤，点「编辑任务」加</div>'}
        <div class="t-foot"><button class="link sm" data-edit="${t.id}">✎ 编辑任务</button></div>
      </div>`;
  },

  openDotMenu(box, t) {
    document.querySelectorAll('.dot-menu').forEach(m => m.remove());
    const item = box.querySelector('.task-item[data-task="' + t.id + '"]');
    if (!item) return;
    const dot = item.querySelector('[data-dot]');
    const r = dot.getBoundingClientRect();
    const menu = document.createElement('div');
    menu.className = 'dot-menu';
    let menuHTML = '<button data-act="done">完成任务</button><button data-act="move">移到明天</button><button data-act="give">✕ 无法完成</button>';
    menuHTML += '<button data-act="rest">' + (t.restDay ? '取消今日休息' : '今日休息') + '</button>';
    menu.innerHTML = menuHTML;
    menu.style.position = 'fixed';
    document.body.appendChild(menu);
    const mh = menu.offsetHeight, mw = menu.offsetWidth;
    let top = r.top - mh - 6; if (top < 8) top = r.bottom + 6;
    let left = Math.min(r.left, window.innerWidth - mw - 8);
    menu.style.top = top + 'px'; menu.style.left = left + 'px';
    const close = () => { menu.remove(); document.removeEventListener('click', onDoc, true); };
    const onDoc = e => { if (!menu.contains(e.target)) close(); };
    setTimeout(() => document.addEventListener('click', onDoc, true), 0);
    menu.querySelector('[data-act=done]').onclick = e => { e.stopPropagation(); close(); this.completeTask(this.cur, t.id); };
    menu.querySelector('[data-act=move]').onclick = e => { e.stopPropagation(); close(); this.moveTmr(this.cur, t.id); };
    menu.querySelector('[data-act=give]').onclick = e => { e.stopPropagation(); close(); this.promptAbandon(this.cur, t.id); };
    const restBtn = menu.querySelector('[data-act=rest]');
    if (restBtn) restBtn.onclick = e => { e.stopPropagation(); close(); this.restDay(this.cur, t.id, !!t.restDay); };
  },

  // 学习任务（cat=kaogong）完成任务/移到明天前，必须先填实际学习时长；其余任务直接继续
  // 刷题错题题型（v282 修订）：题型按「科目」细分（言语→中心理解/逻辑填空…，判断→图形推理…），
  // 不再拿科目当题型；按错题数 N 动态渲染 N 个下拉；换科目清空已选（不同科目题型不同）。
  _kgSubjects() { return (window.KG && window.KG.SUBJECTS) || ['言语', '判断', '数量', '常识', '申论', '综合应用能力', '时政', '面试', '策略']; },
  _kgQTypes(subj) { return (window.KG && window.KG.subjQTypes) ? window.KG.subjQTypes(subj) : []; },
  _taskSubject(t) { return (t && (t.kgSubject || (t.extra && t.extra.subject))) || ''; },
  _qtWrongOpts(sel, subj) { return '<option value="">错题题型</option>' + this._kgQTypes(subj).map(tp => `<option ${tp === sel ? 'selected' : ''}>${tp}</option>`).join(''); },
  _renderWrongTypes(wrap, count, prev, subj) {
    count = Math.max(0, count | 0);
    let h = '';
    for (let i = 0; i < count; i++) { const sel = (prev && prev[i] && prev[i].type) || ''; h += `<div class="form-row qt-wrong-row"><label>错的第${i + 1}题 题型</label><select class="qtType">${this._qtWrongOpts(sel, subj)}</select></div>`; }
    wrap.innerHTML = h;
  },
  _readWrongTypes(wrap, subj) { if (!wrap) return []; const arr = []; wrap.querySelectorAll('.qtType').forEach(s => { if (s.value) arr.push({ type: s.value, subj: subj || '' }); }); return arr; },

  requireActMin(t, date, onConfirm) {
    if (t.cat !== 'kaogong' || t.actMin != null) { onConfirm(); return; }
    const def = t.estMin || '';
    const wdef = t.actWhere || '';
    const isQuiz = t.studyType === '刷题';
    const qdef = (t.qTotal != null ? t.qTotal : '');
    const cdef = (t.qCorrect != null ? t.qCorrect : '');
    // 科目（决定错题题型选项）：优先任务自带，未记过则默认言语
    const subjRaw = this._taskSubject(t);
    const _sl = this._kgSubjects();
    const subjDef = subjRaw || '言语';
    const subjOpts = ((subjRaw && _sl.indexOf(subjRaw) < 0) ? [subjRaw] : []).concat(_sl)
      .map(s => `<option ${s === subjDef ? 'selected' : ''}>${esc(s)}</option>`).join('');
    openModal(`<button class="close-x" onclick="closeModal()">×</button><h3>${icon('book',18)} 记录实际学习时长</h3>
      <div class="muted" style="margin-bottom:10px">「${esc(t.title)}」今天实际学了多少分钟？</div>
      <div class="form-row"><label>实际学习时长</label><input id="actMinInput" type="number" value="${def}" placeholder="如实填，比如 75" autofocus></div>
      ${isQuiz ? '' : `<div class="form-row"><label>学到哪里</label><input id="actWhereInput" value="${esc(wdef)}" placeholder="如：资料分析第3章 / 言语错题本"></div>`}
      ${isQuiz ? `<div class="form-row"><label>科目</label><select id="actQuizSubj">${subjOpts}</select></div>
      <div class="form-row"><label>刷了几道题</label><input id="actQuizTotal" type="number" value="${qdef}" placeholder="如实填，比如 30"></div>
      <div class="form-row"><label>对了几道</label><input id="actQuizCorrect" type="number" value="${cdef}" placeholder="如：24"></div>
      <div id="wrongTypesWrap"></div>` : ''}
      <button class="btn" id="actMinOk" style="width:100%">保存并继续</button>`);
    const inp = document.getElementById('actMinInput');
    const winp = isQuiz ? null : document.getElementById('actWhereInput');
    const qinp = isQuiz ? document.getElementById('actQuizTotal') : null;
    const cinp = isQuiz ? document.getElementById('actQuizCorrect') : null;
    const sinp = isQuiz ? document.getElementById('actQuizSubj') : null;
    const wwrap = isQuiz ? document.getElementById('wrongTypesWrap') : null;
    const curSub = () => (sinp ? sinp.value : subjDef);
    const ok = () => {
      const v = Number(inp.value);
      if (inp.value === '' || isNaN(Number(inp.value)) || Number(inp.value) < 0) return toast('填一下实际学了多久吧～（没学就填 0）');
      const w = winp ? winp.value.trim() : '';
      t.actMin = v; t.actWhere = w;
      if (isQuiz) {
        const qt = Number(qinp.value) || 0, qc = Number(cinp.value) || 0;
        if (qc > qt) return toast('对的题数不能超过刷的总题数哦～');
        t.qTotal = qt; t.qCorrect = qc;
        t.kgSubject = curSub();
        t.qWrongTypes = this._readWrongTypes(wwrap, t.kgSubject);
      }
      const arr = this.list(date); const tt = arr.find(x => x.id === t.id);
      if (tt) { tt.actMin = v; tt.actWhere = w; if (isQuiz) { tt.qTotal = t.qTotal; tt.qCorrect = t.qCorrect; tt.kgSubject = t.kgSubject; tt.qWrongTypes = t.qWrongTypes; } } this.setList(date, arr);
      closeModal(); onConfirm();
    };
    if (isQuiz) {
      const renderW = (reset) => { const n = Math.max(0, (Number(qinp.value) || 0) - (Number(cinp.value) || 0)); this._renderWrongTypes(wwrap, n, reset ? [] : this._readWrongTypes(wwrap, curSub()), curSub()); };
      renderW(false);
      qinp.oninput = () => renderW(false);
      cinp.oninput = () => renderW(false);
      if (sinp) sinp.onchange = () => renderW(true); // 换科目清空已选题型
    }
    document.getElementById('actMinOk').onclick = ok;
    inp.onkeydown = e => { if (e.key === 'Enter') ok(); };
    if (winp) winp.onkeydown = e => { if (e.key === 'Enter') ok(); };
  },

  // 运动任务（cat=sport）完成任务/移到明天前，必须先填运动时长与程度；其余任务直接继续
  requireSportInfo(t, date, onConfirm) {
    if (t.cat !== 'sport' || t.sportMin != null) { onConfirm(); return; }
    const def = t.sportMin || '';
    openModal(`<button class="close-x" onclick="closeModal()">×</button><h3>${icon('fire',18)} 记录运动情况</h3>
      <div class="muted" style="margin-bottom:10px">「${esc(t.title)}」今天练了多久、感觉如何？</div>
      <div class="form-row"><label>运动时长（分钟）</label><input id="sportMinInput" type="number" value="${def}" placeholder="如实填，比如 40" autofocus></div>
      <div class="form-row"><label>运动程度</label><select id="sportFeelInput">
        <option value="轻松">轻松</option><option value="适中" selected>适中</option><option value="吃力">吃力</option><option value="很累">很累</option><option value="力竭">力竭</option>
      </select></div>
      <button class="btn" id="sportOk" style="width:100%">保存并继续</button>`);
    const minp = document.getElementById('sportMinInput');
    const feelp = document.getElementById('sportFeelInput');
    const ok = () => {
      const v = Number(minp.value);
      if (!v || v <= 0) return toast('填一下练了多久吧～');
      const f = feelp.value;
      t.sportMin = v; t.sportFeel = f;
      const arr = this.list(date); const tt = arr.find(x => x.id === t.id);
      if (tt) { tt.sportMin = v; tt.sportFeel = f; } this.setList(date, arr);
      closeModal(); onConfirm();
    };
    document.getElementById('sportOk').onclick = ok;
    minp.onkeydown = e => { if (e.key === 'Enter') ok(); };
  },

  // 英语（多邻国·技能）任务完成前：记录学习时长 + 多邻国涨分（没涨填 0）
  requireEngInfo(t, date, onConfirm) {
    if (t.engMin != null) { onConfirm(); return; }
    const def = (t.extra && t.extra.minutes) || t.estMin || '';
    openModal(`<button class="close-x" onclick="closeModal()">×</button><h3>${icon('globe',18)} 记录英语学习</h3>
      <div class="muted" style="margin-bottom:10px">「${esc(t.title)}」今天学了多久？多邻国分数涨了吗？</div>
      <div class="form-row"><label>学习时长（分钟）</label><input id="engMinInput" type="number" value="${def}" placeholder="如实填，比如 30" autofocus></div>
      <div class="form-row"><label>多邻国涨了多少分</label><input id="engDeltaInput" type="number" value="0" placeholder="没涨就填 0"></div>
      <button class="btn" id="engOk" style="width:100%">保存并继续</button>`);
    const minp = document.getElementById('engMinInput');
    const deltap = document.getElementById('engDeltaInput');
    const ok = () => {
      const m = Number(minp.value);
      if (minp.value === '' || isNaN(Number(minp.value)) || Number(minp.value) < 0) return toast('填一下今天学了多少分钟吧～（没学就填 0）');
      const d = Number(deltap.value) || 0;
      t.engMin = m; t.engDelta = d;
      const arr = this.list(date); const tt = arr.find(x => x.id === t.id);
      if (tt) { tt.engMin = m; tt.engDelta = d; } this.setList(date, arr);
      closeModal(); onConfirm();
    };
    document.getElementById('engOk').onclick = ok;
    minp.onkeydown = e => { if (e.key === 'Enter') ok(); };
    deltap.onkeydown = e => { if (e.key === 'Enter') ok(); };
  },
  // 统一分发：学习→实际时长+学到哪里；运动→时长+程度；英语→时长+涨分；其余→直接继续
  requireTaskInfo(t, date, onConfirm) {
    if (t.cat === 'kaogong') return this.requireActMin(t, date, onConfirm);
    if (t.cat === 'sport') return this.requireSportInfo(t, date, onConfirm);
    if (t.cat === 'growth' && this.growthArea(t.link) === '英语') return this.requireEngInfo(t, date, onConfirm);
    onConfirm();
  },

  completeTask(date, id) {
    const arr = this.list(date); const t = arr.find(x => x.id === id); if (!t) return;
    const finish = () => {
      if (t.steps.length) t.steps.forEach(s => { s.done = true; s.doneAt = Date.now(); });
      else t.manualDone = true;
      if (!t.doneAt) t.doneAt = Date.now();
      if (t.restDay) { t.restDay = false; this._clearRest(date); }
      this.setList(date, arr);
      if (t.link) {
        let extra = t.extra || null;
        if (t.cat === 'kaogong') extra = this._kgExtra(t);
        else if (t.cat === 'sport') extra = { minutes: t.sportMin || 10, feel: t.sportFeel || '适中' };
        else if (this.growthArea(t.link) === '英语') extra = { minutes: (t.engMin != null ? t.engMin : (extra && extra.minutes) || 20), delta: (t.engDelta != null ? t.engDelta : 0) };
        this.pushToColumn(date, t.link, t.title, t.linkApp, extra, t.srcId || t.id);
      }
      this.syncGoalsFromPlan(date);
      this.render(this._root); toast('搞定一项！');
    };
    this.requireTaskInfo(t, date, finish);
  },

  moveTmr(date, id) {
    const arr = this.list(date); const t = arr.find(x => x.id === id); if (!t) return;
    // 移动不记录学习/涨分，英语任务跳过填写弹窗
    if (t.cat === 'growth' && this.growthArea(t.link) === '英语') { this.promptMoveLoad(t, date); return; }
    this.requireTaskInfo(t, date, () => this.promptMoveLoad(t, date));
  },

  // 移到明天时：拆出「今日已消耗」与「明日继续消耗」，让用户填清楚
  promptMoveLoad(t, date) {
    const tl = this.taskLoad(t);
    const totalSteps = t.steps.length;
    const doneSteps = t.steps.filter(s => s.done).length;
    let defConsumed, defTomorrow;
    if (totalSteps > 0) {
      defConsumed = Math.round(tl * doneSteps / totalSteps);
      defTomorrow = tl - defConsumed;
    } else {
      const done = this.effDone(t, date);
      defConsumed = done ? tl : 0;
      defTomorrow = done ? 0 : tl;
    }
    openModal(`<button class="close-x" onclick="closeModal()">×</button><h3>${icon('arrow-right',18)} 移到明天 · 拆分消耗</h3>
      <div class="muted" style="margin-bottom:12px">「${esc(t.title)}」${totalSteps > 0 ? `今天完成了 <b>${doneSteps}/${totalSteps}</b> 步` : (defConsumed ? '今天已做完' : '今天还没做')}。把它挪到 ${fmtCN(addDays(date,1))} 时，消耗值要重新拆开——今天已经花掉多少、明天接着做还要花多少，写清楚：</div>
      <div class="form-row"><label>今日已消耗（精力值）</label><input id="mvConsumed" type="number" min="0" value="${defConsumed}" style="max-width:120px"></div>
      <div class="form-row"><label>明日继续消耗（精力值）</label><input id="mvTomorrow" type="number" min="0" value="${defTomorrow}" style="max-width:120px"></div>
      <div class="muted" style="font-size:12px;margin:-4px 0 12px">两项加起来≈原本的 ${tl}（可微调，比如今天多做了就调高「今日已消耗」）</div>
      <button class="btn" id="mvOk" style="width:100%">确认移到明天</button>`);
    document.getElementById('mvOk').onclick = () => {
      const consumed = Math.max(0, Number(document.getElementById('mvConsumed').value) || 0);
      const tomorrow = Math.max(0, Number(document.getElementById('mvTomorrow').value) || 0);
      closeModal();
      const arr = this.list(date); const tt = arr.find(x => x.id === t.id); if (!tt) return;
      tt.moved = true;
      tt.taskLoadConsumed = consumed;          // 今日已消耗，计入今天精力
      if (tt.restDay) { tt.restDay = false; this._clearRest(date); }
      // 今天实际学了 → 记到备考打卡（考公专栏）；明天那份清空，完成时再问
      if (tt.cat === 'kaogong' && tt.actMin != null && tt.actMin > 0) {
        const sid = tt.srcId || tt.id;
        this.pushToColumn(date, tt.link, tt.title, tt.linkApp, this._kgExtra(tt), sid);
      }
      const tmr = addDays(date, 1); const ta = this.list(tmr);
      // 明天那份是新的实例：消耗值=明日继续消耗，实际时长清空
      ta.push({ ...tt, id: uid(), moved: false, actMin: null, taskLoad: tomorrow, taskLoadConsumed: undefined, steps: tt.steps.map(s => ({ ...s })), createdAt: Date.now() });
      this.setList(tmr, ta); this.setList(date, arr);
      this.render(this._root); toast('已移到 ' + fmtCN(tmr) + '（今天这条划掉啦）');
    };
  },

  abandonTask(date, id, reason) {
    const arr = this.list(date); const t = arr.find(x => x.id === id); if (!t) return;
    t.abandoned = true; t.abandonReason = reason != null ? reason : (t.abandonReason || '');
    if (t.restDay) { t.restDay = false; this._clearRest(date); }
    this.setList(date, arr); this.render(this._root); toast('已标记无法完成，轻装上阵');
  },
  promptAbandon(date, id) {
    const arr = this.list(date); const t = arr.find(x => x.id === id); if (!t) return;
    const prev = t.abandonReason || '';
    openModal(`<button class="close-x" onclick="closeModal()">×</button><h3>✕ 无法完成「${esc(t.title)}」</h3>
      <div class="muted" style="margin-bottom:10px">写一下原因，复盘时你会用得到～</div>
      <div class="form-row"><label>为什么没完成？</label><textarea id="gvReason" rows="3" placeholder="例如：发现优先级不高 / 精力不够 / 计划定太大了…">${esc(prev)}</textarea></div>
      <button class="btn warn" id="gvOk" style="width:100%">确认无法完成</button>`);
    document.getElementById('gvOk').onclick = () => {
      const r = document.getElementById('gvReason').value.trim();
      if (!r) return toast('无法完成也要留下原因哦');
      this.abandonTask(date, id, r);
    };
  },

  // 今日休息：对所有任务可用。运动/备考任务会同步写入对应休息数组，不计入连续打卡中断
  // （一周最多 1 天，一月最多 4 天）。cancel=true 取消休息。
  restDay(date, id, cancel) {
    const arr = this.list(date); const t = arr.find(x => x.id === id); if (!t) return;
    const key = t.cat === 'sport' ? 'sport' : (t.cat === 'kaogong' ? 'kaogong' : (t.cat === 'work' ? 'work' : null));
    if (cancel) {
      t.restDay = false;
      if (key) restRemove(key, date);
      this.setList(date, arr); this.render(this._root);
      toast(key ? '已取消休息' : '已取消今日休息');
      return;
    }
    if (key) {
      const chk = restCanAdd(key, date);
      if (!chk.ok) { toast(chk.msg); return; }
    }
    t.restDay = true;
    if (key) restAdd(key, date);
    this.setList(date, arr); this.render(this._root);
    toast(key === 'kaogong' ? '已设为休息日 · 连续学习不受影响'
      : (key === 'sport' ? '已设为休息日 · 连续运动不受影响' : '已设为今日休息'));
  },

  // 任务改为完成 / 无法完成 / 挪到明天 时，若当天曾被标记休息则清除（这些都不是“休息”）
  _clearRest(date) {
    ['sportRest', 'kgRest', 'workRest'].forEach(k => {
      const rest = S.get(k, []) || [];
      if (rest.includes(date)) S.set(k, rest.filter(d => d !== date));
    });
  },

  // 长按进入排序模式后，按住右侧横线上下拖动重排任务
  startDrag(e, el, box) {
    if (!el) return;
    e.preventDefault(); e.stopPropagation();
    const date = this.cur;
    const id = el.dataset.task;
    let moved = false;
    el.classList.add('dragging');
    el.style.pointerEvents = 'none';
    el.style.zIndex = 50;
    const onMove = ev => {
      ev.preventDefault();
      const y = ev.clientY;
      const under = document.elementFromPoint(ev.clientX, y);
      const over = under && under.closest('.task-item');
      if (over && over !== el) {
        const r = over.getBoundingClientRect();
        const after = (y - r.top) > r.height / 2;
        box.insertBefore(el, after ? over.nextSibling : over);
        moved = true;
      }
    };
    const onUp = () => {
      document.removeEventListener('pointermove', onMove, { passive: false });
      document.removeEventListener('pointerup', onUp);
      el.classList.remove('dragging'); el.style.pointerEvents = ''; el.style.zIndex = '';
      this._suppressClick = moved;
      if (moved) {
        const lb = this._root.querySelector('#taskList') || box;
        const domIds = Array.from(lb.querySelectorAll('.task-item')).map(x => x.dataset.task);
        const arr = this.list(date);
        const activeIds = arr.filter(t => !t.abandoned && !this.effDone(t, date)).map(t => t.id);
        const domActive = domIds.filter(did => activeIds.includes(did));
        const pos = {}; domActive.forEach((did, i) => pos[did] = i);
        arr.sort((a, b) => {
          const ia = pos[a.id], ib = pos[b.id];
          if (ia !== undefined && ib !== undefined) return ia - ib;
          if (ia !== undefined) return -1;
          if (ib !== undefined) return 1;
          return 0;
        });
        this.setList(date, arr);
        this.propagateOrder(date, arr); // 重排后让明日及未来日子跟着前一天的顺序走
      }
      this.render(this._root);
    };
    document.addEventListener('pointermove', onMove, { passive: false });
    document.addEventListener('pointerup', onUp);
  },

  toggleStep(date, taskId, stepId, checked) {
    const arr = this.list(date); const t = arr.find(x => x.id === taskId); if (!t) return false;
    const s = t.steps.find(x => x.id === stepId); if (!s) return false;
    s.done = checked; if (checked) s.doneAt = Date.now(); else delete s.doneAt;
    if (this.isDone(t)) { if (!t.doneAt) t.doneAt = Date.now(); } else { delete t.doneAt; }
    this.setList(date, arr);
    if (this.isDone(t) && t.link) {
      const after = () => {
        let extra = t.extra || null;
        if (t.cat === 'kaogong') extra = this._kgExtra(t);
        else if (t.cat === 'sport') extra = { minutes: t.sportMin || 10, feel: t.sportFeel || '适中' };
        this.pushToColumn(date, t.link, t.title, t.linkApp, extra, t.srcId || t.id);
        this.render(this._root);
      };
      if (t.cat === 'kaogong' && t.actMin == null) this.requireActMin(t, date, after);
      else if (t.cat === 'sport' && t.sportMin == null) this.requireSportInfo(t, date, after);
      else after();
    }
    this.syncGoalsFromPlan(date);
    return this.isDone(t);
  },

  updateProgress(root) {
    if (!root) return;
    const d = this.cur, tasks = this.list(d);
    const doneN = tasks.filter(t => !t.abandoned && this.effDone(t, d)).length;
    const totalN = tasks.filter(t => !t.moved).length; // 与头部 pct 一致：含放弃/请假
    const fill = root.querySelector('#progFill'); if (fill) fill.style.width = (totalN ? Math.round(doneN / totalN * 100) : 0) + '%';
    const txt = root.querySelector('#progText'); if (txt) txt.textContent = '完成 ' + doneN + '/' + totalN;
  },

  catSelectHTML(sel) {
    const opts = this.taskCats().map(c => `<option value="${esc(c.id)}" ${sel === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
    return `<option value="">不分类</option>` + opts;
  },
  // 分类对应的默认关联专栏（用于添加任务时自动预选）
  catDefaultLink(cat) {
    if (cat === 'meals') return 'meals:all';
    if (cat === 'sport') { const sp = (window.MUMU_SPORT && window.MUMU_SPORT.projects) || []; return sp.length ? 'sport:' + sp[0].name : 'sport'; }
    if (cat === 'work') return 'work:today';
    if (cat === 'kaogong') return 'kaogong:study';
    if (cat === 'growth') { const ga = S.get('growthAreas', []); return ga.length ? 'growth:' + ga[0] : 'growth'; }
    return '';
  },
  /* ===== 创作任务的平台多选（v283）=====
     平台候选：优先取所有活动目标里出现过的平台；一个都没有才回退到 Work.PLATS */
  workPlatOpts() {
    const acts = (window.Work && window.Work.acts ? window.Work.acts() : []) || [];
    const set = [];
    acts.forEach(a => (a.targets || []).forEach(t => { if (t.app && set.indexOf(t.app) < 0) set.push(t.app); }));
    if (!set.length) {
      const plats = (window.Work && window.Work.PLATS) ? window.Work.PLATS : [];
      plats.forEach(p => { if (p && set.indexOf(p) < 0) set.push(p); });
    }
    return set;
  },
  /* 平台多选 chips（创作类任务的「发布平台」可多选），写法对齐 Work.logDialog */
  workAppsHTML(sel) {
    const cur = this.appArr(sel);
    const plats = this.workPlatOpts();
    if (!plats.length) return '';
    return `<div class="form-row"><label>发布平台（可多选，区分发在哪个平台）</label>
      <div id="npWApps" style="display:flex;gap:6px;flex-wrap:wrap">${plats.map(p => `<label class="chip" style="cursor:pointer"><input type="checkbox" value="${esc(p)}" class="np-w-app"${cur.indexOf(p) >= 0 ? ' checked' : ''} style="margin-right:4px;accent-color:#111"> ${esc(p)}</label>`).join('')}</div></div>`;
  },
  /* 绑定：勾选平台 / 换关联活动 → 重绘「该平台在活动里的达标要求」（只读提示） */
  bindWorkApps() {
    const reqBox = document.getElementById('npWReqs');
    if (!reqBox) return;
    const appsBox = document.getElementById('npWApps');
    const actEl = document.getElementById('npWAct');
    const linkEl = document.getElementById('npLink');
    const paint = () => {
      const sel = Array.prototype.slice.call(document.querySelectorAll('.np-w-app:checked')).map(c => c.value);
      // 关联活动优先取 #npWAct；没有该下拉时，从 link（work:act:ID）推
      let actId = actEl ? (actEl.value || '') : '';
      if (!actId && linkEl && /^work:act:/.test(linkEl.value || '')) actId = linkEl.value.split(':')[2] || '';
      const act = actId ? ((window.Work && window.Work.acts ? window.Work.acts() : []) || []).find(a => a.id === actId) : null;
      const ts = act ? ((window.Work && window.Work.targetsOf) ? window.Work.targetsOf(act) : (act.targets || [])) : [];
      const html = sel.map(app => {
        const t = ts.find(x => x.app === app);
        const reqTxt = t && t.req ? String(t.req).trim() : '';
        return reqTxt ? `<div class="muted" style="font-size:12px;margin:2px 0 8px">${esc(app)} 达标要求：${esc(reqTxt)}</div>` : '';
      }).filter(Boolean).join('');
      reqBox.innerHTML = html;
    };
    if (appsBox) appsBox.querySelectorAll('.np-w-app').forEach(c => { c.onchange = paint; });
    if (actEl) actEl.onchange = paint;
    paint();
  },
  // 按关联专栏显示对应的打卡信息字段（与专栏打卡一致，双方互通）
  catFieldsHTML(link) {
    if (!link) return '';
    const [mod, sub] = link.split(':');
    if (mod === 'work') {
      const acts = (window.Work && window.Work.acts ? window.Work.acts() : []) || [];
      if (sub === 'video') {
        const actOpts = '<option value="">不关联活动</option>' + acts.map(a => `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('');
        return `<div class="form-row"><label>产出类型</label><select id="npWType"><option value="video">视频</option><option value="article">图文</option></select></div>
        ${this.workAppsHTML('')}
        <div id="npWReqs"></div>
        <div class="form-row"><label>关联活动（可选）</label><select id="npWAct">${actOpts}</select></div>
        <div class="form-row"><label>时长（分钟）</label><input id="npWMin" type="number" value="60"></div>`;
      }
      if (sub === 'write') {
        return `<div class="form-row"><label>写了多少字</label><input id="npWWords" type="number" placeholder="如 1200"></div>`;
      }
      return `<div class="form-row"><label>产出类型</label><select id="npWType"><option value="video">视频</option><option value="article">图文</option></select></div>
        ${this.workAppsHTML('')}
        <div id="npWReqs"></div>`;
    }
    if (mod === 'sport') {
      const sp = (window.MUMU_SPORT && window.MUMU_SPORT.projects) || [];
      return `<div class="form-row"><label>项目</label><select id="npSProj">${sp.map(p => `<option value="${esc(p.name)}" ${link.slice(6) === p.name ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>
        <div class="form-row"><label>时长（分钟）</label><input id="npSMin" type="number" value="20"></div>
        <div class="form-row"><label>感受</label><select id="npSFeel"><option>轻松</option><option>一般</option><option>吃力</option></select></div>`;
    }
    if (mod === 'kaogong') {
      return `<div class="form-row"><label>科目</label><input id="npKSubj" value="言语"></div>
        <div class="muted" style="margin:-4px 0 12px">学习时长请在上方「预估时长」填写；完成任务时会被问实际学了多久</div>`;
    }
    if (mod === 'growth') {
      const ga = S.get('growthAreas', []);
      return `<div class="form-row"><label>领域</label><select id="npGArea">${ga.map(a => `<option value="${esc(a)}" ${link.slice(7) === a ? 'selected' : ''}>${esc(a)}</option>`).join('')}</select></div>
        <div class="form-row"><label>时长（分钟）</label><input id="npGMin" type="number" value="20"></div>`;
    }
    if (mod === 'meals') return '<div class="muted" style="margin:-4px 0 12px">三餐请在「三餐」专栏打卡，这里自动关联</div>';
    return '';
  },

  // 加任务弹窗顶部：不成熟 idea 推荐（#336）
  _ideaRecHTML(added) {
    if (!S.get('mumu_ideaOn', false)) return '';   // v269：idea 模块下线
    const ideas = (S.get('ideas', []) || []).filter(i => !i.done);
    if (!ideas.length) return '';
    added = added || new Set();
    return `<div class="muted" style="font-size:12px;margin-bottom:6px">${icon('sprout',14)} 不成熟的 idea（有精力就纳入今天）</div>
      ${ideas.map(i => `<div class="idea-rec-row">
        <span class="ir-title">${esc(i.title)}</span>
        ${added.has(i.id) ? '<span class="tag">已加入</span>' : `<button class="btn sm" data-irc="${i.id}">＋ 加入今天</button>`}
      </div>`).join('')}`;
  },

  addDialog(root, preset) {
    const ideaRecHTML = this._ideaRecHTML();
    openModal(`<button class="close-x" onclick="closeModal()">×</button><h3>新任务</h3>
      ${ideaRecHTML ? `<div class="idea-rec" id="ideaRecBox" style="display:none">${ideaRecHTML}</div>` : ''}
      <div class="form-row"><label>分类</label><select id="npCat">${this.catSelectHTML('')}</select></div>
      <div style="margin:-8px 0 12px"><button class="link sm" id="npManageCat" type="button">＋ 管理分类</button></div>
      <div id="catEditor" style="display:none;border:1px dashed var(--line);border-radius:10px;padding:12px;margin-bottom:12px;background:#faf8f4">
        <div style="font-size:12.5px;font-weight:600;color:var(--sub);margin-bottom:8px">编辑分类（改名/改图标/删除）</div>
        <div id="catList"></div>
        <div style="display:flex;gap:8px;margin-top:10px">
          <button class="btn sm" id="addCat">＋ 新分类</button>
          <button class="btn sm" id="saveCat" style="margin-left:auto">保存分类</button>
        </div>
      </div>
      <div class="form-row"><label>要做什么？</label><input id="npTitle" placeholder="例如：剪一条造梦西游4的活动视频"></div>
      <div class="form-row"><label>关联到专栏打卡</label><select id="npLink">${this.linkOptionsHTML('')}</select></div>
      <div class="form-row"><label>关联目标（选填）</label><select id="npGoal"></select></div>
      <div id="npGoalNew" style="display:none"><div class="form-row"><label>新目标内容</label><input id="npGoalNewTitle" placeholder="例如：练 30 分钟肩颈放松"></div></div>
      <div id="catFields"></div>
      <div class="form-row" id="estRow" style="display:none"><label>预估时长（分钟）</label><input id="npEst" type="number" placeholder="大概要学多久，如 90"></div>
      <div class="form-row"><label>先拆几步</label><textarea id="npSteps" rows="4" placeholder="找素材&#10;写脚本&#10;粗剪&#10;加字幕发布"></textarea></div>
      <div class="form-row" id="npLoadRow" style="margin-bottom:8px">
        <label>这项会消耗多少精力？</label>
        <div class="seg" id="npLoadSeg">
          <button type="button" data-load="1">轻松</button>
          <button type="button" data-load="2" class="on">一般</button>
          <button type="button" data-load="3">中等</button>
          <button type="button" data-load="4">较重</button>
          <button type="button" data-load="5">大工程</button>
        </div>
      </div>
      <div class="form-row" id="npTypeRow" style="margin-bottom:10px">
        <label>属于哪类？</label>
        <div class="seg" id="npTypeSeg">
          <button type="button" data-type="consume" class="on">系统消耗</button>
          <button type="button" data-type="invest">主动投资</button>
        </div>
      </div>
      <div class="form-row" id="npStudyRow" style="display:none;margin-bottom:10px">
        <label>学习类型</label>
        <div class="seg" id="npStudySeg">
          <button type="button" data-st="网课" class="on">网课</button>
          <button type="button" data-st="刷题">刷题</button>
        </div>
      </div>
      <label style="display:flex;gap:8px;align-items:center;margin:4px 0 12px;cursor:pointer"><input type="checkbox" id="npDaily" style="width:18px;height:18px;accent-color:#111"> ${icon('refresh',14)} 固定为每日任务（每天自动出现）</label>
      <button class="btn" id="npOk" style="width:100%">添加到 ${fmtCN(this.cur)}</button>`);

    const renderCatFields = () => {
      const lk = document.getElementById('npLink').value;
      document.getElementById('catFields').innerHTML = Daily.catFieldsHTML(lk);
      Daily.bindWorkApps();   // 平台 chips + 达标要求提示（每次重绘字段后重新挂）
    };
    const renderGoalSel = () => {
      const sel = document.getElementById('npGoal'); if (!sel) return;
      const link = document.getElementById('npLink').value;
      const goals = S.get('mumu_goals', []);
      const cur = this.cur;
      const dayGoals = goals.filter(g => g.scope === 'day' && g.period === cur && !g.done);
      const boardGoals = goals.filter(g => (g.scope === 'week' || g.scope === 'month') && g.link === link && !g.done);
      let opts = '<option value="">不关联目标</option>';
      dayGoals.forEach(g => opts += '<option value="' + g.id + '">🎯 今日 · ' + esc(g.title) + '</option>');
      boardGoals.forEach(g => opts += '<option value="' + g.id + '">' + (g.scope === 'week' ? '周' : '月') + ' · ' + esc(g.title) + '</option>');
      opts += '<option value="__new__">＋ 新建今日目标</option>';
      sel.innerHTML = opts;
    };
    const setDefaultLink = () => {
      const cat = document.getElementById('npCat').value;
      const dl = Daily.catDefaultLink(cat);
      if (dl) { const sel = document.getElementById('npLink'); if (sel) { sel.value = dl; renderCatFields(); renderGoalSel(); } }
      const er = document.getElementById('estRow'); if (er) er.style.display = (cat === 'kaogong') ? '' : 'none';
      // 默认类型：成长类算主动投资，其余系统消耗
      const tseg = document.getElementById('npTypeSeg');
      if (tseg) tseg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.type === (cat === 'growth' ? 'invest' : 'consume')));
      // 三餐不进精力系统：隐藏精力/类型选择
      const lr = document.getElementById('npLoadRow'); if (lr) lr.style.display = (cat === 'meals') ? 'none' : '';
      const tr = document.getElementById('npTypeRow'); if (tr) tr.style.display = (cat === 'meals') ? 'none' : '';
      const sr2 = document.getElementById('npStudyRow'); if (sr2) sr2.style.display = (cat === 'kaogong') ? '' : 'none';
      updateIdeaVis();
    };

    const renderCatEditor = () => {
      const box = document.getElementById('catList');
      box.innerHTML = this.taskCats().map((c, i) => `
        <div class="cat-edit-row" data-ci="${i}">
          <input class="cat-emoji" value="${esc(c.emoji)}" placeholder="图标" maxlength="2">
          <input class="cat-name" value="${esc(c.name)}" placeholder="分类名">
          <button class="btn sm warn del-cat">删除</button>
        </div>`).join('');
      box.querySelectorAll('.del-cat').forEach(b => b.onclick = () => {
        const idx = Number(b.closest('.cat-edit-row').dataset.ci);
        const cats = this.taskCats(); cats.splice(idx, 1); this.saveCats(cats); renderCatEditor();
        const sel = document.getElementById('npCat'); sel.innerHTML = this.catSelectHTML(sel.value);
      });
    };

    document.getElementById('npManageCat').onclick = () => {
      const ed = document.getElementById('catEditor');
      ed.style.display = ed.style.display === 'none' ? 'block' : 'none';
      if (ed.style.display === 'block') renderCatEditor();
    };
    document.getElementById('addCat').onclick = () => {
      const cats = this.taskCats();
      cats.push({ id: 'cat_' + Date.now(), name: '新分类', emoji: 'tag' });
      this.saveCats(cats); renderCatEditor();
      const sel = document.getElementById('npCat'); sel.innerHTML = this.catSelectHTML(sel.value);
    };
    document.getElementById('saveCat').onclick = () => {
      const cats = this.taskCats();
      document.querySelectorAll('.cat-edit-row').forEach((row, i) => {
        if (!cats[i]) return;
        cats[i].emoji = row.querySelector('.cat-emoji').value.trim() || cats[i].emoji;
        cats[i].name = row.querySelector('.cat-name').value.trim() || cats[i].name;
      });
      this.saveCats(cats);
      const sel = document.getElementById('npCat'); sel.innerHTML = this.catSelectHTML(sel.value);
      toast('分类已保存');
    };
    document.getElementById('npCat').onchange = setDefaultLink;
    document.getElementById('npLink').onchange = () => { renderCatFields(); renderGoalSel(); };
    const bindSeg = (segId) => {
      const seg = document.getElementById(segId);
      if (!seg) return;
      seg.querySelectorAll('button').forEach(b => b.onclick = () => {
        seg.querySelectorAll('button').forEach(x => x.classList.remove('on'));
        b.classList.add('on');
      });
    };
    bindSeg('npLoadSeg');
    bindSeg('npTypeSeg');
    bindSeg('npStudySeg');
    const gsel = document.getElementById('npGoal');
    if (gsel) gsel.onchange = () => { const nv = document.getElementById('npGoalNew'); if (nv) nv.style.display = (gsel.value === '__new__') ? '' : 'none'; };
    // 不成熟 idea 推荐：只有选「主动投资」才出现
    const updateIdeaVis = () => {
      const box = document.getElementById('ideaRecBox'); if (!box) return;
      const tseg = document.getElementById('npTypeSeg');
      const isInvest = tseg && tseg.querySelector('button.on') && tseg.querySelector('button.on').dataset.type === 'invest';
      box.style.display = isInvest ? '' : 'none';
    };
    const tseg = document.getElementById('npTypeSeg');
    if (tseg) tseg.querySelectorAll('button').forEach(b => b.onclick = () => {
      tseg.querySelectorAll('button').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      updateIdeaVis();
    });
    const addedIdeas = new Set();
    const bindIdeaRec = () => {
      const box = document.getElementById('ideaRecBox');
      if (!box) return;
      box.querySelectorAll('[data-irc]').forEach(b => b.onclick = () => {
        const i = (S.get('ideas', []) || []).find(x => x.id === b.dataset.irc); if (!i) return;
        this.addTaskFromIdea(i);
        addedIdeas.add(i.id);
        box.innerHTML = this._ideaRecHTML(addedIdeas);
        bindIdeaRec();
        toast('「' + i.title + '」已加入今日计划 🌱');
      });
    };
    bindIdeaRec();
    if (preset) {
      const pt = document.getElementById('npTitle'); if (pt) pt.value = preset.title || '';
      if (preset.link) { const pl = document.getElementById('npLink'); if (pl) pl.value = preset.link; }
    }
    setDefaultLink();
    if (preset && preset.goalId) { const pg = document.getElementById('npGoal'); if (pg) pg.value = preset.goalId; }

    document.getElementById('npOk').onclick = () => {
      const link = document.getElementById('npLink') ? document.getElementById('npLink').value : '';
      let title = document.getElementById('npTitle').value.trim();
      if (!title) {
        if (link === 'work:write') title = '写作';
        else return toast('先写下要做什么吧');
      }
      const steps = document.getElementById('npSteps').value.split('\n').map(s => s.trim()).filter(Boolean).map(s => ({ id: uid(), text: s, done: false }));
      const daily = document.getElementById('npDaily').checked;
      const cat = document.getElementById('npCat') ? document.getElementById('npCat').value : '';
      // v283：平台改为多选 → 收集成数组（兼容旧的 #npWApp 单选下拉，历史数据不会丢）
      const linkAppsBox = document.getElementById('npWApps');
      const linkApp = linkAppsBox
        ? Array.prototype.slice.call(linkAppsBox.querySelectorAll('.np-w-app:checked')).map(c => c.value)
        : (document.getElementById('npWApp') ? (document.getElementById('npWApp').value || '') : '');
      // 精力档 + 类型（来自分段选择器）；三餐不写消耗值
      const isMealAdd = (cat === 'meals');
      const loadSeg = document.getElementById('npLoadSeg'); const loadBtn = loadSeg && loadSeg.querySelector('button.on');
      const newLoad = isMealAdd ? 0 : (Number(loadBtn ? loadBtn.dataset.load : 1) || 1);
      const typeSeg = document.getElementById('npTypeSeg'); const typeBtn = typeSeg && typeSeg.querySelector('button.on');
      const newType = isMealAdd ? 'consume' : ((typeBtn && typeBtn.dataset.type === 'invest') ? 'invest' : 'consume');
      const stSeg = document.getElementById('npStudySeg');
      const studyType = (cat === 'kaogong' && stSeg) ? ((stSeg.querySelector('button.on') || {}).dataset || {}).st || '' : '';
      // 超额拦截：今日精力已满则禁止再加
      const info = this.dayLoadInfo(this.cur);
      if (info.plannedLoad + newLoad > info.cap) {
        return toast('今天精力已经排满了（' + info.plannedLoad + '/' + info.cap + '），先别硬加。去充个电，或把一些事挪到明天 💤');
      }
      const estMin = (cat === 'kaogong') ? (Number(document.getElementById('npEst').value) || 0) : 0;
      // 产出类型：表单里一定渲染了 #npWType；万一取不到才兜底为 video（绝不静默记成图文）
      const wTypeEl = document.getElementById('npWType');
      const wType = wTypeEl ? (wTypeEl.value || 'video') : 'video';
      const linkAppArr = this.appArr(linkApp);
      const extra = {};
      if (link === 'work:video') {
        extra.type = wType;
        const wact = document.getElementById('npWAct'); if (wact && wact.value) extra.act = wact.value;
        const wm = document.getElementById('npWMin'); extra.minutes = wm ? (Number(wm.value) || 0) : 0;
        if (linkAppArr.length) extra.app = linkAppArr;
      } else if (link === 'work:write') {
        const ww = document.getElementById('npWWords'); extra.words = ww ? (Number(ww.value) || 0) : 0;
      } else if (link.startsWith('work:')) { extra.type = wType; if (linkAppArr.length) extra.app = linkAppArr; }
      else if (link.startsWith('sport:')) { extra.minutes = Number(document.getElementById('npSMin').value) || 10; extra.feel = document.getElementById('npSFeel').value; }
      else if (link.startsWith('kaogong:')) { extra.subject = (document.getElementById('npKSubj').value || '').trim() || '言语'; extra.minutes = estMin || 25; }
      else if (link.startsWith('growth:')) { extra.minutes = Number(document.getElementById('npGMin').value) || 20; }
      // 关联目标：选中「新建今日目标」则先建一个日目标，否则用选中的目标 id
      const gsel = document.getElementById('npGoal');
      const gval = gsel ? gsel.value : '';
      let taskGoalId = null;
      if (gval === '__new__') {
        const gt = (document.getElementById('npGoalNewTitle') || {}).value || '';
        if (gt.trim()) {
          const gs = S.get('mumu_goals', []);
          const ng = { id: uid(), scope: 'day', period: this.cur, title: gt.trim(), done: false, doneDate: null, roll: false, link: link || null, created: todayStr(), parent: null };
          gs.push(ng); S.set('mumu_goals', gs);
          taskGoalId = ng.id;
        }
      } else if (gval) {
        taskGoalId = gval;
      }
      const id = uid();
      const arr = this.list(this.cur);
      arr.push({ id, title, steps, cat, link, linkApp, goalId: taskGoalId, extra: link ? extra : null, estMin, manualDone: false, abandoned: false, moved: false, createdAt: Date.now(), taskLoad: isMealAdd ? undefined : newLoad, taskType: newType, studyType: (cat === 'kaogong' ? studyType : undefined) });
      this.setList(this.cur, arr);
      if (daily) { const tmpl = this.dailyTmpl(); tmpl.push({ id: uid(), title, steps: steps.map(s => ({ id: uid(), text: s.text })), cat, link, extra: link ? extra : null, goalId: taskGoalId, estMin, taskLoad: isMealAdd ? undefined : newLoad, taskType: newType, studyType: (cat === 'kaogong' ? studyType : undefined) }); this.saveDaily(tmpl); arr[arr.length - 1]._tmpl = tmpl[tmpl.length - 1].id; this.setList(this.cur, arr); }
      closeModal(); this.render(root); toast('任务已添加');
    };
  },

  // 充电弹窗（v230）：每 30 分钟 = 1 个电；娱乐时长由娱乐专栏自动同步，这里只放「非娱乐」充电活动，避免重复计数
  rechargeDialog(root) {
    const date = this.cur;
    const presets = [
      { key: 'sleep', emoji: '💤', name: '睡个好觉', mins: 480 },
      { key: 'nap', emoji: '😴', name: '小睡片刻', mins: 30 },
      { key: 'music', emoji: '🎧', name: '听歌放松', mins: 30 },
      { key: 'walk', emoji: '🚶', name: '散个步', mins: 30 },
      { key: 'tea', emoji: '☕', name: '喝杯茶发呆', mins: 30 },
      { key: 'bath', emoji: '🛀', name: '泡个澡', mins: 30 }
    ];
    const powerOf = m => Math.floor((Number(m) || 0) / 30);
    const powerTotal = rechPowerOf(S.get('recharge', {})[date] || []);
    const addRech = (p) => {
      const mins = Number(document.getElementById('rcMin').value) || 0;
      if (!mins) return toast('先填一下这次充了多久（分钟）');
      const rec = S.get('recharge', {}) || {};
      const arr = rec[date] || [];
      const pw = powerOf(mins);
      arr.push({ id: uid(), key: p.key, name: p.name, emoji: p.emoji || '', val: pw, mins, where: '', createdAt: Date.now() });
      rec[date] = arr; S.set('recharge', rec);
      closeModal(); this.render(root); toast('充了 ' + pw + ' 电，恢复一下 🌱');
    };
    openModal(`<button class="close-x" onclick="closeModal()">×</button><h3>${icon('moon',18)} 充个电，恢复能量</h3>
      <div class="muted" style="margin-bottom:10px">每 30 分钟 = 1 个电。今天已充 <b>${powerTotal}</b> 电。娱乐（刷抖音 / 看小说等）请在「娱乐」里记，会自动算进来。</div>
      <div class="recharge-grid" id="rcGrid">${presets.map(p => `<button class="recharge-chip" data-rc="${p.key}">${p.emoji} ${esc(p.name)} <small>· ${p.mins >= 60 ? (p.mins / 60) + 'h' : p.mins + '′'}</small></button>`).join('')}</div>
      <div class="form-row" style="margin-top:10px"><label>这次充了多久？（分钟，可预估）</label><input id="rcMin" type="number" value="30" placeholder="例如：60" style="width:100%"></div>
      <div class="muted" id="rcPrev" style="margin-top:4px"></div>
      <div style="display:flex;gap:8px;margin-top:14px;align-items:flex-end">
        <div class="form-row" style="flex:1;margin:0"><label>自定义做了什么（也按分钟算电）</label><input id="rcName" placeholder="例如：和朋友聊天"></div>
        <button class="btn sm" id="rcCustom" style="white-space:nowrap">记录</button>
      </div>`);
    const grid = document.getElementById('rcGrid');
    presets.forEach(p => { const b = grid.querySelector('[data-rc="' + p.key + '"]'); if (b) b.onclick = () => { document.getElementById('rcMin').value = p.mins; updatePrev(); addRech(p); }; });
    const updatePrev = () => { const m = Number(document.getElementById('rcMin').value) || 0; const pv = document.getElementById('rcPrev'); if (pv) pv.textContent = m ? ('约充 ' + powerOf(m) + ' 电') : ''; };
    const rcMin = document.getElementById('rcMin'); if (rcMin) rcMin.oninput = updatePrev; updatePrev();
    document.getElementById('rcCustom').onclick = () => {
      const n = document.getElementById('rcName').value.trim();
      const m = Number(document.getElementById('rcMin').value) || 0;
      if (!n) return toast('先写一下做了什么');
      if (!m) return toast('先填一下充了多久（分钟）');
      const pw = powerOf(m);
      const rec = S.get('recharge', {}) || {};
      const arr = rec[date] || [];
      arr.push({ id: uid(), key: 'custom', emoji: '✨', name: n, val: pw, mins: m, where: '', createdAt: Date.now() });
      rec[date] = arr; S.set('recharge', rec);
      closeModal(); this.render(root); toast('充了 ' + pw + ' 电 🌱');
    };
  },

  // 精力评估问卷：了解你的情况，设定/调整上限（自适应第一步）
  assessLoadProfile() {
    const cur = S.get('loadProfile', {}) || {};
    const mk = (name, label, opts) => `<div class="form-row"><label>${label}</label><div class="seg" data-q="${name}">${opts.map(o => `<button type="button" data-v="${o.v}" class="${cur[name] === o.v ? 'on' : ''}">${o.t}</button>`).join('')}</div></div>`;
    openModal(`<button class="close-x" onclick="closeModal()">×</button><h3>🌱 精力评估（约 10 秒）</h3>
      <div class="muted" style="margin-bottom:12px">了解你现在的精力，把精力上限设得刚刚好——既能完成、又不会被压垮。以后随时能在「设置」里重新评估，系统也会每月复盘给你建议。</div>
      ${mk('capacity', '你现在一天大概能稳定完成几件事？', [{ v: 'low', t: '1–2 件' }, { v: 'mid', t: '3–4 件' }, { v: 'high', t: '5–6 件' }, { v: 'veryhigh', t: '7 件以上' }])}
      ${mk('fixedShare', '你每天的「系统消耗」固定事项大约占多少精力？', [{ v: 'little', t: '很少，几乎不占' }, { v: 'some', t: '一小部分' }, { v: 'large', t: '占大头' }])}
      ${mk('adjustMode', '你希望精力上限怎么跟着你调整？', [{ v: 'monthly', t: '每月自动建议' }, { v: 'manual', t: '我手动改' }, { v: 'both', t: '都要' }])}
      ${mk('startStyle', '起步阶段，你更想要哪种感觉？', [{ v: 'conservative', t: '保守，轻松完成再慢慢加' }, { v: 'moderate', t: '适中' }, { v: 'tight', t: '稍紧，逼自己多做' }])}
      <button class="btn" id="assessOk" style="width:100%;margin-top:6px">保存并应用</button>`);
    const seg = (nm) => { const s = document.querySelector('[data-q="' + nm + '"]'); if (s) s.querySelectorAll('button').forEach(b => b.onclick = () => { s.querySelectorAll('button').forEach(x => x.classList.remove('on')); b.classList.add('on'); }); };
    ['capacity', 'fixedShare', 'adjustMode', 'startStyle'].forEach(seg);
    document.getElementById('assessOk').onclick = () => {
      const read = (nm) => { const b = document.querySelector('[data-q="' + nm + '"] button.on'); return b ? b.dataset.v : null; };
      const profile = { capacity: read('capacity') || 'mid', fixedShare: read('fixedShare') || 'some', adjustMode: read('adjustMode') || 'monthly', startStyle: read('startStyle') || 'conservative', assessedAt: todayStr() };
      const cap = Daily.suggestCapFromProfile(profile);
      profile.cap = cap;
      S.set('loadProfile', profile);
      S.set('loadCap', cap);
      closeModal();
      if (window.Daily && Daily._root) Daily.render(Daily._root);
      toast('精力上限已设为 ' + cap + '（≈' + Math.round(cap / 2.5) + ' 件中等任务）。之后每月复盘会给你建议 🌱');
    };
  },
  // 由评估结果推算初始上限
  suggestCapFromProfile(p) {
    const base = { low: 6, mid: 12, high: 18, veryhigh: 24 }[p.capacity] || 12;
    const k = { conservative: 0.85, moderate: 1.0, tight: 1.15 }[p.startStyle] || 1.0;
    let cap = Math.round(base * k);
    return Math.max(4, Math.min(40, cap));
  },
  detail(root, id, dateKey) {
    const date = dateKey || this.cur;
    const arr = this.list(date); const t = arr.find(x => x.id === id); if (!t) return;
    const done = this.effDone(t, date);
    const linked = this.linkSatisfied(t, date);
    const autoDone = linked && !this.isDone(t);
    const isDaily = !!t._tmpl;
    const isMeal = this.isMealTask(t);
    openModal(`<button class="close-x" onclick="closeModal()">×</button>
      <h3>${done ? icon('check',18) : icon('edit',18)} 编辑任务 ${t.abandoned ? '<span class="tag">已放弃</span>' : done ? (autoDone ? '<span class="tag">自动完成</span>' : '<span class="tag">已完成</span>') : ''}</h3>
      ${t.abandoned ? `<div class="banner warn" style="display:block">
        <label style="display:block;margin-bottom:4px;font-weight:600">放弃原因（复盘时会用到）</label>
        <textarea id="editReason" rows="3" placeholder="例如：发现优先级不高 / 精力不够 / 计划定太大了…" style="width:100%;box-sizing:border-box">${esc(t.abandonReason || '')}</textarea>
      </div>` : ''}
      ${isDaily ? `<div class="banner info">${icon('refresh',14)} 这是固定每日任务，每天会自动出现</div>` : ''}
      <div class="form-row"><label>任务名称</label><input id="taskTitle" value="${esc(t.title)}" placeholder="任务叫什么？"></div>
      <div class="form-row"><label>关联到专栏打卡</label><select id="taskLink">${this.linkOptionsHTML(t.link || '')}</select></div>
      <div class="form-row"><label>关联目标（选填）</label><select id="taskGoal">${this.goalSelectOpts(t.goalId || '', (t.link || ''), date)}</select></div>
      <div id="taskGoalNewWrap" style="display:${(t.goalId === '__new__') ? '' : 'none'}"><div class="form-row"><label>新目标内容</label><input id="taskGoalNewTitle" placeholder="例如：练 30 分钟肩颈放松"></div></div>
      <div id="linkAppHost">${this.appWrapHTML(t.link || '', t.linkApp || '')}</div>
      ${t.link && t.link.indexOf('work:') === 0 ? `<div class="form-row" style="margin-bottom:8px"><label>产出类型</label><select id="edWType"><option value="video" ${(t.extra && t.extra.type || 'video') === 'video' ? 'selected' : ''}>视频</option><option value="article" ${(t.extra && t.extra.type) === 'article' ? 'selected' : ''}>图文</option></select></div>` : ''}
      <div class="form-row"><label>分类（用于复盘分组）</label><select id="taskCat">${this.catSelectHTML(t.cat || this.catFromLink(t.link || ''))}</select></div>
      ${!isMeal ? `<div class="form-row" style="margin-bottom:8px">
        <label>消耗精力</label>
        <div class="seg" id="edLoadSeg">
          <button type="button" data-load="1" class="${this.taskLoad(t) === 1 ? 'on' : ''}">轻松</button>
          <button type="button" data-load="2" class="${this.taskLoad(t) === 2 ? 'on' : ''}">一般</button>
          <button type="button" data-load="3" class="${this.taskLoad(t) === 3 ? 'on' : ''}">中等</button>
          <button type="button" data-load="4" class="${this.taskLoad(t) === 4 ? 'on' : ''}">较重</button>
          <button type="button" data-load="5" class="${this.taskLoad(t) === 5 ? 'on' : ''}">大工程</button>
        </div>
      </div>
      <div class="form-row" style="margin-bottom:10px">
        <label>类型</label>
        <div class="seg" id="edTypeSeg">
          <button type="button" data-type="consume" class="${this.taskType(t) === 'consume' ? 'on' : ''}">系统消耗</button>
          <button type="button" data-type="invest" class="${this.taskType(t) === 'invest' ? 'on' : ''}">主动投资</button>
        </div>
      </div>
      ${!isMeal && t.cat === 'kaogong' ? `<div class="form-row" style="margin-bottom:10px"><label>学习类型</label><div class="seg" id="edStudySeg"><button type="button" data-st="网课" class="${t.studyType === '网课' ? 'on' : ''}">网课</button><button type="button" data-st="刷题" class="${t.studyType === '刷题' ? 'on' : ''}">刷题</button></div></div>` : ''}` : `<div class="banner info" style="margin-bottom:10px">${icon('meal',14)} 三餐任务不计入精力系统，也无需选消耗值</div>`}
      <div id="stepList">${t.steps.map(s => `
        <div class="step-row ${s.done ? 'done' : ''}" data-lp>
          <input type="checkbox" ${s.done ? 'checked' : ''} data-step="${s.id}">
          <span class="stext">${esc(s.text)}</span>
          <button class="del" data-delstep="${s.id}">✕</button>
        </div>`).join('') || '<div class="empty">还没拆步骤，拆一拆更容易开始！</div>'}
      </div>
      <div style="display:flex;gap:8px;margin:10px 0 16px"><input id="newStep" placeholder="加一个小步骤…" style="flex:1"><button class="btn sm" id="addStep">添加</button></div>
      ${!t.steps.length ? `<label style="display:flex;gap:8px;align-items:center;margin-bottom:14px"><input type="checkbox" id="manualDone" ${t.manualDone ? 'checked' : ''} style="width:17px;height:17px;accent-color:#111"> 直接标记完成</label>` : ''}
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${!done && !t.abandoned && !isDaily ? `<button class="btn sm" id="moveTmr">→ 移到明日</button>` : ''}
        ${!isDaily ? `<button class="btn sm" id="pinDaily">${icon('refresh',14)} 固定每日</button>` : `<button class="btn ghost sm" id="unpinDaily">取消固定</button>`}
        ${!done && !t.abandoned ? `<button class="btn sm" id="giveUp">放弃任务</button>` : ''}
        <button class="btn ghost sm" id="delTask" style="margin-left:auto">删除</button>
      </div>`);

    const syncTmpl = () => {
      if (!t._tmpl) return;
      // 1) 更新模板本身（未来新生成的日子从这里取）
      const tmpl = this.dailyTmpl();
      const e = tmpl.find(x => x.id === t._tmpl);
      if (e) { e.title = t.title; e.link = t.link || ''; e.linkApp = t.linkApp || ''; e.cat = t.cat || this.catFromLink(t.link || ''); e.steps = t.steps.map(s => ({ id: uid(), text: s.text })); e.taskLoad = t.taskLoad; e.taskType = t.taskType; e.studyType = t.studyType; e.extra = t.extra; this.saveDaily(tmpl); }
      // 2) 同步已生成（今天及未来）的固定任务实例，让"后续固定计划"一并改精力/类型/标题
      const all = S.get('plans', {});
      let ch = false;
      Object.keys(all).forEach(dd => {
        if (dd < todayStr()) return;
        (all[dd] || []).forEach(x => {
          if (x._tmpl === t._tmpl) {
            let up = false;
            if (x.taskLoad !== t.taskLoad) { x.taskLoad = t.taskLoad; up = true; }
            if (x.taskType !== t.taskType) { x.taskType = t.taskType; up = true; }
            if (x.title !== t.title) { x.title = t.title; up = true; }
            if (x.studyType !== t.studyType) { x.studyType = t.studyType; up = true; }
            if (JSON.stringify(x.extra || null) !== JSON.stringify(t.extra || null)) { x.extra = t.extra; up = true; }
            if (up) ch = true;
          }
        });
      });
      if (ch) S.set('plans', all);
    };
    const applyGoal = () => {
      const gs2 = document.getElementById('taskGoal'); if (!gs2) return;
      const v = gs2.value;
      if (v === '__new__') {
        const gt = (document.getElementById('taskGoalNewTitle') || {}).value || '';
        if (gt.trim()) {
          const gs = S.get('mumu_goals', []);
          const ng = { id: uid(), scope: 'day', period: date, title: gt.trim(), done: false, doneDate: null, roll: false, link: (t.link || null), created: todayStr(), parent: null };
          gs.push(ng); S.set('mumu_goals', gs);
          t.goalId = ng.id;
        }
      } else { t.goalId = v || null; }
    };
    const save = () => { applyGoal(); this.setList(date, arr); syncTmpl(); };
    const tt = document.getElementById('taskTitle');
    if (tt) tt.onchange = () => { t.title = tt.value.trim() || t.title; save(); this.render(this._root); };
    const er = document.getElementById('editReason');
    if (er) er.onchange = () => { t.abandonReason = er.value.trim(); save(); };
    const lk = document.getElementById('taskLink');
    if (lk) { lk.onchange = () => { t.link = lk.value || ''; t.linkApp = document.getElementById('npApp') ? document.getElementById('npApp').value : ''; if (!t.cat) t.cat = this.catFromLink(t.link || ''); save(); this.detail(root, id, dateKey); }; }
    const appSel = document.getElementById('npApp');
    if (appSel) appSel.onchange = () => { t.linkApp = appSel.value; save(); };
    const edWType = document.getElementById('edWType');
    if (edWType) edWType.onchange = () => { t.extra = t.extra || {}; t.extra.type = edWType.value; save(); this.render(this._root); };
    const catSel = document.getElementById('taskCat');
    if (catSel) catSel.onchange = () => { t.cat = catSel.value || ''; save(); this.render(this._root); };
    const tg = document.getElementById('taskGoal');
    if (tg) tg.onchange = () => { const nv = document.getElementById('taskGoalNewWrap'); if (nv) nv.style.display = (tg.value === '__new__') ? '' : 'none'; };
    const bindEdSeg = (segId, attr, apply) => {
      const seg = document.getElementById(segId);
      if (!seg) return;
      seg.querySelectorAll('button').forEach(b => b.onclick = () => {
        seg.querySelectorAll('button').forEach(x => x.classList.remove('on'));
        b.classList.add('on');
        apply(b.dataset[attr]); save(); this.render(this._root);
      });
    };
    bindEdSeg('edLoadSeg', 'load', v => { t.taskLoad = Number(v) || 1; });
    bindEdSeg('edTypeSeg', 'type', v => { t.taskType = (v === 'invest') ? 'invest' : 'consume'; t.taskTypeManual = true; });
    bindEdSeg('edStudySeg', 'st', v => { t.studyType = v; });
    document.querySelectorAll('[data-step]').forEach(cb => cb.onchange = () => {
      const s = t.steps.find(x => x.id === cb.dataset.step); s.done = cb.checked;
      if (s.done) s.doneAt = Date.now();
      if (this.isDone(t)) { if (!t.doneAt) t.doneAt = Date.now(); } else { delete t.doneAt; }
      save();
      if (this.isDone(t)) { closeModal(); this.render(root); toast('所有步骤划完，任务完成！'); }
      else this.detail(root, id, dateKey);
    });
    document.querySelectorAll('[data-delstep]').forEach(b => b.onclick = () => { t.steps = t.steps.filter(x => x.id !== b.dataset.delstep); save(); this.detail(root, id, dateKey); });
    document.getElementById('addStep').onclick = () => {
      const v = document.getElementById('newStep').value.trim(); if (!v) return;
      t.steps.push({ id: uid(), text: v, done: false }); save(); this.detail(root, id, dateKey);
    };
    const md = document.getElementById('manualDone');
    if (md) md.onchange = () => {
      if (!md.checked) { t.manualDone = false; delete t.doneAt; save(); this.render(root); return; }
      const fin = () => {
        let extra = t.extra || null;
        if (t.cat === 'kaogong') extra = this._kgExtra(t);
        else if (t.cat === 'sport') extra = { minutes: t.sportMin || 10, feel: t.sportFeel || '适中' };
        else if (this.growthArea(t.link) === '英语') extra = { minutes: (t.engMin != null ? t.engMin : (extra && extra.minutes) || 20), delta: (t.engDelta != null ? t.engDelta : 0) };
        t.manualDone = true; t.doneAt = Date.now(); save();
        if (t.link) this.pushToColumn(date, t.link, t.title, t.linkApp, extra, t.srcId || t.id);
        closeModal(); this.render(root);
      };
      if (t.cat === 'kaogong' && t.actMin == null) this.requireActMin(t, date, fin);
      else if (t.cat === 'sport' && t.sportMin == null) this.requireSportInfo(t, date, fin);
      else if (t.cat === 'growth' && this.growthArea(t.link) === '英语' && t.engMin == null) this.requireEngInfo(t, date, fin);
      else fin();
    };
    const mv = document.getElementById('moveTmr');
    if (mv) mv.onclick = () => { this.moveTmr(date, t.id); closeModal(); };
    const pin = document.getElementById('pinDaily');
    if (pin) pin.onclick = () => {
      const tmpl = this.dailyTmpl(); const nt = { id: uid(), title: t.title, steps: t.steps.map(s => ({ id: uid(), text: s.text })), link: t.link || '', cat: t.cat || this.catFromLink(t.link || ''), taskLoad: t.taskLoad, taskType: t.taskType, studyType: t.studyType };
      tmpl.push(nt); this.saveDaily(tmpl); t._tmpl = nt.id; save(); closeModal(); this.render(root); toast('已固定为每日任务');
    };
    const unpin = document.getElementById('unpinDaily');
    if (unpin) unpin.onclick = () => {
      const tmpl = this.dailyTmpl().filter(x => x.id !== t._tmpl); this.saveDaily(tmpl); delete t._tmpl; save(); closeModal(); this.render(root); toast('已取消固定');
    };
    const gu = document.getElementById('giveUp');
    if (gu) gu.onclick = () => {
      openModal(`<button class="close-x" onclick="closeModal()">×</button><h3>放弃「${esc(t.title)}」</h3>
        <div class="form-row"><label>为什么放弃？（写下来，复盘时会用到）</label><textarea id="gvReason" rows="3" placeholder="例如：发现优先级不高 / 精力不够 / 计划定太大了…"></textarea></div>
        <button class="btn warn" id="gvOk" style="width:100%">确认放弃</button>`);
      document.getElementById('gvOk').onclick = () => {
        const r = document.getElementById('gvReason').value.trim();
        if (!r) return toast('放弃也要留下原因哦');
        t.abandoned = true; t.abandonReason = r; save(); closeModal(); this.render(root); toast('已放弃，没关系，轻装上阵');
      };
    };
    document.getElementById('delTask').onclick = () => {
      this.setList(date, arr.filter(x => x.id !== id));
      const t = arr.find(x => x.id === id);
      if (t && t.link) this.removeFromColumn(date, t.link, t.srcId || id, t.srcId);
      closeModal(); this.render(root); toast('已删除，关联专栏同步清除');
    };
  },

  overdueDialog(root, overdue) {
    openModal(`<button class="close-x" onclick="closeModal()">×</button><h3>${icon('clock',18)} 待处理的过期任务</h3>
      ${overdue.map((o, i) => `<div class="list-row"><span class="tag">${o.date.slice(5)}</span><span style="flex:1">${esc(o.t.title)}</span>
        <button class="btn sm" data-mv="${i}">移到今天</button><button class="btn sm" id="gvBtn${i}" data-gv="${i}">放弃</button></div>`).join('')}`);
    document.querySelectorAll('[data-mv]').forEach(b => b.onclick = () => {
      const o = overdue[Number(b.dataset.mv)];
      const arr = this.list(o.date); const t = arr.find(x => x.id === o.t.id); t.moved = true; this.setList(o.date, arr);
      const ta = this.list(todayStr()); ta.push({ ...t, id: uid(), moved: false, steps: t.steps.map(s => ({ ...s })) }); this.setList(todayStr(), ta);
      closeModal(); this.render(root); toast('已移到今天');
    });
    document.querySelectorAll('[data-gv]').forEach(b => b.onclick = () => {
      const o = overdue[Number(b.dataset.gv)];
      closeModal(); this.cur = o.date; this.render(root); this.detail(root, o.t.id, o.date);
      setTimeout(() => { const g = document.getElementById('giveUp'); if (g) g.click(); }, 50);
    });
  },

  // 给复盘/首页用的统计
  // 口径必须与每日计划页头部(doneN/totalN)完全一致：先 ensureDaily 部署固定任务、再按三餐去重，
  // done=已完成(未放弃)、total=未放弃且未移到明天且非休息日的任务数。
  // 否则首页会比每日计划页多算「自动生成的三餐重复任务」或「已放弃但仍 effDone」的条目（曾出现首页2/计划页1）。
  statsOf(date) {
    date = date || todayStr();
    this.ensureDaily(date);
    let tasks = this.list(date);
    const hasManualMeals = tasks.some(t => !t.autoGen && !t.abandoned && t.link && t.link.startsWith('meals:'));
    if (hasManualMeals) tasks = tasks.filter(t => !(t.autoGen && t.link && t.link.startsWith('meals:') && !t.abandoned));
    const done = tasks.filter(t => !t.abandoned && this.effDone(t, date)).length;
    const total = tasks.filter(t => !t.moved).length; // 含放弃/请假：与每日计划头部(pct)口径一致
    return { total, done, abandoned: tasks.filter(t => t.abandoned) };
  },
  openDatePicker() {
    const cur = this.cur;
    openModal(`<button class="close-x" onclick="closeModal()">×</button><h3>${icon('calendar',18)} 切换日期</h3>
      <div class="form-row"><label>选择日期</label><input type="date" id="dpDate" value="${cur}"></div>
      <div style="display:flex;gap:8px;margin-top:6px">
        <button class="btn ghost sm" id="dpPrev" style="flex:1">‹ 前一天</button>
        <button class="btn ghost sm" id="dpNext" style="flex:1">后一天 ›</button>
      </div>
      <button class="btn" id="dpOk" style="width:100%;margin-top:12px">确定</button>`);
    const apply = (v) => {
      if (!v) return;
      this.cur = v; this._openTasks = {}; closeModal(); this.render(this._root);
      App.updateTime();
    };
    document.getElementById('dpOk').onclick = () => apply(document.getElementById('dpDate').value);
    document.getElementById('dpPrev').onclick = () => { document.getElementById('dpDate').value = addDays(document.getElementById('dpDate').value, -1); };
    document.getElementById('dpNext').onclick = () => { document.getElementById('dpDate').value = addDays(document.getElementById('dpDate').value, 1); };
  },

  // ===== 月日历页面（独立页面，非弹窗）=====
  renderMonthCalPage(box) {
    if (!this._monthYm) this._monthYm = todayStr().slice(0, 7);
    const ym = this._monthYm;
    box.innerHTML = `
      <div style="margin-bottom:12px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px">
          <span class="branch-title" style="margin:0;padding:0;border:none;font-size:17px">${ym.slice(0,4)}年${Number(ym.slice(5))}月</span>
          <button class="icon-btn" id="mcBack" title="返回今日计划">${icon('back',18)}</button>
        </div>
      </div>
      <div id="mcCalGrid"></div><div id="mcHl"></div>`;
    // 日历网格
    const calEl = box.querySelector('#mcCalGrid');
    renderMonthCal(calEl, {
      ym,
      legendEl: '#mcHl', legendHTML: v => holidayLegendHTML(v), madeupSet: new Set(madeupSetInRange('2020-01-01', '2050-12-31')),
      cellHTML: ds => {
        const list = this.list(ds);
        const n = list.length;
        const done = list.filter(t => !t.abandoned && this.effDone(t, ds)).length;
        let h = n ? `<div class="tc-count ${ds === todayStr() ? 'tc-today' : ''}">${done}/${n}</div>` : '';
        return h;
      },
      onClick: ds => { this._sub = null; this.cur = ds; this._openTasks = {}; this.render(this._root); }
    });
    box.appendChild(this.renderSubTabs(box, 'monthCal'));
    box.querySelector('#mcBack').onclick = () => { this._sub = null; this.render(this._root); };
    this._monthCalBox = box;
  },

  // ===== 目标系统（v260）：年/月/周目标叠加日历，不影响每日计划 =====
  goalKey(scope) {
    const t = todayStr();
    if (scope === 'year') return t.slice(0, 4);
    if (scope === 'month') return t.slice(0, 7);
    if (scope === 'day') return t;
    return weekDates(t)[0]; // 本周一日期
  },
  goalRoll(scope, period) {
    if (scope === 'year') return String(Number(period) + 1);
    if (scope === 'month') { const [y, m] = period.split('-').map(Number); if (m === 12) return (y + 1) + '-01'; return y + '-' + String(m + 1).padStart(2, '0'); }
    if (scope === 'day') return addDays(period, 1);
    return addDays(period, 7); // 周：顺延到下一周一
  },
  goalChildScope(scope) { return scope === 'year' ? 'month' : scope === 'month' ? 'week' : scope === 'week' ? 'day' : null; },
  goalChildPeriod(scope, period) {
    const p = period || todayStr();
    if (scope === 'year') return p.slice(0, 4) + '-01';
    if (scope === 'month') return weekDates(p.slice(0, 7) + '-01')[0];
    if (scope === 'week') return p; // period 已是周一
    return '';
  },
  goalChildPeriods(scope, period) {
    if (scope === 'year') { const y = period; const a = []; for (let m = 1; m <= 12; m++) a.push(y + '-' + String(m).padStart(2, '0')); return a; }
    if (scope === 'month') {
      const [y, m] = period.split('-').map(Number); const dim = new Date(y, m, 0).getDate();
      const seen = {}, arr = [];
      for (let dd = 1; dd <= dim; dd++) { const wk = weekDates(y + '-' + String(m).padStart(2, '0') + '-' + String(dd).padStart(2, '0'))[0]; if (!seen[wk]) { seen[wk] = 1; arr.push(wk); } }
      return arr;
    }
    if (scope === 'week') { const s = weekDates(period)[0]; const a = []; for (let i = 0; i < 7; i++) a.push(addDays(s, i)); return a; }
    return [];
  },
  goalHasChildren(g) { return S.get('mumu_goals', []).some(x => x.parent === g.id); },
  goalDone(g) {
    const gs = S.get('mumu_goals', []);
    const kids = gs.filter(x => x.parent === g.id);
    if (kids.length) return kids.every(k => this.goalDone(k));
    return !!g.done;
  },
  goalLinkName(link) { return ({ sport: '运动', kaogong: '学习·考编', work: '创作', growth: '成长', read: '阅读', travel: '出行', fun: '娱乐', meals: '三餐', custom: '自定义' })[link] || link || ''; },
  // 第几周（以含 1 月 1 日那周的周一为第 1 周）
  weekOfYear(period) {
    const ws = weekDates(period || todayStr())[0];
    const y = Number(ws.slice(0, 4));
    const jan1 = new Date(y, 0, 1);
    const shift = (jan1.getDay() + 6) % 7;
    const firstMon = new Date(y, 0, 1 - shift);
    const wsD = new Date(y, Number(ws.slice(5, 7)) - 1, Number(ws.slice(8, 10)));
    return Math.max(1, Math.round((wsD - firstMon) / 6048e5) + 1);
  },
  goalPeriodLabel(g) {
    if (g.scope === 'year') return g.period + ' 年';
    if (g.scope === 'month') return Number(g.period.slice(5)) + ' 月';
    if (g.scope === 'week') return '第 ' + this.weekOfYear(g.period) + ' 周';
    return Number(g.period.slice(5, 7)) + '/' + Number(g.period.slice(8, 10));
  },
  // 把父目标的数量平分到 n 份：「读 12 本书」→ 12 个月 →「读 1 本书」
  distributeTitle(title, n) {
    if (!n || n < 2) return title;
    const m = String(title).match(/\d+(\.\d+)?/);
    if (!m) return title;
    const total = Number(m[0]);
    if (!total || total < n) return title;
    let per = total / n;
    per = Number.isInteger(per) ? per : Math.round(per * 10) / 10;
    if (per < 1) return title;
    return title.slice(0, m.index) + per + title.slice(m.index + m[0].length);
  },
  goalStatsHTML() {
    const goals = S.get('mumu_goals', []);
    const cell = scope => {
      const cur = this.goalKey(scope);
      const gs = goals.filter(g => g.scope === scope && g.period === cur);
      const done = gs.filter(g => this.goalDone(g)).length;
      const pct = gs.length ? Math.round(done / gs.length * 100) : 0;
      const label = { year: '今年', month: '本月', week: '本周', day: '今日' }[scope];
      return '<div class="gs-cell"><div class="gs-lb">' + label + '</div>'
        + '<div class="gs-num">' + done + '<i>/' + gs.length + '</i></div>'
        + '<div class="gs-bar"><span style="width:' + pct + '%"></span></div></div>';
    };
    return '<div class="gs-strip">' + ['year', 'month', 'week', 'day'].map(cell).join('') + '</div>';
  },
  goalRowHTML(g, depth) {
    const goals = S.get('mumu_goals', []);
    const childScope = this.goalChildScope(g.scope);
    const kids = goals.filter(x => x.parent === g.id).sort((a, b) => a.period.localeCompare(b.period));
    const treeKids = kids.filter(k => k.scope !== 'day');   // 日目标不进拆解树，只在日历显示
    const dayKids = kids.filter(k => k.scope === 'day');
    const done = this.goalDone(g);
    const kidsDone = kids.filter(k => this.goalDone(k)).length;
    const pct = kids.length ? Math.round(kidsDone / kids.length * 100) : (done ? 100 : 0);
    if (!this._goalOpen) this._goalOpen = {};
    const open = !!this._goalOpen[g.id];
    const d = depth || 0;
    const breakLabel = { month: '拆 12 月', week: '拆各周', day: '拆 7 天' }[childScope] || '拆';

    let h = '<div class="gt-node d' + d + '">';
    h += '<div class="gt-row' + (done ? ' done' : '') + '">';
    h += treeKids.length
      ? '<button class="gt-chev' + (open ? ' open' : '') + '" data-gchev="' + g.id + '">' + (open ? '▾' : '▸') + '</button>'
      : '<span class="gt-chev ph"></span>';
    h += '<button class="gt-tick' + (done ? ' on' : '') + (kids.length ? ' sum' : '') + '" data-gtoggle="' + g.id + '">' + (done ? '✓' : '') + '</button>';
    h += '<div class="gt-main"><div class="gt-title">' + esc(g.title) + '</div><div class="gt-meta">'
      + '<span class="gt-per">' + this.goalPeriodLabel(g) + '</span>'
      + (g.link ? '<span class="gt-tag">' + this.goalLinkName(g.link) + '</span>' : '')
      + (g.cadence ? '<span class="gt-tag">节奏·' + g.cadence + '</span>' : '')
      + (treeKids.length ? '<span class="gt-sub">' + kidsDone + '/' + kids.length + '</span>' : '')
      + (dayKids.length ? '<span class="gt-sub day">日 ' + dayKids.filter(k => this.goalDone(k)).length + '/' + dayKids.length + '</span>' : '')
      + '</div></div>';
    if (kids.length) h += '<span class="gt-pct">' + pct + '%</span>';
    h += '<span class="gt-acts">'
      + (childScope ? '<button class="gt-act" data-gbreak="' + g.id + '" title="' + breakLabel + '">拆</button>' : '')
      + (kids.length ? '' : '<button class="gt-act" data-groll="' + g.id + '" title="顺延到下一期">延</button>')
      + '<button class="gt-act del" data-gdel="' + g.id + '" title="删除">×</button>'
      + '</span></div>';
    if (treeKids.length) {
      h += '<div class="gt-kids"' + (open ? '' : ' hidden') + '>' + treeKids.map(c => this.goalRowHTML(c, d + 1)).join('') + '</div>';
    }
    return h + '</div>';
  },
  goalCardHTML() {
    const goals = S.get('mumu_goals', []);
    const order = { year: 0, month: 1, week: 2 };
    const tops = goals.filter(g => !g.parent && g.scope !== 'day')
      .sort((a, b) => (order[a.scope] - order[b.scope]) || a.period.localeCompare(b.period));
    const orphanDay = goals.filter(g => !g.parent && g.scope === 'day').length;
    const list = tops.length
      ? '<div class="goal-tree">' + tops.map(g => this.goalRowHTML(g, 0)).join('') + '</div>'
      : '<div class="gt-empty">还没有目标，先写一个年目标</div>';
    return '<div class="card goal-card">'
      + '<div class="gt-head"><h3>目标拆解</h3><button class="gt-add" id="goalAdd">＋ 添加</button></div>'
      + this.goalStatsHTML()
      + list
      + (orphanDay ? '<div class="gt-note">独立日目标 ' + orphanDay + ' 个 · 在日历查看</div>' : '')
      + '</div>';
  },
  renderGoalsCard(box) { box.insertAdjacentHTML('beforeend', this.goalCardHTML()); this.bindGoalCard(box); },
  bindGoalCard(box) {
    const add = box.querySelector('#goalAdd');
    if (add) add.onclick = () => this.openGoalAdd();
    box.querySelectorAll('[data-gchev]').forEach(b => b.onclick = e => {
      e.stopPropagation();
      const id = b.dataset.gchev;
      if (!this._goalOpen) this._goalOpen = {};
      this._goalOpen[id] = !this._goalOpen[id];
      const node = b.parentElement && b.parentElement.parentElement;
      const kids = node ? Array.prototype.find.call(node.children, c => c.classList && c.classList.contains('gt-kids')) : null;
      if (kids) { kids.hidden = !this._goalOpen[id]; b.classList.toggle('open', this._goalOpen[id]); b.textContent = this._goalOpen[id] ? '▾' : '▸'; }
      else this.goalRerender();
    });
    box.querySelectorAll('[data-gtoggle]').forEach(b => b.onclick = e => { e.stopPropagation(); this.toggleGoal(b.dataset.gtoggle); this.goalRerender(); });
    box.querySelectorAll('[data-groll]').forEach(b => b.onclick = e => { e.stopPropagation(); this.rollGoal(b.dataset.groll); this.goalRerender(); });
    box.querySelectorAll('[data-gdel]').forEach(b => b.onclick = e => { e.stopPropagation(); this.delGoal(b.dataset.gdel); this.goalRerender(); });
    box.querySelectorAll('[data-gbreak]').forEach(b => b.onclick = e => { e.stopPropagation(); this.breakGoal(b.dataset.gbreak); this.goalRerender(); });
  },
  todayGoalsHTML(d) {
    const dayGoals = S.get('mumu_goals', []).filter(g => g.scope === 'day' && g.period === d).sort((a, b) => (a.created || '').localeCompare(b.created || ''));
    let h = '<div class="card today-goals" id="todayGoalsCard">'
      + '<div class="tg-head"><h3>今日目标</h3><span class="tg-acts">'
      + '<button class="tg-cal" id="goalCal" title="打开目标日历（年 / 月 / 周 / 日）">' + icon('calendar', 16) + '</button>'
      + '<button class="tg-add" id="goalAddDay" title="添加今日目标">＋</button></span></div>';
    if (!dayGoals.length) {
      h += '<div class="tg-empty">今天还没有日目标。点右上角「＋」新建一个，或点日历查看／拆解年、月、周目标。</div>';
    } else {
      h += '<div class="tg-list">' + dayGoals.map(g => {
        const done = this.goalDone(g);
        return '<div class="goal-row' + (done ? ' done' : '') + '">'
          + '<button class="chip" data-gtoggle="' + g.id + '" style="' + (done ? 'background:#111;color:#fff;border-color:#111' : '') + '">' + (done ? '✓' : '○') + '</button>'
          + '<div class="tg-title"><b>' + esc(g.title) + '</b>' + (g.link ? ' <span class="muted">· ' + this.goalLinkName(g.link) + '</span>' : '') + (g.progress ? ' <span class="muted">×' + g.progress + '</span>' : '') + '</div></div>';
      }).join('') + '</div>';
    }
    return h + '</div>';
  },
  // v310：从目标拉取——把进行中的月/周目标一键变成今天的计划（目标引导计划）
  goalQuickHTML(d) {
    const goals = S.get('mumu_goals', []);
    const rel = goals.filter(g => !g.done && (g.scope === 'month' || g.scope === 'week') && g.link && g.link !== 'custom' && g.link !== '');
    if (!rel.length) return '';
    const cur = d;
    return '<div class="card today-goals" style="margin-top:14px">'
      + '<div class="tg-head"><h3>从目标拉取</h3><span class="muted" style="font-size:12px">点 ＋ 把目标变成计划</span></div>'
      + '<div class="tg-list">' + rel.map(g => {
        const scoped = g.scope === 'week' ? '周' : '月';
        return '<div class="goal-row"><button class="chip" data-goaladd="' + g.id + '" style="border:none;background:var(--light);font-size:15px;line-height:1;padding:2px 9px">＋</button>'
          + '<div class="tg-title"><b>' + esc(g.title) + '</b> <span class="muted">· ' + scoped + (g.cadence ? '·' + g.cadence : '') + '·' + this.goalLinkName(g.link) + '</span></div></div>';
      }).join('') + '</div></div>';
  },
  goalRerender() { if (this._root) this.render(this._root); },
  syncGoalsFromPlan(date) {
    const gs = S.get('mumu_goals', []);
    const dayGoals = gs.filter(g => g.scope === 'day' && g.period === date);
    if (!dayGoals.length) return;
    const tasks = this.list(date);
    const doneCats = new Set(tasks.filter(t => !t.abandoned && this.effDone(t, date) && t.link).map(t => (t.link.split(':')[0])));
    const doneGoalIds = new Set(tasks.filter(t => !t.abandoned && this.effDone(t, date) && t.goalId).map(t => t.goalId));
    let changed = false;
    dayGoals.forEach(g => {
      if (g.done) return;
      if ((g.link && doneCats.has(g.link)) || (g.id && doneGoalIds.has(g.id))) {
        g.done = true; g.doneDate = date; g.progress = (g.progress || 0) + 1; changed = true;
      }
    });
    if (changed) S.set('mumu_goals', gs);
  },
  toggleGoal(id) {
    const gs = S.get('mumu_goals', []); const g = gs.find(x => x.id === id); if (!g) return;
    if (this.goalHasChildren(g)) { toast('这是汇总目标，完成它的子目标即自动达成 ✓'); return; }
    g.done = !g.done; g.doneDate = g.done ? todayStr() : null; S.set('mumu_goals', gs);
    toast(g.done ? '目标达成 ✓' : '已取消达成');
  },
  rollGoal(id) {
    const gs = S.get('mumu_goals', []); const g = gs.find(x => x.id === id); if (!g) return;
    g.period = this.goalRoll(g.scope, g.period); g.done = false; g.doneDate = null; S.set('mumu_goals', gs);
    toast('已顺延到下一期');
  },
  delGoal(id) {
    let gs = S.get('mumu_goals', []);
    const toDel = new Set([id]); let changed = true;
    while (changed) { changed = false; gs.forEach(g => { if (g.parent && toDel.has(g.parent) && !toDel.has(g.id)) { toDel.add(g.id); changed = true; } }); }
    gs = gs.filter(x => !toDel.has(x.id));
    S.set('mumu_goals', gs); toast('已删除' + (toDel.size > 1 ? '（含子目标）' : ''));
  },
  goalSelectOpts(curId, link, date) {
    const goals = S.get('mumu_goals', []);
    const matched = goals.filter(g => !g.done && ((g.scope === 'day' && g.period === date) || ((g.scope === 'week' || g.scope === 'month') && g.link === link)));
    const byId = {};
    let opts = '<option value="">不关联目标</option>';
    matched.forEach(g => { byId[g.id] = 1; opts += '<option value="' + g.id + '"' + (g.id === curId ? ' selected' : '') + '>' + (g.scope === 'day' ? '🎯 今日 · ' : (g.scope === 'week' ? '周 · ' : '月 · ')) + esc(g.title) + '</option>'; });
    const cur = goals.find(g => g.id === curId);
    if (cur && !byId[cur.id]) opts = '<option value="' + cur.id + '" selected>🎯 ' + esc(cur.title) + (cur.done ? '（已完成）' : '') + '</option>' + opts;
    opts += '<option value="__new__">＋ 新建今日目标</option>';
    return opts;
  },
  openGoalAdd(parent, preset) {
    const defScope = preset ? preset.scope : (parent ? this.goalChildScope(parent.scope) : 'year');
    const defPeriod = preset ? preset.period : (parent ? this.goalChildPeriod(defScope, parent.period) : this.goalKey(defScope));
    const linkOpts = ['', 'sport', 'kaogong', 'work', 'growth', 'read', 'travel', 'fun', 'meals', 'custom'];
    const linkSel = '<div class="form-row"><label>关联每日计划（选填）</label><select id="gLink">' + linkOpts.map(l => '<option value="' + l + '">' + (l ? this.goalLinkName(l) : '不关联') + '</option>').join('') + '</select></div>';
    const cadenceOpts = ['', '每天', '每周', '每月', '每季度', '每年', '一次'];
    const yr = new Date().getFullYear();
    const yearOpts = []; for (let y = yr - 2; y <= yr + 3; y++) yearOpts.push(y);
    const monthOpts = []; for (let m = 1; m <= 12; m++) monthOpts.push(String(m).padStart(2, '0'));
    // 周期选择器：年/月可任选（含过去与未来），周/日用日期选择器（可任选任意一天，周自动对齐到周一）
    const periodCtl = (scope, period) => {
      if (scope === 'year') return '<select id="gPeriodY">' + yearOpts.map(y => '<option value="' + y + '"' + (String(y) === String(period || yr) ? ' selected' : '') + '>' + y + ' 年</option>').join('') + '</select>';
      if (scope === 'month') { const [py, pm] = (period || this.goalKey('month')).split('-'); return '<select id="gPeriodY">' + yearOpts.map(y => '<option value="' + y + '"' + (String(y) === String(py || yr) ? ' selected' : '') + '>' + y + '</option>').join('') + '</select> 年 <select id="gPeriodM">' + monthOpts.map(m => '<option value="' + m + '"' + (m === (pm || '01') ? ' selected' : '') + '>' + m + ' 月</option>').join('') + '</select>'; }
      return '<input type="date" id="gPeriodD" value="' + (period || todayStr()) + '">';
    };
    openModal('<button class="close-x" onclick="closeModal()">×</button><h3>🎯 添加目标</h3>'
      + '<div class="form-row"><label>类型</label><select id="gScope">' + ['year', 'month', 'week', 'day'].map(s => '<option value="' + s + '"' + (s === defScope ? ' selected' : '') + '>' + ({ year: '年目标', month: '月目标', week: '周目标', day: '日目标' }[s]) + '</option>').join('') + '</select></div>'
      + '<div class="form-row"><label>目标内容</label><input id="gTitle" placeholder="例如：读完 2 本书 / 存下 3000 元"></div>'
      + '<div class="form-row"><label>归属期间</label><div id="gPeriodBox">' + periodCtl(defScope, defPeriod) + '</div><div class="muted" style="font-size:12px;margin-top:-4px">可任选过去或未来的任意年/月/周/日</div></div>'
      + '<div class="form-row"><label>节奏（选填）</label><select id="gCadence">' + cadenceOpts.map(c => '<option value="' + c + '">' + (c || '不设定') + '</option>').join('') + '</select></div>'
      + linkSel
      + '<div class="form-row"><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="gRoll" checked> 到期未做可顺延到下一期</label></div>'
      + '<button class="btn" id="gOk">添加</button>');
    setTimeout(() => {
      const scopeSel = document.getElementById('gScope');
      if (scopeSel) scopeSel.onchange = () => { const pb = document.getElementById('gPeriodBox'); if (pb) pb.innerHTML = periodCtl(scopeSel.value, ''); };
      const ok = document.getElementById('gOk');
      if (ok) ok.onclick = () => {
        const scope = scopeSel.value;
        const title = document.getElementById('gTitle').value.trim();
        if (!title) return toast('写点目标内容吧');
        let period;
        if (scope === 'year') period = document.getElementById('gPeriodY').value;
        else if (scope === 'month') period = document.getElementById('gPeriodY').value + '-' + document.getElementById('gPeriodM').value;
        else { let ds = document.getElementById('gPeriodD') ? document.getElementById('gPeriodD').value : todayStr(); if (scope === 'week') ds = weekDates(ds)[0]; period = ds; }
        const gs = S.get('mumu_goals', []);
        gs.push({ id: uid(), scope, period, title, done: false, doneDate: null, roll: document.getElementById('gRoll').checked, link: document.getElementById('gLink').value || null, cadence: document.getElementById('gCadence').value || null, created: todayStr(), parent: parent ? parent.id : null });
        S.set('mumu_goals', gs); closeModal();
        this.goalRerender();
      };
    }, 0);
  },
  breakGoal(parentId) {
    const gs = S.get('mumu_goals', []); const p = gs.find(x => x.id === parentId); if (!p) return;
    const cScope = this.goalChildScope(p.scope); if (!cScope) return;
    const periods = this.goalChildPeriods(p.scope, p.period);
    const unit = { month: '月', week: '周', day: '日' }[cScope];
    const suggest = this.distributeTitle(p.title, periods.length);
    openModal('<button class="close-x" onclick="closeModal()">×</button><h3>拆解目标</h3>'
      + '<div class="gb-src">' + esc(p.title) + ' <span class="muted">' + this.goalPeriodLabel(p) + '</span></div>'
      + '<div class="gb-arrow">↓ 平分为 ' + periods.length + ' 个' + unit + '目标</div>'
      + '<div class="form-row"><label>每' + unit + '做</label><input id="gbTitle" value="' + esc(suggest) + '"></div>'
      + (cScope === 'day' ? '<div class="form-row"><label>关联每日计划</label><select id="gbLink">' + ['', 'sport', 'kaogong', 'work', 'growth', 'read', 'travel', 'fun', 'meals', 'custom'].map(l => '<option value="' + l + '"' + (p.link === l ? ' selected' : '') + '>' + (l ? this.goalLinkName(l) : '不关联') + '</option>').join('') + '</select></div>' : '')
      + '<div class="form-row"><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="gbRoll" checked> 到期未做可顺延到下一期</label></div>'
      + '<button class="btn" id="gbOk">拆出 ' + periods.length + ' 个</button>');
    setTimeout(() => {
      const ok = document.getElementById('gbOk');
      if (ok) ok.onclick = () => {
        const title = document.getElementById('gbTitle').value.trim() || suggest;
        const linkEl = document.getElementById('gbLink');
        const link = cScope === 'day' ? (linkEl ? (linkEl.value || null) : null) : (p.link || null);
        const roll = document.getElementById('gbRoll').checked;
        let arr = S.get('mumu_goals', []);
        const old = arr.filter(x => x.parent === parentId && x.scope === cScope);
        if (old.length) {
          if (!confirm('已有 ' + old.length + ' 个' + unit + '子目标，重新拆解会替换它们（含其下层）。继续？')) return;
          const del = new Set(old.map(x => x.id)); let ch = true;
          while (ch) { ch = false; arr.forEach(x => { if (x.parent && del.has(x.parent) && !del.has(x.id)) { del.add(x.id); ch = true; } }); }
          arr = arr.filter(x => !del.has(x.id));
        }
        periods.forEach(period => { arr.push({ id: uid(), scope: cScope, period, title, done: false, doneDate: null, roll, link, created: todayStr(), parent: parentId }); });
        S.set('mumu_goals', arr); closeModal();
        if (!this._goalOpen) this._goalOpen = {};
        this._goalOpen[parentId] = true;
        toast('已拆出 ' + periods.length + ' 个' + unit + '目标');
        this.goalRerender();
      };
    }, 0);
  },
  // ===== 目标日历（年→月→周 钻取）=====
  renderGoalYearPage(box) {
    if (!this._goalYear) this._goalYear = todayStr().slice(0, 4);
    const y = this._goalYear;
    const goals = S.get('mumu_goals', []);
    const goalYears = (() => { const ys = new Set([todayStr().slice(0, 4)]); goals.forEach(g => { const p = g.period || ''; if (/^\d{4}/.test(p)) ys.add(p.slice(0, 4)); }); return [...ys].sort(); })();
    const months = [];
    for (let m = 1; m <= 12; m++) {
      const ym = y + '-' + String(m).padStart(2, '0');
      const gs = goals.filter(g => g.scope === 'month' && g.period === ym);
      const done = gs.filter(g => this.goalDone(g)).length;
      const dayCount = goals.filter(g => g.scope === 'day' && g.period.startsWith(ym + '-')).length;
      months.push({ ym, m, gs, done, dayCount });
    }
    box.innerHTML = `
      <div class="branch-title" style="display:flex;align-items:center;justify-content:space-between">
        <span style="display:flex;align-items:center;gap:8px">🎯 目标日历
          <select id="gyYear" class="select" style="font-weight:600">${goalYears.map(yy => '<option value="' + yy + '"' + (yy === y ? ' selected' : '') + '>' + yy + ' 年</option>').join('')}</select>
        </span>
        <button class="icon-btn" id="gyBack" title="返回每日计划">${icon('back', 18)}</button>
      </div>
      <div class="goal-year-grid">
        ${months.map(mo => {
          const cls = mo.gs.length ? (mo.done === mo.gs.length ? 'all' : 'part') : '';
          return '<button class="goal-month-tile ' + cls + '" data-ym="' + mo.ym + '">'
            + '<span class="gm-m">' + mo.m + '月</span>'
            + (mo.gs.length ? '<span class="gm-p">' + mo.done + '/' + mo.gs.length + '</span>' : '<span class="gm-p muted">—</span>')
            + (mo.dayCount ? '<span class="gm-d">有' + mo.dayCount + '个日标</span>' : '')
            + '</button>';
        }).join('')}
      </div>
      ${this.goalCardHTML()}`;
    const gySel = box.querySelector('#gyYear');
    if (gySel) gySel.onchange = () => { this._goalYear = gySel.value; this.renderGoalYearPage(box); };
    box.querySelector('#gyBack').onclick = () => { this._sub = null; this.render(this._root); };
    box.querySelectorAll('[data-ym]').forEach(b => b.onclick = () => { this._goalYm = b.dataset.ym; this.renderGoalMonthPage(box); });
    this.bindGoalCard(box);
  },
  renderGoalMonthPage(box) {
    const ym = this._goalYm;
    const goals = S.get('mumu_goals', []);
    box.innerHTML = `
      <div class="branch-title" style="display:flex;align-items:center;justify-content:space-between">
        <button class="icon-btn" id="gmBack" title="返回年历">${icon('back', 18)}</button>
        <span>${ym.slice(0, 4)}年${Number(ym.slice(5))}月 · 目标</span>
        <span style="width:18px"></span>
      </div>
      <div id="gmCal"></div><div id="gmHl"></div>`;
    const calEl = box.querySelector('#gmCal');
    renderMonthCal(calEl, {
      ym,
      legendEl: '#gmHl', legendHTML: v => holidayLegendHTML(v), madeupSet: new Set(madeupSetInRange('2020-01-01', '2050-12-31')),
      cellHTML: ds => {
        const dgs = goals.filter(g => g.scope === 'day' && g.period === ds);
        if (!dgs.length) return '';
        const done = dgs.filter(g => this.goalDone(g)).length;
        return '<div class="goal-day-flag" title="' + dgs.length + ' 个日目标，已完成 ' + done + '">' + done + '/' + dgs.length + '</div>';
      },
      onClick: ds => { this._goalWk = weekDates(ds)[0]; this.renderGoalWeekPage(box); }
    });
    box.querySelector('#gmBack').onclick = () => this.renderGoalYearPage(box);
  },
  renderGoalWeekPage(box) {
    const wk = this._goalWk;
    const goals = S.get('mumu_goals', []);
    const wd = ['一', '二', '三', '四', '五', '六', '日'];
    const days = []; for (let i = 0; i < 7; i++) days.push(addDays(wk, i));
    box.innerHTML = `
      <div class="branch-title" style="display:flex;align-items:center;justify-content:space-between">
        <button class="icon-btn" id="gwBack" title="返回月历">${icon('back', 18)}</button>
        <span>${wk.slice(5)} 当周 · 目标</span>
        <span style="width:18px"></span>
      </div>
      <div class="goal-week">
        ${days.map((ds, i) => {
          const dgs = goals.filter(g => g.scope === 'day' && g.period === ds);
          const done = dgs.filter(g => this.goalDone(g)).length;
          return '<div class="goal-day-cell ' + (ds === todayStr() ? 'today' : '') + '">'
            + '<div class="gdc-d">周' + wd[i] + ' ' + ds.slice(5) + (ds === todayStr() ? ' · 今天' : '') + '</div>'
            + (dgs.length ? '<div class="gdc-goals">' + dgs.map(g => '<div class="gdc-g ' + (this.goalDone(g) ? 'done' : '') + '">· ' + esc(g.title) + (g.link ? ' <span class="muted">[' + this.goalLinkName(g.link) + ']</span>' : '') + '</div>').join('') + '</div>' : '<div class="muted gdc-empty">无日标</div>')
            + '</div>';
        }).join('')}
      </div>`;
    box.querySelector('#gwBack').onclick = () => this.renderGoalMonthPage(box);
  },


  // 当月日历：预览每日任务 + 点日期切换（保留兼容）
  monthCalDialog(root) {
    let viewYm = this.cur.slice(0, 7);
    const dlg = openModal(`<button class="close-x" onclick="closeModal()">×</button><h3>${icon('calendar',18)} 每日计划 · 切换日期</h3>
      <div id="mcBody"></div>
      <div style="display:flex;justify-content:center;align-items:center;margin-top:10px">
        <button class="btn sm ghost" id="mcToday">回到今天</button>
      </div>
      <div class="muted" style="margin-top:8px;text-align:center">点任意日期可查看/切换到那天</div>`);
    const body = dlg.querySelector('#mcBody');
    const draw = () => renderMonthCal(body, {
      ym: viewYm,
      cellHTML: ds => {
        const list = this.list(ds);
        const n = list.length;
        const done = list.filter(t => !t.abandoned && this.effDone(t, ds)).length;
        const todayDs = todayStr();
        if (!n) return `<div class="tc-count tc-none">·</div>`;
        return `<div class="tc-count ${ds === todayDs ? 'tc-today' : ''}">${done}/${n}</div>`;
      },
      onClick: ds => { this.cur = ds; this._openTasks = {}; closeModal(); this.render(this._root); }
    });
    draw();
    dlg.querySelector('#mcToday').onclick = () => { viewYm = todayStr().slice(0, 7); this.cur = todayStr(); this._openTasks = {}; closeModal(); this.render(this._root); };
  }
};

window.Modules.daily = { render: r => Daily.render(r) };
window.Daily = Daily;
