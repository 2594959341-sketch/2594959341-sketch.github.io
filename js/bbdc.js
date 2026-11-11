/* 墨墨背单词 · 手动记录面板（v427 建，v432 由「不背单词」改名）
 * 数据存本地 localStorage（mumu_bbdc），形状：
 *   { updated:'YYYY-MM-DD', data:{ 'YYYY-MM-DD':{time:分钟, learn:新学, review:复习} } }
 * 不依赖任何远程接口：所有统计 / 连续天数 / 热力图都由本地真实记录驱动。
 * 续火花 'growth:墨墨' 由 streak.js 的 refreshFromBbdc() 从此数据重建 done。
 */
const BBDC = {
  KEY: 'mumu_bbdc',
  get() {
    let d = S.get(this.KEY, null);
    if (!d || typeof d !== 'object') d = { updated: '', data: {} };
    if (!d.data || typeof d.data !== 'object') d.data = {};
    // v438：木木从 11-02 开始背，2/3/4/5 四天当时只在续火花里种了天数、没记时长。
    // 这里如实补进墨墨页自己的数据（标「已背·未记时长」，不编造分钟数）；_v438seed 保证只补一次，之后删改不再回灌
    if (!d._v438seed) {
      d._v438seed = 1;
      ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'].forEach(dt => {
        if (!d.data[dt]) d.data[dt] = { time: 0, learn: 0, review: 0, _seed: 1 };
      });
      this.set(d);
    }
    return d;
  },
  hasRec(d, dt) { const v = d[dt]; return !!(v && (v.time > 0 || v.learn > 0 || v.review > 0 || v._seed)); },
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
      '<div class="bbdc-head"><div class="bbdc-title">墨墨 · 学习记录</div>' +
      '<button class="bbdc-refresh" data-badd>＋ 记一笔</button></div>' +
      '<div class="bbdc-updated" data-bdate></div>' +
      '<div id="bbdcBody" class="bbdc-body"></div>';
    const dateEl = mount.querySelector('[data-bdate]');
    if (dateEl) dateEl.textContent = data.updated ? ('最近更新 ' + data.updated) : '还没有记录，点右上角记一笔吧～';
    const body = mount.querySelector('#bbdcBody');
    body.innerHTML = has ? this.dashboard(data) : this.emptyState();
    mount.querySelector('[data-badd]').onclick = () => this.openForm();
    this.bindRecent(body, 'bdel', 'bedit');
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
    if (body.addEventListener) body.addEventListener('click', e => {
      const t = e.target;
      if (t && t.closest && t.closest('.bbdc-rec-x')) return;
      clearAll();
    });
  },
  emptyState() {
    return '<div class="bbdc-empty">还没有记录呀～<br>点右上角 <b>＋ 记一笔</b>，每天记下学习时长，枝枝帮你把连续天数、热力图都画出来。</div>';
  },
  openForm(date) {
    const mount = this.mount; if (!mount) return;
    const data = this.get();
    const d = date || todayStr();
    const cur = (data.data[d]) || {};
    const old = mount.querySelector('#bbdcForm'); if (old) old.remove();
    const form = document.createElement('div');
    form.id = 'bbdcForm';
    form.className = 'bbdc-form';
    const isEdit = !!(cur.time || cur.learn || cur.review || cur._seed);
    // v444：跟每日计划「记录墨墨」一样，只记 时长 / 新学词数 / 复习词数；新增默认今天，去掉多出来的日期框
    form.innerHTML =
      (date ? '<div class="bbdc-form-date">' + date + '</div>' : '') +
      '<div class="bbdc-form-row"><label>学习时长（分钟）<input class="bbdc-num" type="text" inputmode="numeric" data-ft value="' + (cur.time || '') + '" placeholder="如实填，比如 20"></label></div>' +
      '<div class="bbdc-form-row"><label>新学词数（没学填 0）<input class="bbdc-num" type="text" inputmode="numeric" data-fl value="' + (cur.learn || '') + '" placeholder="0"></label></div>' +
      '<div class="bbdc-form-row"><label>复习词数（没复习填 0）<input class="bbdc-num" type="text" inputmode="numeric" data-fr value="' + (cur.review || '') + '" placeholder="0"></label></div>' +
      '<div class="bbdc-form-actions">' +
        '<button class="bbdc-btn ghost" data-fc>取消</button>' +
        '<button class="bbdc-btn" data-fs>' + (isEdit ? '更新' : '保存') + '</button>' +
      '</div>';
    mount.querySelector('#bbdcBody').before(form);
    form.querySelector('[data-fc]').onclick = () => form.remove();
    form.querySelector('[data-fs]').onclick = () => {
      const ft = parseInt(form.querySelector('[data-ft]').value, 10) || 0;
      const fl = parseInt(form.querySelector('[data-fl]').value, 10) || 0;
      const fr = parseInt(form.querySelector('[data-fr]').value, 10) || 0;
      const obj = this.get();
      if (ft || fl || fr) obj.data[d] = { time: ft, learn: fl, review: fr };
      else if (cur._seed) obj.data[d] = { time: 0, learn: 0, review: 0, _seed: 1 }; // 历史「已背·未记时长」别被空更新抹掉
      else delete obj.data[d];
      obj.updated = todayStr();
      this.set(obj);
      if (window.Streak && Streak.refreshFromBbdc) Streak.refreshFromBbdc();
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
    if (window.Streak && Streak.refreshFromBbdc) Streak.refreshFromBbdc();
    this.draw();
  },
  dashboard(data) {
    const d = data.data || {};
    const dates = Object.keys(d).sort();
    let totalTime = 0, totalLearn = 0, totalReview = 0;
    dates.forEach(dt => { const v = d[dt]; totalTime += v.time || 0; totalLearn += v.learn || 0; totalReview += v.review || 0; });
    // v438：连续天数与「续火花」页同源。旧算法从今天起、遇到第一个没记录的日子就 break，
    // 所以今天还没记一笔就显示 0；现在取续火花口径（今天没打卡不算断，往回找最近一段连续；放过日不断但不计数）
    let streak = 0;
    try {
      if (window.Streak && Streak.ensureItems) {
        const _it = Streak.ensureItems().find(x => x.id === 'growth:墨墨');
        if (_it) streak = Streak.curStreak(_it);
      }
    } catch (e) { streak = 0; }
    if (!streak) {
      let cur = todayStr();
      while (cur >= '2025-01-01' && !this.hasRec(d, cur)) cur = addDays(cur, -1);
      while (cur >= '2025-01-01' && this.hasRec(d, cur)) { streak++; cur = addDays(cur, -1); }
    }
    const stats = '<div class="bbdc-stats">' +
      this.stat(streak, '连续天数') +
      this.stat((totalTime / 60).toFixed(1), '累计时长(h)') +
      this.stat(totalLearn, '累计新学') +
      this.stat(totalReview, '累计复习') +
      '</div>';
    // 近 30 天柱状
    const last30 = []; let c = todayStr();
    for (let i = 0; i < 30; i++) { last30.push(c); c = addDays(c, -1); }
    last30.reverse();
    const bars = '<div class="bbdc-bars">' + last30.map(dt => {
      const v = d[dt] || {}; const t = v.time || 0; const sd = !!v._seed && !t;
      const h = sd ? 6 : Math.max(2, Math.min(64, Math.round(t / 2)));
      return '<div class="bbdc-bar" title="' + dt + (t ? (': ' + t + ' 分钟') : (sd ? ': 已背（未记时长）' : ': 未学习')) + '"><div class="bbdc-bar-f" style="height:' + h + 'px"></div><span class="bbdc-bar-d">' + dt.slice(5) + '</span></div>';
    }).join('') + '</div>';
    // 热力图（近 ~140 天，按分钟着色）
    const hmDates = []; let h = todayStr();
    for (let i = 0; i < 140; i++) { hmDates.push(h); h = addDays(h, -1); }
    hmDates.reverse();
    const hm = '<div class="bbdc-hm">' + hmDates.map(dt => {
      const v = d[dt] || {}; const t = v.time || 0;
      const lvl = t > 0 ? (t <= 15 ? 1 : t <= 30 ? 2 : t <= 60 ? 3 : 4) : (v._seed ? 1 : 0);
      return '<div class="bbdc-cell lvl' + lvl + '" title="' + dt + (t ? (': ' + t + ' 分钟') : (v._seed ? ': 已背（未记时长）' : '')) + '"></div>';
    }).join('') + '</div>';
    // 最近记录（最近 10 条，倒序）
    const recent = dates.slice(-10).reverse();
    const recentHTML = '<div class="bbdc-card"><h3>最近记录</h3><div class="bbdc-recent">' +
      recent.map(dt => {
        const v = d[dt]; const parts = [];
        if (v.time) parts.push(v.time + ' 分');
        if (v.learn) parts.push('新学' + v.learn);
        if (v.review) parts.push('复习' + v.review);
        return '<div class="bbdc-rec" data-bedit="' + dt + '">' +
          '<span class="bbdc-rec-d">' + dt + '</span>' +
          '<span class="bbdc-rec-v">' + (parts.join(' · ') || (v._seed ? '已背 · 未记时长' : '—')) + '</span>' +
          '<button class="bbdc-rec-x" data-bdel="' + dt + '">×</button></div>';
      }).join('') + '</div></div>';
    return stats +
      '<div class="bbdc-card"><h3>学习热力图（按分钟）</h3>' + hm + '</div>' +
      '<div class="bbdc-card"><h3>近 30 天学习时长</h3>' + bars + '</div>' +
      recentHTML;
  },
  stat(n, label) {
    return '<div class="bbdc-stat"><div class="n">' + n + '</div><div class="l">' + label + '</div></div>';
  }
};
window.BBDC = BBDC;
