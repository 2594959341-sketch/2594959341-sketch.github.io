window.Modules = window.Modules || {};
/* ============================================================
 * 出行专栏（mumu-workbench · v114）
 *  - 日常外出 (travel:out)：今日OOTD / 随手拍时间轴 / 照片日历 / 出行记录
 *  - 旅行 (travel:trip)：计划 / 今日记录 / 照片日历 / 中国地图 / 游记库
 *  - 旅行详情：行程规划 / 行李清单 / 途中记录(带评分) / 预设vs实际 / 问答式游记
 *
 *  localStorage（S 自动加 mumu_ 前缀）：
 *    travelOut      { 'YYYY-MM-DD': [entry] }   entry.kind = 'ootd'|'snap'|'note'
 *    travelPhotos   [{id,date,kind:'out'|'map',prov?}]
 *    travelTrips    [trip]
 *    travelCover    { 'YYYY-MM-DD': pid }        照片日历首图
 *    travelMap      { 省级区划简称: [pid] }       中国地图照片收录
 *    travelJournals [{id,tripId,place,name,range,text,updatedAt}]
 *  照片二进制统一在 IndexedDB mumu_photos（{id,data}）
 * ============================================================ */
const Travel = {
  sub: 'out',
  _calYm: null,        // 照片日历当前月
  _selDate: null,      // 日常外出当前选中日期
  _year: false,        // 出行记录页
  _yearSel: null,      // 出行记录选中年
  _yearMonth: null,    // 兼容 app.js 的重置（已不再使用）
  _tripId: null,       // 当前查看的旅行 id
  _openDay: null,      // 行程规划展开的日期
  _editEntry: null,    // 随手拍展开编辑的条目 id
  _booted: false,
  _root: null,

  /* ---------- 存储 ---------- */
  outStore() { return S.get('travelOut', {}) || {}; },
  saveOut(s) { S.set('travelOut', s); },
  photos() { return S.get('travelPhotos', []) || []; },
  savePhotos(a) { S.set('travelPhotos', a); },
  trips() { return S.get('travelTrips', []) || []; },
  saveTrips(a) { S.set('travelTrips', a); },
  /* 关键：单个 trip 落盘（旧代码 saveTrips(this.trips()) 会把刚改的对象丢掉） */
  saveTrip(t) {
    if (!t || !t.id) return;
    const arr = this.trips();
    const i = arr.findIndex(x => x.id === t.id);
    if (i >= 0) arr[i] = t; else arr.push(t);
    this.saveTrips(arr);
  },
  trip() { return this.trips().find(t => t.id === this._tripId) || null; },
  covers() { return S.get('travelCover', {}) || {}; },
  saveCovers(c) { S.set('travelCover', c); },
  mapStore() { return S.get('travelMap', {}) || {}; },
  saveMap(m) { S.set('travelMap', m); },
  journals() { return S.get('travelJournals', []) || []; },
  saveJournals(a) { S.set('travelJournals', a); },

  /* ---------- 日期安全助手（杜绝 NaN / Invalid Date 乱码） ---------- */
  _isDate(s) {
    return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + 'T12:00:00').getTime());
  },
  _fmtCN(ds) { return this._isDate(ds) ? fmtCN(ds) : ''; },
  _md(ds) { return this._isDate(ds) ? (Number(ds.slice(5, 7)) + '月' + Number(ds.slice(8, 10)) + '日') : ''; },
  _addDays(ds, n) { return this._isDate(ds) ? addDays(ds, n) : ''; },
  _between(a, b) {
    if (!this._isDate(a) || !this._isDate(b)) return 0;
    return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);
  },
  _rangeText(a, b) {
    if (this._isDate(a) && this._isDate(b)) return this._md(a) + ' - ' + this._md(b);
    if (this._isDate(a)) return this._md(a) + ' 起';
    return '未设日期';
  },
  _nowHM() { const n = new Date(); return String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0'); },
  _cut(s, n) { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n) + '…' : s; },
  _splitList(v) { return String(v == null ? '' : v).split(/[，,、;；\s]+/).filter(Boolean); },
  _typeName(k) { return ({ note: '随记', food: '吃', play: '玩', scenic: '景', hotel: '住', ootd: 'OOTD' })[k] || '随记'; },
  _diff(n) { return (n > 0 ? '+' : '') + n; },

  /* ---------- 半星三态（灭 → 半 → 全 → 灭）data-tvstar ↔ dataset.tvstar ---------- */
  starHTML(v) {
    v = Number(v) || 0;
    let s = '<span class="tv-stars">';
    for (let i = 1; i <= 5; i++) {
      const pct = v >= i ? 100 : (v >= i - 0.5 ? 50 : 0);
      s += '<span class="tv-star" data-tvstar="' + i + '">★<i style="width:' + pct + '%">★</i></span>';
    }
    return s + '</span>';
  },
  bindStars(box, getV, setV) {
    if (!box) return;
    const paint = () => {
      const v = Number(getV()) || 0;
      box.querySelectorAll('.tv-star').forEach(sp => {
        const n = Number(sp.dataset.tvstar);
        const it = sp.querySelector('i');
        if (it) it.style.width = (v >= n ? 100 : (v >= n - 0.5 ? 50 : 0)) + '%';
      });
    };
    box.querySelectorAll('.tv-star').forEach(sp => sp.onclick = ev => {
      ev.stopPropagation();
      const n = Number(sp.dataset.tvstar);
      const v = Number(getV()) || 0;
      let nv;
      if (v === n) nv = 0;            // 全亮 → 灭
      else if (v === n - 0.5) nv = n;  // 半亮 → 全亮
      else nv = n - 0.5;               // 灭 → 半亮
      setV(nv); paint();
    });
    paint();
  },

  /* ========================================================
   *  统一删除入口（IndexedDB / travelPhotos / travelOut / trips / 首图 / 地图）
   * ======================================================== */
  async deletePhoto(pid) {
    if (!pid) return;
    try { await IDB.del(pid); } catch (e) { /* blob 已不存在也继续清索引 */ }
    // ① travelPhotos 索引
    this.savePhotos(this.photos().filter(p => p && p.id !== pid));
    // ② travelOut 各条目引用
    const s = this.outStore();
    Object.keys(s).forEach(d => {
      (s[d] || []).forEach(e => { if (e.photoIds) e.photoIds = e.photoIds.filter(x => x !== pid); });
      s[d] = (s[d] || []).filter(e => !(e.auto && !(e.photoIds || []).length && !e.text && !e.place && !e.reason));
      if (!s[d].length) delete s[d];
    });
    this.saveOut(s);
    // ③ 旅行内引用
    const trips = this.trips();
    trips.forEach(t => {
      (t.notes || []).forEach(n => {
        if (n.photoIds) n.photoIds = n.photoIds.filter(x => x !== pid);
        if (n.photoId === pid) delete n.photoId;   // 兼容迁移前的旧字段
      });
      (t.packing || []).forEach(p => {
        if (p.photoIds) p.photoIds = p.photoIds.filter(x => x !== pid);
        if (p.photoId === pid) delete p.photoId;   // 兼容迁移前的旧字段
      });
      if (t.cover === pid) t.cover = null;
    });
    this.saveTrips(trips);
    // ④ 照片日历首图缓存
    const cv = this.covers(); let cc = false;
    Object.keys(cv).forEach(d => { if (cv[d] === pid) { delete cv[d]; cc = true; } });
    if (cc) this.saveCovers(cv);
    // ⑤ 中国地图收录
    const mp = this.mapStore(); let mc = false;
    Object.keys(mp).forEach(k => {
      const n = (mp[k] || []).filter(x => x !== pid);
      if (n.length !== (mp[k] || []).length) mc = true;
      if (n.length) mp[k] = n; else delete mp[k];
    });
    if (mc) this.saveMap(mp);
  },
  /* 删除一条随手拍 / OOTD / 随记 → 连带删掉它名下所有照片 */
  async deleteEntry(id) {
    const s0 = this.outStore();
    let pids = []; let srcIds = [];
    Object.keys(s0).forEach(d => {
      const e = (s0[d] || []).find(x => x.id === id);
      if (e) { pids = pids.concat(e.photoIds || []); if (e.srcId) srcIds.push(e.srcId); }
    });
    for (const pid of pids) await this.deletePhoto(pid);
    const s = this.outStore();
    Object.keys(s).forEach(d => {
      s[d] = (s[d] || []).filter(x => x.id !== id);
      if (!s[d].length) delete s[d];
    });
    this.saveOut(s);
    // 同步删掉生成这条外出的每日计划任务（双向互写清理，避免月时间轴/今日列表留孤儿任务）
    if (srcIds.length && window.Daily && Daily.removePlanById) {
      srcIds.forEach(sid => { try { Daily.removePlanById(sid); } catch (e) {} });
    }
  },
  /* 幂等清理：剔除指向 IndexedDB 已不存在的脏索引，收养无主照片 */
  async cleanupPhotos() {
    let all;
    try { all = await IDB.getAll(); } catch (e) { return 0; }
    const alive = new Set((all || []).map(r => r && r.id).filter(Boolean));
    let changed = 0;
    const ph = this.photos();
    const keep = ph.filter(p => p && p.id && alive.has(p.id));
    // 防御：仅保留明确属于出行板块的照片索引（out/trip/map），剔除任何非法/串入的索引，确保各板块照片日历不互通
    const ALLOWED = ['out', 'trip', 'map'];
    const keepKind = keep.filter(p => ALLOWED.includes(p.kind));
    if (keepKind.length !== keep.length) { changed += keep.length - keepKind.length; this.savePhotos(keepKind); }

    const s = this.outStore(); let sc = 0;
    Object.keys(s).forEach(d => {
      (s[d] || []).forEach(e => {
        if (!Array.isArray(e.photoIds)) { e.photoIds = []; sc++; }
        // 极老数据可能是单数 photoId，先并入数组再做存活过滤，否则照片永远读不到
        if (e.photoId) { e.photoIds = e.photoIds.concat([e.photoId]); delete e.photoId; sc++; }
        const n = e.photoIds.filter(pid => alive.has(pid));
        if (n.length !== e.photoIds.length) { e.photoIds = n; sc++; }
      });
    });
    // 收养：IndexedDB 里还在、travelPhotos 有索引、但没有任何条目引用的照片
    const refd = new Set();
    Object.keys(s).forEach(d => (s[d] || []).forEach(e => (e.photoIds || []).forEach(p => refd.add(p))));
    const mp = this.mapStore();
    Object.keys(mp).forEach(k => (mp[k] || []).forEach(p => refd.add(p)));
    const trips = this.trips();
    trips.forEach(t => {
      (t.notes || []).forEach(n => { (n.photoIds || []).forEach(p => refd.add(p)); if (n.photoId) refd.add(n.photoId); });
      (t.packing || []).forEach(p => { (p.photoIds || []).forEach(x => refd.add(x)); if (p.photoId) refd.add(p.photoId); });
      if (t.cover) refd.add(t.cover);
    });
    keepKind.filter(p => p.kind !== 'map' && !refd.has(p.id)).forEach(p => {
      const d = this._isDate(p.date) ? p.date : todayStr();
      s[d] = s[d] || [];
      let e = s[d].find(x => x.auto && x.kind === 'snap');
      if (!e) {
        e = { id: uid(), kind: 'snap', auto: 1, date: d, time: '', place: '', reason: '', text: '', rating: 0, photoIds: [] };
        s[d].push(e);
      }
      e.photoIds.push(p.id); sc++;
    });
    Object.keys(s).forEach(d => { if (!s[d] || !s[d].length) delete s[d]; });
    if (sc) { this.saveOut(s); changed += sc; }

    const cv = this.covers(); let cc = 0;
    Object.keys(cv).forEach(d => { if (!alive.has(cv[d])) { delete cv[d]; cc++; } });
    if (cc) { this.saveCovers(cv); changed += cc; }

    let mc = 0;
    Object.keys(mp).forEach(k => {
      const n = (mp[k] || []).filter(p => alive.has(p));
      if (n.length !== (mp[k] || []).length) mc++;
      if (n.length) mp[k] = n; else delete mp[k];
    });
    if (mc) { this.saveMap(mp); changed += mc; }

    let tc = 0;
    trips.forEach(t => {
      (t.notes || []).forEach(n => {
        if (n.photoIds) { const x = n.photoIds.filter(p => alive.has(p)); if (x.length !== n.photoIds.length) { n.photoIds = x; tc++; } }
        if (n.photoId && !alive.has(n.photoId)) { delete n.photoId; tc++; }
      });
      (t.packing || []).forEach(p => {
        if (p.photoIds) { const x = p.photoIds.filter(q => alive.has(q)); if (x.length !== p.photoIds.length) { p.photoIds = x; tc++; } }
        if (p.photoId && !alive.has(p.photoId)) { delete p.photoId; tc++; }
      });
      if (t.cover && !alive.has(t.cover)) { t.cover = null; tc++; }
    });
    if (tc) { this.saveTrips(trips); changed += tc; }
    return changed;
  },

  /* ---------- 缩略图统一装载 ---------- */
  loadThumbs(scope) {
    (scope || document).querySelectorAll('.tv-img[data-pid]').forEach(async sp => {
      if (sp.dataset.loaded === '1') return;
      sp.dataset.loaded = '1';
      const r = await IDB.get(sp.dataset.pid);
      if (r && r.data) { const img = new Image(); img.src = r.data; img.className = 'tv-thumb-img'; sp.appendChild(img); }
    });
  },
  thumbHTML(pid) {
    return '<span class="tv-thumb tv-img" data-lp data-pid="' + pid + '" data-outthumb="1"></span>';
  },

  /* ---------- 入口 ---------- */
  render(root) {
    this._root = root;
    if (!this._booted) {
      this._booted = true;
      this.cleanupPhotos().then(n => { if (n && this._root) this.render(this._root); }).catch(() => {});
    }
    // 整页重渲会销毁输入框：若当前停留在某旅行详情且展开了「计划日」，先把已输入但未点的内容落盘
    if (this.sub === 'trip' && this._tripId) {
      const t = this.trip();
      if (t && this._openDay) this.flushOpenPlan(root, t);
    }
    if (this._year) { root.innerHTML = this.yearPageHTML(); this.bindYear(root); this.loadThumbs(root); this.appendTravelNav(root); return; }
    if (this.sub === 'trip') { this.renderTrip(root); this.appendTravelNav(root); return; }
    this.renderOut(root); this.appendTravelNav(root);
  },
  travelNavHTML() {
    const cur = this.sub === 'trip' ? 'trip' : 'out';
    const items = [['out', '日常外出'], ['trip', '旅行']];
    return `<div class="subnav">${items.map(([k, l]) => `<button class="${cur === k ? 'on' : ''}" data-tsub="${k}">${l}</button>`).join('')}</div>`;
  },
  appendTravelNav(root) {
    root.insertAdjacentHTML('beforeend', this.travelNavHTML());
    root.querySelectorAll('[data-tsub]').forEach(b => b.onclick = () => { this.sub = (b.dataset.tsub === 'trip' ? 'trip' : null); this.render(root); });
  },

  /* ========================================================
   *  A. 日常外出
   * ======================================================== */
  renderOut(root) {
    if (!this._isDate(this._selDate)) this._selDate = todayStr();
    const d = this._selDate;
    const store = this.outStore();
    const all = store[d] || [];
    const ootdIds = [];
    const ootds = all.filter(e => e.kind === 'ootd');
    all.filter(e => e.kind === 'ootd').forEach(e => (e.photoIds || []).forEach(p => ootdIds.push(p)));
    const snaps = all.filter(e => e.kind !== 'ootd');

    root.innerHTML = `
    <div class="tv-scope">
      <div class="tv-head">
        <span class="tv-head-actions"><input type="date" id="tvDate" class="tv-datemini" value="${d}" style="position:absolute;opacity:0;pointer-events:none;width:0;height:0"></span>
      </div>

      <div class="card">
        <div class="tv-cardhead"><b>今日OOTD</b>
          <span class="tv-head-actions">
            <button class="icon-btn" id="tvOotdAdd">${icon('plus', 18)}</button>
            <button class="icon-btn" id="tvDateIcon" title="选择日期">${icon('calendar', 18)}</button>
          </span></div>
        ${this._editEntry && ootds.find(e => e.id === this._editEntry) ? this.entryFormHTML(ootds.find(e => e.id === this._editEntry)) : `<div class="tv-thumbs" id="tvOotdBox">${ootdIds.map(p => this.thumbHTML(p)).join('')}</div>`}
      </div>

      <div class="card">
        <div class="tv-cardhead"><b>随手拍</b>
          <span class="tv-head-actions">
            <button class="icon-btn" id="tvSnapAdd">${icon('plus', 18)}</button>
            <button class="icon-btn" id="tvCollect">${icon('map', 18)}</button>
          </span></div>
        <div class="tv-tl" id="tvList">${snaps.map(e => this._editEntry === e.id ? this.entryFormHTML(e) : this.entryRowHTML(e)).join('')}</div>
      </div>

      <div class="card">
        <div class="tv-cardhead"><b>照片日历</b>
          <button class="icon-btn" id="tvCalToggle">${icon('chevronUp', 16)}</button></div>
        <div id="tvCalBody"></div>
      </div>
    </div>`;

    const dateEl = root.querySelector('#tvDate');
    dateEl.onchange = () => {
      this._selDate = this._isDate(dateEl.value) ? dateEl.value : todayStr();
      this._calYm = this._selDate.slice(0, 7);
      this._editEntry = null; this.render(root);
    };
    root.querySelector('#tvOotdAdd').onclick = () => this.addOOTD(d, root);
    const dateIcon = root.querySelector('#tvDateIcon');
    if (dateIcon) dateIcon.onclick = () => { const el = root.querySelector('#tvDate'); if (el && el.showPicker) el.showPicker(); };
    root.querySelector('#tvSnapAdd').onclick = () => {
      const s = this.outStore(); s[d] = s[d] || [];
      const e = { id: uid(), kind: 'snap', date: d, time: this._nowHM(), place: '', reason: '', text: '', rating: 0, photoIds: [] };
      s[d].push(e); this.saveOut(s);
      this._editEntry = e.id; this.render(root);
    };
    root.querySelector('#tvCollect').onclick = () => {
      this._year = true; this._yearSel = d.slice(0, 4); this.render(root);
    };
    const tg = root.querySelector('#tvCalToggle');
    tg.onclick = () => {
      const b = root.querySelector('#tvCalBody');
      const hide = b.style.display !== 'none';
      b.style.display = hide ? 'none' : '';
      tg.innerHTML = icon(hide ? 'chevronDown' : 'chevronUp', 16);
    };

    root.querySelectorAll('.tv-tlrow').forEach(r => r.onclick = ev => {
      if (ev.target.closest('.del')) return;
      this._editEntry = r.dataset.entry; this.render(root);
    });
    this.bindDelButtons(root);
    if (this._editEntry) this.bindEntryForm(root, this._editEntry);

    this.drawPhotoCal(root.querySelector('#tvCalBody'), root, 'out');
    this.loadThumbs(root);
    this.bindOutThumbs(root, root);
  },

  bindDelButtons(scope) {
    const root = this._root;
    scope.querySelectorAll('[data-delout]').forEach(b => b.onclick = async ev => {
      ev.stopPropagation();
      await this.deleteEntry(b.dataset.delout);
      this._editEntry = null; this.render(root);
    });
    scope.querySelectorAll('[data-delphoto]').forEach(b => b.onclick = async ev => {
      ev.stopPropagation();
      await this.deletePhoto(b.dataset.delphoto);
      this.render(root);
    });
  },

  entryRowHTML(e) {
    const pid = (e.photoIds || [])[0];
    const n = (e.photoIds || []).length;
    const title = e.reason || e.place || (e.kind === 'note' ? '随记' : '随手拍');
    const sub = [];
    if (e.reason && e.place) sub.push(esc(e.place));
    /* 老数据兼容：把 thought 拼到 text 后面一次显示；新数据只剩 text */
    const merged = [e.text, e.thought].filter(Boolean).join('\n');
    if (merged) sub.push(esc(this._cut(merged, 50)));
    return `<div class="tv-tlrow" data-lp data-entry="${e.id}">
      <span class="tv-tlpic tv-img${pid ? '' : ' none'}"${pid ? ' data-pid="' + pid + '"' : ''}>${n > 1 ? '<i class="tv-tlnum">' + n + '</i>' : ''}</span>
      <div class="tv-tlinfo">
        <b>${esc(title)}</b>
        ${sub.map(x => '<span class="tv-sub">' + x + '</span>').join('')}
        <span class="tv-tlmeta">${esc(e.time || '')}${e.rating ? ' · ' + e.rating + '分' : ''}</span>
      </div>
      <button class="del" data-delout="${e.id}">✕</button>
    </div>`;
  },

  entryFormHTML(e) {
    return `<div class="tv-entry" data-entry="${e.id}">
      <div class="tv-cardhead">
        <input class="inp tv-timein" id="tvTime_${e.id}" type="time" value="${esc(e.time || '')}">
        <button class="icon-btn" data-delout="${e.id}">${icon('trash', 16)}</button>
      </div>
      <input class="inp" id="tvReason_${e.id}" value="${esc(e.reason || '')}" placeholder="事由">
      <div style="display:flex;gap:6px;align-items:center"><input class="inp" id="tvPlace_${e.id}" value="${esc(e.place || '')}" placeholder="地点"><button class="btn sm ghost" id="tvLoc_${e.id}" type="button" style="flex:none">📍 定位</button></div>
      <textarea class="inp" id="tvText_${e.id}" rows="4" placeholder="记录">${esc(e.text || '')}</textarea>
      <div class="tv-thumbs">${(e.photoIds || []).map(p => this.thumbHTML(p)).join('')}</div>
      <div class="tv-mbtns">
        <button class="btn sm ghost" id="tvPhoto_${e.id}">${icon('camera', 14)}</button>
        <button class="btn sm" id="tvSave_${e.id}">保存</button>
      </div>
    </div>`;
  },

  bindEntryForm(root, id) {
    const ph = root.querySelector('#tvPhoto_' + id);
    if (ph) ph.onclick = () => this.addOutPhoto(id, root);
    const sv = root.querySelector('#tvSave_' + id);
    if (sv) sv.onclick = () => {
      this.flushOutForm(root);
      this._editEntry = null; this.render(root); toast('已保存');
    };
    const loc = root.querySelector('#tvLoc_' + id);
    if (loc) loc.onclick = () => this.getLoc(loc, 'tvPlace_' + id);
  },

  /* 把展开中的随手拍表单里还没点保存的输入落盘。
     整页 render 会重建输入框，任何「异步选图回来再 render」的路径都必须先调它。 */
  flushOutForm(scope) {
    const id = this._editEntry;
    if (!id) return;
    const sc = scope || this._root || document;
    const map = { Time: 'time', Reason: 'reason', Place: 'place', Text: 'text' };
    const obj = {};
    Object.keys(map).forEach(sfx => {
      const el = sc.querySelector('#tv' + sfx + '_' + id);
      if (el) obj[map[sfx]] = (sfx === 'Time') ? el.value : el.value.trim();
    });
    if (Object.keys(obj).length) this.saveOutFields(id, obj);
  },

  saveOutFields(id, obj) {
    const s = this.outStore();
    Object.keys(s).forEach(d => {
      const e = (s[d] || []).find(x => x.id === id);
      if (e) {
        Object.keys(obj).forEach(k => e[k] = obj[k]);
        if (e.auto) delete e.auto;
        /* 老数据兼容：合并 textarea 后，老的 thought 字段作废 */
        if (e.thought !== undefined && obj.text !== undefined) delete e.thought;
      }
    });
    this.saveOut(s);
  },

  /* 出行：一键获取当前定位填入地点（navigator.geolocation + 反向地理编码出中文地名） */
  getLoc(btn, inputId) {
    if (!navigator.geolocation) { toast('当前浏览器不支持定位'); return; }
    if (window.isSecureContext === false) { toast('定位需要 HTTPS 环境，请在 https 页面里使用'); return; }
    const prev = btn.textContent;
    const restore = () => { btn.disabled = false; btn.textContent = prev; };
    btn.disabled = true; btn.textContent = '定位中…';
    const finish = async (pos) => {
      try {
        const lat = pos.coords.latitude, lng = pos.coords.longitude;
        let name = lat.toFixed(4) + ',' + lng.toFixed(4);
        try {
          const rn = await this.reversePlaceName(lat, lng);
          if (rn) name = rn;
        } catch (e) { /* 反查失败就用坐标兜底 */ }
        const el = document.getElementById(inputId);
        if (el) el.value = name;
        restore(); toast('已获取当前位置');
      } catch (e) {
        restore(); toast('定位后处理出错，请重试');
      }
    };
    const showErr = (err) => {
      restore();
      const c = err && err.code;
      const msg = c === 1 ? '定位权限被拒绝，请在浏览器/系统里允许定位'
        : c === 2 ? '暂时取不到位置（信号弱或定位服务未开），打开系统定位后重试'
        : c === 3 ? '定位超时，请重试一次'
        : (err && err.message) || '请允许定位权限';
      toast('定位失败：' + msg);
    };
    /* 第一次用低精度（基站/WiFi）：快、省电，「市/区」级地名本来就够用；
       超时或取不到时，再换高精度 + 强制刷新重试一次。 */
    navigator.geolocation.getCurrentPosition(
      (pos) => finish(pos),
      (err) => {
        if (err && err.code === 1) { showErr(err); return; }   // 权限被拒：重试也没用
        navigator.geolocation.getCurrentPosition(
          (pos) => finish(pos),
          showErr,
          { enableHighAccuracy: true, timeout: 25000, maximumAge: 0 }
        );
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 }
    );
  },
  /* 带超时的 JSON 请求：反查服务在部分网络下可能长时间无响应，必须能主动放弃，避免一直卡在「定位中」 */
  async _fetchJSON(url, ms) {
    const ctl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), ms || 6000) : null;
    try {
      const r = await fetch(url, ctl ? { signal: ctl.signal } : undefined);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } finally { if (timer) clearTimeout(timer); }
  },
  /* 反向地理编码：优先 BigDataCloud 客户端接口（支持 CORS、免 key、返回中文），兜底 Nominatim，再不行返回 null 用坐标兜底。
     地名尽量短：只取「市/区/县」+「省/自治区（剥后缀）」，永远不显示国家。 */
  async reversePlaceName(lat, lng) {
    const stripSub = s => (s || '').replace(/(省|自治区|特别行政区|地区|自治州|盟|市|区|县)$/, '');
    try {
      const j = await this._fetchJSON('https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=' + lat + '&longitude=' + lng + '&localityLanguage=zh', 6000);
      if (j) {
        const city = j.city || j.locality || '';
        const subRaw = j.principalSubdivision || '';
        const sub = stripSub(subRaw);
        const parts = [];
        if (city) parts.push(city);
        // 省：仅当市里未包含省名时才补（避免「呼伦贝尔市 内蒙古」这类重复/过长的英文省名泄漏）
        if (sub && city && !city.includes(sub) && !sub.includes(stripSub(city))) parts.push(sub);
        if (parts.length) return parts.join(' ');
      }
    } catch (e) { /* 走兜底 */ }
    try {
      const j = await this._fetchJSON('https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=' + lat + '&lon=' + lng + '&accept-language=zh-CN', 6000);
      if (j) {
        const a = j.address || {};
        const city = a.city || a.town || a.county || a.village || '';
        const sub = stripSub(a.state || '');
        const parts = [];
        if (city) parts.push(city);
        if (sub && city && !city.includes(sub) && !sub.includes(stripSub(city))) parts.push(sub);
        if (parts.length) return parts.join(' ');
        if (j.display_name) return j.display_name.split(',').slice(-3, -1).reverse().join(' ').slice(0, 24);
      }
    } catch (e) { /* 用坐标兜底 */ }
    return null;
  },

  /* 当前正在进行的旅行：优先 status='ongoing'，其次 'plan'（用户常把即将出发的也当作进行中） */
  ongoingTrip() {
    const ts = this.trips();
    return ts.find(t => t.status === 'ongoing') || ts.find(t => t.status === 'plan') || null;
  },
  /* 把今日 OOTD 直接存进进行中的旅行（而非日常外出） */
  addOOTDToTrip(trip, root) {
    pickPhoto(async dataURL => {
      const pid = uid();
      await IDB.put({ id: pid, data: dataURL });
      trip.notes = trip.notes || [];
      trip.notes.push({ id: uid(), kind: 'ootd', type: 'ootd', date: todayStr(), time: this._nowHM(), place: '', reason: '今日OOTD', text: '', rating: 0, photoIds: [pid] });
      this.saveTrip(trip);
      const ph = this.photos(); ph.push({ id: pid, date: todayStr(), kind: 'trip' }); this.savePhotos(ph);
      this.render(root); toast('已存入「' + (trip.name || '旅行') + '」');
    });
  },
  addOOTD(d, root) {
    pickPhoto(async dataURL => {
      const pid = uid();
      await IDB.put({ id: pid, data: dataURL });
      this.flushOutForm(root);   // 同页可能开着随手拍表单，先落盘再整页重渲
      const s = this.outStore(); s[d] = s[d] || [];
      let e = s[d].find(x => x.kind === 'ootd');
      if (!e) {
        e = { id: uid(), kind: 'ootd', date: d, time: this._nowHM(), place: '', reason: '今日OOTD', text: '', rating: 0, photoIds: [] };
        s[d].push(e);
      }
      e.photoIds = e.photoIds || []; e.photoIds.push(pid);
      this.saveOut(s);
      const ph = this.photos(); ph.push({ id: pid, date: d, kind: 'out' }); this.savePhotos(ph);
      this._editEntry = e.id; this.render(root);   // 记录后直接展开表单，可顺手填地点+记录
    });
  },

  addOutPhoto(id, root) {
    pickPhoto(async dataURL => {
      const pid = uid();
      await IDB.put({ id: pid, data: dataURL });
      this.flushOutForm(root);   // 先保住用户已输入但未点保存的 事由/地点/记录/感想
      const s = this.outStore();
      let date = todayStr();
      Object.keys(s).forEach(d => {
        const e = (s[d] || []).find(x => x.id === id);
        if (e) { e.photoIds = e.photoIds || []; e.photoIds.push(pid); date = d; if (e.auto) delete e.auto; }
      });
      this.saveOut(s);
      const ph = this.photos(); ph.push({ id: pid, date, kind: 'out' }); this.savePhotos(ph);
      this.render(root);
    });
  },

  /* ---------- 照片日历（含首图选择） ---------- */
  drawPhotoCal(body, root, kind) {
    if (!body) return;
    if (!this._calYm) this._calYm = (this._isDate(this._selDate) ? this._selDate : todayStr()).slice(0, 7);
    const covers = this.covers();
    const byDate = {};
    this.photos().filter(p => p && (kind ? p.kind === kind : p.kind !== 'map') && this._isDate(p.date))
      .forEach(p => { (byDate[p.date] = byDate[p.date] || []).push(p); });
    const marks = {};
    Object.keys(byDate).forEach(d => marks[d] = ['#111']);

    const opts = {
      ym: this._calYm, marks,
      cellHTML: ds => {
        const arr = byDate[ds];
        if (!arr || !arr.length) return '';
        const cid = (covers[ds] && arr.some(p => p.id === covers[ds])) ? covers[ds] : arr[0].id;
        return '<div class="cal-photo tv-img" data-pid="' + cid + '"></div>' + (arr.length > 1 ? '<span class="pc-count">' + arr.length + '</span>' : '');
      },
      onClick: ds => {
        if (this._calLp) { this._calLp = false; return; }
        const arr = byDate[ds] || [];
        if (arr.length) this.dayPhotoModal(ds, arr, root);
        else if (kind === 'out' && !this._year) { this._selDate = ds; this._editEntry = null; this.render(root); }
      },
      afterRender: el => {
        this._calYm = opts.ym;
        el.querySelectorAll('.cal-photo').forEach(pe => { const c = pe.closest('.cal-cell'); if (c) c.classList.add('has-photo'); });
        el.querySelectorAll('.cal-photo[data-pid]').forEach(pe => {
          let timer = null, lp = false, sx = 0, sy = 0;
          const start = (x, y) => { lp = false; sx = x; sy = y; timer = setTimeout(() => { lp = true; timer = null; this._calLp = true; if (confirm('删除这张照片？')) this.deletePhoto(pe.dataset.pid).then(() => this.render(root)); }, 550); };
          const move = (x, y) => { if (Math.abs(x - sx) > 12 || Math.abs(y - sy) > 12) { if (timer) { clearTimeout(timer); timer = null; } } };
          const end = () => { if (timer) { clearTimeout(timer); timer = null; } };
          pe.addEventListener('touchstart', e => { const t = e.touches[0]; start(t.clientX, t.clientY); }, { passive: true });
          pe.addEventListener('touchmove', e => { const t = e.touches[0]; move(t.clientX, t.clientY); }, { passive: true });
          pe.addEventListener('touchend', end);
          pe.addEventListener('touchcancel', end);
          pe.addEventListener('mousedown', e => start(e.clientX, e.clientY));
          pe.addEventListener('mousemove', e => move(e.clientX, e.clientY));
          pe.addEventListener('mouseup', end);
          pe.addEventListener('mouseleave', end);
        });
        this.loadThumbs(el);
      }
    };
    renderMonthCal(body, opts);
  },

  dayPhotoModal(ds, arr, root) {
    const covers = this.covers();
    const html = `<div class="tv-modal">
      <button class="close-x" onclick="closeModal()">×</button>
      <h3>${esc(this._fmtCN(ds) || ds)}</h3>
      <div class="muted" style="font-size:12px;margin-bottom:6px">点开看大图 · 长按照片可删除</div>
      <div class="photo-grid">${arr.map(p => `<div class="pg tv-img" data-pid="${p.id}" data-outthumb="1">
        <span class="tv-pgacts">
          <button class="tv-pgbtn${covers[ds] === p.id ? ' on' : ''}" data-cover="${p.id}">${icon('star', 13)}</button>
        </span></div>`).join('')}</div>
    </div>`;
    const ov = openModal(html);
    this.loadThumbs(ov);
    ov.querySelectorAll('[data-cover]').forEach(b => b.onclick = e => {
      e.stopPropagation();
      const c = this.covers();
      if (c[ds] === b.dataset.cover) delete c[ds]; else c[ds] = b.dataset.cover;
      this.saveCovers(c); closeModal(); this.render(root);
    });
    this.bindOutThumbs(ov, root);
  },

  /* ========================================================
   *  B. 出行记录
   * ======================================================== */
  recordList() {
    const store = this.outStore();
    const out = [];
    Object.keys(store).forEach(d => {
      if (!this._isDate(d)) return;
      (store[d] || []).forEach(e => out.push(Object.assign({}, e, { date: d })));
    });
    out.sort((a, b) => (b.date + ' ' + (b.time || '')).localeCompare(a.date + ' ' + (a.time || '')));
    return out;
  },

  yearPageHTML() {
    if (!/^\d{4}$/.test(String(this._yearSel || ''))) this._yearSel = todayStr().slice(0, 4);
    const y = this._yearSel;
    const recs = this.recordList().filter(r => r.date.slice(0, 4) === y);
    const groups = {};
    recs.forEach(r => { const m = r.date.slice(0, 7); (groups[m] = groups[m] || []).push(r); });
    const months = Object.keys(groups).sort().reverse();
    const body = months.map(m => `<div class="tv-mon">${Number(m.slice(5, 7))}月</div>
      <div class="tv-recs">${groups[m].map(r => this.recCardHTML(r)).join('')}</div>`).join('');
    return `<div class="tv-scope">
      <div class="tv-head">
        <span class="tv-head-actions">
          <button class="icon-btn" id="tyYearBtn">${icon('calendar', 18)}</button>
          <button class="icon-btn" id="tyBack">${icon('chevronLeft', 18)}</button>
        </span></div>
      <div id="tyBody">${body}</div>
    </div>`;
  },

  recCardHTML(r) {
    const pid = (r.photoIds || [])[0];
    const n = (r.photoIds || []).length;
    const title = r.reason || r.place || (r.kind === 'ootd' ? '今日OOTD' : (r.kind === 'note' ? '随记' : '出行'));
    const sub = [this._md(r.date), r.reason ? r.place : ''].filter(Boolean).join(' · ');
    return `<div class="tv-rec${pid ? '' : ' nopic'}" data-rec="${r.id}">
      ${pid ? '<span class="tv-recimg tv-img" data-pid="' + pid + '"></span>' : ''}
      ${n > 1 ? '<span class="tv-reccount">' + n + '</span>' : ''}
      <div class="tv-recmeta"><b>${esc(title)}</b><span>${esc(sub)}</span></div>
    </div>`;
  },

  bindYear(root) {
    const back = root.querySelector('#tyBack');
    if (back) back.onclick = () => { this._year = false; this.render(root); };
    const yb = root.querySelector('#tyYearBtn');
    if (yb) yb.onclick = () => this.yearPickModal(root);
    root.querySelectorAll('[data-rec]').forEach(c => c.onclick = () => this.recModal(c.dataset.rec, root));
  },

  yearPickModal(root) {
    const ys = new Set();
    this.recordList().forEach(r => ys.add(r.date.slice(0, 4)));
    ys.add(todayStr().slice(0, 4));
    const arr = Array.from(ys).sort().reverse();
    const html = `<div class="tv-modal"><button class="close-x" onclick="closeModal()">×</button>
      <h3>年份</h3>
      <div class="tv-years">${arr.map(y => `<button class="tv-year${y === this._yearSel ? ' on' : ''}" data-y="${y}">${y}</button>`).join('')}</div></div>`;
    const ov = openModal(html);
    ov.querySelectorAll('[data-y]').forEach(b => b.onclick = () => {
      this._yearSel = b.dataset.y; closeModal(); this.render(root);
    });
  },

  recModal(id, root) {
    const r = this.recordList().find(x => x.id === id);
    if (!r) return;
    const pids = r.photoIds || [];
    /* 老数据：把 thought 拼到 text 后面一次性显示，但不再单独保存 */
    const mergedText = [r.text, r.thought].filter(Boolean).join('\n');
    const html = `<div class="tv-modal">
      <button class="close-x" onclick="closeModal()">×</button>
      <h3>${esc(this._fmtCN(r.date) || r.date)}${r.time ? ' · ' + esc(r.time) : ''}</h3>
      <div class="tv-bigwrap">${pids.map(p => `<div class="tv-big tv-img" data-pid="${p}">
        <button class="tv-pgbtn tv-bigdel" data-delphoto="${p}">${icon('trash', 14)}</button></div>`).join('')}</div>
      <div class="tv-frow"><label>事由</label><input class="inp" id="rmReason" value="${esc(r.reason || '')}"></div>
      <div class="tv-frow"><label>地点</label><div style="display:flex;gap:6px;align-items:center"><input class="inp" id="rmPlace" value="${esc(r.place || '')}"><button class="btn sm ghost" id="rmLoc" type="button" style="flex:none">📍 定位</button></div></div>
      <div class="tv-frow"><label>记录</label><textarea class="inp" id="rmText" rows="5">${esc(mergedText)}</textarea></div>
      <div class="tv-mbtns">
        <button class="btn sm ghost" id="rmPhoto">${icon('camera', 14)}</button>
        <button class="btn sm ghost" id="rmDel">${icon('trash', 14)}</button>
        <button class="btn sm" id="rmSave">保存</button>
      </div></div>`;
    const ov = openModal(html);
    this.loadThumbs(ov);
    /* 关弹层 = 输入框销毁，任何关闭前的动作都要先把当前输入落盘 */
    const flush = () => {
      const v = sel => { const el = ov.querySelector(sel); return el ? el.value.trim() : null; };
      const obj = {};
      [['#rmReason', 'reason'], ['#rmPlace', 'place'], ['#rmText', 'text']]
        .forEach(kv => { const x = v(kv[0]); if (x !== null) obj[kv[1]] = x; });
      if (Object.keys(obj).length) this.saveOutFields(id, obj);
    };
    ov.querySelectorAll('[data-delphoto]').forEach(b => b.onclick = async () => {
      flush();
      await this.deletePhoto(b.dataset.delphoto); closeModal(); this.render(root);
    });
    ov.querySelector('#rmPhoto').onclick = () => { flush(); closeModal(); this.addOutPhoto(id, root); };
    ov.querySelector('#rmDel').onclick = async () => { await this.deleteEntry(id); closeModal(); this.render(root); };
    ov.querySelector('#rmSave').onclick = () => { flush(); closeModal(); this.render(root); toast('已保存'); };
    const rmloc = ov.querySelector('#rmLoc');
    if (rmloc) rmloc.onclick = () => this.getLoc(rmloc, 'rmPlace');
  },

  /* ========================================================
   *  C. 旅行主页
   * ======================================================== */
  renderTrip(root) {
    if (this._tripId) {
      const t = this.trip();
      if (t) { this.renderTripDetail(root, this._migrate(t)); return; }
      this._tripId = null;
    }
    const trips = this.trips().map(t => this._migrate(t)).filter(t => t.status !== 'done');
    root.innerHTML = `
    <div class="tv-scope">
      <div class="card">
        <div class="tv-cardhead"><b>计划中的旅行</b>
          <button class="icon-btn" id="tvNewTrip">${icon('plus', 18)}</button></div>
        <div id="tripList">${trips.map(t => this.tripCardHTML(t)).join('')}</div>
      </div>

      <div class="card">
        <div class="tv-cardhead"><b>今日OOTD / 随记</b></div>
        <div class="tv-mbtns tv-left">
          <button class="btn sm ghost" id="tvTripOotd">${icon('camera', 14)} OOTD</button>
          <button class="btn sm ghost" id="tvTripNote">${icon('edit', 14)} 随记</button>
        </div>
      </div>

      <div class="card">
        <div class="tv-cardhead"><b>照片日历</b>
          <button class="icon-btn" id="tvTripCalToggle">${icon('chevronUp', 16)}</button></div>
        <div id="tvTripCalBody"></div>
      </div>

      <div class="card">
        <div class="tv-cardhead"><b>中国地图</b></div>
        <div id="tvMapBox">${this.mapHTML()}</div>
        <div class="tv-jlibrow"><button class="tv-jlib" id="tvJLib">${icon('book', 15)}<span>游记库</span></button></div>
      </div>
    </div>`;

    root.querySelector('#tvNewTrip').onclick = () => this.newTripModal(root);
    root.querySelectorAll('[data-open]').forEach(b => b.onclick = ev => {
      ev.stopPropagation(); this._tripId = b.dataset.open; this._openDay = null; this._warn90 = null; this.render(root);
    });
    root.querySelectorAll('[data-deltrip]').forEach(b => b.onclick = async ev => {
      ev.stopPropagation(); await this.delTrip(b.dataset.deltrip); this.render(root);
    });
    const onTrip = this.ongoingTrip();
    if (onTrip) {
      root.querySelector('#tvTripOotd').onclick = () => this.addOOTDToTrip(onTrip, root);
      root.querySelector('#tvTripNote').onclick = () => this.quickNoteModal(root, onTrip);
      const ootdHint = root.querySelector('#tvTripOotd');
      if (ootdHint) ootdHint.title = '存入「' + (onTrip.name || '旅行') + '」';
    } else {
      root.querySelector('#tvTripOotd').onclick = () => this.addOOTD(todayStr(), root);
      root.querySelector('#tvTripNote').onclick = () => this.quickNoteModal(root);
    }
    root.querySelector('#tvJLib').onclick = () => this.openJournalLib(root);

    this.bindMap(root);
    this.loadThumbs(root);
    const tripCalBody = root.querySelector('#tvTripCalBody');
    if (tripCalBody) this.drawPhotoCal(tripCalBody, root, 'trip');
    const tripCalTg = root.querySelector('#tvTripCalToggle');
    if (tripCalTg) tripCalTg.onclick = () => {
      const b = root.querySelector('#tvTripCalBody');
      const hide = b.style.display !== 'none';
      b.style.display = hide ? 'none' : '';
      tripCalTg.innerHTML = icon(hide ? 'chevronDown' : 'chevronUp', 16);
    };
  },

  tripCardHTML(t) {
    const stMap = { plan: '计划中', ongoing: '进行中', done: '已完成' };
    return `<div class="tv-trip" data-lp data-id="${t.id}">
      <div class="tv-triphead"><b>${esc(t.name || '未命名旅行')}</b><span class="tag">${stMap[t.status] || '计划中'}</span></div>
      <div class="tv-sub">${esc(t.dest || '')}${t.dest ? ' · ' : ''}${esc(this._rangeText(t.start, t.end))}</div>
      <div class="tv-tripfoot">
        <button class="btn sm" data-open="${t.id}">查看详情</button>
        <span class="tv-tripfoot-r"><button class="del" data-deltrip="${t.id}">✕</button></span>
      </div>
    </div>`;
  },

  newTripModal(root) {
    const today = todayStr();
    const html = `<div class="tv-modal"><button class="close-x" onclick="closeModal()">×</button>
      <h3>新建旅行计划</h3>
      <div class="tv-frow"><label>名称</label><input class="inp" id="ntName" placeholder="国庆日本行"></div>
      <div class="tv-frow"><label>目的地</label><input class="inp" id="ntDest" placeholder="内蒙古"></div>
      <div class="tv-frow"><label>出发</label><input class="inp" id="ntStart" type="date" value="${today}"></div>
      <div class="tv-frow"><label>返程</label><input class="inp" id="ntEnd" type="date" value="${addDays(today, 4)}"></div>
      <div class="tv-mbtns"><button class="btn" id="ntSave">保存</button></div></div>`;
    const ov = openModal(html);
    ov.querySelector('#ntSave').onclick = () => {
      const name = ov.querySelector('#ntName').value.trim();
      if (!name) { toast('请填写旅行名称'); return; }
      const start = ov.querySelector('#ntStart').value;
      const end = ov.querySelector('#ntEnd').value;
      const t = {
        id: uid(), name, dest: ov.querySelector('#ntDest').value.trim(),
        start: this._isDate(start) ? start : '', end: this._isDate(end) ? end : '',
        status: 'plan', plan: {}, packing: [], notes: [],
        budget: { preset: {}, actual: {}, presetNote: '', actualNote: '' },
        qa: {}, journal: '', cover: null
      };
      const arr = this.trips(); arr.push(t); this.saveTrips(arr);
      closeModal(); this._tripId = t.id; this._openDay = null; this._warn90 = null; this.render(root);
    };
  },

  async delTrip(id) {
    const t = this.trips().find(x => x.id === id);
    if (t) {
      let pids = [];
      (t.notes || []).forEach(n => { pids = pids.concat(n.photoIds || []); });
      (t.packing || []).forEach(p => { pids = pids.concat(p.photoIds || []); });
      for (const pid of pids) await this.deletePhoto(pid);
    }
    this.saveTrips(this.trips().filter(x => x.id !== id));
    this.saveJournals(this.journals().filter(j => j.tripId !== id));
    if (this._tripId === id) this._tripId = null;
  },

  quickNoteModal(root, trip) {
    const d = todayStr();
    const html = `<div class="tv-modal"><button class="close-x" onclick="closeModal()">×</button>
      <h3>随记${trip ? ' · 存入「' + esc(trip.name || '旅行') + '」' : ''}</h3>
      <textarea class="inp" id="qnText" rows="3" placeholder="记一笔"></textarea>
      <div class="tv-frow"><label>地点</label><div style="display:flex;gap:6px;align-items:center"><input class="inp" id="qnPlace"><button class="btn sm ghost" id="qnLoc" type="button" style="flex:none">📍 定位</button></div></div>
      <div class="tv-frow"><label>评分</label><div id="qnStars">${this.starHTML(0)}</div></div>
      <div class="tv-thumbs" id="qnThumbs"></div>
      <div class="tv-mbtns">
        <button class="btn sm ghost" id="qnPhoto">${icon('camera', 14)}</button>
        <button class="btn sm" id="qnSave">保存</button>
      </div></div>`;
    const ov = openModal(html);
    let rate = 0; const pids = [];
    this.bindStars(ov.querySelector('#qnStars'), () => rate, v => { rate = v; });
    ov.querySelector('#qnPhoto').onclick = () => pickPhoto(async dataURL => {
      const pid = uid(); await IDB.put({ id: pid, data: dataURL }); pids.push(pid);
      const box = ov.querySelector('#qnThumbs');
      box.insertAdjacentHTML('beforeend', '<span class="tv-thumb tv-img" data-pid="' + pid + '"></span>');
      this.loadThumbs(box);
    });
    ov.querySelector('#qnSave').onclick = () => {
      const txt = ov.querySelector('#qnText').value.trim();
      if (!txt && !pids.length) { closeModal(); return; }
      const qnloc = ov.querySelector('#qnLoc');
      if (qnloc) qnloc.onclick = () => this.getLoc(qnloc, 'qnPlace');
      if (trip) {
        trip.notes = trip.notes || [];
        trip.notes.push({
          id: uid(), kind: 'note', type: 'note', date: d, time: this._nowHM(),
          place: ov.querySelector('#qnPlace').value.trim(), reason: '', text: txt,
          rating: rate, photoIds: pids.slice()
        });
        this.saveTrip(trip);
        const ph = this.photos(); pids.forEach(p => ph.push({ id: p, date: d, kind: 'trip' })); this.savePhotos(ph);
        closeModal(); this.render(root); toast('已存入「' + (trip.name || '旅行') + '」');
      } else {
        const s = this.outStore(); s[d] = s[d] || [];
        s[d].push({
          id: uid(), kind: 'note', date: d, time: this._nowHM(),
          place: ov.querySelector('#qnPlace').value.trim(), reason: '', text: txt,
          rating: rate, photoIds: pids.slice()
        });
        this.saveOut(s);
        const ph = this.photos(); pids.forEach(p => ph.push({ id: p, date: d, kind: 'out' })); this.savePhotos(ph);
        closeModal(); this.render(root); toast('已记录');
      }
    };
  },

  /* ---------- C6 中国地图（纯离线内嵌 SVG，不联网、不改疆域数据） ---------- */
  mapHTML() {
    const M = window.MUMU_CHINA_MAP;
    if (!M || !M.provinces || !M.provinces.length) return '';
    const mp = this.mapStore();
    const paths = [], labels = [];
    M.provinces.forEach((p, i) => {
      if (p.line) { paths.push('<path class="tv-provline" d="' + p.d + '"/>'); return; }
      const has = (mp[p.n] || []).length > 0;
      paths.push('<path class="tv-prov' + (has ? ' has' : '') + '" id="tvprov_' + i + '" data-prov="' + esc(p.n) + '" d="' + p.d + '"/>');
      if (!has && p.cx && p.cy) labels.push('<text class="tv-provname" x="' + p.cx + '" y="' + p.cy + '">' + esc(p.n) + '</text>');
    });
    return '<svg class="tv-map" viewBox="0 0 ' + M.w + ' ' + M.h + '" xmlns="http://www.w3.org/2000/svg">'
      + '<defs id="tvMapDefs"></defs>'
      + '<g id="tvMapPaths">' + paths.join('') + '</g>'
      + '<g class="tv-maplabels">' + labels.join('') + '</g></svg>';
  },

  bindMap(root) {
    const svg = root.querySelector('.tv-map');
    if (!svg) return;
    svg.querySelectorAll('.tv-prov').forEach(p => p.onclick = () => this.provinceModal(p.dataset.prov, root));
    this.paintMap(svg);
  },

  async paintMap(svg) {
    const M = window.MUMU_CHINA_MAP;
    const defs = svg.querySelector('#tvMapDefs');
    if (!M || !defs) return;
    const NS = 'http://www.w3.org/2000/svg';
    const XL = 'http://www.w3.org/1999/xlink';
    const mp = this.mapStore();
    for (let i = 0; i < M.provinces.length; i++) {
      const p = M.provinces[i];
      if (p.line) continue;
      const ids = mp[p.n] || [];
      if (!ids.length) continue;
      const path = svg.querySelector('#tvprov_' + i);
      if (!path) continue;
      let rec = null;
      try { rec = await IDB.get(ids[0]); } catch (e) { rec = null; }
      if (!rec || !rec.data) continue;
      let bb = null;
      try { bb = path.getBBox(); } catch (e) { bb = null; }
      if (!bb || !bb.width || !bb.height) continue;
      const pid = 'tvpat_' + i;
      const pat = document.createElementNS(NS, 'pattern');
      pat.setAttribute('id', pid);
      pat.setAttribute('patternUnits', 'userSpaceOnUse');
      pat.setAttribute('x', bb.x); pat.setAttribute('y', bb.y);
      pat.setAttribute('width', bb.width); pat.setAttribute('height', bb.height);
      const im = document.createElementNS(NS, 'image');
      im.setAttribute('x', 0); im.setAttribute('y', 0);
      im.setAttribute('width', bb.width); im.setAttribute('height', bb.height);
      im.setAttribute('preserveAspectRatio', 'xMidYMid slice');
      im.setAttribute('href', rec.data);
      try { im.setAttributeNS(XL, 'xlink:href', rec.data); } catch (e) { /* 现代浏览器用 href 即可 */ }
      pat.appendChild(im);
      defs.appendChild(pat);
      path.style.fill = 'url(#' + pid + ')';
    }
  },

  provinceModal(name, root) {
    if (!name) return;
    const ids = this.mapStore()[name] || [];
    /* 单击照片 = 选中（再单击取消） / 长按 = 查看大图
       底部 [+照片] [+排序入口（如未删）] 或 [+删除（选中时启用）]
       此处由 _bindProvinceGrid 控制选中与长按。 */
    const html = `<div class="tv-modal">
      <button class="close-x" onclick="closeModal()">×</button>
      <h3>${esc(name)}</h3>
      <div class="photo-grid tv-flex-photos" id="pvGrid">
        ${ids.map((p, i) => `<div class="pg tv-img${i === 0 ? ' pg-cover' : ''}" data-pid="${p}" data-idx="${i}">
          <span class="tv-pgcover${i === 0 ? ' on' : ''}">${i === 0 ? '封面' : '#' + (i + 1)}</span>
        </div>`).join('')}
      </div>
      <div class="tv-mbtns">
        <button class="btn sm ghost" id="pvAdd">${icon('plus', 14)} 照片</button>
        <button class="btn sm ghost" id="pvDel" disabled>${icon('trash', 14)} 删除</button>
      </div>
    </div>`;
    const ov = openModal(html);
    this.loadThumbs(ov);
    this._bindProvinceGrid(ov, name, root);
    ov.querySelector('#pvAdd').onclick = () => pickPhoto(async dataURL => {
      const pid = uid();
      await IDB.put({ id: pid, data: dataURL });
      const m = this.mapStore(); (m[name] = m[name] || []).push(pid); this.saveMap(m);
      const ph = this.photos(); ph.push({ id: pid, date: todayStr(), kind: 'map', prov: name }); this.savePhotos(ph);
      closeModal(); this.render(root);
      this.provinceModal(name, root);  /* 重开以便显示新封面位置 */
      toast('已收录 ' + name);
    });
    /* 底部 ×删除：仅当有选中时启用 */
    const updateDel = () => {
      const has = ov.querySelector('#pvGrid .pg.pg-selected');
      const btn = ov.querySelector('#pvDel');
      btn.disabled = !has;
      btn.classList.toggle('danger', !!has);
    };
    ov.addEventListener('pg-select-change', updateDel);
    /* 初始态 */
    updateDel();
    ov.querySelector('#pvDel').onclick = async () => {
      const sel = ov.querySelectorAll('#pvGrid .pg.pg-selected');
      if (!sel.length) return;
      const pids = Array.from(sel).map(p => p.dataset.pid);
      /* 二次确认：避免误删（弹层里有不可逆操作） */
      if (!confirm(`删除选中的 ${pids.length} 张照片？`)) return;
      for (const pid of pids) await this.deletePhoto(pid);
      const m = this.mapStore();
      m[name] = (m[name] || []).filter(x => !pids.includes(x));
      this.saveMap(m);
      closeModal(); this.render(root);
      this.provinceModal(name, root);
      toast(`已删除 ${pids.length} 张`);
    };
  },

  /* 省份照片：单击选中（再单击取消）+ 长按查看大图。
     排序功能 v115 已删除（与单击查看手势冲突，需要时再单独做）。 */
  _bindProvinceGrid(ov, name, root) {
    const grid = ov.querySelector('#pvGrid');
    if (!grid) return;

    let pressTimer = 0;
    let pressStart = 0;
    let moved = false;

    /* 单击 → 选中/取消 */
    grid.addEventListener('click', ev => {
      const pg = ev.target.closest('.pg');
      if (!pg) return;
      if (moved) { moved = false; return; }  /* 长按出大图后，避免这 click 误触发选中 */
      const wasSel = pg.classList.contains('pg-selected');
      grid.querySelectorAll('.pg.pg-selected').forEach(p => p.classList.remove('pg-selected'));
      if (!wasSel) pg.classList.add('pg-selected');
      ov.dispatchEvent(new CustomEvent('pg-select-change'));
    });

    /* 长按 → 大图查看 */
    grid.addEventListener('pointerdown', ev => {
      const pg = ev.target.closest('.pg');
      if (!pg) return;
      pressStart = { x: ev.clientX, y: ev.clientY, pid: pg.dataset.pid };
      moved = false;
      pressTimer = setTimeout(() => {
        pressTimer = 0;
        this._photoViewer(ov, name, root, pressStart.pid);
      }, 380);
    });
    grid.addEventListener('pointermove', ev => {
      if (!pressTimer) return;
      if (Math.abs(ev.clientX - pressStart.x) > 6 || Math.abs(ev.clientY - pressStart.y) > 8) {
        clearTimeout(pressTimer); pressTimer = 0; moved = true;
      }
    });
    const cancelPress = () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = 0; } };
    grid.addEventListener('pointerup', cancelPress);
    grid.addEventListener('pointercancel', cancelPress);
    grid.addEventListener('pointerleave', cancelPress);
  },

  /* 单张照片大图查看（含删除该图）。长按照片时调用。 */
  async _photoViewer(ov, name, root, pid) {
    const data = await IDB.get(pid);
    if (!data || !data.data) { toast('照片不存在'); return; }
    const ids = (this.mapStore()[name] || []);
    const idx = ids.indexOf(pid);
    const html = `<div class="tv-modal">
      <button class="close-x" onclick="closeModal()">×</button>
      <img class="pv-view" src="${data.data}">
      <button class="pv-dl" id="pvViewDl" type="button" aria-label="下载">${icon('download', 20)}</button>
      <div class="tv-mbtns">
        <span class="muted" style="margin-right:auto">${idx >= 0 ? '#' + (idx + 1) : ''}</span>
        <button class="btn sm ghost danger" id="pvViewDel">${icon('trash', 14)} 删除该图</button>
      </div>
    </div>`;
    const ov2 = openModal(html);
    /* 关闭大图 → 回到省份照片弹层（保留选中态） */
    const close = () => { closeModal(); /* ov 仍在内存中 */ };
    ov2.querySelector('.close-x').onclick = close;
    /* 点大图本身也关闭 */
    ov2.querySelector('.pv-view').onclick = close;
    ov2.querySelector('#pvViewDl').onclick = () => { const a = document.createElement('a'); a.href = data.data; a.download = '木木_' + pid + '.png'; document.body.appendChild(a); a.click(); a.remove(); toast('已保存到下载'); };
    ov2.querySelector('#pvViewDel').onclick = async () => {
      if (!confirm('删除这张照片？')) return;
      await this.deletePhoto(pid);
      const m = this.mapStore();
      m[name] = (m[name] || []).filter(x => x !== pid);
      this.saveMap(m);
      closeModal();  /* openModal 在 _photoViewer 开头已替换掉省份弹层，此处只关大图层 */
      this.render(root);
      this.provinceModal(name, root);
    };
  },

  /* 日常外出单张照片大图查看（含下载 / 删除，不关联省份） */
  async _outPhotoViewer(root, pid) {
    const data = await IDB.get(pid);
    if (!data || !data.data) { toast('照片不存在'); return; }
    const html = `<div class="tv-modal">
      <button class="close-x" onclick="closeModal()">×</button>
      <img class="pv-view" src="${data.data}">
      <button class="pv-dl" id="pvOutDl" type="button" aria-label="下载">${icon('download', 20)}</button>
      <div class="tv-mbtns">
        <button class="btn sm ghost danger" id="pvOutDel">${icon('trash', 14)} 删除该图</button>
      </div>
    </div>`;
    const ov = openModal(html);
    ov.querySelector('.pv-view').onclick = () => closeModal();
    ov.querySelector('#pvOutDl').onclick = () => { const a = document.createElement('a'); a.href = data.data; a.download = '木木_' + pid + '.png'; document.body.appendChild(a); a.click(); a.remove(); toast('已保存到下载'); };
    ov.querySelector('#pvOutDel').onclick = async () => {
      if (!confirm('删除这张照片？')) return;
      await this.deletePhoto(pid); closeModal();
      if (this.sub === 'trip') this.renderTrip(root); else this.render(root);
    };
  },

  /* 日常外出缩略图：点开看大图（_outPhotoViewer），长按(550ms)删除 */
  bindOutThumbs(scope, root) {
    if (!scope) return;
    scope.querySelectorAll('.tv-thumb[data-outthumb], .pg[data-outthumb]').forEach(el => {
      if (el._outBound) return; el._outBound = true;
      let timer = null, lp = false, sx = 0, sy = 0;
      const start = (x, y) => { lp = false; sx = x; sy = y; timer = setTimeout(() => { lp = true; timer = null; if (confirm('删除这张照片？')) this.deletePhoto(el.dataset.pid).then(() => this.render(root)); }, 550); };
      const move = (x, y) => { if (Math.abs(x - sx) > 12 || Math.abs(y - sy) > 12) { if (timer) { clearTimeout(timer); timer = null; } } };
      const end = () => { if (timer) { clearTimeout(timer); timer = null; if (!lp) this._outPhotoViewer(root, el.dataset.pid); } };
      el.addEventListener('touchstart', e => { const t = e.touches[0]; start(t.clientX, t.clientY); }, { passive: true });
      el.addEventListener('touchmove', e => { const t = e.touches[0]; move(t.clientX, t.clientY); }, { passive: true });
      el.addEventListener('touchend', end);
      el.addEventListener('touchcancel', end);
      el.addEventListener('mousedown', e => start(e.clientX, e.clientY));
      el.addEventListener('mousemove', e => move(e.clientX, e.clientY));
      el.addEventListener('mouseup', end);
      el.addEventListener('mouseleave', end);
    });
  },

  /* ---------- C7 游记库（按地名归档） ---------- */
  openJournalLib(root) {
    const js = this.journals();
    const html = `<div class="tv-modal"><button class="close-x" onclick="closeModal()">×</button>
      <h3>游记库</h3>
      <input class="inp" id="jlSearch" placeholder="地名 / 名称">
      <div id="jlList" class="tv-jlist"></div></div>`;
    const ov = openModal(html);
    const list = ov.querySelector('#jlList');
    const draw = q => {
      q = String(q || '').trim().toLowerCase();
      const f = js.filter(j => !q || ((j.place || '') + ' ' + (j.name || '') + ' ' + (j.text || '')).toLowerCase().includes(q));
      const groups = {};
      f.forEach(j => { const k = j.place || '未标地名'; (groups[k] = groups[k] || []).push(j); });
      const keys = Object.keys(groups).sort();
      list.innerHTML = keys.map(k => `<div class="tv-jgroup">
        <div class="tv-jplace">${icon('location', 13)}<span>${esc(k)}</span></div>
        ${groups[k].map(j => `<div class="tv-jitem" data-jid="${j.id}">
          <b>${esc(j.name || '游记')}</b><span class="tv-sub">${esc(j.range || '')}</span></div>`).join('')}
      </div>`).join('');
      list.querySelectorAll('[data-jid]').forEach(c => c.onclick = () => this.journalViewModal(c.dataset.jid, root));
    };
    draw('');
    ov.querySelector('#jlSearch').oninput = e => draw(e.target.value);
  },

  journalViewModal(jid, root) {
    const j = this.journals().find(x => x.id === jid);
    if (!j) return;
    const hasTrip = !!j.tripId && this.trips().some(x => x.id === j.tripId);
    const trip = hasTrip ? this.trips().find(x => x.id === j.tripId) : null;
    const pids = []; if (trip) (trip.notes || []).forEach(n => (n.photoIds || []).forEach(p => pids.push(p)));
    const longJ = j.text && j.text.length > 600;
    const html = `<div class="tv-modal"><button class="close-x" onclick="closeModal()">×</button>
      <h3>${esc(j.name || '游记')}</h3>
      ${hasTrip ? '<div class="tv-mbtns tv-left"><button class="btn sm ghost" id="jvTrip">' + icon('plane', 14) + ' 打开对应旅行</button></div>' : ''}
      <div class="tv-frow"><label>地名</label><input class="inp" id="jvPlace" value="${esc(j.place || '')}"></div>
      <div class="tv-jpreview" id="jvPreview"${longJ ? ' style="max-height:240px;overflow:hidden"' : ''}>${esc(j.text || '')}</div>
      ${longJ ? '<button class="btn sm ghost" id="jvToggle" style="margin-top:6px">展开全部</button>' : ''}
      <button class="btn sm ghost" id="jvEdit" style="margin-top:6px">编辑文本</button>
      <textarea class="inp tv-jtext" id="jvText" rows="12" style="display:none">${esc(j.text || '')}</textarea>
      ${pids.length ? `<div class="tv-jphotos"><div class="tv-jphead" style="display:flex;align-items:center;gap:6px">${icon('camera',14)}<span>旅途照片（${pids.length}）</span></div><div class="tv-thumbs" id="jvPhBox">${pids.map(p => this.thumbHTML(p)).join('')}</div></div>` : ''}
      <div class="tv-mbtns">
        <button class="btn sm ghost" id="jvDel">${icon('trash', 14)}</button>
        <button class="btn sm" id="jvSave">保存</button>
      </div></div>`;
    const ov = openModal(html);
    this.loadThumbs(ov);
    this.bindPhotoLongPress(ov, root);
    this.bindPhotoDelIn(ov);
    if (hasTrip) ov.querySelector('#jvTrip').onclick = () => {
      this._tripId = j.tripId; this._openDay = null; this._warn90 = null; closeModal(); this.render(root);
    };
    const tx = ov.querySelector('#jvText');
    const toggle = ov.querySelector('#jvToggle');
    if (toggle) toggle.onclick = () => {
      const pv = ov.querySelector('#jvPreview');
      const collapsed = pv.style.maxHeight && pv.style.maxHeight !== 'none';
      pv.style.maxHeight = collapsed ? 'none' : '240px';
      toggle.textContent = collapsed ? '收起' : '展开全部';
    };
    const edit = ov.querySelector('#jvEdit');
    if (edit) edit.onclick = () => {
      tx.style.display = tx.style.display === 'none' ? '' : 'none';
      edit.textContent = tx.style.display === 'none' ? '编辑文本' : '收起编辑';
    };
    ov.querySelector('#jvSave').onclick = () => {
      const arr = this.journals();
      const i = arr.findIndex(x => x.id === jid);
      if (i >= 0) {
        arr[i].text = tx.value;
        arr[i].place = ov.querySelector('#jvPlace').value.trim() || '未标地名';
        this.saveJournals(arr);
      }
      closeModal(); toast('已保存');
    };
    ov.querySelector('#jvDel').onclick = () => {
      this.saveJournals(this.journals().filter(x => x.id !== jid));
      closeModal(); this.render(root);
    };
  },

  /* ========================================================
   *  D. 旅行详情
   * ======================================================== */
  _migrate(t) {
    if (!t) return t;
    let ch = false;
    if (Array.isArray(t.plan)) {
      const o = {};
      t.plan.forEach((d, i) => {
        const ds = this._isDate(d && d.date) ? d.date : this._addDays(t.start, i);
        if (!ds) return;
        o[ds] = {
          from: (d && d.from) || '', to: (d && d.to) || '',
          transport: (d && (d.transport || d.transportThere)) || '',
          plays: (d && d.plays) || [], eats: (d && d.eats) || [], stay: (d && d.stay) || ''
        };
      });
      t.plan = o; ch = true;
    }
    if (!t.plan || typeof t.plan !== 'object') { t.plan = {}; ch = true; }
    if (!t.budget) {
      t.budget = { preset: {}, actual: {}, presetNote: '', actualNote: '' };
      ['ticket', 'hotel', 'ticketFee', 'food', 'other'].forEach(k => {
        t.budget.preset[k] = (t.preset && Number(t.preset[k])) || 0;
        t.budget.actual[k] = (t.actual && Number(t.actual[k])) || 0;
      });
      if (t.preset && t.preset.plans) t.budget.presetNote = (t.preset.plans || []).join('\n');
      if (t.actual && t.actual.plans) t.budget.actualNote = (t.actual.plans || []).join('\n');
      ch = true;
    }
    if (t.preset) { delete t.preset; ch = true; }
    if (t.actual) { delete t.actual; ch = true; }
    if (t.ratings) { delete t.ratings; ch = true; }
    if (!t.qa) { t.qa = {}; ch = true; }
    if (!Array.isArray(t.packing)) { t.packing = []; ch = true; }
    if (!Array.isArray(t.notes)) { t.notes = []; ch = true; }
    /* 单数 photoId → photoIds 数组：先把 photoIds 归一成数组，再并入旧字段，两处逻辑保持一致 */
    t.packing.forEach(p => {
      if (!Array.isArray(p.photoIds)) { p.photoIds = []; ch = true; }
      if (p.photoId) { p.photoIds = p.photoIds.concat([p.photoId]); delete p.photoId; ch = true; }
    });
    t.notes.forEach(n => {
      if (n.rating == null) { n.rating = 0; ch = true; }
      if (!Array.isArray(n.photoIds)) { n.photoIds = []; ch = true; }
      if (n.photoId) { n.photoIds = n.photoIds.concat([n.photoId]); delete n.photoId; ch = true; }
    });
    if (t.photoId) { t.cover = t.cover || t.photoId; delete t.photoId; ch = true; }
    if (!this._isDate(t.start)) { if (t.start) { t.start = ''; ch = true; } }
    if (!this._isDate(t.end)) { if (t.end) { t.end = ''; ch = true; } }
    if (ch) this.saveTrip(t);
    return t;
  },

  _planDates(t) {
    if (!this._isDate(t.start)) return [];
    const end = (this._isDate(t.end) && t.end >= t.start) ? t.end : t.start;
    const total = this._between(t.start, end) + 1;
    const n = Math.min(90, total);
    if (total > 90 && this._warn90 !== t.id) { this._warn90 = t.id; toast('行程超过 90 天，仅生成前 90 天'); }
    const out = [];
    for (let i = 0; i < n; i++) out.push(addDays(t.start, i));
    return out;
  },

  renderTripDetail(root, t) {
    const dates = this._planDates(t);
    root.innerHTML = `
    <div class="tv-scope">
      <div class="tv-head">
        <span class="tv-head-actions"><button class="icon-btn" id="tdBack">${icon('chevronLeft', 18)}</button></span>
      </div>
      <div class="card">
        <input class="inp tv-titlein" id="tdName" value="${esc(t.name || '')}" placeholder="旅行名称">
        <div class="tv-grid2">
          <div class="tv-frow"><label>目的地</label><input class="inp" id="tdDest" value="${esc(t.dest || '')}"></div>
          <div class="tv-frow"><label>状态</label><select class="inp" id="tdStatus">
            <option value="plan"${t.status === 'plan' ? ' selected' : ''}>计划中</option>
            <option value="ongoing"${t.status === 'ongoing' ? ' selected' : ''}>进行中</option>
            <option value="done"${t.status === 'done' ? ' selected' : ''}>已完成</option>
          </select></div>
        </div>
        <div class="tv-grid2">
          <div class="tv-frow"><label>出发</label><input class="inp" id="tdStart" type="date" value="${this._isDate(t.start) ? t.start : ''}"></div>
          <div class="tv-frow"><label>返程</label><input class="inp" id="tdEnd" type="date" value="${this._isDate(t.end) ? t.end : ''}"></div>
        </div>
      </div>
      ${this.sectionHTML('行程规划', 'tdPlanSec', this.planHTML(t, dates))}
      ${this.sectionHTML('行李清单', 'tdPackSec', this.packingHTML(t))}
      ${this.sectionHTML('途中记录', 'tdNoteSec', this.notesHTML(t))}
      ${this.sectionHTML('预设 vs 实际', 'tdCmpSec', this.budgetHTML(t))}
      ${this.sectionHTML('游记', 'tdJourSec', this.journalHTML(t))}
    </div>`;

    root.querySelector('#tdBack').onclick = () => { this._tripId = null; this._openDay = null; this.render(root); };
    const nm = root.querySelector('#tdName');
    nm.onchange = () => { t.name = nm.value.trim(); this.saveTrip(t); };
    const ds2 = root.querySelector('#tdDest');
    ds2.onchange = () => { t.dest = ds2.value.trim(); this.saveTrip(t); };
    const st = root.querySelector('#tdStatus');
    st.onchange = () => { t.status = st.value; this.saveTrip(t); if (t.status === 'done') { this._tripId = null; this.render(root); } };
    const sd = root.querySelector('#tdStart');
    sd.onchange = () => { t.start = this._isDate(sd.value) ? sd.value : ''; this.saveTrip(t); this._openDay = null; this.render(root); };
    const ed = root.querySelector('#tdEnd');
    ed.onchange = () => { t.end = this._isDate(ed.value) ? ed.value : ''; this.saveTrip(t); this._openDay = null; this.render(root); };

    this.bindPlan(root, t);
    this.bindPacking(root, t);
    this.bindNotes(root, t);
    this.bindBudget(root, t);
    this.bindJournal(root, t);
    this.loadThumbs(root);
    this.bindPhotoLongPress(root, root);
    this.bindPhotoDelIn(root.querySelector('#jsPhBox'), t);
  },

  sectionHTML(title, id, inner) {
    return '<div class="card"><h3>' + esc(title) + '</h3><div id="' + id + '">' + inner + '</div></div>';
  },

  /* ---------- D3 行程规划（存进 trip.plan[date]） ---------- */
  planHTML(t, dates) {
    if (!dates.length) return '';
    return dates.map((ds, i) => {
      const p = t.plan[ds] || {};
      const open = this._openDay === ds;
      const sum = [
        (p.from || p.to) ? ((p.from || '') + (p.to ? '→' + p.to : '')) : '',
        (p.plays || []).join('、'),
        p.stay
      ].filter(Boolean).join(' · ');
      return `<div class="tv-day${open ? ' open' : ''}">
        <div class="tv-dayhead" data-day="${ds}">
          <b>第${i + 1}天 · ${esc(this._md(ds))}</b>
          <span class="tv-sub">${esc(this._cut(sum, 22))}</span>
          ${icon(open ? 'chevronUp' : 'chevronDown', 15)}
        </div>
        ${open ? `<div class="tv-daybody" data-plday="${ds}">
          <div class="tv-grid2">
            <input class="inp" id="pl_from" value="${esc(p.from || '')}" placeholder="出发地">
            <input class="inp" id="pl_to" value="${esc(p.to || '')}" placeholder="到达地">
          </div>
          <input class="inp" id="pl_trans" value="${esc(p.transport || '')}" placeholder="交通">
          <input class="inp" id="pl_play" value="${esc((p.plays || []).join('、'))}" placeholder="玩什么">
          <input class="inp" id="pl_eat" value="${esc((p.eats || []).join('、'))}" placeholder="吃什么">
          <input class="inp" id="pl_stay" value="${esc(p.stay || '')}" placeholder="住哪里">
          <div class="tv-mbtns"><button class="btn sm" id="pl_save">保存</button></div>
        </div>` : ''}
      </div>`;
    }).join('');
  },

  bindPlan(root, t) {
    root.querySelectorAll('[data-day]').forEach(el => el.onclick = () => {
      this._openDay = (this._openDay === el.dataset.day) ? null : el.dataset.day;
      this.render(root);
    });
    const btn = root.querySelector('#pl_save');
    if (!btn) return;
    btn.onclick = () => {
      const body = root.querySelector('.tv-daybody[data-plday]');
      const ds = body && body.dataset.plday;
      if (!this._isDate(ds)) return;
      const g = id => { const e = body.querySelector('#' + id); return e ? e.value : ''; };
      t.plan[ds] = {
        from: g('pl_from').trim(), to: g('pl_to').trim(), transport: g('pl_trans').trim(),
        plays: this._splitList(g('pl_play')), eats: this._splitList(g('pl_eat')), stay: g('pl_stay').trim()
      };
      this.saveTrip(t);
      this._openDay = null;
      this.render(root);
      toast('已保存');
    };
  },

  /* ---------- D4 行李清单 ---------- */
  packingHTML(t) {
    const items = (t.packing || []).map(p => `<div class="list-row tv-packrow" data-lp>
      <input type="checkbox" class="tv-cb"${p.packed ? ' checked' : ''} data-pack="${p.id}">
      <span class="tv-packname${p.packed ? ' done' : ''}">${esc(p.name || '')}</span>
      <span class="tv-thumbs">${(p.photoIds || []).map(x => this.thumbHTML(x)).join('')}</span>
      <button class="icon-btn tv-mini" data-packphoto="${p.id}">${icon('camera', 14)}</button>
      <button class="del" data-delpack="${p.id}">✕</button>
    </div>`).join('');
    return items + `<div class="tv-addrow">
      <input class="inp" id="pkName" placeholder="要带的东西">
      <button class="btn sm" id="pkAdd">${icon('plus', 14)}</button>
    </div>`;
  },

  bindPacking(root, t) {
    root.querySelectorAll('[data-pack]').forEach(cb => cb.onchange = () => {
      const p = (t.packing || []).find(x => x.id === cb.dataset.pack);
      if (!p) return;
      p.packed = cb.checked; this.saveTrip(t);
      const nm = cb.parentElement.querySelector('.tv-packname');
      if (nm) nm.classList.toggle('done', !!p.packed);
    });
    root.querySelectorAll('[data-delpack]').forEach(b => b.onclick = async () => {
      this.flushOpenPlan(root, t);
      const p = (t.packing || []).find(x => x.id === b.dataset.delpack);
      if (p) for (const pid of (p.photoIds || [])) await this.deletePhoto(pid);
      t.packing = (t.packing || []).filter(x => x.id !== b.dataset.delpack);
      this.saveTrip(t); this.render(root);
    });
    root.querySelectorAll('[data-packphoto]').forEach(b => b.onclick = () => pickPhoto(async dataURL => {
      const pid = uid(); await IDB.put({ id: pid, data: dataURL });
      const p = (t.packing || []).find(x => x.id === b.dataset.packphoto);
      if (p) { p.photoIds = p.photoIds || []; p.photoIds.push(pid); this.saveTrip(t); }
      const ph = this.photos(); ph.push({ id: pid, date: todayStr(), kind: 'trip' }); this.savePhotos(ph);
      this.appendThumb(b, pid);   // 局部追加，不整页重渲
    }));
    const add = root.querySelector('#pkAdd');
    if (add) add.onclick = () => {
      const inp = root.querySelector('#pkName');
      const v = inp.value.trim();
      if (!v) return;
      this.flushOpenPlan(root, t);
      t.packing = t.packing || [];
      t.packing.push({ id: uid(), name: v, packed: false, photoIds: [] });
      this.saveTrip(t); this.render(root);
    };
    this.bindPhotoDelIn(root.querySelector('#tdPackSec'), t);
  },

  bindPhotoDelIn(scope) {
    if (!scope) return;
    const root = this._root;
    scope.querySelectorAll('[data-delphoto]').forEach(b => b.onclick = async ev => {
      ev.stopPropagation();
      await this.deletePhoto(b.dataset.delphoto);
      this.render(root);
    });
  },
  bindPhotoLongPress(scope, root) {
    if (!scope) return;
    scope.querySelectorAll('.tv-thumb[data-delphoto]').forEach(el => {
      if (el._lpBound) return; el._lpBound = true;
      let timer = null, sx = 0, sy = 0;
      const begin = (x, y) => { sx = x; sy = y; timer = setTimeout(() => { timer = null; if (confirm('删除这张照片？')) { this.deletePhoto(el.dataset.delphoto).then(() => this.render(root)); } }, 550); };
      const move = (x, y) => { if (Math.abs(x - sx) > 12 || Math.abs(y - sy) > 12) { if (timer) { clearTimeout(timer); timer = null; } } };
      const end = () => { if (timer) { clearTimeout(timer); timer = null; } };
      el.addEventListener('touchstart', e => { const t = e.touches[0]; begin(t.clientX, t.clientY); }, { passive: true });
      el.addEventListener('touchmove', e => { const t = e.touches[0]; move(t.clientX, t.clientY); }, { passive: true });
      el.addEventListener('touchend', end);
      el.addEventListener('touchcancel', end);
      el.addEventListener('mousedown', e => begin(e.clientX, e.clientY));
      el.addEventListener('mousemove', e => move(e.clientX, e.clientY));
      el.addEventListener('mouseup', end);
      el.addEventListener('mouseleave', end);
    });
  },

  /* 在行李/记录缩略图区局部追加一张刚拍的照片，避免整页重渲导致其它未保存输入丢失 */
  appendThumb(holderEl, pid) {
    if (!holderEl) return;
    const row = holderEl.closest('.list-row, .tv-packrow, .tv-noterow') || holderEl.parentElement;
    const th = row ? row.querySelector('.tv-thumbs') : null;
    if (th) {
      th.insertAdjacentHTML('beforeend', this.thumbHTML(pid));
      this.loadThumbs(th);
      this.bindOutThumbs(th, this._root);   // 新缩略图：点开看大图、长按要求删除
    }
  },

  /* 整页 render 前，把当前展开的「计划日」输入框落盘，避免丢失。
     日期一律从 DOM 上的 .tv-daybody[data-plday] 取，输入框也在该 body 内取，
     绝不读 this._openDay —— 这样即使 _openDay 已被切走，落盘的仍是 DOM 上那一天，
     跨写污染不可能发生；重复调用只是幂等重写同一天。 */
  flushOpenPlan(root, t) {
    const body = root && root.querySelector('.tv-daybody[data-plday]');
    if (!body) return;                       // 不在旅行详情页 / 没展开日 → 绝不写
    const ds = body.dataset.plday;
    if (!this._isDate(ds)) return;
    const g = id => { const e = body.querySelector('#' + id); return e ? e.value : null; };
    const from = g('pl_from');
    if (from === null) return;
    // 隐式自动落盘：不允许把「已存内容」抹空（清空是 #pl_save 显式按钮的意图）
    const to = g('pl_to'), transport = g('pl_trans'), stay = g('pl_stay');
    const plays = this._splitList(g('pl_play')), eats = this._splitList(g('pl_eat'));
    const empty = !from.trim() && !to && !transport && !stay && !plays.length && !eats.length;
    const old = (t.plan || {})[ds];
    const oldHas = old && (old.from || old.to || old.transport || old.stay || (old.plays || []).length || (old.eats || []).length);
    if (empty && oldHas) return;
    t.plan = t.plan || {};
    t.plan[ds] = { from: from.trim(), to: to.trim(), transport: transport.trim(), plays, eats, stay: stay.trim() };
    this.saveTrip(t);
  },

  /* ---------- D6 途中记录（每条自带评分） ---------- */
  notesHTML(t) {
    const notes = (t.notes || []).slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    const rows = notes.map(n => `<div class="list-row tv-noterow" data-lp>
      <div class="tv-notemain">
        <div class="tv-noteline"><span class="tag">${esc(this._typeName(n.type))}</span>
          <b>${esc(n.text || '')}</b>
          <span class="tv-sub">${esc(this._md(n.date))}</span></div>
        <div class="tv-noterate" data-noteid="${n.id}">${this.starHTML(n.rating || 0)}</div>
        <span class="tv-thumbs">${(n.photoIds || []).map(x => this.thumbHTML(x)).join('')}</span>
      </div>
      <button class="icon-btn tv-mini" data-notephoto="${n.id}">${icon('camera', 14)}</button>
      <button class="del" data-deln="${n.id}">✕</button>
    </div>`).join('');
    return `<div class="tv-addrow">
        <input class="inp" id="ntText" placeholder="记一笔">
        <select class="inp tv-typesel" id="ntType">
          <option value="note">随记</option><option value="food">吃</option>
          <option value="play">玩</option><option value="scenic">景</option><option value="hotel">住</option>
        </select>
        <button class="btn sm" id="ntAdd">${icon('plus', 14)}</button>
      </div>${rows}`;
  },

  bindNotes(root, t) {
    const add = root.querySelector('#ntAdd');
    if (add) add.onclick = () => {
      const inp = root.querySelector('#ntText');
      const v = inp.value.trim();
      if (!v) return;
      t.notes = t.notes || [];
      t.notes.push({ id: uid(), date: todayStr(), text: v, type: root.querySelector('#ntType').value, rating: 0, photoIds: [] });
      this.saveTrip(t); this.render(root);
    };
    root.querySelectorAll('[data-deln]').forEach(b => b.onclick = async () => {
      const n = (t.notes || []).find(x => x.id === b.dataset.deln);
      if (n) for (const pid of (n.photoIds || [])) await this.deletePhoto(pid);
      t.notes = (t.notes || []).filter(x => x.id !== b.dataset.deln);
      this.saveTrip(t); this.render(root);
    });
    root.querySelectorAll('[data-notephoto]').forEach(b => b.onclick = () => pickPhoto(async dataURL => {
      const pid = uid(); await IDB.put({ id: pid, data: dataURL });
      const n = (t.notes || []).find(x => x.id === b.dataset.notephoto);
      if (n) { n.photoIds = n.photoIds || []; n.photoIds.push(pid); this.saveTrip(t); }
      const ph = this.photos(); ph.push({ id: pid, date: (n && n.date) || todayStr(), kind: 'trip' }); this.savePhotos(ph);
      this.appendThumb(b, pid);   // 局部追加，不整页重渲（评分/文本均已即时落盘）
    }));
    root.querySelectorAll('[data-noteid]').forEach(box => {
      const n = (t.notes || []).find(x => x.id === box.dataset.noteid);
      if (!n) return;
      this.bindStars(box, () => n.rating || 0, v => { n.rating = v; this.saveTrip(t); });
    });
    this.bindPhotoDelIn(root.querySelector('#tdNoteSec'));
  },

  /* ---------- D5 预设 vs 实际 ---------- */
  _budgetKeys() { return [['ticket', '交通'], ['hotel', '住宿'], ['ticketFee', '门票'], ['food', '吃饭'], ['other', '其他']]; },

  budgetHTML(t) {
    const b = t.budget;
    let sp = 0, sa = 0;
    /* 差额方向：pv - av（实际比预算高 = 负数 = 超支；反之结余）
       这样 "实际高于预算" 时显示 -X（红），符合用户直觉。 */
    const rows = this._budgetKeys().map(kv => {
      const k = kv[0], lb = kv[1];
      const pv = Number(b.preset[k]) || 0, av = Number(b.actual[k]) || 0;
      sp += pv; sa += av;
      const df = pv - av;
      return `<div class="tv-bgrow">
        <span class="tv-bglb">${lb}</span>
        <input class="inp tv-bgin" type="number" inputmode="decimal" id="pre_${k}" value="${pv}">
        <input class="inp tv-bgin" type="number" inputmode="decimal" id="act_${k}" value="${av}">
        <span class="tv-bgdf${df < 0 ? ' over' : ''}">${this._diff(df)}</span>
      </div>`;
    }).join('');
    const dt = sp - sa;
    return `<div class="tv-bgrow tv-bghead"><span class="tv-bglb"></span><span>预设</span><span>实际</span><span class="tv-bgdf">差额</span></div>
      ${rows}
      <div class="tv-bgrow tv-bgsum"><span class="tv-bglb">合计</span><span>${sp}</span><span>${sa}</span><span class="tv-bgdf${dt < 0 ? ' over' : ''}">${this._diff(dt)}</span></div>`;
  },

  bindBudget(root, t) {
    const sec = root.querySelector('#tdCmpSec');
    if (!sec) return;
    const redraw = () => { sec.innerHTML = this.budgetHTML(t); this.bindBudget(root, t); };
    this._budgetKeys().forEach(kv => {
      const k = kv[0];
      const pre = sec.querySelector('#pre_' + k), act = sec.querySelector('#act_' + k);
      if (pre) pre.onchange = () => { t.budget.preset[k] = Number(pre.value) || 0; this.saveTrip(t); redraw(); };
      if (act) act.onchange = () => { t.budget.actual[k] = Number(act.value) || 0; this.saveTrip(t); redraw(); };
    });
  },

  /* ---------- D7 问答式游记 ---------- */
  journalHTML(t) {
    const j = this.journals().find(x => x.tripId === t.id);
    const longJ = j && j.text && j.text.length > 600;
    return `<div class="tv-mbtns tv-left">
        <button class="btn sm" id="jsGen">${icon('edit', 14)} 生成游记</button>
        <button class="btn sm ghost" id="jsLib">${icon('book', 14)} 游记库</button>
        ${t.status !== 'done' ? '<button class="btn sm ghost" id="jsDone">' + icon('check', 14) + ' 标记为已完成</button>' : ''}
      </div>
      ${j ? `
        <div class="tv-jpreview" id="jsPreview"${longJ ? ' style="max-height:220px;overflow:hidden"' : ''}>${esc(j.text || '')}</div>
        ${longJ ? '<button class="btn sm ghost" id="jsToggle" style="margin-top:6px">展开全部</button>' : ''}
        <button class="btn sm ghost" id="jsEdit" style="margin-top:6px">编辑文本</button>
        <textarea class="inp tv-jtext" id="jsText" rows="12" style="display:none">${esc(j.text || '')}</textarea>
        ${this.journalPhotosHTML(t)}
      ` : '<div class="muted" style="padding:8px 0">还没有游记，点「生成游记」用问答式向导一气呵成～</div>'}`;
  },

  journalPhotosHTML(t) {
    const pids = [];
    (t.notes || []).forEach(n => (n.photoIds || []).forEach(p => pids.push(p)));
    if (!pids.length) return '';
    const many = pids.length > 12;
    return `<div class="tv-jphotos">
        <div class="tv-jphead" style="display:flex;align-items:center;gap:6px">${icon('camera', 14)}<span>旅途照片（${pids.length}）</span>${many ? '<button class="btn sm ghost" id="jsPhToggle" style="margin-left:auto">收起</button>' : ''}</div>
        <div class="tv-thumbs" id="jsPhBox"${many ? ' style="max-height:128px;overflow:hidden"' : ''}>${pids.map(p => this.thumbHTML(p)).join('')}</div>
      </div>`;
  },

  bindJournal(root, t) {
    const gen = root.querySelector('#jsGen');
    if (gen) gen.onclick = () => this.journalWizard(t, root, () => { this.render(root); toast('游记已生成'); });
    const lib = root.querySelector('#jsLib');
    if (lib) lib.onclick = () => this.openJournalLib(root);
    const done = root.querySelector('#jsDone');
    if (done) done.onclick = () => this.journalWizard(t, root, () => {
      t.status = 'done'; this.saveTrip(t);
      this._tripId = null; this._openDay = null;
      this.render(root); toast('已完成，游记已入库');
    });
    const tx = root.querySelector('#jsText');
    if (tx) tx.onchange = () => {
      const arr = this.journals();
      const i = arr.findIndex(x => x.tripId === t.id);
      if (i >= 0) { arr[i].text = tx.value; this.saveJournals(arr); }
      t.journal = tx.value; this.saveTrip(t);
    };
    const toggle = root.querySelector('#jsToggle');
    if (toggle) toggle.onclick = () => {
      const pv = root.querySelector('#jsPreview');
      const collapsed = pv.style.maxHeight && pv.style.maxHeight !== 'none';
      pv.style.maxHeight = collapsed ? 'none' : '220px';
      toggle.textContent = collapsed ? '收起' : '展开全部';
    };
    const edit = root.querySelector('#jsEdit');
    if (edit) edit.onclick = () => {
      tx.style.display = tx.style.display === 'none' ? '' : 'none';
      edit.textContent = tx.style.display === 'none' ? '编辑文本' : '收起编辑';
    };
    const phToggle = root.querySelector('#jsPhToggle');
    if (phToggle) phToggle.onclick = () => {
      const box = root.querySelector('#jsPhBox');
      const collapsed = box.style.maxHeight && box.style.maxHeight !== 'none';
      box.style.maxHeight = collapsed ? 'none' : '128px';
      phToggle.textContent = collapsed ? '收起' : '展开';
    };
  },

  _questions(t) {
    const qs = [];
    const dates = this._planDates(t);
    const stays = [];
    dates.forEach((ds, i) => {
      const p = t.plan[ds] || {};
      if (p.stay) stays.push({ i: stays.length + 1, name: p.stay });
    });
    (t.notes || []).filter(n => n.type === 'hotel' && n.text).forEach(n => {
      if (!stays.some(s => s.name === n.text)) stays.push({ i: stays.length + 1, name: n.text });
    });
    if (!stays.length && dates.length > 1) {
      for (let i = 1; i < dates.length; i++) stays.push({ i, name: '' });
    }
    stays.slice(0, 8).forEach(s => qs.push({
      id: 'stay_' + s.i,
      q: '第' + s.i + '晚' + (s.name ? '「' + s.name + '」' : '') + '住得怎么样？',
      rate: true, ph: ''
    }));
    const foods = (t.notes || []).filter(n => n.type === 'food' && n.text);
    const eats = [];
    dates.forEach(ds => ((t.plan[ds] || {}).eats || []).forEach(x => eats.push(x)));
    if (foods.length || eats.length) {
      qs.push({ id: 'food', q: '这趟最难忘的一餐是？', rate: true, ph: (foods[0] && foods[0].text) || eats[0] || '' });
    }
    const spots = [];
    dates.forEach(ds => ((t.plan[ds] || {}).plays || []).forEach(x => spots.push(x)));
    (t.notes || []).filter(n => (n.type === 'play' || n.type === 'scenic') && n.text).forEach(n => spots.push(n.text));
    if (spots.length) qs.push({ id: 'spot', q: '最喜欢哪个地方？', rate: true, ph: spots[0] || '' });
    qs.push({ id: 'gain', q: '这趟旅行最大的收获是？', rate: false, ph: '' });
    qs.push({ id: 'again', q: '还想再来吗？为什么？', rate: true, ph: '' });
    return qs;
  },

  journalWizard(t, root, after) {
    const qs = this._questions(t);
    const ans = Object.assign({}, t.qa || {});
    let i = 0;
    const step = () => {
      if (i >= qs.length) {
        closeModal();
        t.qa = ans; this.saveTrip(t);
        this.buildJournal(t, ans);
        if (after) after();
        return;
      }
      const q = qs[i];
      const cur = ans[q.id] || { text: '', rate: 0 };
      let rate = Number(cur.rate) || 0;
      const html = `<div class="tv-modal"><button class="close-x" onclick="closeModal()">×</button>
        <h3>${esc(q.q)}</h3>
        <textarea class="inp" id="wzText" rows="3" placeholder="${esc(q.ph || '')}">${esc(cur.text || '')}</textarea>
        ${q.rate ? '<div class="tv-frow"><label>评分</label><div id="wzStars">' + this.starHTML(rate) + '</div></div>' : ''}
        <div class="tv-wzfoot"><span class="tv-sub">${i + 1} / ${qs.length}</span>
          <span class="tv-mbtns">
            <button class="btn sm ghost" id="wzSkip">跳过</button>
            <button class="btn sm" id="wzNext">${i === qs.length - 1 ? '完成' : '下一步'}</button>
          </span></div></div>`;
      const ov = openModal(html);
      if (q.rate) this.bindStars(ov.querySelector('#wzStars'), () => rate, v => { rate = v; });
      ov.querySelector('#wzSkip').onclick = () => { i++; step(); };
      ov.querySelector('#wzNext').onclick = () => {
        const tx = ov.querySelector('#wzText');
        ans[q.id] = { text: tx ? tx.value.trim() : '', rate };
        i++; step();
      };
    };
    step();
  },

  /* 纯本地字符串拼装，不调用任何网络/LLM 接口 */
  buildJournal(t, ans) {
    ans = ans || {};
    const L = [];
    L.push('《' + (t.name || '旅行') + '》');
    L.push([t.dest || '', this._rangeText(t.start, t.end)].filter(Boolean).join(' · '));
    L.push('');

    const dates = this._planDates(t);
    const dayLines = [];
    dates.forEach((ds, i) => {
      const p = t.plan[ds] || {};
      const seg = [];
      if (p.from || p.to) seg.push((p.from || '') + (p.to ? '→' + p.to : ''));
      if (p.transport) seg.push(p.transport);
      if ((p.plays || []).length) seg.push('玩：' + p.plays.join('、'));
      if ((p.eats || []).length) seg.push('吃：' + p.eats.join('、'));
      if (p.stay) seg.push('住：' + p.stay);
      (t.notes || []).forEach(n => {
        if (n.date !== ds) return;
        const phn = (n.photoIds || []).length;
        if (n.text) {
          seg.push(this._typeName(n.type) + '：' + n.text + (n.rating ? '（' + n.rating + '分）' : '') + (phn ? '（含' + phn + '张照片）' : ''));
        } else if (n.type === 'ootd' && phn) {
          seg.push('OOTD：今日穿搭（含' + phn + '张照片）');
        }
      });
      if (seg.length) dayLines.push('第' + (i + 1) + '天 ' + this._md(ds) + '｜' + seg.join('；'));
    });
    const usedDates = dates.slice();
    (t.notes || []).forEach(n => {
      if (usedDates.indexOf(n.date) >= 0) return;
      const phn = (n.photoIds || []).length;
      if (n.text) {
        dayLines.push((this._md(n.date) || '路上') + '｜' + this._typeName(n.type) + '：' + n.text + (n.rating ? '（' + n.rating + '分）' : '') + (phn ? '（含' + phn + '张照片）' : ''));
      } else if (n.type === 'ootd' && phn) {
        dayLines.push((this._md(n.date) || '路上') + '｜OOTD：今日穿搭（含' + phn + '张照片）');
      }
    });
    if (dayLines.length) { L.push('— 行程 —'); dayLines.forEach(x => L.push(x)); L.push(''); }

    const b = t.budget || { preset: {}, actual: {} };
    let sp = 0, sa = 0;
    const bl = [];
    this._budgetKeys().forEach(kv => {
      const pv = Number(b.preset[kv[0]]) || 0, av = Number(b.actual[kv[0]]) || 0;
      sp += pv; sa += av;
      if (pv || av) bl.push(kv[1] + ' 预设' + pv + ' / 实际' + av);
    });
    if (sp || sa) {
      L.push('— 花费 —');
      bl.forEach(x => L.push(x));
      L.push('合计 预设' + sp + ' / 实际' + sa + '，' + (sa > sp ? '超支 ' + (sa - sp) : '结余 ' + (sp - sa)) + ' 元');
      L.push('');
    }

    const rated = (t.notes || []).filter(n => Number(n.rating) > 0);
    const qKeys = Object.keys(ans).filter(k => ans[k] && Number(ans[k].rate) > 0);
    if (rated.length || qKeys.length) {
      L.push('— 评分 —');
      const byType = {};
      rated.forEach(n => { (byType[n.type] = byType[n.type] || []).push(Number(n.rating)); });
      Object.keys(byType).forEach(k => {
        const a = byType[k];
        L.push(this._typeName(k) + ' ' + (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) + ' 分（' + a.length + ' 条）');
      });
      const all = rated.map(n => Number(n.rating)).concat(qKeys.map(k => Number(ans[k].rate)));
      if (all.length) L.push('总体 ' + (all.reduce((x, y) => x + y, 0) / all.length).toFixed(1) + ' 分');
      L.push('');
    }

    const qmap = {};
    this._questions(t).forEach(q => qmap[q.id] = q.q);
    const said = Object.keys(ans).filter(k => ans[k] && (ans[k].text || Number(ans[k].rate) > 0));
    if (said.length) {
      L.push('— 感想 —');
      said.forEach(k => {
        const a = ans[k];
        const line = (qmap[k] ? qmap[k] + ' ' : '') + (a.text || '') + (Number(a.rate) > 0 ? '（' + a.rate + '分）' : '');
        L.push(line.trim());
      });
    }

    const text = L.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    const arr = this.journals();
    const idx = arr.findIndex(x => x.tripId === t.id);
    const rec = {
      id: idx >= 0 ? arr[idx].id : uid(),
      tripId: t.id,
      place: (t.dest || '').trim() || '未标地名',
      name: t.name || '旅行',
      start: t.start || '', end: t.end || '',
      range: this._rangeText(t.start, t.end),
      text, updatedAt: new Date().toISOString()
    };
    if (idx >= 0) arr[idx] = rec; else arr.push(rec);
    this.saveJournals(arr);
    t.journal = text; this.saveTrip(t);
    return rec;
  }
};

window.Modules.travel = { render: r => Travel.render(r) };
window.Travel = Travel;
