/* ============ 续火花 · 连续打卡天数 + 休息日 + 补签卡 ============ */
/* 纯新增模块（v221）：零侵入——所有打卡数据来自现有专栏日志反查，不新增独立打卡入口。
 * 内置项目（创作/学习/运动）自动从 workLogs / kgLogs.subject / sportLogs.project 反查；
 * 用户用右上角「+」新增的项目需先选「关联板块」（运动/学习/创作/成长/阅读/出行/娱乐/三餐），
 * 关联后同样由对应专栏日志反查自动续火花；「自定义」默认点格子手动打卡，标 auto 的项（多邻国/墨墨/炭炭）只能由打卡自动点亮。
 */
// 同义归一：学习科目 / 运动项目 名字变体合并到同一续火花项（根治「言语」与「行测言语」分裂、运动名变体导致天数对不上）
const KG_ALIAS = { '言语理解': '言语', '言语模块': '言语', '综应': '综合应用能力', '综合应用': '综合应用能力' };
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
  _cache: null,
  data() { if (!this._cache) this._cache = S.get(this.KEY, { items: [] }); return this._cache; },
  save(d) { S.set(this.KEY, d); this._cache = d; },

  // 某天是否「真实打卡」（按项目类型反查现有日志）
  isDone(item, date) {
    // 空数组不算打卡（!![] 为 true，必须判长度）
    if (item.type === 'work') {
      if (item.sub === 'write') return (S.get('writeLogs', {})[date] || []).length > 0;
      if (item.sub === 'game') return (S.get('workLogs', {})[date] || []).some(l => (l.type || '') !== 'writing');
      return (S.get('workLogs', {})[date] || []).length > 0 || (S.get('writeLogs', {})[date] || []).length > 0;
    }
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
    if (item.type === 'custom') { if (item.done && item.done[date]) return true; if (item.id === 'growth:多邻国' && (S.get('duoStreaks', []) || []).indexOf(date) >= 0) return true; if (item.ref && (S.get('growthLogs', {})[date] || []).some(l => (l.area || '').trim() === (item.ref || '').trim())) return true; return false; }
    return false;
  },
  // 是否覆盖（真实打卡 / 休息日 / 补签日都算续上；休息日含每日计划里的运动/备考休息日）
  covered(item, date) {
    if (item.type === 'group') return this.groupCovered(item, date); // 上级火花（v437）：板块内所有在用子项当天都覆盖才算重叠续上
    if (isSickLeave(date)) return true; // 病假：保护所有板块续火花，等同月经假/年度假期
    if (isAnnualHoliday(date)) return true; // 年度固定假期（生日/纪念日）：全局保护所有板块续火花，等同月经假
    if ((S.get('menstrualRest', []) || []).indexOf(date) >= 0) return true; // 月经假：保护所有板块续火花
    if (item.type === 'kg' && typeof isExamDay === 'function' && isExamDay(date)) return true; // 考试日：保护备考板块续火花（不要求打卡也不中断）
    return this.isDone(item, date) || !!(item.rest && item.rest[date]) || !!(item.madeup && item.madeup[date]);
  },

  // v386 层级辅助：上级组与子项的递归关系
  childrenOf(parentId) {
    return (this.data().items || []).filter(it => it.parent === parentId);
  },
  // 递归收集某组下所有叶子（非 group）续火花项
  leafItems(groupId) {
    const out = [];
    const walk = (id) => {
      this.childrenOf(id).forEach(ch => { if (ch.type === 'group') walk(ch.id); else out.push(ch); });
    };
    walk(groupId);
    return out;
  },
  // v437：参与一级火花计算的「在用子项」——近 45 天有过真实打卡（或休息/补签）的叶子。
  // 从不做的科目 / 已废弃的项目不参与，否则一级火花会被一个永久为 0 的子项拖死（v386 老问题）
  activeLeafItems(groupId) {
    const leaves = this.leafItems(groupId);
    if (!leaves.length) return [];
    const base = todayStr();
    const act = leaves.filter(l => {
      const rest = l.rest || {}, made = l.madeup || {};
      for (let i = 0; i < 45; i++) { const d = addDays(base, -i); if (this.isDone(l, d) || rest[d] || made[d]) return true; }
      return false;
    });
    return act.length ? act : leaves;
  },
  // 上级当天是否「点亮」（v437）：板块内所有在用子项当天都覆盖，这一天才算重叠点亮
  groupCovered(item, date) {
    const leaves = this.activeLeafItems(item.id);
    if (!leaves.length) return false;
    return leaves.every(l => this.covered(l, date));
  },
  // 上级连续天数（v437）：一级火花 = 各二级火花重叠的日子 = 取在用的二级火花里「最短」的那个（不是最多的那个）
  groupCurStreak(item) {
    const leaves = this.activeLeafItems(item.id);
    if (!leaves.length) return 0;
    let m = Infinity;
    leaves.forEach(l => { const s = this.curStreak(l); if (s < m) m = s; });
    return m === Infinity ? 0 : m;
  },

  // 收集续火花项目：默认种子 + 从日志自动发现（后续新增学习科目/运动项目自动进入）+ 已存自定义
  ensureItems() {
    const d = this.data();
    if (!d.items) d.items = [];
    const byId = {};
    d.items.forEach(it => byId[it.id] = it);
    const base = () => ({ makeup: 0, rest: {}, madeup: {}, done: {}, parent: null });
    // v432：①「不背单词」全站改名「墨墨」——旧 streak 项就地改名（保留 done/rest/madeup）+ growthLogs 与每日计划任务 link 一次性迁移；②多邻国/墨墨设为 auto（只能由打卡点亮，火花页不可手动点格子）
    const _oldBB = byId['growth:不背单词'];
    if (_oldBB) { _oldBB.id = 'growth:墨墨'; _oldBB.name = '墨墨'; _oldBB.ref = '墨墨'; _oldBB.auto = 1; byId['growth:墨墨'] = _oldBB; delete byId['growth:不背单词']; }
    const _duoIt = byId['growth:多邻国']; if (_duoIt) _duoIt.auto = 1;
    const _ttIt = byId['growth:炭炭']; if (_ttIt) _ttIt.auto = 1;
    const _gl = S.get('growthLogs', {}); let _glDirty = false;
    Object.keys(_gl).forEach(_d => (_gl[_d] || []).forEach(_l => { if (_l && _l.area === '不背单词') { _l.area = '墨墨'; _glDirty = true; } }));
    if (_glDirty) S.set('growthLogs', _gl);
    ['plans', 'plansDaily'].forEach(function (_pk) {
      const _pv = S.get(_pk, null); if (!_pv || typeof _pv !== 'object') return;
      let _pd = false;
      const _fix = function (_t) { if (_t && _t.link === 'growth:不背单词') { _t.link = 'growth:墨墨'; _pd = true; } };
      if (Array.isArray(_pv)) _pv.forEach(_fix);
      else Object.keys(_pv).forEach(function (_d) { const _a = _pv[_d]; if (Array.isArray(_a)) _a.forEach(_fix); });
      if (_pd) S.set(_pk, _pv);
    });
    const seed = [
      { id: 'group:kg', type: 'group', key: 'kg', name: '备考', parent: null },
      { id: 'group:sport', type: 'group', key: 'sport', name: '运动', parent: null },
      { id: 'group:work', type: 'group', key: 'work', name: '创作', parent: null },
      { id: 'group:growth', type: 'group', key: 'growth', name: '成长', parent: null },
      { id: 'group:english', type: 'group', key: 'english', name: '英语', parent: 'group:growth' },
      { id: 'read:all', type: 'read', name: '阅读', parent: 'group:growth' },
      { id: 'growth:多邻国', type: 'custom', name: '多邻国', ref: '多邻国', parent: 'group:english', auto: 1 },
      { id: 'growth:墨墨', type: 'custom', name: '墨墨', ref: '墨墨', parent: 'group:english', auto: 1 },
      { id: 'growth:炭炭', type: 'custom', name: '炭炭', ref: '炭炭', parent: 'group:english', auto: 1 },
      { id: 'work:game', type: 'work', sub: 'game', name: '游戏', ref: '' },
      { id: 'work:write', type: 'work', sub: 'write', name: '写作', ref: '' },
      { id: 'kg:言语', type: 'kg', name: '言语', ref: '言语' },
      { id: 'sport:大小脸改善', type: 'sport', name: '大小脸改善', ref: '大小脸改善' },
      { id: 'sport:天鹅颈', type: 'sport', name: '天鹅颈', ref: '天鹅颈' }
    ];
    seed.forEach(s => { if (!byId[s.id]) { byId[s.id] = Object.assign(base(), s); d.items.push(byId[s.id]); } });
    // v361：拆分「创作」火花为「游戏」+「写作」，移除旧的合并项（避免多出一张「创作」卡）
    if (byId['work']) { delete byId['work']; }
    d.items = d.items.filter(x => x.id !== 'work');
    // 自动发现：学习各科目、运动各项目（日志里出现过就进续火花，后续新增项目自动进入）
    const kgSubs = {};
    Object.values(S.get('kgLogs', {}) || {}).forEach(arr => (arr || []).forEach(l => { if (l.subject) kgSubs[kgNorm(l.subject)] = 1; }));
    Object.keys(kgSubs).forEach(sub => { const id = 'kg:' + sub; if (!byId[id]) { byId[id] = Object.assign(base(), { id, type: 'kg', name: sub, ref: sub }); d.items.push(byId[id]); } });
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
    // 归一显示名与 ref，确保合并后名称干净（备考二级火花直接用科目名，如「言语」，不再带"学习·"前缀）
    d.items.forEach(it => {
      if (it.type === 'kg') { it.ref = kgNorm(it.ref); it.name = it.ref; }
      else if (it.type === 'sport') { it.ref = sportNorm(it.ref); it.name = it.ref; }
    });
    // v386：挂接层级——为各续火花项指定上级组（备考/运动/创作/成长）；多邻国已 seed 到 group:english 保留
    const PARENT = { kg: 'group:kg', sport: 'group:sport', work: 'group:work', growth: 'group:growth', read: 'group:growth' };
    d.items.forEach(it => {
      if (it.type === 'group') return;          // 组本身不动
      if (it.type === 'custom') return;          // 自定义（含 seed 的多邻国→group:english）保留 parent
      if (PARENT[it.type]) it.parent = PARENT[it.type];
    });
    // v363 迁移：旧 section 级休息数组(sportRest/kgRest/workRest) → 各 streak item 的 per-item rest；迁移后清空旧数组
    ['sportRest', 'kgRest', 'workRest'].forEach(function (secKey) {
      var mtype = secKey === 'sportRest' ? 'sport' : secKey === 'kgRest' ? 'kg' : 'work';
      var arr = S.get(secKey, []) || [];
      if (arr.length) {
        arr.forEach(function (ds) { d.items.forEach(function (it) { if (it.type === mtype) { it.rest = it.rest || {}; if (!it.rest[ds]) it.rest[ds] = 1; } }); });
        S.set(secKey, []);
      }
    });
    // v386：多邻国一次性种入 411 个连续「已打卡」日（含今天），后续在 411 上累加
    const duo = d.items.find(x => x.id === 'growth:多邻国');
    if (duo && (!duo.done || Object.keys(duo.done).length === 0)) {
      let cur = todayStr();
      for (let i = 0; i < 411; i++) { duo.done[cur] = 1; cur = addDays(cur, -1); }
    }
    // v440：411 天种子窗口右端被钉死在旧日期，后面几天没记录就出现断口，一打卡又从 1 天重新起算。
    // 改为固定锚点（2026-11-09 = 第 433 天）+ 之后每天真实打卡自动 +1：
    // 种子窗口右端固定为锚点；锚点之后：打卡日→done（计入），没打卡→rest+pass（不断火、不计数、不占休息额度）。
    // 已写入的 done 永久保留，duoStreaks 只留最近 60 天也不会让数字倒退。
    const DUO_ANCHOR = '2026-11-09', DUO_BASE = 433;
    if (!d._duo440 && duo) {
      d._duo440 = 1;
      duo.done = {};
      let c0 = DUO_ANCHOR;
      for (let i = 0; i < DUO_BASE; i++) { duo.done[c0] = 1; c0 = addDays(c0, -1); }
    }
    if (duo) {
      const realDuo = S.get('duoStreaks', []) || [];
      let c1 = addDays(DUO_ANCHOR, 1), t1 = todayStr();
      while (c1 <= t1) {
        if (duo.done[c1]) { /* 已计入，永久保留 */ }
        else if (realDuo.indexOf(c1) >= 0) {
          duo.done[c1] = 1;
          if (duo.rest) delete duo.rest[c1];
          if (duo.pass) delete duo.pass[c1];
        } else {
          duo.rest = duo.rest || {}; duo.pass = duo.pass || {};
          if (!duo.rest[c1]) { duo.rest[c1] = 1; duo.pass[c1] = 1; }
        }
        c1 = addDays(c1, 1);
      }
    }
    // v426/v432：墨墨（原不背单词）火花由 bbdc 数据自动驱动（纯自动，无手动打卡）；重建 done = 一次性种入的历史日期 ∪ mumu_bbdc 记录
    const bbdcItem = d.items.find(x => x.id === 'growth:墨墨');
    if (bbdcItem) {
      if (!bbdcItem._seed) bbdcItem._seed = { '2026-11-02': 1, '2026-11-03': 1, '2026-11-04': 1, '2026-11-05': 1 }; // 木木从 11-02 开始背墨墨，种入前四天
      bbdcItem.done = {};
      Object.keys(bbdcItem._seed).forEach(dt => { bbdcItem.done[dt] = 1; });
      const _bbd = (S.get('mumu_bbdc', null) || {}).data || {};
      Object.keys(_bbd).forEach(dt => { const v = _bbd[dt]; if (v && (v.time > 0 || v.learn > 0 || v.review > 0 || v._seed)) bbdcItem.done[dt] = 1; });
    }
    // v443：炭炭（练口语）火花由 mumu_tantan 数据自动驱动（纯自动，无手动打卡）
    const tantanItem = d.items.find(x => x.id === 'growth:炭炭');
    if (tantanItem) {
      tantanItem.done = {};
      const _ttd = (S.get('mumu_tantan', null) || {}).data || {};
      Object.keys(_ttd).forEach(dt => { const v = _ttd[dt]; if (v && (v.time > 0 || v.talk > 0 || v.review > 0 || v._seed)) tantanItem.done[dt] = 1; });
    }
    // v432/v434：一次性补 2026-11-04 火花——当日真做了的已有日志（isDone），放过/漏掉的补 rest，保证「过」了也不断火；
    // v434：改用 _heal1104b 重跑一次，给 11-04 的补火 rest 补打 pass 标记（放过日不占休息额度）
    if (!d._heal1104b) {
      d._heal1104b = 1;
      (d.items || []).forEach(it => {
        if (it.type === 'group' || it.id === 'growth:炭炭') return; // v443：炭炭是新增项，别被历史补火误标成「在用」
        if (!this.covered(it, '2026-11-04')) { it.rest = it.rest || {}; it.rest['2026-11-04'] = 1; }
        if (it.rest && it.rest['2026-11-04']) { it.pass = it.pass || {}; it.pass['2026-11-04'] = 1; }
      });
    }
    // v433/v434：历史「今日放过」全量补火——v428~v431 期间成长/三餐任务选「过」时 rest 没写（映射缺失 bug），
    // 导致多邻国/阅读等火焰断了；扫描每日计划里所有 passToday 的任务，把对应火焰项当天补 rest；
    // v434：同时打 pass 标记（restCanAdd 跳过这些日期，「放过」彻底不占休息额度）——改用 _healPass2 标记让 v433 已跑过的设备再补跑一次
    if (!d._healPass2 && window.Daily && window.Daily._passTargetItems) {
      d._healPass2 = 1;
      const _plans = S.get('plans', null);
      if (_plans && typeof _plans === 'object') {
        Object.keys(_plans).forEach(function (dt) {
          const _arr = _plans[dt]; if (!Array.isArray(_arr)) return;
          _arr.forEach(function (t) {
            if (!t || !t.passToday) return;
            (window.Daily._passTargetItems(t) || []).forEach(function (it) {
              it.pass = it.pass || {}; it.pass[dt] = 1;
              it.rest = it.rest || {}; it.rest[dt] = 1;
            });
          });
        });
      }
    }
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
    if (item.type === 'group') return this.groupCurStreak(item); // 上级连续天数 = 各在用子项里最短的那个（重叠日）
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
  refreshFromBbdc() {
    const d = this.data();
    const it = d.items.find(x => x.id === 'growth:墨墨');
    if (!it) return;
    it.done = {};
    Object.keys(it._seed || {}).forEach(dt => { it.done[dt] = 1; }); // 保留一次性种入的历史天数
    const data = (S.get('mumu_bbdc', null) || {}).data || {};
    Object.keys(data).forEach(dt => { const v = data[dt]; if (v && (v.time > 0 || v.learn > 0 || v.review > 0 || v._seed)) it.done[dt] = 1; });
    this.save(d);
  },
  // v443：炭炭面板「记一笔 / 删除」后重建火花（与墨墨 refreshFromBbdc 同款）
  refreshFromTantan() {
    const d = this.data();
    const it = d.items.find(x => x.id === 'growth:炭炭');
    if (!it) return;
    it.done = {};
    const data = (S.get('mumu_tantan', null) || {}).data || {};
    Object.keys(data).forEach(dt => { const v = data[dt]; if (v && (v.time > 0 || v.talk > 0 || v.review > 0 || v._seed)) it.done[dt] = 1; });
    this.save(d);
  },
  // 休息日规则（按项目维度）：一周 <=1、一月 <=4
  restCanAdd(item, date) {
    const wk = mondayOf(date);
    const ym = date.slice(0, 7);
    const rest = item.rest || {};
    const pass = item.pass || {};
    let wkN = 0, moN = 0;
    Object.keys(rest).forEach(d => {
      if (!rest[d]) return;
      if (pass[d]) return; // v434：「今日放过」产生的休息不占额度
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
    const ORDER = ['group:kg', 'group:sport', 'group:work', 'group:growth'];
    const roots = [];
    ORDER.forEach(id => { const g = items.find(i => i.id === id); if (g) roots.push(g); });
    items.filter(i => i.type !== 'group' && !i.parent).forEach(i => roots.push(i));
    this._navStack = [];
    this._addParent = null;
    this.renderLevel(roots, box, '续火花', null);
  },

  // 套娃式下钻：每一级单独一页；点「组」进入其子级页面，点「叶子」进入自身日历
  renderLevel(list, box, title, parentId) {
    box.innerHTML = '';
    this._curLevel = { list, title, parentId };
    this._addParent = parentId;
    const isTop = !this._navStack.length;
    if (isTop) {
      const _sr = S.get('selfRescue');
      const _srStart = (_sr && _sr.start) || '2026-07-13';
      const _srDay = Math.max(1, daysBetween(_srStart, todayStr()) + 1);
      const sr = document.createElement('div'); sr.style.marginBottom = '10px';
      sr.innerHTML = '<div class="branch-title" style="margin:0;padding:0;border:none;font-size:17px">365天自救计划 · 第 ' + _srDay + ' 天</div>';
      box.appendChild(sr);
    }
    const top = document.createElement('div'); top.style.marginBottom = '12px'; box.appendChild(top);
    const bar = document.createElement('div');
    bar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:6px';
    bar.innerHTML = '<button class="icon-btn" id="lvBack" title="返回">' + icon('back', 18) + '</button>'
      + '<div style="flex:1;min-width:0;text-align:center;font-size:17px;font-weight:800;color:var(--ink)">' + esc(title) + '</div>'
      + '<button class="icon-btn" id="lvAdd" title="新增项目">' + icon('plus', 18) + '</button>';
    top.appendChild(bar);
    const grid = document.createElement('div'); grid.className = 'stk-children'; grid.style.marginTop = '12px'; box.appendChild(grid);
    const _sorted = list.slice().sort((a, b) => this.curStreak(b) - this.curStreak(a));
    _sorted.forEach(it => grid.appendChild(this.listCard(it, box)));
    box.querySelector('#lvBack').onclick = () => {
      if (isTop) { Daily._sub = null; Daily.render(Daily._root); }
      else { const prev = this._navStack.pop(); this.renderLevel(prev.list, box, prev.title, prev.parentId); }
    };
    box.querySelector('#lvAdd').onclick = () => this.addDialog(box);
    box.appendChild(Daily.renderSubTabs(box, 'streak'));
  },

  listCard(item, box) {
    const isGrp = item.type === 'group';
    const st = this.curStreak(item);
    const card = document.createElement('div'); card.className = 'stk-card' + (isGrp ? ' stk-card-grp' : '');
    const GMAC = { 'group:kg': '#9FC3E8', 'group:sport': '#8FD9B6', 'group:work': '#F6AFC4', 'group:growth': '#C2A8E0', 'group:english': '#C2A8E0' };
    const CM = { kg: '#9FC3E8', sport: '#8FD9B6', work: '#F6AFC4', growth: '#C2A8E0', read: '#C2A8E0', custom: '#AEBCCB', travel: '#7FD4CB', fun: '#F4A38C', meals: '#EFC15A' };
    const color = isGrp ? (GMAC[item.id] || '#AEBCCB') : (CM[item.type] || '#AEBCCB');
    card.style.setProperty('--mac', color);
    card.innerHTML = '<div class="stk-flame">' + icon('fire', 26) + '</div>'
      + '<div class="stk-num">' + st + '</div>'
      + '<div class="stk-name">' + esc(item.name) + '</div>';
    card.onclick = () => {
      if (isGrp) { this._navStack.push({ list: this._curLevel.list, title: this._curLevel.title, parentId: this._curLevel.parentId }); this.renderLevel(this.childrenOf(item.id), box, item.name, item.id); }
      else { if (this._navStack && this._navStack.length) this._navStack.push({ list: this._curLevel.list, title: this._curLevel.title, parentId: this._curLevel.parentId }); this.detail(item, box); }
    };
    return card;
  },


  // 单个上级组（可嵌套子组，如 成长→英语→多邻国）
  renderGroup(g, depth, color, box) {
    const sec = document.createElement('div');
    sec.className = 'stk-group' + (depth > 0 ? ' nested' : '');
    sec.style.setProperty('--mac', color);
    const leaves = this.leafItems(g.id);
    const lit = leaves.filter(l => this.covered(l, todayStr())).length;
    const head = document.createElement('div');
    head.className = 'stk-group-head';
    head.innerHTML = `<span class="stk-group-name">${esc(g.name)}</span><span class="stk-group-meta">🔥${this.curStreak(g)} · ${lit}/${leaves.length} 亮</span>`;
    head.onclick = (e) => { e.stopPropagation(); this.detail(g, box); };
    sec.appendChild(head);
    const ch = document.createElement('div'); ch.className = 'stk-children'; sec.appendChild(ch);
    this.childrenOf(g.id).filter(c => c.type === 'group').forEach(sub => ch.appendChild(this.renderGroup(sub, depth + 1, color, box)));
    this.childrenOf(g.id).filter(c => c.type !== 'group').forEach(c => ch.appendChild(this.childCard(c, box)));
    return sec;
  },

  // 子火花卡片（叶子项）
  childCard(item, box) {
    const st = this.curStreak(item);
    const card = document.createElement('div'); card.className = 'stk-card stk-child';
    const CM = { kg: '#9FC3E8', sport: '#8FD9B6', work: '#F6AFC4', growth: '#C2A8E0', read: '#C2A8E0', custom: '#AEBCCB', travel: '#7FD4CB', fun: '#F4A38C', meals: '#EFC15A' };
    card.style.setProperty('--mac', CM[item.type] || '#AEBCCB');
    card.innerHTML = `<div class="stk-flame">${icon('fire', 26)}</div>
      <div class="stk-num">${st}</div>
      <div class="stk-name">${esc(item.name)}</div>`;
    card.onclick = () => { if (this._navStack && this._navStack.length) this._navStack.push({ list: this._curLevel.list, title: this._curLevel.title, parentId: this._curLevel.parentId }); this.detail(item, box); };
    return card;
  },

  detail(item, box) {
    if (item.type === 'group') return this.detailGroup(item, box);
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
    const catRest = ds => isAnnualHoliday(ds) || isSickLeave(ds);
    for (let dd = 1; dd <= dim; dd++) {
      const ds = ym + '-' + String(dd).padStart(2, '0');
      const done = this.isDone(item, ds);
      const mens = (S.get('menstrualRest', []) || []).indexOf(ds) >= 0;
      const sick = isSickLeave(ds);
      const ahRaw = annualHolidayType(ds);
      const ah = (!sick && (ahRaw === 'birth' || ahRaw === 'anni')) ? ahRaw : null;
      const rest = !!(item.rest && item.rest[ds]) || catRest(ds);
      const mu = !!(item.madeup && item.madeup[ds]);
      // 考试日：仅备考(kg)板块，底层逻辑同假期（保护续火花、不要求打卡），但显示成考试日配色而非「已完成」标记
      const exam = item.type === 'kg' && typeof isExamDay === 'function' && isExamDay(ds);
      // v368：假期全员上色——月经假粉、病假蓝、生日黄、纪念日紫（原先只出文字标签不上色）
      const cls = mu ? 'mu' : sick ? 'sick' : ah ? ah : mens ? 'mens' : exam ? 'exam' : rest ? 'rest' : done ? 'done' : 'gap';
      const cell = document.createElement('div');
      cell.className = 'stk-day ' + cls;
      const lab = mu ? '补' : sick ? '病' : ah === 'birth' ? '诞' : ah === 'anni' ? '念' : mens ? '经' : exam ? '考' : rest ? '休' : done ? '✓' : '';
      cell.innerHTML = `<span class="d">${dd}</span>${lab ? '<span class="mk">' + lab + '</span>' : ''}`;
      cell.onclick = () => this.toggleDay(item, ds, cls, box);
      grid.appendChild(cell);
    }
    // 解释说明挪到日期格子下方，视觉上更干净
    const tip = document.createElement('div'); tip.className = 'stk-tip';
    tip.textContent = item.auto ? '本项由每日任务/英语版块打卡自动点亮，格子不可手动点' : item.type === 'custom' ? '点格子=打卡；再点取消' : '点空格=用补签卡补签；当天已打卡不可改；休息请在板块设置';
    box.appendChild(tip);
    const _hl = holidayLegendHTML(ym, item.type === 'kg' ? 'kaogong' : undefined); if (_hl) box.insertAdjacentHTML('beforeend', _hl);
    if ((item.type === 'custom' && !item.auto) || item.user) {
      const del = document.createElement('button'); del.className = 'btn ghost'; del.style.marginTop = '8px'; del.textContent = '删除该项目';
      del.onclick = () => { if (confirm('删除「' + item.name + '」？')) { const d = this.data(); d.items = d.items.filter(x => x.id !== item.id); this.save(d); this.render(box); } };
      box.appendChild(del);
    }
    box.querySelector('#dtBack').onclick = () => { if (this._navStack && this._navStack.length) { const prev = this._navStack.pop(); this.renderLevel(prev.list, box, prev.title, prev.parentId); } else { this.render(box); } };
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
  // 上级组详情：日历显示板块活跃的天（任一子项真实打卡=实心、仅休息=part）；不可手动打卡
  detailGroup(item, box) {
    if (!Daily._monthYm) Daily._monthYm = todayStr().slice(0, 7);
    const ym = Daily._monthYm;
    const [yy, mm] = ym.split('-').map(Number);
    const dim = new Date(yy, mm, 0).getDate();
    box.innerHTML = '';
    const top = document.createElement('div'); top.style.marginBottom = '12px'; box.appendChild(top);
    const bar = document.createElement('div');
    bar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:10px';
    bar.innerHTML = `<div style="display:flex;align-items:center;gap:8px;min-width:0">
        <span class="branch-title stk-dt-name" style="margin:0;padding:0;border:none;font-size:17px">${esc(item.name)}</span>
      </div>
      <button class="icon-btn" id="dtBack" title="返回">${icon('back', 18)}</button>`;
    top.appendChild(bar);
    const stat = document.createElement('div'); stat.className = 'stk-stat';
    const _actLeaves = this.activeLeafItems(item.id);
    let _minLeaf = null;
    _actLeaves.forEach(l => { const s = this.curStreak(l); if (!_minLeaf || s < _minLeaf.s) _minLeaf = { name: l.name, s: s }; });
    stat.innerHTML = `连续 <b>${this.curStreak(item)}</b> 天 · 取二级火花里最短的一项${_minLeaf ? '（' + esc(_minLeaf.name) + ' ' + _minLeaf.s + ' 天）' : ''}`;
    box.appendChild(stat);
    const grid = document.createElement('div'); grid.className = 'stk-days'; box.appendChild(grid);
    const leavesAll = this.activeLeafItems(item.id);
    for (let dd = 1; dd <= dim; dd++) {
      const ds = ym + '-' + String(dd).padStart(2, '0');
      const allDone = leavesAll.length > 0 && leavesAll.every(l => this.isDone(l, ds)); // v437：全部在用子项都真实打卡=实心（重叠日）
      const lit = leavesAll.filter(l => this.covered(l, ds)).length;
      const cls = allDone ? 'done' : (lit > 0 ? 'part' : 'gap');
      const lab = allDone ? '' : (lit > 0 ? lit + '/' + leavesAll.length : '');
      const cell = document.createElement('div');
      cell.className = 'stk-day ' + cls;
      cell.innerHTML = `<span class="d">${dd}</span>${lab ? '<span class="mk">' + lab + '</span>' : ''}`;
      cell.onclick = () => toast('上级火花由子项自动点亮，不可手动打卡');
      grid.appendChild(cell);
    }
    // 子项快捷入口
    const ch = this.childrenOf(item.id);
    if (ch.length) {
      const cw = document.createElement('div'); cw.className = 'stk-children'; cw.style.marginTop = '10px';
      const tip = document.createElement('div'); tip.className = 'stk-tip'; tip.textContent = '点下方子项查看各自的续火花'; cw.appendChild(tip);
      ch.forEach(c => { if (c.type === 'group') cw.appendChild(this.renderGroup(c, 0, '#C2A8E0', box)); else cw.appendChild(this.childCard(c, box)); });
      box.appendChild(cw);
    }
    box.querySelector('#dtBack').onclick = () => { if (this._navStack && this._navStack.length) { const prev = this._navStack.pop(); this.renderLevel(prev.list, box, prev.title, prev.parentId); } else { this.render(box); } };
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
    if (item.type === 'group') { toast('上级火花由子项自动点亮，不可手动打卡'); return; }
    if (item.auto) { toast('「' + item.name + '」由每日任务/英语版块打卡自动点亮，不能手动点格子'); return; }
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
      // v368：病假/年度假期格子同样禁止补签（此前会掉进补签分支误发卡）
      if (isSickLeave(ds)) { toast('当日为病假，已是休息，无需补签'); return; }
      if (isAnnualHoliday(ds)) { toast('当日为' + annualHolidayLabel(ds) + '，自动休息，无需补签'); return; }
      if (it.type === 'kg' && typeof isExamDay === 'function' && isExamDay(ds)) { toast('当日为考试日，已自动跳过，无需补签'); return; }
      const covCat = !!(item.rest && item.rest[ds]);
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
        options: [['', '任意（小说/影视/漫画都算）'], ['小说', '小说'], ['影视', '影视'], ['漫画', '漫画']]
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
        : m.k === 'kg' ? ref
        : (m.k === 'sport' || m.k === 'growth') ? ref
        : m.k === 'fun' ? (ref ? '娱乐·' + ref : '娱乐')
        : m.k === 'meals' ? ({ breakfast: '早餐', lunch: '午餐', dinner: '晚餐' }[ref] || '三餐')
        : m.label;
      const id = m.k === 'custom' ? 'custom:' + uid() : m.k + ':' + (ref || 'all');
      if (d.items.some(x => x.id === id)) return toast('「' + name + '」已经在续火花里了');
      const newItem = { id, type: m.k, name, ref, user: 1, makeup: 0, rest: {}, madeup: {}, done: {} };
      const P = { kg: 'group:kg', sport: 'group:sport', work: 'group:work', growth: 'group:growth', read: 'group:growth' };
      if (P[m.k] || this._addParent) newItem.parent = this._addParent || P[m.k];
      d.items.push(newItem);
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
