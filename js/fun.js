/* ============ 娱乐档案（影视 / 小说 / 漫画 / 游戏） ============
   设计原则：在现有枝枝喵上「长」出来的专栏，复用通用卡片/弹窗/图标，不重做界面。
   v191 重构：
   - 娱乐无子分支：侧栏「娱乐」一点开即「全部」页（展示 + 统计 + 近期在看）。
   - 底部固定导航（不抖）：只有「全部」是房子图标、不显示文字；四类（影视/小说/漫画/游戏）各用专属图标 + 文字。
   - 分类精简为 4 类：影视（影视剧/综艺/动漫/电影合并）、小说、漫画、游戏；旧类型自动归一。
   - 封面墙变成「全部」页上方的背景式半露斜放封面带，点击下拉进完整斜放封面墙。
   - 统计弱化：去掉「有没有打分」相关统计。
   - 封面日历变成「全部」里的一个日历图标，呈现所有带封面的记录（不限小说）；单独类型页也有日历（时间轴收入其中），点开看当日。
   - 单独类型页无标题：顶部「打卡 · 类型」+ 日历图标；主体只显示当下一周；小红书检测仅小说页。
   - 时间轴/记录均带标签显示。 */
const FUN_TYPES = ['影视', '小说', '漫画', '游戏'];
const FUN_COLORS = { '影视': '#8FB8E0', '小说': '#B8A4D4', '漫画': '#F4A6B8', '游戏': '#4FB0AE' };
const FUN_ICONS = { '影视': 'film', '小说': 'book', '漫画': 'comic', '游戏': 'game' };
const FUN_SHOW = ['影视', '漫画']; // 时长可自动推断的类型
// 娱乐 → 充电 时间自动同步映射（影视→看剧 / 小说→看小说 / 漫画→看漫画 / 游戏→玩游戏 / 随手记·刷抖音→刷抖音）
const FUN_RECH = {
  '影视': { key: 'drama', name: '看剧', emoji: '📺' },
  '小说': { key: 'novel', name: '看小说', emoji: '📚' },
  '漫画': { key: 'comic', name: '看漫画', emoji: '💬' },
  '游戏': { key: 'game', name: '玩游戏', emoji: '🎮' }
};
function funRechKey(rec) {
  let m = FUN_RECH[rec.type];
  if (!m && (rec.type === '随手记' || rec.type === '娱乐') && (rec.title || '').indexOf('刷抖音') >= 0) m = { key: 'douyin', name: '刷抖音', emoji: '🎵' };
  return m || null;
}
function funRechSync(rec, date) {
  const m = funRechKey(rec); if (!m) return;
  const mins = Number(rec.minutes) || 0; if (!mins) return;
  const recs = S.get('recharge', {});
  const arr = recs[date] || [];
  const cleaned = arr.filter(r => r.src !== rec.id);
  // v230：每 30 分钟 = 1 个电（val 不再恒为 0，否则娱乐充电看不出）
  cleaned.push({ id: uid(), key: m.key, name: m.name, emoji: m.emoji, val: Math.floor((Number(mins) || 0) / 30), mins, where: '', createdAt: Date.now(), src: rec.id });
  recs[date] = cleaned; S.set('recharge', recs);
}
function funRechCleanSrc(date, id) {
  const recs = S.get('recharge', {});
  if (!recs[date]) return;
  const f = recs[date].filter(r => r.src !== id);
  if (f.length) recs[date] = f; else delete recs[date];
  S.set('recharge', recs);
}
const FUN_TAG_HIDDEN = ['赚钱', '爱玩']; // 打卡页列表不显示，仅详情可见
const FUN_TAG_COLOR = { '赚钱': '#F4A6B8', '爱玩': '#8FB8E0' }; // 这些标签上颜色
// 旧类型 → 新 4 类 归一
function funNormType(t) {
  if (!t) return t;
  if (['电视剧', '综艺', '动漫', '电影'].includes(t)) return '影视';
  if (t === '漫话') return '漫画';
  return t;
}
// 游戏图标兜底：无上传图标时用「标题首字 + 标题哈希色」生成不同色块，保证每游戏图标不同
function funColorHash(t) {
  const c = ['#8FB8E0', '#B8A4D4', '#F4A6B8', '#4FB0AE', '#F5C518', '#E8927C', '#7FB88F', '#C9A0DC'];
  let h = 0;
  for (let i = 0; i < (t || '').length; i++) h = (h * 31 + (t.charCodeAt(i) || 0)) >>> 0;
  return c[h % c.length];
}
// 数量单位：小说用「本」、游戏用「款」、其余用「部」
function funUnit(t) { return t === '小说' ? '本' : (t === '游戏' ? '款' : '部'); }
function funVerb(t) { return t === '游戏' ? '玩' : '读'; }
// 环形图（时间占比）
function svgDonut(segs, size, unit) {
  size = size || 120;
  const total = segs.reduce((s, x) => s + x.value, 0);
  const r = size / 2 - 12, c = 2 * Math.PI * r, cx = size / 2, cy = size / 2;
  let off = 0;
  const arcs = segs.filter(s => s.value > 0).map(s => {
    const len = s.value / (total || 1) * c;
    const el = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${s.color}" stroke-width="13" stroke-dasharray="${len.toFixed(2)} ${(c - len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})"></circle>`;
    off += len; return el;
  }).join('');
  const center = `<text x="${cx}" y="${cy - 1}" text-anchor="middle" font-size="20" font-weight="800" fill="#222">${total}</text><text x="${cx}" y="${cy + 15}" text-anchor="middle" font-size="10" fill="#999">${unit || '总计'}</text>`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${arcs}${center}</svg>`;
}
const XHS_LIB = [
  { c: '色情低俗 / 性暗示（高风险）', a: '小红书对性相关描述极敏感，BL/小说观后感最易在此被判定「色情低俗」甚至「提供性幻想/性服务」。务必用剧情、人物、文笔、三观评价代替任何亲密/性相关字眼；隐晦黑话也会被识别，建议通篇避开。', w: ['性爱','做爱','上床','同床','舌吻','深吻','体位','play','开车','肉文','h文','r文','限制级','18禁','abo','双性','调情','涩','擦边','软色情','性幻想','性服务','约吗','约炮','原味','福利姬','本子','双男','男男','黄文'] },
  { c: '违规导流 / 资源分享（高风险）', a: '小说分享常被判定「分享资源/导流侵权」。不要提供或引导获取全文、网盘、未删减版；「指路」「资源」「合集」等词都很危险，改成「个人观后感、不剧透推荐」最安全。', w: ['资源','完整版','未删减','全文','指路','网盘','度盘','夸克','后台','加微信','薇信','vx','二维码','公众号','进群','免费看','合集'] },
  { c: '极限词 / 虚假宣传', a: '广告法禁用绝对化用语，改用「我觉得/个人体验」等客观描述。', w: ['最好','最佳','第一','顶级','绝对','唯一','100%','全网最低','销量第一','国家级','王牌','绝无仅有'] },
  { c: '医疗 / 功效夸大', a: '护肤健康类避免疗效承诺，改用「个人体验」。', w: ['治疗','治愈','消炎','抗菌','美白','祛斑','祛痘','减肥','瘦身','燃脂','丰胸','增高','排毒','抗癌','防辐射'] },
  { c: '诱导互动 / 营销', a: '删掉「点赞收藏关注」「私聊」「抽奖」等引导，避免被判营销号。', w: ['点赞','收藏','关注','转发','私聊','私信我','看全文','抽奖','免费送','秒杀','立即购买','抢购','点击下方','特价','福利'] },
  { c: '违法违规 / 金钱交易', a: '涉及代购、刷单、网贷、赌博等一律别碰，会被限流甚至封号。', w: ['代购','刷单','兼职','返利','网贷','赌博','彩票','博彩'] }
];
const Entertainment = {
  sub: 'fun',
  activeType: '全部',
  _view: 'main',
  _calYmPhoto: null,
  _calYmDot: null,
  _calScope: 'all',
  _savedView: null,
  _root: null,
  logs() { return S.get('funLogs', {}) || {}; },
  save(L) {
    // 归一：任何记录缺 id 或与别的记录 id 撞车，都会让编辑时按 id 找不到原记录，
    // 进而误删数组最后一条（splice(-1,1)）。保存前保证每条都有唯一 id，杜绝该误删触发条件。
    const seen = {};
    for (const d in L) { (L[d] || []).forEach(r => { if (!r) return; if (!r.id || seen[r.id]) r.id = uid(); seen[r.id] = 1; }); }
    S.set('funLogs', L);
  },
  // 启动归一化：把历史数据中所有缺失/重复的 id 一次性修正为全局唯一。
  // 之后按 id 编辑/删除只会命中本条，彻底杜绝“编辑一个误删另一个”。
  normalizeIds() {
    const L = this.logs(); let changed = false; const seen = {};
    for (const d in L) { (L[d] || []).forEach(r => { if (!r) return; if (!r.id || seen[r.id]) { r.id = uid(); changed = true; } seen[r.id] = 1; }); }
    if (changed) this.save(L);
    return changed;
  },
  // 按 (类型, 标题) 去重，保留「最新」那条（date 升序后取末位；createdAt 兜底）。
  // 非 影视/小说/漫画/游戏 的记录（如随手记）保持原样不参与去重。
  dedupLatest(recs) {
    const sorted = recs.slice().sort((a, b) => a.date.localeCompare(b.date) || ((a.createdAt || 0) - (b.createdAt || 0)));
    const map = {};
    sorted.forEach(r => {
      const t = funNormType(r.type);
      const k = (t || '') + '|' + (r.title || '');
      if (!FUN_TYPES.includes(t) || k === '|') { map['_raw_' + uid()] = r; return; }
      map[k] = r;
    });
    return Object.values(map);
  },
  // 一次性合并迁移：同名同类型（影视/小说/漫画/游戏）的多条记录合并为单条。
  // latest-wins（状态/封面/进度等取最新），分钟数累加（保留总阅读/观看时长，与充电一致）。随手记等其它类型原样保留。
  normalizeMerge() {
    const L = this.logs();
    const newL = {}; let changed = false;
    const groups = {};
    for (const d in L) {
      (L[d] || []).forEach(r => {
        if (!r) return;
        const t = funNormType(r.type);
        if (!FUN_TYPES.includes(t)) { (newL[d] = newL[d] || []).push(r); return; }
        const k = t + '|' + (r.title || '');
        if (k === '|') { (newL[d] = newL[d] || []).push(r); return; }
        (groups[k] = groups[k] || []).push({ date: d, rec: r });
      });
    }
    for (const k in groups) {
      const items = groups[k].sort((a, b) => a.date.localeCompare(b.date) || ((a.rec.createdAt || 0) - (b.rec.createdAt || 0)));
      const last = items[items.length - 1];
      let totalMin = 0; items.forEach(it => totalMin += (Number(it.rec.minutes) || 0));
      const merged = Object.assign({}, last.rec, { minutes: totalMin });
      if (!newL[last.date]) newL[last.date] = [];
      newL[last.date].push(merged);
      if (items.length > 1) changed = true;
    }
    if (changed) this.save(newL);
    return changed;
  },
  // v243：小说历史基线归一。同名小说可能存在多条「累计式」旧记录（每条都带当时累计总时长），
  // 后续改为按次累加后会重复计。这里把每组同名小说合并为单条「累计起点」(seed=true)，保留真实总时长，
  // 删掉其余重复快照；若只有一条则仅打上 seed 标记。非小说类型不动。
  normalizeSeed() {
    const L = this.logs(); let changed = false;
    const groups = {};
    for (const d in L) (L[d] || []).forEach(r => {
      if (funNormType(r.type) !== '小说') return;
      const k = '小说|' + (r.title || '');
      if (k === '小说|') return;
      (groups[k] = groups[k] || []).push({ date: d, rec: r });
    });
    const del = [];
    for (const k in groups) {
      const items = groups[k].sort((a, b) => a.date.localeCompare(b.date) || ((a.rec.createdAt || 0) - (b.rec.createdAt || 0)));
      const maxMin = Math.max(0, ...items.map(it => Number(it.rec.minutes) || 0));
      const last = items[items.length - 1];
      if (!last.rec.seed || (Number(last.rec.minutes) || 0) !== maxMin) {
        funRechCleanSrc(last.date, last.rec.id);
        last.rec.seed = true; last.rec.minutes = maxMin;
        funRechSync(last.rec, last.date);
        changed = true;
      }
      items.forEach(it => { if (it !== last) del.push({ date: it.date, id: it.rec.id }); });
      if (items.length > 1) changed = true;
    }
    del.forEach(({ date, id }) => { funRechCleanSrc(date, id); const arr = L[date] || []; const idx = arr.findIndex(x => x.id === id); if (idx >= 0) { arr.splice(idx, 1); if (!arr.length) delete L[date]; } });
    if (changed) this.save(L);
    return changed;
  },
  all() {
    const L = this.logs(); const out = [];
    Object.keys(L).forEach(d => (L[d] || []).forEach(r => out.push(Object.assign({ date: d }, r, { type: funNormType(r.type) }))));
    return out.sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
  },
  typeColor(t) { return FUN_COLORS[t] || '#A8B5C4'; },
  rangeRecs(recs, range) {
    if (range === 'all') return recs;
    if (range === 'week') { const [mon, sun] = this.weekRange(); return recs.filter(r => r.date >= mon && r.date <= sun); }
    if (range === 'month') { const ym = todayStr().slice(0, 7); return recs.filter(r => r.date.indexOf(ym) === 0); }
    return recs;
  },
  render(root) {
    this._root = root;
    if (this._view === 'wall') { this.renderWall(root); return; }
    if (this._view === 'mwall') { this.renderMediaWall(root); return; }
    if (this._view === 'cal') { this.renderCal(root); return; }
    if (this._view === 'timeline') { this.renderTimeline(root); return; }
    if (this._view === 'detail') { this.renderDetail(root); return; }
    if (this.activeType === '全部') this.renderMain(root);
    else this.renderType(root);
  },
  /* ============ 底部固定导航 ============ */
  navHTML(active) {
    const items = ['影视', '小说', '全部', '漫画', '游戏'];
    return `<div class="fun-nav">${items.map(t => {
      if (t === '全部') return `<button class="fun-nav-item fun-nav-home${'全部' === active ? ' on' : ''}" data-type="全部">${icon('home', 20)}</button>`;
      const ic = FUN_ICONS[t];
      return `<button class="fun-nav-item${t === active ? ' on' : ''}" data-type="${esc(t)}">${icon(ic, 20)}</button>`;
    }).join('')}</div>`;
  },
  bindNav(root) {
    root.querySelectorAll('.fun-nav-item').forEach(b => b.onclick = () => {
      const t = b.dataset.type;
      this.activeType = t; this._view = 'main';
      this.render(this._root);
    });
  },
  /* 悬浮打卡加号（固定右下，不随滑动移动） */
  fabHTML() {
    return `<button class="fun-fab" data-fab="1" title="打卡">${icon('plus', 24)}</button>`;
  },
  fabSheet() {
    const showQuick = this.activeType === '全部';
    const panel = document.createElement('div');
    panel.className = 'fun-sheet-mask';
    panel.innerHTML = `<div class="fun-sheet">
      <button class="fun-sheet-btn" data-act="detail">${icon('edit', 18)} 详细打卡</button>
      ${showQuick ? `<button class="fun-sheet-btn" data-act="quick">${icon('clock', 18)} 快速记时长</button>` : ''}
      <button class="fun-sheet-cancel" data-act="cancel">取消</button>
    </div>`;
    document.body.appendChild(panel);
    panel.onclick = (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) { panel.remove(); return; }
      const act = b.dataset.act; panel.remove();
      if (act === 'detail') this.editModal(null, this.activeType || null);
      else if (act === 'quick') this.quickTimeModal();
    };
  },
  quickTimeModal() {
    openModal(`<button class="close-x" onclick="closeModal()">×</button><h3>${icon('clock', 18)} 快速记时长</h3>
      <div class="muted" style="font-size:12px;margin-bottom:8px">只记个时长就行，比如刷抖音、听歌、发呆…</div>
      <div class="form-row"><label>记什么</label><input id="qtTitle" value="刷抖音" placeholder="刷抖音"></div>
      <div class="form-row"><label>多久（分钟）</label><input id="qtMin" type="number" placeholder="30"></div>
      <div class="form-row"><label>日期</label><input id="qtDate" type="date" value="${todayStr()}"></div>
      <button class="btn" id="qtSave" style="width:100%;margin-top:10px">记一笔</button>`);
    document.getElementById('qtSave').onclick = () => {
      const title = document.getElementById('qtTitle').value.trim() || '刷抖音';
      const minutes = Number(document.getElementById('qtMin').value) || 0;
      const date = document.getElementById('qtDate').value || todayStr();
      if (!minutes) { toast('填一下时长哦'); return; }
      const rec = { id: uid(), type: '随手记', title, cover: '', total: '', progress: '', status: '', rating: 0, review: '', minutes, purpose: '', imgs: [], tags: [], icon: '', epMin: '', speed: 1, skip: 0, episodes: '', createdAt: Date.now() };
      const L = this.logs(); if (!L[date]) L[date] = [];
      L[date].push(rec); this.save(L); funRechSync(rec, date);
      closeModal(); this.render(this._root); toast('已记：' + title + ' ' + this.fmtMin(minutes));
    };
  },
  weekDayShort(d) {
    return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][new Date(d + 'T00:00:00').getDay()];
  },
  /* ============ 全部页（封面墙背景 + 统计 + 近期在看 + 日历图标） ============ */
  renderMain(root) {
    this._root = root;
    const recs = this.all();
    const covers = recs.filter(r => r.cover).sort((a, b) => b.date.localeCompare(a.date));
    const body = `
      ${this.bgCoverHTML(covers)}
      <div class="fun-main-scroll">
        ${this.statsHTML(recs)}
        ${this.recentWatchingHTML(recs)}
      </div>
      ${this.fabHTML()}
    `;
    root.innerHTML = `<div class="fun-archive">${body}${this.navHTML('全部')}</div>`;
    this.bindMain(root);
  },
  bindMain(root) {
    this.bindNav(root);
    const hero = root.querySelector('[data-wall]');
    if (hero) hero.onclick = () => this.openWall();
    const cal = root.querySelector('[data-cal]');
    if (cal) cal.onclick = (e) => { e.stopPropagation(); this.openCal('all'); };
    root.querySelectorAll('[data-srange]').forEach(b => b.onclick = () => { this._statRange = b.dataset.srange; this.renderMain(this._root); });
    root.querySelectorAll('[data-sunit]').forEach(b => b.onclick = () => { this._statUnit = b.dataset.sunit; this.renderMain(this._root); });
    root.querySelectorAll('[data-stats]').forEach(b => b.onclick = () => this.statsDetailModal(b.dataset.stats, this.all()));
    root.querySelectorAll('[data-fnentry]').forEach(el => el.onclick = (e) => {
      if (e.target.closest('.ry-tag-more')) return;
      this._detailFromWall = false;
      const entry = this._findEntry(el.dataset.fnentry); if (entry) this.recordDetail(entry);
    });
    root.querySelectorAll('[data-dtcover]').forEach(el => el.onclick = (e) => { e.stopPropagation(); const entry = this._findEntry(el.dataset.dtcover); if (entry) this.openDetail(entry.id); });
    root.querySelectorAll('[data-rytoggle]').forEach(b => b.onclick = (e) => { e.stopPropagation(); const w = b.closest('.ry-tags'); if (w) w.classList.toggle('ry-expanded'); });
    const fab = root.querySelector('[data-fab]');
    if (fab) fab.onclick = () => this.fabSheet();
  },
  statsDetailModal(kind, recs) {
    const rs = this.realRecs(this.rangeRecs(recs, this._statRange || 'all'));
    const list = rs.slice().sort((a, b) => b.date.localeCompare(a.date));
    const rows = list.length ? list.map(r => `<div class="list-row" style="align-items:flex-start;cursor:pointer" data-dayrec="${r.id}">
        ${r.cover ? `<img src="${esc(r.cover)}" style="width:30px;height:42px;object-fit:cover;border-radius:5px;flex-shrink:0">` : ''}
        <div style="flex:1;min-width:0"><b>${esc(r.title || '未命名')}</b>
          <div class="muted" style="font-size:11px;margin-top:2px">${r.date} · ${esc(r.type)} · ${this.fmtMin(r.minutes)}</div>
        </div></div>`).join('') : '<div class="empty">这段时间还没有记录</div>';
    const title = kind === 'hours' ? '累计时长明细（按记录）' : '打卡记录明细';
    openModal(`<button class="close-x" onclick="closeModal()">×</button><h3>${title}</h3><div class="muted" style="font-size:12px;margin-bottom:8px">共 ${list.length} 条 · 用来确认打卡是否成功记录</div><div>${rows}</div>`);
    document.querySelectorAll('#ov [data-dayrec]').forEach(el => el.onclick = () => { const e = this._findEntry(el.dataset.dayrec); if (e) { closeModal(); this.recordDetail(e); } });
  },
  /* 过滤掉「同作品内，进度（状态/进度/总量/时长）与更早一条完全相同的纯元数据重复记录」——
     改标签/改感想这类元数据编辑不应计入打卡次数；保留首条、剔除后续纯重复。 */
  realRecs(recs) {
    const sorted = recs.slice().sort((a, b) => {
      const ka = (a.date || '') + String(a.createdAt || 0).padStart(13, '0');
      const kb = (b.date || '') + String(b.createdAt || 0).padStart(13, '0');
      return ka.localeCompare(kb);
    });
    const lastSig = {};
    const out = [];
    for (const r of sorted) {
      const k = (r.type || '') + '|' + (r.title || '');
      const sig = [r.minutes || 0, r.status || '', r.progress || '', r.total || ''].join('#');
      if (lastSig[k] === sig) continue; // 与更早的同作品记录进度完全一致 → 视为元数据重复，跳过
      lastSig[k] = sig;
      out.push(r);
    }
    return out;
  },
  bgCoverHTML(covers) {
    if (!covers.length) return '<div class="fun-cover-top fun-cover-empty" data-wall="1"></div>';
    const need = 32;
    const sizes = ['c-mid', 'c-tall', 'c-tiny'];
    const grid = [];
    for (let i = 0; i < need; i++) {
      const c = covers[i % covers.length];
      // 用标题 hash + i 保证稳定分配（同一封面每次都落同一格大小，不抖动）
      const k = ((c.title || '').length * 7 + i * 13) % sizes.length;
      const cls = sizes[k];
      grid.push(`<div class="fct-cell ${cls}"><img class="fct-img" src="${esc(c.cover)}" alt=""></div>`);
    }
    return `<div class="fun-cover-top" data-wall="1">
      <div class="fct-wall">${grid.join('')}</div>
      <button class="fun-cover-cal" data-cal="1" title="日历">${icon('calendar', 20)}</button>
    </div>`;
  },
  heroCoverHTML(covers) {
    return `<div class="fun-hero" data-wall="1">
      <div class="fun-hero-tip">${covers.length ? '封面墙 · 点击展开' : '加封面，铺成你的娱乐墙'}</div>
      <button class="fun-cal-fab" data-cal="1" title="封面日历">${icon('calendar', 20)}</button>
    </div>`;
  },
  statsHTML(recs) {
    const range = this._statRange || 'all';
    const rs = this.rangeRecs(recs, range);
    const realRs = this.realRecs(rs); // 记录数只算真实时长/进度记录，剔除改标签/感想等元数据重复
    const byType = {}, minByType = {};
    FUN_TYPES.forEach(t => { byType[t] = 0; minByType[t] = 0; });
    const _works = new Set();
    rs.forEach(r => { if (byType[r.type] !== undefined) { const wk = r.type + '' + r.title; if (!_works.has(wk)) { _works.add(wk); byType[r.type]++; } minByType[r.type] += Number(r.minutes) || 0; } });
    // 充电里直接记的娱乐类（刷抖音/看剧/看小说/看漫画/玩游戏，且非娱乐镜像 src）→ 时长互通计入娱乐统计
    const RECH_ENT = new Set(['drama', 'novel', 'comic', 'game', 'douyin']);
    let rechMinExtra = 0;
    const _rechStore = S.get('recharge', {}) || {};
    const _inR = (d) => {
      if (range === 'all') return true;
      if (range === 'week') { const [mon, sun] = this.weekRange(); return d >= mon && d <= sun; }
      if (range === 'month') { const ym = todayStr().slice(0, 7); return d.indexOf(ym) === 0; }
      return true;
    };
    Object.keys(_rechStore).forEach(d => { if (!_inR(d)) return; (_rechStore[d] || []).forEach(r => { if (RECH_ENT.has((r.key || '').trim()) && !r.src) rechMinExtra += Number(r.mins) || 0; }); });
    const totalMin = rs.reduce((s, r) => s + (Number(r.minutes) || 0), 0) + rechMinExtra;
    const unitMode = this._statUnit || 'count';
    const rangeSeg = [['all', '全部'], ['week', '周'], ['month', '月']].map(([k, l]) =>
      `<button class="seg-btn ${range === k ? 'on' : ''}" data-srange="${k}">${l}</button>`).join('');
    const unitSeg = [['count', '数量'], ['time', '时间']].map(([k, l]) =>
      `<button class="seg-btn ${unitMode === k ? 'on' : ''}" data-sunit="${k}">${l}</button>`).join('');
    const maxT = Math.max(1, ...FUN_TYPES.map(t => byType[t]));
    let typeBody;
    if (unitMode === 'count') {
      typeBody = FUN_TYPES.map(t => `<div class="fun-type-row">
        <span class="fun-type-lab"><span class="en-dot" style="background:${this.typeColor(t)}"></span>${t}</span>
        <div class="en-bar"><span class="en-fill" style="width:${byType[t] / maxT * 100}%;background:${this.typeColor(t)}"></span></div>
        <span class="fun-type-val">${byType[t]} ${funUnit(t)}</span>
      </div>`).join('');
    } else {
      const segs = FUN_TYPES.map(t => ({ color: this.typeColor(t), value: minByType[t], label: t }));
      const legend = FUN_TYPES.map(t => `<span class="fun-donut-leg"><span class="en-dot" style="background:${this.typeColor(t)}"></span>${t} ${(minByType[t] / 60).toFixed(1)}h</span>`).join('');
      typeBody = `<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
        <div style="flex:none">${svgDonut(segs, 120)}</div>
        <div style="flex:1;min-width:140px;display:flex;flex-direction:column;gap:6px">${legend}</div>
      </div>`;
    }
    return `<div class="fun-stats-wrap">
      <div class="card"><h3>娱乐统计</h3>
        <div class="seg" style="margin-bottom:10px">${rangeSeg}</div>
        <div class="stat-combined">
          <div class="sc-half" data-stats="recs" style="cursor:pointer"><div class="sc-val">${realRs.length}</div><div class="sc-lab">记录</div></div>
          <div class="sc-half" data-stats="hours" style="cursor:pointer"><div class="sc-val">${Math.round(totalMin / 60 * 10) / 10}</div><div class="sc-lab">累计小时</div></div>
        </div>
      </div>
      <div class="card"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px"><h3 style="margin:0">各类型</h3><div class="seg sm">${unitSeg}</div></div>
        ${typeBody}
      </div>
    </div>`;
  },
  gameStatsHTML() {
    const games = this.all().filter(r => r.type === '游戏');
    if (!games.length) return `<div class="card"><div class="empty">还没有游戏打卡，去右下角 + 记录第一局~</div></div>`;
    const map = {};
    games.forEach(g => {
      const k = (g.title || '未命名');
      if (!map[k]) map[k] = { title: k, days: new Set(), totalMin: 0, last: '', icon: g.icon || '', rating: 0, playFor: g.playFor || '' };
      const m = map[k];
      m.days.add(g.date); m.totalMin += Number(g.minutes) || 0;
      if (g.date > m.last) m.last = g.date;
      if (!m.icon && g.icon) m.icon = g.icon;
      if ((Number(g.rating) || 0) > 0) m.rating = g.rating;
      if (g.playFor) m.playFor = g.playFor;
    });
    const arr = Object.values(map);
    const playedCount = arr.length;
    const selfCount = arr.filter(g => g.playFor === '自愿').length;
    const contentCount = arr.filter(g => g.playFor === '创作').length;
    const [mon, sun] = this.typeScopeRange();
    const scopeCount = games.filter(g => g.date >= mon && g.date <= sun).length;
    const freq = arr.filter(g => g.days.size >= 3).sort((a, b) => b.days.size - a.days.size);
    const love = arr.slice().sort((a, b) => b.totalMin - a.totalMin).slice(0, 3).filter(g => g.totalMin > 0);
    // 图标以「上传的游戏图标」为准；没有上传就用纯灰底占位，不再用线条图标
    const iconHTML = (g) => g.icon ? `<img src="${esc(g.icon)}" class="fun-game-stat-ic" alt="">` : `<div class="fun-game-stat-ic" style="display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;background:${funColorHash(g.title)}22;color:${funColorHash(g.title)}">${esc((g.title || '?').slice(0, 1))}</div>`;
    const playForBadge = (g) => g.playFor ? `<span class="tag" style="background:${g.playFor === '自愿' ? '#E8F3EB' : '#FFF1E0'};color:#555;border:none;font-size:10px;padding:1px 6px;flex-shrink:0;margin-left:4px">${esc(g.playFor)}</span>` : '';
    const gameRow = (g) => `<div class="fun-game-stat-row">
        ${iconHTML(g)}
        <div class="fun-game-stat-mid"><b>${esc(g.title || '未命名')}</b>
          <div class="muted" style="font-size:11px">${g.rating ? this.starsHTML(g.rating) + ' · ' : ''}${g.days.size} 天打卡 · ${(g.totalMin / 60).toFixed(1)}h</div>
        </div>
        ${playForBadge(g)}
      </div>`;
    return `<div class="fun-stats-wrap">
      <div class="card"><h3>游戏统计</h3>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:4px;text-align:center">
          <div><div class="stat-num">${playedCount}</div><div class="stat-lab">玩过(款)</div></div>
          <div><div class="stat-num">${selfCount}</div><div class="stat-lab">自愿</div></div>
          <div><div class="stat-num">${contentCount}</div><div class="stat-lab">创作</div></div>
          <div><div class="stat-num">${scopeCount}</div><div class="stat-lab">${this.typeScopeLab()}打卡</div></div>
        </div>
      </div>
      ${freq.length ? `<div class="card"><h3>常玩</h3>${freq.map(gameRow).join('')}</div>` : ''}
      ${love.length ? `<div class="card"><h3>爱玩</h3>${love.map(gameRow).join('')}</div>` : ''}
    </div>`;
  },
  recentWatchingHTML(recs) {
    // 游戏不像小说能「看完」，设定只呈现最近一周内的记录，避免一直挂在这
    const cut = (() => { const d = new Date(todayStr() + 'T00:00:00'); d.setDate(d.getDate() - 7); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })();
    // 每个作品取「最新一条」记录判定状态：最新状态为已看完/已读完的，不再出现在「近期在看/在玩」
    const DONE = new Set(['看完', '已读完']);
    const latest = {};
    recs.forEach(r => { const k = r.type + '|' + (r.title || ''); if (!latest[k] || r.date > latest[k].date) latest[k] = r; });
    const ws = Object.values(latest).filter(r => {
      if (this.isDouyinRec(r)) return false;   // 刷抖音不进「近期在看/在玩」
      if (r.type === '游戏') return r.date >= cut;
      return !DONE.has(r.status);   // 最新记录未标记看完 → 视为在追
    }).sort((a, b) => b.date.localeCompare(a.date));
    if (ws.length > 5) ws.length = 5;
    if (!ws.length) return '';
    return `<div class="card"><h3>近期在看 / 在玩</h3>${ws.map(l => this.entryRowHTML(l, true)).join('')}</div>`;
  },
  /* ============ 类型页（无标题 · 打卡 · 本周数据 · 年时间轴 · 小红书仅小说） ============ */
  typeScopeRange() {
    const scope = this._typeScope || 'week';
    if (scope === 'month') { const ym = todayStr().slice(0, 7); const dim = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0).getDate(); return [ym + '-01', ym + '-' + String(dim).padStart(2, '0')]; }
    if (scope === 'year') { const y = todayStr().slice(0, 4); return [y + '-01-01', y + '-12-31']; }
    return this.weekRangeOff(this._typeWeekOff || 0);
  },
  typeScopeLabel() {
    const scope = this._typeScope || 'week';
    if (scope === 'month') { const ym = todayStr().slice(0, 7); return Number(ym.slice(0, 4)) + '年' + Number(ym.slice(5, 7)) + '月'; }
    if (scope === 'year') return todayStr().slice(0, 4) + '年';
    const [mon, sun] = this.weekRangeOff(this._typeWeekOff || 0);
    return mon.slice(5) + ' ~ ' + sun.slice(5);
  },
  typeScopeLab() { return { week: '本周', month: '本月', year: '本年' }[this._typeScope || 'week']; },
  typeScopeSegHTML() {
    // 影视/小说/漫画/游戏页只保留「周」视图：月/年聚合已收进「年时间轴」，类型页不再显示周/月/年切换段
    return '';
  },
  /* ============ 小说主页（阅读统计风格，参考小红书阅读报告） ============ */
  novelCoverHTML(e, t) {
    const cover = e.cover ? `<img src="${esc(e.cover)}" alt="" class="novel-recent-thumb">` : `<div class="novel-recent-thumb novel-recent-ph"></div>`;
    return `<div class="novel-recent-cell" data-dtcover="${e.id}">${cover}<div class="novel-recent-name">${esc(e.title || '未命名')}</div></div>`;
  },
  novelHeatmapHTML(months, type) {
    const allType = this.all().filter(r => r.type === (type || '小说'));
    const dayMin = {};
    allType.forEach(r => { dayMin[r.date] = (dayMin[r.date] || 0) + (Number(r.minutes) || 0); });
    const maxMin = Math.max(1, ...Object.values(dayMin));
    const WD = ['一', '二', '三', '四', '五', '六', '日'];
    const cols = months.map(ym => {
      const [y, m] = ym.split('-').map(Number);
      const dim = new Date(y, m, 0).getDate();
      const startDow = new Date(y, m - 1, 1).getDay();
      const lead = (startDow + 6) % 7;   // 周一为第一列
      const cells = [];
      for (let i = 0; i < lead; i++) cells.push(`<div class="n3-hm-c empty"></div>`);
      for (let d = 1; d <= dim; d++) {
        const date = `${ym}-${String(d).padStart(2, '0')}`;
        const mm = dayMin[date] || 0;
        const lvl = mm === 0 ? 0 : Math.min(4, Math.ceil((mm / maxMin) * 4));
        cells.push(`<div class="n3-hm-c lvl-${lvl}" title="${mm ? date + ' · ' + Math.round(mm) + ' 分钟' : date}"></div>`);
      }
      return `<div class="n3-month"><div class="n3-m-head">${m}月</div><div class="n3-days">${cells.join('')}</div></div>`;
    }).join('');
    return `<div class="n3-heatmap">${cols}</div>`;
  },
  // 足迹：以 ym 为最右月，取连续三个月
  threeMonthsEnding(ym) {
    let [y, m] = ym.split('-').map(Number);
    const out = [];
    for (let k = 2; k >= 0; k--) {
      let mm = m - k, yy = y;
      while (mm < 1) { mm += 12; yy--; }
      out.push(yy + '-' + String(mm).padStart(2, '0'));
    }
    return out;
  },
  // 月份加减（用于 12 个月足迹面板）
  shiftMonths(ym, delta) {
    let [y, m] = ym.split('-').map(Number);
    m += delta;
    while (m > 12) { m -= 12; y++; }
    while (m < 1) { m += 12; y--; }
    return y + '-' + String(m).padStart(2, '0');
  },
  longestStreakAll(type) {
    const days = this.all().filter(r => r.type === (type || '小说') && (Number(r.minutes) || 0) > 0).map(r => r.date).sort();
    if (!days.length) return 0;
    let max = 1, cur = 1;
    for (let i = 1; i < days.length; i++) {
      cur = (daysBetween(days[i - 1], days[i]) === 1) ? cur + 1 : 1;
      if (cur > max) max = cur;
    }
    return max;
  },
  longestStreakMonth(type, ym) {
    const days = this.all().filter(r => r.type === (type || '小说') && r.date.slice(0, 7) === ym && (Number(r.minutes) || 0) > 0).map(r => r.date).sort();
    if (!days.length) return 0;
    let max = 1, cur = 1;
    for (let i = 1; i < days.length; i++) {
      cur = (daysBetween(days[i - 1], days[i]) === 1) ? cur + 1 : 1;
      if (cur > max) max = cur;
    }
    return max;
  },
  // 本月「读了 X 本」= 本月出现过的不重复书名数量（与时间轴、最近陪伴统一口径）
  novelMonthBookCount(ym) {
    return new Set(this.all().filter(r => r.type === '小说' && r.date.slice(0, 7) === ym).map(r => r.title)).size;
  },
  novelInsightHTML(all, t) {
    if (!all.length) return '';
    const isBook = t === '小说';
    const verb = isBook ? '读' : '看';
    const unit = isBook ? '本' : '部';
    const ym = todayStr().slice(0, 7);
    const monthEs = all.filter(r => r.date.slice(0, 7) === ym);
    const monthBooks = new Set(monthEs.map(r => r.title)).size;
    const monthFin = new Set(monthEs.filter(r => r.status === '已读完' || r.status === '看完').map(r => r.title)).size;
    const tags = {};
    all.forEach(r => (r.tags || []).forEach(t2 => { if (!FUN_TAG_HIDDEN.includes(t2)) tags[t2] = (tags[t2] || 0) + 1; }));
    const topTag = Object.entries(tags).sort((a, b) => b[1] - a[1])[0];
    if (monthEs.length === 0) return `本月还没有新的${verb}${unit}记录，去开启一段新旅程吧。`;
    if (monthBooks > 0) return `这个月你${verb}了 <b>${monthBooks}</b> ${unit}${monthFin ? `，其中 <b>${monthFin}</b> ${unit}${isBook ? '读完' : '看完'}` : ''}。`;
    if (topTag && topTag[1] >= 3) return `你最近偏爱「<b>${esc(topTag[0])}</b>」类作品，已经标记了 <b>${topTag[1]}</b> 次。`;
    const totalH = (all.reduce((s, r) => s + (Number(r.minutes) || 0), 0) / 60).toFixed(0);
    if (Number(totalH) > 0) return `累计${verb}${unit} <b>${totalH}</b> 小时，每一段时光都在陪伴你。`;
    return `坚持记录，是给${verb}${unit}最好的礼物。`;
  },
  /* ============ 媒体主页（小说/影视/漫画 通用 · 阅读报告风格） ============ */
  renderMediaHome(root) {
    this._root = root;
    const t = this.activeType;
    const isBook = t === '小说';
    const unit = isBook ? '本' : '部';
    const verb = isBook ? '读' : '看';
    const actWord = isBook ? '阅读' : '观看';
    const doneWord = isBook ? '读完' : '看完';
    const all = this.all().filter(r => r.type === t);
    const ym = this._mediaYm || todayStr().slice(0, 7);
    const monthEs = all.filter(r => r.date.slice(0, 7) === ym);
    const monthDays = new Set(monthEs.map(r => r.date)).size;

    // 1) 最近陪伴
    const byTitle = {};
    all.forEach(r => { if (!byTitle[r.title] || r.date > byTitle[r.title].date) byTitle[r.title] = r; });
    const recently = Object.values(byTitle).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
    const monthTitles = new Set(monthEs.map(r => r.title));
    const monthHours = (monthEs.reduce((s, r) => s + (Number(r.minutes) || 0), 0) / 60).toFixed(1);

    // 2) 本月主X：本月时长最长
    let mainEntry = null, mainMin = 0, mainCount = 0;
    if (monthEs.length) {
      const byT = {};
      monthEs.forEach(r => {
        const k = r.title || '未命名';
        if (!byT[k]) byT[k] = { min: 0, latest: r };
        byT[k].min += Number(r.minutes) || 0;
        if (r.date > byT[k].latest.date) byT[k].latest = r;
      });
      const sorted = Object.entries(byT).sort((a, b) => b[1].min - a[1].min);
      mainEntry = sorted[0][1].latest;
      mainMin = sorted[0][1].min;
      mainCount = monthEs.filter(r => r.title === mainEntry.title).length;
    }
    const mainHours = (mainMin / 60).toFixed(1);

    // 3) 足迹（季度分组 123/456/789/101112；呈现连续 3 个月，左右滑动按季度切换）
    const footYm = this._footYm || todayStr().slice(0, 7);
    const footMonths = this.threeMonthsEnding(footYm);
    const windowDays = new Set(all.filter(r => footMonths.includes(r.date.slice(0, 7))).map(r => r.date)).size;
    const heatmapHTML = this.novelHeatmapHTML(footMonths, t);
    // 当月口径（始终显示「本月」）：本月读了几天 + 本月最长连续几天
    const curYm = todayStr().slice(0, 7);
    const curMonthDays = new Set(all.filter(r => r.date.slice(0, 7) === curYm).map(r => r.date)).size;
    const curMonthStreak = this.longestStreakMonth(t, curYm);

    // 4) 一条洞察
    const insight = this.novelInsightHTML(all, t);

    // 5) 档案（本年：当前自然年，避免与上方月度洞察信息重合）
    const yYear = todayStr().slice(0, 4);
    const yearEs = all.filter(r => r.date.slice(0, 4) === yYear);
    const totalMin = yearEs.reduce((s, r) => s + (Number(r.minutes) || 0), 0);
    const totalDays = new Set(yearEs.map(r => r.date)).size;
    const finishedBooks = new Set(yearEs.filter(r => r.status === '已读完' || r.status === '看完').map(r => r.title)).size;

    const recentSection = `<div class="card novel-card">
      <div class="novel-card-head">
        <span class="novel-head-l">最近陪伴你的${isBook ? '书' : (t === '影视' ? '剧' : '漫')}</span>
        <a class="novel-head-r" data-novel-all="1">全部 ›</a>
      </div>
      <div class="novel-recent-row">${recently.length ? recently.map(e => this.novelCoverHTML(e, t)).join('') : '<div class="empty">还没有' + (isBook ? '读过书' : (t === '影视' ? '看剧' : '看漫画')) + '</div>'}</div>
      <div class="novel-card-sub">这个月，你${verb}了 ${monthTitles.size} ${unit} · 共${actWord} ${monthHours} 小时</div>
    </div>`;

    const mainSection = mainEntry ? `<div class="card novel-card novel-main-card">
      <div class="novel-card-head">
        <span class="novel-head-l">本月主${isBook ? '故事' : (t === '影视' ? '剧' : '漫')}</span>
      </div>
      <div class="novel-main-body">
        <div class="novel-main-cover" data-dtcover="${mainEntry.id}">
          ${mainEntry.cover ? `<img src="${esc(mainEntry.cover)}" alt="">` : `<div class="novel-cover-ph-lg"></div>`}
        </div>
        <div class="novel-main-info">
          <div class="novel-main-pre">本月，陪伴你最久的是</div>
          <div class="novel-main-title">《${esc(mainEntry.title)}》</div>
          <div class="novel-main-desc">${mainEntry.review ? esc(mainEntry.review.slice(0, 50)) + (mainEntry.review.length > 50 ? '…' : '') : '你在它的字里行间，走过一段旅程。'}</div>
          <div class="novel-main-stats">
            <div><span class="novel-stat-num">${mainHours}<small>h</small></span><span class="novel-stat-lab">${actWord}时长</span></div>
            <div><span class="novel-stat-num">${mainCount}<small>次</small></span><span class="novel-stat-lab">${verb}次数</span></div>
            <div><span class="novel-stat-num">${esc(mainEntry.date.slice(5))}</span><span class="novel-stat-lab">上次${verb}</span></div>
          </div>
        </div>
      </div>
    </div>` : '';

    const heatmapSection = `<div class="card novel-card" id="nheatmapCard">
      <div class="novel-card-head">
        <span class="novel-head-l">${actWord}足迹</span>
      </div>
      <div class="novel-heatmap-body" id="nheatBody">${heatmapHTML}</div>
      <div class="novel-heatmap-foot">
        <div class="novel-heatmap-sum"><div>${Number(curYm.slice(5))}月${verb}了 ${curMonthDays} 天</div><div>最长连续 ${curMonthStreak} 天</div></div>
      </div>
    </div>`;

    const insightSection = insight ? `<div class="card novel-card novel-insight-card">
      <div class="novel-card-head">
        <span class="novel-head-l">一条洞察</span>
      </div>
      <div class="novel-insight-body">${insight}</div>
    </div>` : '';

    const archiveSection = `<div class="card novel-card">
      <div class="novel-card-head">
        <span class="novel-head-l">${yYear} ${actWord}档案</span>
      </div>
      <div class="novel-archive-grid">
        <div><div class="novel-arc-num">${(totalMin / 60).toFixed(0)}<small>h</small></div><div class="novel-arc-lab">累计${actWord}时长</div></div>
        <div><div class="novel-arc-num">${totalDays}</div><div class="novel-arc-lab">累计${verb}天数</div></div>
        <div><div class="novel-arc-num">${finishedBooks}</div><div class="novel-arc-lab">累计${doneWord}作品</div></div>
      </div>
    </div>`;

    const xhsFab = isBook ? this.xhsFabHTML() : '';

    root.innerHTML = `<div class="fun-archive novel-home">
      <div class="fun-subbar">
        <span>${esc(t)}</span>
        <div class="fun-subbar-right">
          <button class="icon-btn" data-tl="1" title="年时间轴">${icon('calendar', 18)}</button>
        </div>
      </div>
      ${all.length ? '' : '<div class="empty">还没有' + esc(t) + '记录，去右下角 + 记第一' + unit + '~</div>'}
      ${all.length ? recentSection : ''}
      ${mainSection}
      ${all.length ? heatmapSection : ''}
      ${insightSection}
      ${all.length ? archiveSection : ''}
      ${xhsFab}
      ${this.fabHTML()}
      ${this.navHTML(t)}
    </div>`;
    this.bindType(root);
  },
  /* ============ 类型页：小说→新设计；其他（影视/漫画/游戏）→恢复 v234 之前的"统计+周时间轴" ============ */
  renderType(root) {
    this._root = root;
    const t = this.activeType;
    if (['小说', '影视', '漫画'].includes(t)) return this.renderMediaHome(root);
    if (this._typeScope && this._typeScope !== 'week') this._typeScope = 'week';
    const off = this._typeWeekOff || 0;
    const [mon, sun] = this.typeScopeRange();
    const es = this.all().filter(r => r.type === t && r.date >= mon && r.date <= sun);
    const wkCount = es.length;
    const wkMin = es.reduce((s, r) => s + (Number(r.minutes) || 0), 0);
    const wkFin = es.filter(r => r.status === '看完').length;
    const scopeLab = this.typeScopeLab();
    const isGame = t === '游戏';
    const dateHead = `<div class="fun-date-head">
        <button class="fun-wk-arrow" data-wkprev ${off <= -104 ? 'disabled' : ''}>‹</button>
        <span class="fun-week-range">${this.typeScopeLabel()}</span>
        <button class="fun-wk-arrow" data-wknext ${off >= 0 ? 'disabled' : ''}>›</button>
        <button class="icon-btn" data-tl="1" title="年时间轴">${icon('calendar', 20)}</button>
      </div>`;
    if (isGame) {
      const body = `${this.gameStatsHTML()}${dateHead}${this.weekHTML(t, off)}${this.fabHTML()}`;
      root.innerHTML = `<div class="fun-archive">${body}${this.navHTML(t)}</div>`;
      this.bindType(root);
      return;
    }
    const statCells = [
      `<div><b>${wkCount}</b><span>${scopeLab}记录</span></div>`,
      `<div><b>${Math.round(wkMin / 60 * 10) / 10}h</b><span>时长</span></div>`,
      `<div><b>${wkFin}</b><span>看完</span></div>`
    ];
    const body = `<div class="fun-week-stats">${statCells.join('')}</div>${dateHead}${this.weekHTML(t, off)}${this.fabHTML()}`;
    root.innerHTML = `<div class="fun-archive">${body}${this.navHTML(t)}</div>`;
    this.bindType(root);
  },
  bindType(root) {
    this.bindNav(root);
    root.querySelectorAll('[data-tscope]').forEach(b => b.onclick = () => { this._typeScope = b.dataset.tscope; this.renderType(this._root); });
    const tl = root.querySelector('[data-tl]');
    if (tl) tl.onclick = () => this.openTimeline(this.activeType);
    const wp = root.querySelector('[data-wkprev]');
    if (wp) wp.onclick = () => { this._typeWeekOff = (this._typeWeekOff || 0) - 1; this.renderType(this._root); };
    const wn = root.querySelector('[data-wknext]');
    if (wn) wn.onclick = () => { this._typeWeekOff = (this._typeWeekOff || 0) + 1; this.renderType(this._root); };
    const fab = root.querySelector('[data-fab]');
    if (fab) fab.onclick = () => this.editModal(null, this.activeType);
    root.querySelectorAll('[data-fnentry]').forEach(el => el.onclick = (e) => {
      if (e.target.closest('.ry-tag-more')) return;
      this._detailFromWall = false;
      const entry = this._findEntry(el.dataset.fnentry); if (entry) this.recordDetail(entry);
    });
    root.querySelectorAll('[data-dtcover]').forEach(el => el.onclick = (e) => { e.stopPropagation(); const entry = this._findEntry(el.dataset.dtcover); if (entry) this.openDetail(entry.id); });
    const xb = root.querySelector('[data-xhs]');
    if (xb) xb.onclick = () => this.xhsModal();
    const allLink = root.querySelector('[data-novel-all]');
    if (allLink) allLink.onclick = () => this.openMediaWall(this.activeType);
    // 足迹：连续 3 个月窗口，左右滑动按「季度」(±3 月) 切换（无药丸，纯滑动导航）
    const fnShift = (delta) => { Entertainment._footYm = Entertainment.shiftMonths(Entertainment._footYm || todayStr().slice(0, 7), delta); Entertainment.renderMediaHome(Entertainment._root); };
    const hb = root.querySelector('#nheatBody');
    if (hb) {
      let sx = 0;
      hb.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
      hb.addEventListener('touchend', e => {
        const dx = e.changedTouches[0].clientX - sx;
        if (Math.abs(dx) < 45) return;
        fnShift(dx < 0 ? 3 : -3);
      }, { passive: true });
    }
  },
  weekRange() {
    const t = new Date(todayStr() + 'T00:00:00');
    const dow = (t.getDay() + 6) % 7;
    const mon = new Date(t); mon.setDate(t.getDate() - dow);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    const fmt = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    return [fmt(mon), fmt(sun)];
  },
  weekRangeOff(off) {
    off = off || 0;
    const t = new Date(todayStr() + 'T00:00:00');
    const dow = (t.getDay() + 6) % 7;
    const cur = new Date(t); cur.setDate(t.getDate() - dow + off * 7);
    const end = new Date(cur); end.setDate(cur.getDate() + 6);
    const fmt = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    return [fmt(cur), fmt(end)];
  },
  weekDayLabel(d) {
    const wd = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][new Date(d + 'T00:00:00').getDay()];
    return wd + ' ' + Number(d.slice(5, 7)) + '.' + Number(d.slice(8, 10));
  },
  weekHTML(type, off) {
    const [mon, sun] = this.weekRangeOff(off || 0);
    const es = this.dedupLatest(this.all().filter(r => r.type === type && r.date >= mon && r.date <= sun)).sort((a, b) => a.date.localeCompare(b.date));
    if (!es.length) return `<div class="empty">本周还没有${esc(type)}记录，点右下角「+」记一笔~</div>`;
    const days = {}; es.forEach(r => { (days[r.date] = days[r.date] || []).push(r); });
    const order = Object.keys(days).sort();
    return `<div class="fun-axis">${order.map(d => `<div class="fun-axis-item">
      <div class="fun-axis-left">${this.weekDayShort(d)}</div>
      <div class="fun-axis-mid"><div class="fun-axis-dot"></div></div>
      <div class="fun-axis-right">
        <div class="fun-axis-date">${d.slice(5)}</div>
        ${days[d].map(l => this.entryRowHTML(l, false, true)).join('')}
      </div>
    </div>`).join('')}</div>`;
  },
  /* ============ 记录行（带标签） ============ */
  fmtMin(m) { m = Number(m) || 0; if (!m) return ''; return m >= 60 ? (Math.round(m / 60 * 10) / 10) + ' 小时' : m + ' 分钟'; },
  // 半星渲染（支持 0 / 0.5 / 1 ... 5），与阅读打分统一底层逻辑
  starsHTML(v) {
    v = Number(v) || 0;
    if (!v) return '';
    let s = '';
    for (let i = 1; i <= 5; i++) {
      const pct = v >= i ? 100 : (v >= i - 0.5 ? 50 : 0);
      s += `<span style="position:relative;display:inline-block;width:0.8em;margin:0 -0.04em;color:#e0e0e0">★<span style="position:absolute;left:0;top:0;overflow:hidden;white-space:nowrap;color:#F5C518;width:${pct}%">★</span></span>`;
    }
    return s;
  },
  entryRowHTML(l, showType, hideDate) {
    const tags = (l.tags || []).filter(t => !FUN_TAG_HIDDEN.includes(t));
    const tagHTML = tags.length ? `<div class="rd-tl-tags">
      ${tags.slice(0, 4).map(t => `<span class="tag" style="background:#eee;color:#444;border:none;font-size:10px;padding:1px 6px">${esc(t)}</span>`).join('')}
    </div>` : '';
    const typeTag = showType ? `<span class="tag" style="background:${this.typeColor(l.type)};color:#fff;border:none;font-size:10px;padding:1px 6px;margin-left:2px">${esc(l.type)}</span>` : '';
    const isFinished = l.status === '看完' || l.status === '已读完';
    const isNovel = l.type === '小说';
    const timeTxt = this.fmtMin(l.minutes);
    const showStars = (Number(l.rating) || 0) > 0;
    const starHTML = showStars ? `<span class="rd-stars">${this.starsHTML(l.rating)}</span>` : '';
    const thumb = (l.type === '游戏')
      ? (l.icon ? `<img data-dtcover="${l.id}" src="${esc(l.icon)}" style="width:30px;height:42px;object-fit:cover;border-radius:5px;flex-shrink:0">` : `<div data-dtcover="${l.id}" class="fun-game-ic" style="width:30px;height:42px;background:${funColorHash(l.title)}22;color:${funColorHash(l.title)};font-weight:700;font-size:14px">${esc((l.title || '?').slice(0, 1))}</div>`)
      : (l.cover ? `<img data-dtcover="${l.id}" src="${esc(l.cover)}" style="width:30px;height:42px;object-fit:cover;border-radius:5px;flex-shrink:0">` : `<div data-dtcover="${l.id}" class="fun-game-ic" style="width:30px;height:42px"></div>`);
    // 第二行 = 评星 + 解释词（状态 · 日期 · 时长 · 进度），解释词小且淡
    const cap = [];
    if (isFinished) cap.push(isNovel ? '已读完' : '已看完');
    else if (l.status) cap.push(esc(l.status));
    if (!hideDate && l.date) cap.push(l.date.slice(5));
    if (timeTxt) cap.push(timeTxt);
    if (l.progress && !isFinished) cap.push('看到 ' + esc(l.progress));
    const capHTML = cap.length ? `<span class="rd-cap">${cap.join(' · ')}</span>` : '';
    return `<div class="list-row" style="align-items:flex-start" data-fnentry="${l.id}">
      ${thumb}
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:6px"><b>${esc(l.title || '未命名')}</b>${typeTag}</div>
        <div class="rd-line2">${starHTML}${capHTML}</div>
        ${tagHTML}
      </div></div>`;
  },
  recordDetail(entry) {
    const statusTxt = entry.status === '看完' ? '已看完' : (entry.status === '想看' ? '想看' : (entry.progress ? '在看 · 看到 ' + entry.progress : '在看'));
    const tags = entry.tags || [];
    openModal(`<button class="close-x" onclick="closeModal()">×</button>
      <div style="display:flex;gap:12px;align-items:flex-start">
        ${(entry.type === '游戏' && entry.icon) ? `<img src="${esc(entry.icon)}" style="width:64px;height:90px;object-fit:cover;border-radius:8px;flex-shrink:0">` : (entry.type === '游戏' || !entry.cover) ? `<div class="fun-game-ic" style="width:64px;height:90px;border-radius:8px;background:${funColorHash(entry.title)}22;color:${funColorHash(entry.title)};font-weight:700;font-size:30px">${esc((entry.title || '?').slice(0, 1))}</div>` : `<img src="${esc(entry.cover)}" style="width:64px;height:90px;object-fit:cover;border-radius:8px;flex-shrink:0">`}
        <div style="flex:1;min-width:0"><h3 style="margin:0">${esc(entry.title || '未命名')}</h3>
          <div style="display:flex;gap:6px;align-items:center;margin-top:6px;flex-wrap:wrap">
            <span class="tag" style="background:${this.typeColor(entry.type)};color:#fff;border:none;font-size:11px;padding:1px 8px">${esc(entry.type)}</span>
            ${tags.map(t => `<span class="tag" style="${FUN_TAG_HIDDEN.includes(t) && FUN_TAG_COLOR[t] ? 'background:' + FUN_TAG_COLOR[t] + ';color:#fff' : 'background:#eee;color:#444'};border:none;font-size:11px;padding:1px 7px">${esc(t)}</span>`).join('')}
          </div>
          <div class="muted" style="margin-top:6px;font-size:12px">${statusTxt} · ${entry.date}</div>
          ${entry.type !== '游戏' && entry.rating ? `<div style="margin-top:4px;font-size:14px">${this.starsHTML(entry.rating)}</div>` : ''}
          ${entry.type === '游戏' && entry.rating ? `<div style="margin-top:4px;font-size:14px">${this.starsHTML(entry.rating)}</div>` : ''}
          ${entry.minutes ? `<div class="muted" style="font-size:12px;margin-top:2px">耗时约 ${Math.round(entry.minutes / 60 * 10) / 10} 小时</div>` : ''}
        </div>
      </div>
      ${entry.review ? `<div style="margin-top:12px"><div class="muted" style="font-size:11px;margin-bottom:4px">观后感</div><div style="white-space:pre-wrap;font-size:13px">${esc(entry.review)}</div></div>` : ''}
      <div style="margin-top:14px;display:flex;gap:8px;justify-content:flex-end">
        <button class="btn ghost" onclick="window.Entertainment.editModal('${encodeURIComponent(JSON.stringify({ date: entry.date, id: entry.id }))}')">编辑</button>
        <button class="btn" onclick="window.Entertainment.del('${encodeURIComponent(JSON.stringify({ date: entry.date, id: entry.id }))}')">删除</button>
      </div>`);
  },
  _findEntry(id) {
    const L = this.logs();
    for (const d in L) { const f = (L[d] || []).find(r => r.id === id); if (f) return Object.assign({}, f, { date: d }); }
    return null;
  },
  /* ============ 完整封面墙（斜放网格） ============ */
  openWall() { this._savedView = { activeType: this.activeType, _view: this._view }; this._view = 'wall'; this.render(this._root); },
  openMediaWall(t) { this._savedView = { activeType: this.activeType, _view: this._view }; this._wallType = t; this._view = 'mwall'; this.render(this._root); },
  renderWall(root) {
    this._root = root;
    const covers = this.dedupLatest(this.all().filter(r => r.cover)).sort((a, b) => b.date.localeCompare(a.date));
    const sizes = ['c-mid', 'c-tall', 'c-tiny'];
    const grid = covers.length ? covers.map((r, i) => {
      const k = ((r.title || '').length * 7 + i * 13) % sizes.length;
      return `<div class="fct-cell ${sizes[k]}" data-wallrec="${encodeURIComponent(JSON.stringify({ date: r.date, id: r.id }))}"><img class="fct-img" src="${esc(r.cover)}" alt=""></div>`;
    }).join('') : '<div class="empty">还没有带封面的记录</div>';
    root.innerHTML = `<div class="fun-wall-page">
      <div class="fun-wall-count">封面墙 · ${covers.length}</div>
      <button class="fun-wall-back" data-back="1" title="返回">${icon('chevronLeft', 22)}</button>
      <div class="fun-wall-slant">${grid}</div>
      ${this.navHTML('全部')}
    </div>`;
    this.bindSub(root);
  },
  /* ============ 小说专属封面墙（两排 · 仅小说封面 · 按日期倒序，排序参考娱乐统计封面墙） ============ */
  /* ============ 媒体封面墙（悬浮标题+返回，封面从顶开始；小说/影视/漫画共用） ============ */
  renderMediaWall(root) {
    this._root = root;
    const t = this._wallType || this.activeType || '小说';
    const covers = this.dedupLatest(this.all().filter(r => r.type === t && r.cover)).sort((a, b) => b.date.localeCompare(a.date));
    const grid = covers.length
      ? covers.map(r => `<div class="nwall-cell" data-dtcover="${r.id}"><img class="nwall-img" src="${esc(r.cover)}" alt=""><div class="nwall-cap">${esc(r.title || '未命名')}</div></div>`).join('')
      : '<div class="empty">还没有' + esc(t) + '封面，去记一本带封面的吧~</div>';
    root.innerHTML = `<div class="fun-sub nwall-page">
      <div class="nwall-overlay">
        <span class="nwall-title">${esc(t)}封面墙</span>
        <button class="icon-btn fun-back nwall-back" data-back="1" title="返回">${icon('chevronLeft', 20)}</button>
      </div>
      <div class="nwall-grid">${grid}</div>
      ${this.navHTML(t)}
    </div>`;
    this.bindSub(root);
  },
  /* ============ 时间轴（单类型：年/月聚合 OR 周聚合，可切换；月份标签与周视图对齐到左列） ============ */
  openTimeline(scope) { this._savedView = { activeType: this.activeType, _view: this._view }; this._tlScope = scope; this._view = 'timeline'; this.render(this._root); },
  renderTimeline(root) {
    this._root = root;
    const t = this._tlScope || this.activeType;
    const allEs = this.all().filter(r => r.type === t).sort((a, b) => a.date.localeCompare(b.date));
    const monthNames = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];
    const unit = funUnit(t);
    const view = this._tlView || 'year';
    let yearDrop = '';
    if (view === 'year') {
      const years = [...new Set(allEs.map(r => r.date.slice(0, 4)))];
      const thisYear = todayStr().slice(0, 4);
      if (!years.includes(thisYear)) years.push(thisYear);
      years.sort();
      if (!this._tlYear || !years.includes(this._tlYear)) this._tlYear = years[years.length - 1];
      const opts = years.map(yy => `<div class="tl-year-opt${yy === this._tlYear ? ' on' : ''}" data-year="${yy}">${yy}</div>`).join('');
      yearDrop = `<div class="fun-tl-yeardrop" id="tlYearDrop" style="display:none">${opts}</div>`;
    }
    let body;
    if (view === 'year') {
      const y = this._tlYear;
      const es = this.dedupLatest(allEs.filter(r => r.date.slice(0, 4) === y));
      if (!es.length) {
        body = `<div class="empty">${y} 年还没有「${esc(t)}」记录，去打卡第一笔~</div>`;
      } else {
        const byMonth = {};
        es.forEach(r => { const m = r.date.slice(0, 7); (byMonth[m] = byMonth[m] || []).push(r); });
        const months = Object.keys(byMonth).sort();
        const totalMin = es.reduce((s, r) => s + (Number(r.minutes) || 0), 0);
        const monthBlocks = months.map(m => {
          const arr = byMonth[m];
          const mm = Number(m.slice(5, 7));
          const label = monthNames[mm - 1] + '月';
          const mMin = arr.reduce((s, r) => s + (Number(r.minutes) || 0), 0);
          const mTime = mMin ? ` · 共计 ${Math.round(mMin / 60 * 10) / 10} 小时` : '';
          // 修复 bug：月份标签移到左列（与周时间轴对齐），不再"悬空"在右列
          return `<div class="fun-axis-item">
            <div class="fun-axis-left">${label}</div>
            <div class="fun-axis-mid"><div class="fun-axis-dot"></div></div>
            <div class="fun-axis-right">
              <div class="fun-axis-date">${funVerb(t)}了 ${new Set(arr.map(r => r.title)).size} ${unit}${mTime}</div>
              ${arr.map(r => this.entryRowHTML(r, false, false)).join('')}
            </div>
          </div>`;
        }).join('');
        body = `<div class="fun-axis fun-axis-year">${monthBlocks}</div>
          <div class="fun-tl-year-sum">${y} 年 · 共${funVerb(t)} ${new Set(es.map(r => r.title)).size} ${unit} · 时长 ${Math.round(totalMin / 60 * 10) / 10} 小时</div>`;
      }
    } else {
      // 周视图：复用 weekHTML，加上左右切换 + 周汇总
      const off = this._tlWeekOff || 0;
      const [mon, sun] = this.weekRangeOff(off);
      const es = this.dedupLatest(allEs.filter(r => r.date >= mon && r.date <= sun));
      const totalMin = es.reduce((s, r) => s + (Number(r.minutes) || 0), 0);
      const weekHead = `<div class="fun-tl-week-head">
        <button class="fun-wk-arrow" data-wkprev ${off <= -104 ? 'disabled' : ''}>‹</button>
        <span class="fun-week-range">${mon.slice(5)} ~ ${sun.slice(5)}</span>
        <button class="fun-wk-arrow" data-wknext ${off >= 0 ? 'disabled' : ''}>›</button>
      </div>`;
      const weekBody = es.length ? this.weekHTML(t, off) : `<div class="empty">本周还没有「${esc(t)}」记录，去打卡第一笔~</div>`;
      const sum = `<div class="fun-tl-year-sum">本周 · ${es.length} ${unit} · 时长 ${Math.round(totalMin / 60 * 10) / 10} 小时</div>`;
      body = weekHead + weekBody + sum;
    }
    root.innerHTML = `<div class="fun-sub">
      <div class="fun-subbar">
        <span>时间轴 · ${esc(t)}</span>
        ${view === 'year' ? `<div class="fun-tl-year"><button class="fun-tl-yearbtn" id="tlYearBtn">${this._tlYear} ${icon('chevronDown', 14)}</button>${yearDrop}</div>` : ''}
        <div class="fun-subbar-right">
          <button class="icon-btn" id="tlViewBtn" title="${view === 'year' ? '切换到周' : '切换到年'}">${icon(view === 'year' ? 'calendar' : 'clock', 18)}</button>
          <button class="icon-btn fun-back" data-back="1" title="返回">${icon('chevronLeft', 20)}</button>
        </div>
      </div>
      ${body}
      ${this.navHTML(t)}</div>`;
    this.bindSub(root);
    if (view === 'year') {
      const yb = root.querySelector('#tlYearBtn');
      const yd = root.querySelector('#tlYearDrop');
      if (yb && yd) {
        yb.onclick = (e) => {
          e.stopPropagation();
          const open = yd.style.display !== 'none';
          yd.style.display = open ? 'none' : 'block';
          if (!open) {
            const outside = (ev) => { if (!yd.contains(ev.target) && ev.target !== yb) { yd.style.display = 'none'; document.removeEventListener('click', outside, true); } };
            setTimeout(() => document.addEventListener('click', outside, true), 0);
          }
        };
        yd.querySelectorAll('.tl-year-opt').forEach(o => o.onclick = () => { this._tlYear = o.dataset.year; this.renderTimeline(this._root); });
      }
    } else {
      const wp = root.querySelector('[data-wkprev]');
      if (wp) wp.onclick = () => { this._tlWeekOff = (this._tlWeekOff || 0) - 1; this.renderTimeline(this._root); };
      const wn = root.querySelector('[data-wknext]');
      if (wn) wn.onclick = () => { this._tlWeekOff = (this._tlWeekOff || 0) + 1; this.renderTimeline(this._root); };
    }
    const vb = root.querySelector('#tlViewBtn');
    if (vb) vb.onclick = () => { this._tlView = (this._tlView === 'year' ? 'week' : 'year'); this.renderTimeline(this._root); };
  },
  /* ============ 单本/单部详情页（全屏独立页） ============ */
  openDetail(id) {
    this._detailFromWall = false;
    this._savedView = { activeType: this.activeType, _view: this._view };
    this._view = 'detail';
    this._detailId = id;
    if (!this._detailTrend) this._detailTrend = 7;
    this.render(this._root);
  },
  renderDetail(root) {
    this._root = root;
    const id = this._detailId;
    const entry = this._findEntry(id);
    if (!entry) { root.innerHTML = '<div class="empty">记录不见了~</div>'; return; }
    const type = entry.type;
    const all = this.all().filter(r => r.title === entry.title && r.type === type).sort((a, b) => a.date.localeCompare(b.date));
    const isBook = ['小说', '漫画', '影视'].includes(type);
    const totalMin = all.reduce((s, r) => s + (Number(r.minutes) || 0), 0);
    const days = new Set(all.map(r => r.date)).size;
    const cnt = all.length;
    const sessRecs = all.filter(r => !r.seed);
    const sessionMin = sessRecs.reduce((s, r) => s + (Number(r.minutes) || 0), 0);
    const avg = sessRecs.length ? Math.round(sessionMin / sessRecs.length) : 0;
    const firstDate = all.length ? all[0].date : entry.date;
    const lastDate = all.length ? all[all.length - 1].date : entry.date;
    const dayDiff = Math.max(0, daysBetween(todayStr(), firstDate));
    const total = Number(entry.total) || 0;
    const progress = Number(entry.progress) || 0;
    const pct = (total && progress) ? Math.max(0, Math.min(100, Math.floor(progress / total * 100))) : ((entry.status === '看完' || entry.status === '已读完') ? 100 : 0);
    const shift = (base, delta) => { const [y, m, dd] = base.split('-').map(Number); const d = new Date(y, m - 1, dd); d.setDate(d.getDate() + delta); return todayStr(d); };

    // 趋势：按窗口聚合（近7天 / 近30天 / 全部按月）
    const trend = String(this._detailTrend || 7);
    let trendMap = {}, trendLabel = {}, trendOrder = [];
    if (trend === 'all') {
      all.forEach(r => { const k = r.date.slice(0, 7); trendMap[k] = (trendMap[k] || 0) + (Number(r.minutes) || 0); });
      trendOrder = Object.keys(trendMap).sort();
      trendLabel = Object.fromEntries(trendOrder.map(k => [k, k.slice(2)]));
    } else {
      const N = Number(trend);
      const step = N <= 14 ? 1 : Math.ceil(N / 6);
      for (let i = N - 1; i >= 0; i--) {
        const d = shift(todayStr(), -i);
        const sum = all.filter(r => r.date === d).reduce((s, r) => s + (Number(r.minutes) || 0), 0);
        if (sum) trendMap[d] = sum;
        trendOrder.push(d);
        const show = (i % step === 0) || (i === 0);
        trendLabel[d] = show ? (Number(d.slice(5, 7)) + '/' + Number(d.slice(8, 10))) : '';
      }
    }
    const maxTrend = Math.max(1, ...Object.values(trendMap));
    const trendHTML = trendOrder.map(k => {
      const v = trendMap[k] || 0;
      const h = v ? Math.max(4, Math.round(v / maxTrend * 100)) : 2;
      const cls = v ? '' : ' fun-dt-bar-empty';
      return `<div class="fun-dt-bar${cls}"><div class="fun-dt-fill" style="height:${h}%;background:${this.typeColor(type)}"></div><div class="fun-dt-day">${trendLabel[k]}</div></div>`;
    }).join('');

    const [mon, sun] = this.weekRange();
    const weekMin = all.filter(r => r.date >= mon && r.date <= sun).reduce((s, r) => s + (Number(r.minutes) || 0), 0);
    const dayAvg = days ? Math.round(totalMin / days) : 0;

    const rev = all.slice().reverse();
    const trailHTML = rev.slice(0, 30).map(r => {
      const pr = isBook && r.progress ? (' · 看到 ' + esc(r.progress)) : '';
      const st = (r.status && r.status !== '在看') ? (' · ' + esc(r.status)) : '';
      const minTxt = r.seed ? `<span class="fun-trail-min">累计 ${this.fmtMin(r.minutes)} 起点</span>` : (r.minutes ? `<span class="fun-trail-min">${this.fmtMin(r.minutes)}</span>` : '');
      return `<div class="fun-trail-item"><div class="fun-trail-dot" style="background:${this.typeColor(type)}"></div><div class="fun-trail-mid"><span class="fun-trail-date">${r.date.slice(5)}</span>${minTxt}${pr}${st}</div></div>`;
    }).join('');

    const thumb = (type === '游戏')
      ? (entry.icon ? `<img src="${esc(entry.icon)}" class="fun-dt-cover" alt="">` : `<div class="fun-dt-cover fun-dt-cover-ph" style="background:${funColorHash(entry.title)}22;color:${funColorHash(entry.title)}">${esc((entry.title || '?').slice(0, 1))}</div>`)
      : (entry.cover ? `<img src="${esc(entry.cover)}" class="fun-dt-cover" alt="">` : `<div class="fun-dt-cover fun-dt-cover-ph"></div>`);

    const statusTxt = entry.status || (isBook ? '在看' : '在玩');
    const isFinished = entry.status === '看完' || entry.status === '已读完';
    const unitWord = ({ '小说': '章', '漫画': '话', '影视': '集' })[type] || '章';
    const pctLab = (type === '小说') ? '已读' : '已看';
    const progCap = isFinished
      ? (total ? ('全书 ' + total + ' ' + unitWord + ' · 已看完') : '已看完')
      : (total ? ('全书 ' + total + ' ' + unitWord + ' · ') : '') + '看到第 ' + (progress || '1') + ' ' + unitWord;
    const progBlock = isBook ? `
      <div class="fun-dt-pct">${pct}<span class="fun-dt-pctsign">%</span><span class="fun-dt-pct-lab">${pctLab}</span></div>
      <div class="fun-dt-progbar"><div class="fun-dt-progfill" style="width:${pct}%;background:${this.typeColor(type)}"></div></div>
      <div class="fun-dt-progcap">${progCap}</div>` : '';

    const catLabel = (type === '影视' && entry.cat) ? entry.cat : type;
    root.innerHTML = `<div class="fun-detail-page">
      <div class="fun-dt-topbar fun-dt-topbar--title">
        <div class="fun-dt-titlerow">
          <div class="fun-dt-cat">${esc(catLabel)}</div>
          <div class="fun-dt-topbar-actions">
            <button class="icon-btn fun-dt-edit" data-fedit="1" title="编辑">${icon('edit', 18)}</button>
            <button class="icon-btn fun-back" data-back="1" title="返回">${icon('chevronLeft', 18)}</button>
          </div>
        </div>
      </div>
      <div class="fun-dt-head">
        ${thumb}
        <div class="fun-dt-headinfo">
          <div class="fun-dt-name">${esc(entry.title || '未命名')}</div>
          <div class="fun-dt-sub">${esc(statusTxt)}${dayDiff ? ' · 已陪伴 ' + dayDiff + ' 天' : ''} · 最近 ${lastDate.slice(5)}</div>
          ${progBlock}
        </div>
      </div>
      <div class="fun-dt-stats">
        <div class="fun-dt-stat"><div class="fun-dt-val">${cnt}</div><div class="fun-dt-lab">打卡次数</div></div>
        <div class="fun-dt-stat"><div class="fun-dt-val">${days}</div><div class="fun-dt-lab">天</div></div>
        <div class="fun-dt-stat"><div class="fun-dt-val">${this.fmtMin(totalMin) || '0'}</div><div class="fun-dt-lab">累计时长</div></div>
        <div class="fun-dt-stat"><div class="fun-dt-val">${this.fmtMin(avg) || '0'}</div><div class="fun-dt-lab">单次均</div></div>
      </div>
      <div class="card fun-dt-trendcard">
        <div class="fun-dt-cardhead"><h3>投入趋势</h3>
          <div class="seg sm">
            <button class="seg-btn ${trend === '7' ? 'on' : ''}" data-dtrend="7">近7天</button>
            <button class="seg-btn ${trend === '30' ? 'on' : ''}" data-dtrend="30">近30天</button>
            <button class="seg-btn ${trend === 'all' ? 'on' : ''}" data-dtrend="all">全部</button>
          </div>
        </div>
        <div class="fun-dt-trend">${trendHTML || '<div class="empty">还没有投入记录~</div>'}</div>
      </div>
      <div class="card fun-dt-weekcard">
        <div class="fun-dt-cardhead"><h3>本周 · 日均</h3></div>
        <div class="fun-dt-weekgrid">
          <div class="fun-dt-wk"><div class="fun-dt-wkval">${this.fmtMin(weekMin) || '0'}</div><div class="fun-dt-wklab">本周投入 (${mon.slice(5)}~${sun.slice(5)})</div></div>
          <div class="fun-dt-wk"><div class="fun-dt-wkval">${this.fmtMin(dayAvg) || '0'}</div><div class="fun-dt-wklab">日均投入</div></div>
        </div>
      </div>
      <div class="card">
        <div class="fun-dt-cardhead"><h3>阅读轨迹</h3></div>
        <div class="fun-trail">${trailHTML || '<div class="empty">还没有记录~</div>'}</div>
      </div>
      ${this.navHTML(this.activeType !== '全部' ? this.activeType : type)}
    </div>`;
    this.bindDetail(root, id);
  },
  bindDetail(root, id) {
    this.bindSub(root);
    const edit = root.querySelector('[data-fedit]');
    if (edit) edit.onclick = () => {
      this._detailFromWall = false;
      const e = this._findEntry(id); if (!e) return;
      // 始终就地编辑「同名同类型」的最新那条记录，绝不再新建记录（避免一个作品出现多条 / 封面墙重复封面）
      const allSame = this.all().filter(r => (r.title || '') === (e.title || '') && funNormType(r.type) === funNormType(e.type)).sort((a, b) => a.date.localeCompare(b.date) || ((a.createdAt || 0) - (b.createdAt || 0)));
      const latest = allSame[allSame.length - 1] || e;
      this.editModal(encodeURIComponent(JSON.stringify({ date: latest.date, id: latest.id })), null);
    };
    root.querySelectorAll('[data-dtrend]').forEach(b => b.onclick = () => { this._detailTrend = b.dataset.dtrend; this.renderDetail(this._root); });
  },
  /* ============ 封面日历（全部 / 单类型） ============ */
  openCal(scope) { this._savedView = { activeType: this.activeType, _view: this._view }; this._calScope = scope; this._view = 'cal'; this.render(this._root); },
  renderCal(root) {
    this._root = root;
    const scope = this._calScope || 'all';
    const mode = this._calMode || 'photo';
    // 封面日历 / 圆点日历 两个独立状态，切换或翻月互不串信息
    const ymKey = mode === 'photo' ? '_calYmPhoto' : '_calYmDot';
    if (!this[ymKey]) this[ymKey] = todayStr().slice(0, 7);
    const [yy, mm] = this[ymKey].split('-').map(Number);
    const dim = new Date(yy, mm, 0).getDate();
    const lead = (new Date(yy, mm - 1, 1).getDay() + 6) % 7;
    let calHTML = `<div class="hm-grid${mode === 'dot' ? ' hm-grid--dot' : ''}" style="margin:0 auto;max-width:340px">`;
    ['一', '二', '三', '四', '五', '六', '日'].forEach(w => calHTML += `<div class="hm-wd">${w}</div>`);
    for (let i = 0; i < lead; i++) calHTML += `<div class="hm-cell empty"></div>`;
    for (let dd = 1; dd <= dim; dd++) {
      const ds = this[ymKey] + '-' + String(dd).padStart(2, '0');
      // 刷抖音：仅圆点日历呈现，封面日历过滤掉（N9 修订 v248）
      const es = this.dayEntries(ds, scope).filter(r => mode === 'photo' ? (!this.isDouyinRec(r) && r.type !== '随手记') : true);
      if (!es.length) {
        // N10：封面日历只呈现封面，无封面则不显示任何文字
        calHTML += mode === 'photo' ? `<div class="hm-cell"></div>` : `<div class="hm-cell"><span class="hm-day-num">${dd}</span></div>`;
        continue;
      }
      const types = [...new Set(es.map(x => x.type))];
      if (mode === 'photo') {
        const cover = scope === 'all' ? (es.find(x => x.cover) || {}).cover : (es[0].cover || '');
        // 封面日历：只呈现封面，不标日期、不显示角标文字
        if (cover) calHTML += `<div class="hm-cell hm-photo-cell" data-calday="${ds}" title="${ds}" style="background-image:url('${esc(cover)}')"></div>`;
        else calHTML += `<div class="hm-cell"></div>`;
      } else {
        // 圆点日历：日期永远居中；娱乐日把圆点放在日期正下方居中；每格黑边框（由 .hm-grid--dot 控制）
        const seenLbl = new Set();
        const dots = es.map(r => { const lbl = funRecLabel(r); if (seenLbl.has(lbl)) return ''; seenLbl.add(lbl); return `<span class="hm-dot" style="background:${funMacaron(r.type)}" title="${esc(lbl)}"></span>`; }).join('');
        calHTML += `<div class="hm-cell hm-cell--dot" data-calday="${ds}"><span class="hm-day-num">${dd}</span><div class="hm-dots">${dots}</div></div>`;
      }
    }
    calHTML += '</div>';
    const label = (mode === 'photo' ? '封面日历' : '圆点日历') + (scope === 'all' ? '' : (' · ' + scope));
    // 彩色圆点图例仅在圆点日历显示
    const legend = mode === 'dot'
      ? (() => {
          const legTypes = FUN_TYPES.concat(scope === 'all' ? this._calNoteLabels() : []);
          const legCls = this._calLegOpen ? '' : 'hm-leg-collapsed';
          return `<div class="hm-legend ${legCls}">${legTypes.map(t => `<span class="hm-leg-item"><span class="hm-dot" style="background:${funMacaron(t)}"></span>${esc(funRecLabel({ type: t }))}</span>`).join('')}${legTypes.length > 4 ? `<span class="hm-leg-more" id="fnLegMore">${this._calLegOpen ? '收起' : '更多'}</span>` : ''}</div>`;
        })()
      : '';
    root.innerHTML = `<div class="fun-sub">
      <div class="fun-subbar"><span>${label}</span>
        <div style="margin-left:auto;display:flex;gap:6px;align-items:center">
          <button class="btn sm ghost" id="fnCalMode" title="切换封面/圆点">切换</button>
          <button class="icon-btn fun-back" data-back="1" title="返回">${icon('chevronLeft', 20)}</button>
        </div></div>
      ${calHTML}
      <div class="fun-cal-header">
        <button class="btn sm ghost" id="fnCalPrev" title="上个月">‹</button>
        <span class="fun-cal-ym">${yy}年${mm}月</span>
        <button class="btn sm ghost" id="fnCalNext" title="下个月">›</button>
      </div>
      ${legend}
      ${this.navHTML(scope === 'all' ? '全部' : scope)}
    </div>`;
    this.bindSub(root);
    const prev = root.querySelector('#fnCalPrev');
    if (prev) prev.onclick = () => { const [y, m] = this[ymKey].split('-').map(Number); const d = new Date(y, m - 2, 1); this[ymKey] = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); this.render(this._root); };
    const next = root.querySelector('#fnCalNext');
    if (next) next.onclick = () => { const [y, m] = this[ymKey].split('-').map(Number); const d = new Date(y, m, 1); this[ymKey] = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); this.render(this._root); };
    const modeBtn = root.querySelector('#fnCalMode');
    if (modeBtn) modeBtn.onclick = () => { this._calMode = (this._calMode || 'photo') === 'photo' ? 'dot' : 'photo'; this.render(this._root); };
    const legMore = root.querySelector('#fnLegMore');
    if (legMore) legMore.onclick = () => { this._calLegOpen = !this._calLegOpen; this.render(this._root); };
  },
  isDouyinRec(r) { return (r.type === '随手记' || r.type === '娱乐') && (r.title || '').indexOf('刷抖音') >= 0; },
  dayEntries(date, scope) {
    const arr = (this.logs()[date] || []).map(r => Object.assign({ date }, r, { type: funNormType(r.type) }));
    return scope === 'all' ? arr : arr.filter(r => r.type === scope);
  },
  _calNoteLabels() {
    const ymKey = this._calMode === 'photo' ? '_calYmPhoto' : '_calYmDot';
    const ym = this[ymKey] || todayStr().slice(0, 7);
    const labels = new Set();
    const L = this.logs();
    Object.keys(L).forEach(d => {
      if (!d.startsWith(ym)) return;
      (L[d] || []).forEach(r => { if (r.type === '随手记') { const lbl = funRecLabel(r); if (lbl) labels.add(lbl); } });
    });
    return [...labels];
  },
  bindSub(root) {
    this.bindNav(root);
    // N1：返回键改由根容器事件委托一次性绑定，避免某次渲染中途异常导致绑定丢失（偶发失效）
    if (!root._backDelegated) {
      root.addEventListener('click', (e) => {
        const b = e.target.closest('[data-back]');
        if (b) { e.preventDefault(); e.stopPropagation(); this.backSub(); }
      });
      root._backDelegated = true;
    }
    root.querySelectorAll('[data-wallrec]').forEach(el => el.onclick = () => { this._detailFromWall = true; const o = JSON.parse(decodeURIComponent(el.dataset.wallrec)); const entry = this._findEntry(o.id); if (entry) this.recordDetail(entry); });
    root.querySelectorAll('[data-calday]').forEach(c => c.onclick = () => this.dayModal(c.dataset.calday, this._calScope || 'all'));
    root.querySelectorAll('[data-rytoggle]').forEach(b => b.onclick = (e) => { e.stopPropagation(); const w = b.closest('.ry-tags'); if (w) w.classList.toggle('ry-expanded'); });
    root.querySelectorAll('[data-fnentry]').forEach(el => {
      el.onclick = (e) => {
        if (e.target.closest('.ry-tag-more')) return;
        if (el._lpFired) { el._lpFired = false; return; }
        const entry = this._findEntry(el.dataset.fnentry); if (entry) this.recordDetail(entry);
      };
      let lpTimer = null;
      const lpStart = () => { el._lpFired = false; if (lpTimer) clearTimeout(lpTimer); lpTimer = setTimeout(() => { el._lpFired = true; const entry = this._findEntry(el.dataset.fnentry); if (entry) this.entryActionSheet(entry); }, 550); };
      const lpCancel = () => { if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; } };
      el.addEventListener('touchstart', lpStart, { passive: true });
      el.addEventListener('touchend', lpCancel);
      el.addEventListener('touchmove', lpCancel);
      el.addEventListener('mousedown', lpStart);
      el.addEventListener('mouseup', lpCancel);
      el.addEventListener('mouseleave', lpCancel);
    });
    root.querySelectorAll('[data-dtcover]').forEach(el => el.onclick = (e) => { e.stopPropagation(); const entry = this._findEntry(el.dataset.dtcover); if (entry) this.openDetail(entry.id); });
  },
  backSub() {
    const s = this._savedView || { activeType: '全部', _view: 'main' };
    this.activeType = s.activeType; this._view = s._view;
    this.render(this._root);
  },
  dayModal(date, scope) {
    const es = this.dayEntries(date, scope);
    if (!es.length) { toast('这天没有记录'); return; }
    const rows = es.map(r => `<div class="list-row" style="align-items:flex-start;cursor:pointer" data-dayrec="${r.id}">
        ${r.cover ? `<img src="${esc(r.cover)}" style="width:34px;height:48px;object-fit:cover;border-radius:6px;flex-shrink:0">` : ''}
        <div style="flex:1;min-width:0"><b>${esc(r.title || '未命名')}</b>
          <div style="display:flex;gap:6px;align-items:center;margin-top:2px;flex-wrap:wrap">
            <span class="tag" style="background:${this.typeColor(r.type)};color:#fff;border:none;font-size:10px;padding:1px 6px">${esc(r.type)}</span>
            ${r.status ? `<span class="tag" style="background:#eee;color:#444;border:none;font-size:10px;padding:1px 6px">${esc(r.status)}</span>` : ''}
          </div>
          ${(r.tags && r.tags.length) ? `<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px">${r.tags.map(t => `<span class="tag" style="background:#eee;color:#444;border:none;font-size:10px;padding:1px 6px">${esc(t)}</span>`).join('')}</div>` : ''}
        </div></div>`).join('');
    const _u = es.every(r => r.type === '小说') ? '本' : (es.every(r => r.type === '游戏') ? '款' : '部');
    openModal(`<button class="close-x" onclick="closeModal()">×</button><h3>${date}${es.length > 1 ? ' · 共 ' + es.length + ' ' + _u : ''}</h3><div>${rows}</div>`);
    document.querySelectorAll('#ov [data-dayrec]').forEach(el => el.onclick = () => { const e = this._findEntry(el.dataset.dayrec); if (e) this.recordDetail(e); });
  },
  /* ============ 小红书违禁词检测（仅小说页 · 右下角图标点开） ============ */
  xhsFabHTML() {
    return `<button class="fun-xhs-fab" data-xhs="1" title="小红书违禁词检测">${icon('search', 20)}</button>`;
  },
  xhsModal() {
    openModal(`<button class="close-x" onclick="closeModal()">×</button><h3>${icon('search', 18)} 小红书违禁词检测</h3>
      <div class="muted" style="font-size:12px;margin-bottom:8px">发笔记前粘进来自查，命中词标红并给修改建议。重点覆盖 BL/小说分享最易误判的「色情低俗」「导流资源」两类。</div>
      <textarea id="xhsInput" class="xhs-input" placeholder="把你要发的小红书笔记粘进来…"></textarea>
      <button class="btn" id="xhsCheck" style="width:100%;margin-top:10px">检测一下</button>
      <div id="xhsResult" style="margin-top:10px"></div>`);
    const btn = document.getElementById('xhsCheck');
    if (btn) btn.onclick = () => this.xhsCheck();
  },
  xhsCheck() {
    const ta = document.getElementById('xhsInput');
    if (!ta) return;
    const text = ta.value;
    const out = document.getElementById('xhsResult');
    if (!text.trim()) { out.innerHTML = '<div class="empty">把笔记内容粘进来，点「检测一下」</div>'; return; }
    const allWords = XHS_LIB.flatMap(g => g.w);
    const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pat = allWords.slice().sort((a, b) => b.length - a.length).map(escRe).join('|');
    const re = new RegExp('(' + pat + ')', 'gi');
    const html = esc(text).replace(re, m => '<mark class="xhs-hit">' + m + '</mark>');
    const hits = (text.match(new RegExp('(' + pat + ')', 'gi')) || []).length;
    const groups = XHS_LIB.filter(g => g.w.some(w => text.toLowerCase().includes(w.toLowerCase()))).map(g => ({
      c: g.c, a: g.a, words: g.w.filter(w => text.toLowerCase().includes(w.toLowerCase()))
    }));
    out.innerHTML = `<div class="banner ${hits ? 'warn' : 'info'}" style="margin-bottom:10px">${hits ? ('检测到 <b>' + hits + '</b> 处可能违规词，建议改完再发') : '未发现明显违禁词，但仍注意上下文与配图'}</div>
      <div class="xhs-text">${html}</div>
      ${groups.length ? groups.map(g => `<div class="xhs-group">
        <div class="xhs-cat">${esc(g.c)}</div>
        <div class="xhs-words">${g.words.map(w => '<span class="xhs-w">' + esc(w) + '</span>').join('')}</div>
        <div class="xhs-advice">${esc(g.a)}</div>
      </div>`).join('') : ''}
      <div class="muted" style="font-size:11px;margin-top:10px">检测基于小红书常见违规词库（重点覆盖小说/BL 分享场景），仅供参考；平台用机器学习综合判定，最终以审核为准。</div>`;
  },
  /* ============ 添加 / 编辑（打卡） ============ */
  editModal(ref, presetType, seed) {
    let r = { date: todayStr(), type: presetType || '影视', title: '', cover: '', total: '', progress: '', status: '在看', rating: 0, review: '', minutes: '', epMin: '', speed: 1, skip: 0, episodes: '', imgs: [], tags: [], playFor: '' };
    if (ref) { const o = JSON.parse(decodeURIComponent(ref)); const arr = (this.logs()[o.date] || []); r = Object.assign(r, arr.find(x => x.id === o.id) || {}); r.type = funNormType(r.type); }
    else if (seed) { r = Object.assign(r, seed); r.type = funNormType(r.type || presetType || '影视'); r.date = todayStr(); r.id = uid(); r.createdAt = Date.now(); }
    const origTitle = r.title;  // 编辑已保存作品改名字时，用来把该作品全部历史记录一并改名
    const isGame = () => r.type === '游戏';
    const isNovel = () => r.type === '小说';
    const tagsStr = (r.tags || []).join(' ');
    // 半星点击评分：点左半=半星，点右半=全星，再点同位=清零
    const starRateBox = (id, cur) => `<div id="${id}" class="star-rate" data-rate="${cur}">${[1, 2, 3, 4, 5].map(n => `<span data-rstar="${n}" style="position:relative;display:inline-block;width:1em;margin:0 -0.05em;color:#e0e0e0;font-size:20px;cursor:pointer;line-height:1">★<span style="position:absolute;left:0;top:0;overflow:hidden;white-space:nowrap;color:#F5C518;width:${cur >= n ? 100 : (cur >= n - 0.5 ? 50 : 0)}%">★</span></span>`).join('')}</div>`;
    const coverBlock = isGame() ? ''
      : `<div class="form-row"><label>封面图（链接或上传）</label><div style="display:flex;gap:6px"><input id="fCover" value="${esc(r.cover)}" placeholder="https://…" style="flex:1"><button class="btn sm ghost" id="fUp">上传</button></div><input id="fFile" type="file" accept="image/*" style="display:none"></div>
      <div id="fCoverPrev" style="margin:6px 0">${r.cover ? `<img src="${esc(r.cover)}" style="max-height:90px;border-radius:8px">` : ''}</div>`;
    const totalBlock = isGame() ? '' : `<div style="display:flex;gap:8px">
        <div class="form-row" style="flex:1"><label>总量（集/话/季）</label><input id="fTotal" value="${esc(r.total)}"></div>
        <div class="form-row" style="flex:1"><label>进度（看到哪）</label><input id="fProg" value="${esc(r.progress)}"></div>
      </div>`;
    const gameBlock = isGame() ? `<div id="fGameFields">
        <div class="form-row"><label>游戏图标（方图）</label><div style="display:flex;gap:6px"><input id="fIcon" value="${esc(r.icon || '')}" placeholder="上传方图"><button class="btn sm ghost" id="fIconUp">上传</button></div><input id="fIconFile" type="file" accept="image/*" style="display:none"></div>
        <div id="fIconPrev" style="margin:6px 0">${r.icon ? `<img src="${esc(r.icon)}" style="max-height:64px;border-radius:8px">` : ''}</div>
        <div class="form-row"><label>游玩目的</label><select id="fPlayFor"><option value="自愿" ${r.playFor === '创作' ? '' : 'selected'}>自愿玩</option><option value="创作" ${r.playFor === '创作' ? 'selected' : ''}>为了创作/赚钱玩</option></select></div>
        <div class="form-row"><label>给游戏评星（可随时改）</label>${starRateBox('fGameRateBox', r.rating || 0)}</div>
        <div class="form-row"><label>本次玩了多久(分钟)</label><input id="fMin" type="number" value="${r.minutes || ''}"></div>
      </div>` : '';
    const typed = presetType && FUN_TYPES.includes(presetType);
    const titleTxt = ref ? '编辑' : (typed ? '记录' + r.type : '打卡娱乐记录');
    const typeSelHTML = `<div class="form-row"${typed ? ' style="display:none"' : ''}><label>类型</label><select id="fType">${FUN_TYPES.map(t => `<option ${t === r.type ? 'selected' : ''}>${t}</option>`).join('')}</select></div>`;
    const totalWrapHTML = isGame() ? '' : `<div id="fTotalWrap">
        <div class="form-row"><label>总量（集/话/章）</label><input id="fTotal" value="${esc(r.total)}"></div>
        <div id="fProgWrap" style="${r.status === '看完' ? 'display:none' : ''}"><div class="form-row"><label>进度（看到哪）</label><input id="fProg" value="${esc(r.progress)}"></div></div>
      </div>`;
    const mediaTimeBlock = ['小说', '影视', '漫画'].includes(r.type) ? `<div class="form-row" id="fMediaTimeWrap"><label>${r.type === '小说' ? '本次读了多久（分钟）' : '本次看了多久（分钟）'}</label><input id="fMediaMin" type="number" value="${ref ? '' : (r.minutes || '')}" placeholder="如 40"></div>` : '';
    openModal(`<button class="close-x" onclick="closeModal()">×</button><h3>${icon('play', 18)} ${titleTxt}</h3>
      ${typeSelHTML}
      <div class="form-row"><label>标题</label><input id="fTitle" value="${esc(r.title)}" placeholder="剧名 / 书名 / 游戏名"></div>
      ${coverBlock}
      ${isGame() ? '' : `<div class="form-row"><label>状态</label><select id="fStatus">${['想看', '在看', '看完'].map(s => `<option ${s === r.status ? 'selected' : ''}>${s}</option>`).join('')}</select></div>`}
      ${totalWrapHTML}
      <div class="form-row"><label>标签（空格分隔，如 治愈 悬疑 下饭）</label><input id="fTags" value="${esc(tagsStr)}" placeholder="治愈 悬疑"></div>
      <div id="fCatWrap" style="${r.type === '影视' ? '' : 'display:none'}"><div class="form-row"><label>分类（影视）</label><select id="fCat">${['电视剧', '电影', '综艺', '短剧', 'AI漫剧', '动漫', '纪录片', '其他'].map(c => `<option ${c === (r.cat || '') ? 'selected' : ''}>${c}</option>`).join('')}</select></div></div>
      ${mediaTimeBlock}
      ${gameBlock}
      <div class="form-row"><label>日期</label><input id="fDate" type="date" value="${r.date}"></div>
      ${isGame() ? '' : `<div id="fReviewBox" style="${r.status === '看完' ? '' : 'display:none'}">
        <div class="form-row"><label>看完打分</label>${starRateBox('fRateBox', r.rating || 0)}<input id="fRating" type="hidden" value="${r.rating || 0}"></div>
        <div class="form-row"><label>观后感</label><textarea id="fReview" rows="3" placeholder="写点感受吧~">${esc(r.review || '')}</textarea></div>
      </div>`}
      <div style="display:flex;gap:8px;margin-top:10px;justify-content:flex-end">
        <button class="btn ghost" onclick="closeModal()">取消</button>
        <button class="btn" id="fSave">保存</button>
      </div>`);
    const typeSel = document.getElementById('fType');
    typeSel.onchange = () => {
      r.type = typeSel.value;
      const cw = document.getElementById('fCatWrap'); if (cw) cw.style.display = (r.type === '影视') ? '' : 'none';
      const gf = document.getElementById('fGameFields'); if (gf) gf.style.display = isGame() ? '' : 'none';
      const needMedia = ['小说', '影视', '漫画'].includes(r.type);
      let mtb = document.getElementById('fMediaTimeWrap');
      if (needMedia && !mtb) { const tagsRow = document.getElementById('fTags').closest('.form-row'); const div = document.createElement('div'); div.className = 'form-row'; div.id = 'fMediaTimeWrap'; div.innerHTML = '<label>' + (r.type === '小说' ? '本次读了多久（分钟）' : '本次看了多久（分钟）') + '</label><input id="fMediaMin" type="number" placeholder="如 40">'; if (tagsRow) tagsRow.after(div); }
      else if (mtb) { mtb.style.display = needMedia ? '' : 'none'; }
      const tw = document.getElementById('fTotalWrap'); if (tw) tw.style.display = '';
      applyMemory();
    };
    const fStatusEl = document.getElementById('fStatus'); if (fStatusEl) fStatusEl.onchange = (e) => { const rb = document.getElementById('fReviewBox'); if (rb) rb.style.display = e.target.value === '看完' ? '' : 'none'; const pw = document.getElementById('fProgWrap'); if (pw) pw.style.display = e.target.value === '看完' ? 'none' : ''; };
    const fUp = document.getElementById('fUp');
    if (fUp) {
      const cover = document.getElementById('fCover'), prev = document.getElementById('fCoverPrev'), file = document.getElementById('fFile');
      fUp.onclick = () => file.click();
      file.onchange = () => { const f = file.files[0]; if (!f) return; const fr = new FileReader(); fr.onload = () => { const raw = fr.result; if (typeof shrinkImage === 'function') { shrinkImage(raw, 1000, 0.82).then(small => { const v = small || raw; cover.value = v; prev.innerHTML = `<img src="${v}" style="max-height:90px;border-radius:8px">`; }).catch(() => { cover.value = raw; prev.innerHTML = `<img src="${raw}" style="max-height:90px;border-radius:8px">`; }); } else { cover.value = raw; prev.innerHTML = `<img src="${raw}" style="max-height:90px;border-radius:8px">`; } }; fr.readAsDataURL(f); };
    }
    const fIconUp = document.getElementById('fIconUp');
    if (fIconUp) {
      const iconIn = document.getElementById('fIcon'), iconPrev = document.getElementById('fIconPrev'), iconFile = document.getElementById('fIconFile');
      fIconUp.onclick = () => iconFile.click();
      iconFile.onchange = () => { const f = iconFile.files[0]; if (!f) return; const fr = new FileReader(); fr.onload = () => { const raw = fr.result; if (typeof shrinkImage === 'function') { shrinkImage(raw, 600, 0.82).then(small => { const v = small || raw; iconIn.value = v; iconPrev.innerHTML = `<img src="${v}" style="max-height:64px;border-radius:8px">`; }).catch(() => { iconIn.value = raw; iconPrev.innerHTML = `<img src="${raw}" style="max-height:64px;border-radius:8px">`; }); } else { iconIn.value = raw; iconPrev.innerHTML = `<img src="${raw}" style="max-height:64px;border-radius:8px">`; } }; fr.readAsDataURL(f); };
    }
    // 半星评分通用绑定：点左半=半星、点右半=全星、再点同位=清零；和阅读打分同一套逻辑
    const renderStars = (box, v) => {
      if (!box) return;
      box.dataset.rate = v;
      box.querySelectorAll('span[data-rstar]').forEach(sp => {
        const n = Number(sp.dataset.rstar);
        const inner = sp.querySelector('span');
        if (inner) inner.style.width = (v >= n ? 100 : (v >= n - 0.5 ? 50 : 0)) + '%';
      });
    };
    const bindStarRate = (boxId, hiddenId, lockedFn) => {
      const box = document.getElementById(boxId);
      if (!box) return;
      box.querySelectorAll('span[data-rstar]').forEach(sp => {
        sp.onclick = (e) => {
          if (lockedFn && lockedFn()) return;
          const n = Number(sp.dataset.rstar);
          const rect = sp.getBoundingClientRect();
          const half = (e.clientX - rect.left) < rect.width / 2;
          const cur = Number(box.dataset.rate) || 0;
          let nv;
          if (cur === n) nv = 0;
          else if (cur === n - 0.5) nv = n;
          else nv = half ? n - 0.5 : n;
          renderStars(box, nv);
          if (hiddenId) { const hi = document.getElementById(hiddenId); if (hi) hi.value = nv; }
        };
      });
      renderStars(box, Number(box.dataset.rate) || 0);
    };
    bindStarRate('fRateBox', 'fRating', null);
    bindStarRate('fGameRateBox', null, null);

    // 同名记录记忆：写名字即带出上一次的基础信息（封面/图标/评分等），只填空字段，方便只改想改的
    const applyMemory = () => {
      const type = typeSel.value;
      const title = (document.getElementById('fTitle').value || '').trim();
      if (!title) return;
      const mem = Entertainment.all()
        .filter(x => funNormType(x.type) === type && (x.title || '') === title)
        .sort((a, b) => b.date.localeCompare(a.date))[0];
      if (!mem) return;
      if (type === '游戏') {
        const fi = document.getElementById('fIcon');
        if (fi && !fi.value.trim() && mem.icon) {
          fi.value = mem.icon;
          const fp = document.getElementById('fIconPrev'); if (fp) fp.innerHTML = `<img src="${esc(mem.icon)}" style="max-height:64px;border-radius:8px">`;
        }
        const gbox = document.getElementById('fGameRateBox');
        if (gbox && !(Number(gbox.dataset.rate) || 0) && (Number(mem.rating) || 0) > 0) renderStars(gbox, mem.rating);
        const pf = document.getElementById('fPlayFor'); if (pf && !pf.value) pf.value = mem.playFor || '自愿';
      } else {
        const fc = document.getElementById('fCover');
        if (fc && !fc.value.trim() && mem.cover) {
          fc.value = mem.cover;
          const fp = document.getElementById('fCoverPrev'); if (fp) fp.innerHTML = `<img src="${esc(mem.cover)}" style="max-height:90px;border-radius:8px">`;
        }
      }
      const setIfEmpty = (id, val) => { const el = document.getElementById(id); if (el && !el.value.trim() && val != null && val !== '') el.value = String(val); };
      setIfEmpty('fTotal', mem.total);
      setIfEmpty('fProg', mem.progress);
      setIfEmpty('fTags', (mem.tags || []).join(' '));
      setIfEmpty('fReview', mem.review);
      setIfEmpty('fCat', mem.cat);
    };
    const fTitleEl = document.getElementById('fTitle');
    if (fTitleEl) fTitleEl.addEventListener('input', () => { r.title = fTitleEl.value; applyMemory(); });
    document.getElementById('fSave').onclick = () => {
      const type = typeSel.value;
      const newTitle = document.getElementById('fTitle').value.trim();
      // 分钟框为空（编辑媒体作品时被刻意清空，见 1385 行）→ 沿用原时长，避免「空=0」被误判为进度编辑而额外建记录（v277 修复）
      const _rawMin = isGame() ? document.getElementById('fMin').value : document.getElementById('fMediaMin')?.value;
      const minutes = (_rawMin === '' || _rawMin == null) ? (Number(r.minutes) || 0) : (Number(_rawMin) || 0);
      const tags = (document.getElementById('fTags').value.trim().split(/\s+/).filter(Boolean));
      const coverVal = document.getElementById('fCover') ? document.getElementById('fCover').value.trim() : '';
      const fStatus = isGame() ? '' : (document.getElementById('fStatus') ? document.getElementById('fStatus').value : '');
      const fProgRaw = document.getElementById('fProg') ? document.getElementById('fProg').value.trim() : '';
      const fTotalRaw = document.getElementById('fTotal') ? document.getElementById('fTotal').value.trim() : '';
      // 选「看完」必须填总量（章/集/话），否则详情页无法显示「全书 X 章 · 已看完」
      if (fStatus === '看完' && !fTotalRaw) { toast('已看完需要填写总量（章/集/话）'); return; }
      // 小说/影视/漫画：编辑=在历史基础上「新增一条本次记录」（累积轨迹，旧记录保留）；游戏：保持就地覆盖旧记录。
      const isBook = ['小说', '影视', '漫画'].includes(r.type);
      // 仅「进度类」字段（状态/进度/总量/时长）的编辑才追加为一条新轨迹/打卡记录；
      // 其余元数据编辑（改名/标签/封面/感想/改日期等）原地更新现有记录，不计入打卡次数，避免轨迹与次数错位。
      const _oStatus = r.status || '', _oProg = r.progress || '', _oTotal = r.total || '', _oMin = Number(r.minutes) || 0;
      const isProgressEdit = (fStatus !== _oStatus) || (fProgRaw !== _oProg) || (fTotalRaw !== _oTotal) || (Number(minutes) !== _oMin);
      const appendRec = isBook && !!ref && isProgressEdit;
      const rec = {
        id: appendRec ? uid() : (r.id || uid()), type, title: newTitle,
        cover: coverVal, total: document.getElementById('fTotal') ? document.getElementById('fTotal').value.trim() : '',
        progress: fStatus === '看完' ? '' : fProgRaw,         status: fStatus,
        rating: isGame() ? (Number((document.getElementById('fGameRateBox') || {}).dataset?.rate) || 0) : (Number(document.getElementById('fRating')?.value) || 0), review: isGame() ? '' : (document.getElementById('fReview') ? document.getElementById('fReview').value.trim() : ''),
        minutes, imgs: [], playFor: isGame() ? (document.getElementById('fPlayFor')?.value || '自愿') : '', icon: isGame() ? (document.getElementById('fIcon')?.value.trim() || '') : '',
        cat: r.type === '影视' ? (document.getElementById('fCat') ? document.getElementById('fCat').value : '') : '',
        tags,
        createdAt: appendRec ? Date.now() : (r.createdAt || Date.now())
      };
      const date = document.getElementById('fDate').value || todayStr();
      const L = this.logs();
      if (ref && !appendRec) {
        const o = JSON.parse(decodeURIComponent(ref));
        const _arr = L[o.date] || [];
        const _idx = _arr.findIndex(x => x.id === o.id);
        if (_idx >= 0) _arr.splice(_idx, 1);
        // 仅在原日期已无其他记录时才清理该日期桶，避免改日期时误删同日其他条目
        if (o.date !== date && !_arr.length) delete L[o.date];
      }
      if (origTitle && newTitle && origTitle !== newTitle) {
        // 编辑已保存作品改名字：把该作品全部历史记录一并改名，避免保存后裂成两个作品
        Object.keys(L).forEach(dt => (L[dt] || []).forEach(x => { if (x.type === r.type && x.title === origTitle) x.title = newTitle; }));
      }
      if (!L[date]) L[date] = []; L[date].push(rec); this.save(L);
      if (ref && !appendRec) { const o = JSON.parse(decodeURIComponent(ref)); funRechCleanSrc(o.date, o.id); }
      funRechSync(rec, date);
      this._detailId = rec.id;
      closeModal(); this.render(this._root); toast('已记录：' + (rec.title || rec.type));
    };
  },
  entryActionSheet(entry) {
    const ref = encodeURIComponent(JSON.stringify({ date: entry.date, id: entry.id }));
    openModal(`<button class="close-x" onclick="closeModal()">×</button>
      <h3>操作</h3>
      <div style="display:flex;flex-direction:column;gap:10px;margin-top:12px">
        <button class="btn" onclick="closeModal();window.Entertainment.editModal('${ref}')">编辑</button>
        <button class="btn ghost" style="color:#e35d5d" onclick="closeModal();window.Entertainment.del('${ref}')">删除</button>
      </div>`);
  },
  del(ref) {
    const o = JSON.parse(decodeURIComponent(ref)); const L = this.logs();
    L[o.date] = (L[o.date] || []).filter(x => x.id !== o.id); if (!L[o.date].length) delete L[o.date];
    this.save(L); funRechCleanSrc(o.date, o.id);
    closeModal(); this.render(this._root); toast('已删除');
  }
};
function funMacaron(type) {
  const key = type || '影视';
  let h = 0; for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return FUN_MACARON[h % FUN_MACARON.length];
}
const FUN_MACARON = ['#F7B2C4', '#FBD3A6', '#A8E6CF', '#B5C7F0', '#D7BDE2', '#FFD3B6', '#C8E6C9', '#B2EBF2', '#F8BBD0', '#E1BEE7', '#FFCCBC', '#C5E1A5'];
function funRecLabel(r) {
  if (r && r.type === '随手记') {
    const t = r.title || '';
    const MAP = [['抖音', '抖音'], ['小红书', '小红书'], ['b站', 'B站'], ['B站', 'B站'], ['微博', '微博'], ['知乎', '知乎'], ['网易云', '网易云'], ['微信', '微信'], ['淘宝', '淘宝'], ['京东', '京东'], ['刷剧', '刷剧'], ['看番', '看番'], ['游戏', '游戏']];
    for (const kv of MAP) if (t.indexOf(kv[0]) >= 0) return kv[1];
    return '随手记';
  }
  return r ? r.type : '';
}
window.Modules = window.Modules || {};
window.Modules.fun = Entertainment;
window.Entertainment = Entertainment;
// 启动即归一化所有记录 id（历史数据可能遗留重复 id，会导致编辑/删除误伤另一条）
try { Entertainment.normalizeIds(); } catch (e) { console.warn('fun normalizeIds failed', e); }
// 启动一次性合并同名同类型多记录（影视/小说/漫画/游戏）为单条（latest-wins + 时长累加），flag 守护只跑一次
try { if (S.get('funMergeV') !== '240') { Entertainment.normalizeMerge(); S.set('funMergeV', '240'); } } catch (e) { console.warn('fun normalizeMerge failed', e); }
// v243：小说历史基线归一——同名小说多条历史「累计式」记录合并为单条「累计起点」，避免后续按次累加重复计
try { if (S.get('funSeedV') !== '243') { Entertainment.normalizeSeed(); S.set('funSeedV', '243'); } } catch (e) { console.warn('fun normalizeSeed failed', e); }
