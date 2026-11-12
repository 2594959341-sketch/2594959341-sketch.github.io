/* 炭炭 · 练口语记录面板（v443 建，仿墨墨）
 * 数据存本地 localStorage（mumu_tantan），形状：
 *   { updated:'YYYY-MM-DD', data:{ 'YYYY-MM-DD':{time:分钟} } }（v444 起只记时长；旧记录里的 talk/review 仍兼容读取）
 * 不依赖任何远程接口：统计 / 连续天数 / 热力图都由本地真实记录驱动。
 * 续火花 'growth:炭炭' 由 streak.js 的 refreshFromTantan() 从此数据重建 done。
 */
const TANTAN = {
  _recOpen: false,
  KEY: 'mumu_tantan',
  get() {
    let d = S.get(this.KEY, null);
    if (!d || typeof d !== 'object') d = { updated: '', data: {} };
    if (!d.data || typeof d.data !== 'object') d.data = {};
    return d;
  },
  hasRec(d, dt) { const v = d[dt]; return !!(v && (v.time > 0 || v.talk > 0 || v.review > 0 || v._seed)); },
  set(obj) { S.set(this.KEY, obj); },
  render(mount) {
    if (!mount) return;
    this.mount = mount;
    this.draw();
  },
  draw() {
    const mount = this.mount; if (!mount) return;
    const data = this.get();
    const has = Object.keys(data.data).length > 0;
    mount.innerHTML =
      '<div class="bbdc-head"><div class="bbdc-title">炭炭 · 口语记录</div>' +
      '<button class="bbdc-refresh" data-tadd>＋ 记一笔</button></div>' +
      '<div class="bbdc-updated" data-tdate></div>' +
      '<div id="tantanBody" class="bbdc-body"></div>';
    const dateEl = mount.querySelector('[data-tdate]');
    if (dateEl) dateEl.textContent = data.updated ? ('最近更新 ' + data.updated) : '还没有记录，点右上角记一笔吧～';
    const body = mount.querySelector('#tantanBody');
    body.innerHTML = has ? this.dashboard(data) : this.emptyState();
    mount.querySelector('[data-tadd]').onclick = () => this.openForm();
    this.bindRecent(body, 'tdel', 'tedit');
  },
  // v444：最近记录的删除叉号默认隐藏，长按该行 ~500ms 才出现；单击仍是编辑，避免误触误删
  bindRecent(body, delAttr, editAttr) {
    const rows = body.querySelectorAll('[data-' + editAttr + ']') || [];
    body.querySelectorAll('[data-' + delAttr + ']').forEach(b => b.onclick = (e) => { e.stopPropagation(); this.del(b.dataset[delAttr]); });
    const clearAll = () => rows.forEach(r => { if (r.classList) r.classList.remove('rec-long'); });
    rows.forEach(r => {
      let timer = null, long = false;
      const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };
      if (r.addEventListener) {
        r.addEventListener('pointerdown', () => {
          long = false; cancel();
          timer = setTimeout(() => { long = true; clearAll(); if (r.classList) r.classList.add('rec-long'); }, 500);
        });
        ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => r.addEventListener(ev, cancel));
        r.addEventListener('contextmenu', e => { e.preventDefault(); });
      }
      r.onclick = (e) => {
        if (long) { long = false; if (e && e.stopPropagation) e.stopPropagation(); return; } // 长按抬手这次 click 不能冒泡到 body，否则刚显示的叉号会被 clearAll 立刻收起
        clearAll();
        this.openForm(r.dataset[editAttr]);
      };
    });
    // v445：最近记录默认只露 3 条，其余折叠；点按钮展开 / 收起
    const fold = body.querySelector('[data-bfold]');
    const moreBtn = body.querySelector('[data-bmore]');
    if (fold && moreBtn) {
      moreBtn.onclick = (e) => {
        if (e && e.stopPropagation) e.stopPropagation();
        const open = fold.classList.contains('is-open');
        this._recOpen = !open; // v445：记住展开态，记一笔 / 删一条重绘后不重复收起
        if (open) { fold.classList.remove('is-open'); moreBtn.textContent = moreBtn.dataset.label || '展开'; }
        else { fold.classList.add('is-open'); moreBtn.textContent = '收起'; }
        clearAll();
      };
    }
    if (body.addEventListener) body.addEventListener('click', e => {
      const t = e.target;
      if (t && t.closest && t.closest('.bbdc-rec-x')) return;
      clearAll();
    });
  },
  emptyState() {
    return '<div class="bbdc-empty">还没有记录呀～<br>点右上角 <b>＋ 记一笔</b>，每天记下练了多久，枝枝帮你把连续天数、热力图都画出来。</div>';
  },
  openForm(date) {
    const mount = this.mount; if (!mount) return;
    const data = this.get();
    const d = date || todayStr();
    const cur = (data.data[d]) || {};
    const old = mount.querySelector('#tantanForm'); if (old) old.remove();
    const form = document.createElement('div');
    form.id = 'tantanForm';
    form.className = 'bbdc-form';
    const isEdit = !!(cur.time || cur._seed);
    // v444：炭炭只记时长，其余不记；新增默认今天，去掉多出来的日期框
    form.innerHTML =
      (date ? '<div class="bbdc-form-date">' + date + '</div>' : '') +
      '<div class="bbdc-form-row"><label>练习时长（分钟）<input class="bbdc-num" type="text" inputmode="numeric" data-ft value="' + (cur.time || '') + '" placeholder="如实填，比如 20"></label></div>' +
      '<div class="bbdc-form-actions">' +
        '<button class="bbdc-btn ghost" data-fc>取消</button>' +
        '<button class="bbdc-btn" data-fs>' + (isEdit ? '更新' : '保存') + '</button>' +
      '</div>';
    mount.querySelector('#tantanBody').before(form);
    form.querySelector('[data-fc]').onclick = () => form.remove();
    form.querySelector('[data-fs]').onclick = () => {
      const ft = parseInt(form.querySelector('[data-ft]').value, 10) || 0;
      const obj = this.get();
      if (ft) obj.data[d] = { time: ft };
      else if (cur._seed) obj.data[d] = { time: 0, _seed: 1 }; // 历史「已练·未记时长」别被空更新抹掉
      else delete obj.data[d];
      obj.updated = todayStr();
      this.set(obj);
      if (window.Streak && Streak.refreshFromTantan) Streak.refreshFromTantan();
      form.remove();
      this.draw();
    };
    try { form.querySelector('[data-ft]').focus(); } catch (e) {}
  },
  del(date) {
    const obj = this.get();
    delete obj.data[date];
    obj.updated = todayStr();
    this.set(obj);
    if (window.Streak && Streak.refreshFromTantan) Streak.refreshFromTantan();
    this.draw();
  },
  dashboard(data) {
    const d = data.data || {};
    const dates = Object.keys(d).sort();
    let totalTime = 0;
    dates.forEach(dt => { totalTime += d[dt].time || 0; });
    // 连续天数与「续火花」页同源（今天还没记不算断；放过日不断但不计数）
    let streak = 0;
    try {
      if (window.Streak && Streak.ensureItems) {
        const _it = Streak.ensureItems().find(x => x.id === 'growth:炭炭');
        if (_it) streak = Streak.curStreak(_it);
      }
    } catch (e) { streak = 0; }
    if (!streak) {
      let cur = todayStr();
      while (cur >= '2025-01-01' && !this.hasRec(d, cur)) cur = addDays(cur, -1);
      while (cur >= '2025-01-01' && this.hasRec(d, cur)) { streak++; cur = addDays(cur, -1); }
    }
    const stats = '<div class="bbdc-stats tantan-stats">' +
      this.stat(streak, '连续天数') +
      this.stat((totalTime / 60).toFixed(1), '累计时长(h)') +
      '</div>';
    // 近 30 天柱状（按分钟）
    const last30 = []; let c = todayStr();
    for (let i = 0; i < 30; i++) { last30.push(c); c = addDays(c, -1); }
    last30.reverse();
    const bars = '<div class="bbdc-bars">' + last30.map(dt => {
      const v = d[dt] || {}; const t = v.time || 0; const sd = !t && !!(v._seed || v.talk || v.review);
      const h = sd ? 6 : Math.max(2, Math.min(64, Math.round(t / 2)));
      return '<div class="bbdc-bar" title="' + dt + (t ? (': ' + t + ' 分钟') : (sd ? ': 已练（未记时长）' : ': 未练习')) + '"><div class="bbdc-bar-f" style="height:' + h + 'px"></div><span class="bbdc-bar-d">' + dt.slice(5) + '</span></div>';
    }).join('') + '</div>';
    // 热力图（近 ~140 天，按分钟着色）
    const hmDates = []; let h = todayStr();
    for (let i = 0; i < 140; i++) { hmDates.push(h); h = addDays(h, -1); }
    hmDates.reverse();
    const hm = '<div class="bbdc-hm">' + hmDates.map(dt => {
      const v = d[dt] || {}; const t = v.time || 0;
      const lvl = t > 0 ? (t <= 15 ? 1 : t <= 30 ? 2 : t <= 60 ? 3 : 4) : ((v._seed || v.talk || v.review) ? 1 : 0);
      return '<div class="bbdc-cell lvl' + lvl + '" title="' + dt + (t ? (': ' + t + ' 分钟') : (v._seed ? ': 已练（未记时长）' : '')) + '"></div>';
    }).join('') + '</div>';
    // 最近记录（最近 10 条，倒序；v445 默认只露 3 条，其余折叠，点一下展开）
    const recent = dates.slice(-10).reverse();
    const rowHTML = dt => {
      const v = d[dt];
      return '<div class="bbdc-rec" data-tedit="' + dt + '">' +
        '<span class="bbdc-rec-d">' + dt + '</span>' +
        '<span class="bbdc-rec-v">' + (v.time ? v.time + ' 分' : ((v._seed || v.talk || v.review) ? '已练 · 未记时长' : '—')) + '</span>' +
        '<button class="bbdc-rec-x" data-tdel="' + dt + '">×</button></div>';
    };
    const shown = recent.slice(0, 3), rest = recent.slice(3);
    const recentHTML = '<div class="bbdc-card"><h3>最近记录</h3><div class="bbdc-recent">' +
      shown.map(rowHTML).join('') +
      (rest.length ? '<div class="bbdc-rec-fold' + (this._recOpen ? ' is-open' : '') + '" data-bfold>' + rest.map(rowHTML).join('') + '</div>' +
        '<button class="bbdc-more-btn" data-bmore data-label="展开 ' + rest.length + ' 条">' + (this._recOpen ? '收起' : '展开 ' + rest.length + ' 条') + '</button>' : '') +
      '</div></div>';
    return stats +
      '<div class="bbdc-card"><h3>练习热力图（按分钟）</h3>' + hm + '</div>' +
      '<div class="bbdc-card"><h3>近 30 天练习时长</h3>' + bars + '</div>' +
      recentHTML;
  },
  stat(n, label) {
    return '<div class="bbdc-stat"><div class="n">' + n + '</div><div class="l">' + label + '</div></div>';
  }
};
window.TANTAN = TANTAN;
