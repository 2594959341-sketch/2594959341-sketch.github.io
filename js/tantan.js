/* 炭炭 · 练口语记录面板（v443 建，仿墨墨）
 * 数据存本地 localStorage（mumu_tantan），形状：
 *   { updated:'YYYY-MM-DD', data:{ 'YYYY-MM-DD':{time:分钟, talk:学会话(段), review:复习会话(段)} } }
 * 不依赖任何远程接口：统计 / 连续天数 / 热力图都由本地真实记录驱动。
 * 续火花 'growth:炭炭' 由 streak.js 的 refreshFromTantan() 从此数据重建 done。
 */
const TANTAN = {
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
    body.querySelectorAll('[data-tdel]').forEach(b => b.onclick = (e) => { e.stopPropagation(); this.del(b.dataset.tdel); });
    body.querySelectorAll('[data-tedit]').forEach(r => r.onclick = () => this.openForm(r.dataset.tedit));
  },
  emptyState() {
    return '<div class="bbdc-empty">还没有记录呀～<br>点右上角 <b>＋ 记一笔</b>，每天记下练了多久、学会话多少，枝枝帮你把连续天数、热力图都画出来。</div>';
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
    const isEdit = !!(cur.time || cur.talk || cur.review || cur._seed);
    form.innerHTML =
      '<div class="bbdc-form-row"><label>日期<input type="date" data-fd value="' + d + '"></label></div>' +
      '<div class="bbdc-form-row bbdc-form-3">' +
        '<label>时长(分)<input class="bbdc-num" type="text" inputmode="numeric" style="direction:ltr" data-ft value="' + (cur.time || '') + '"></label>' +
        '<label>学会话<input class="bbdc-num" type="text" inputmode="numeric" style="direction:ltr" data-fl value="' + (cur.talk || '') + '"></label>' +
        '<label>复习会话<input class="bbdc-num" type="text" inputmode="numeric" style="direction:ltr" data-fr value="' + (cur.review || '') + '"></label>' +
      '</div>' +
      '<div class="bbdc-form-actions">' +
        '<button class="bbdc-btn ghost" data-fc>取消</button>' +
        '<button class="bbdc-btn" data-fs>' + (isEdit ? '更新' : '保存') + '</button>' +
      '</div>';
    mount.querySelector('#tantanBody').before(form);
    form.querySelector('[data-fc]').onclick = () => form.remove();
    form.querySelector('[data-fs]').onclick = () => {
      const fd = form.querySelector('[data-fd]').value || todayStr();
      const ft = parseInt(form.querySelector('[data-ft]').value, 10) || 0;
      const fl = parseInt(form.querySelector('[data-fl]').value, 10) || 0;
      const fr = parseInt(form.querySelector('[data-fr]').value, 10) || 0;
      const obj = this.get();
      if (ft || fl || fr) obj.data[fd] = { time: ft, talk: fl, review: fr };
      else delete obj.data[fd];
      obj.updated = todayStr();
      this.set(obj);
      if (window.Streak && Streak.refreshFromTantan) Streak.refreshFromTantan();
      form.remove();
      this.draw();
    };
    try { form.querySelector('[data-fd]').focus(); } catch (e) {}
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
    let totalTime = 0, totalTalk = 0, totalReview = 0;
    dates.forEach(dt => { const v = d[dt]; totalTime += v.time || 0; totalTalk += v.talk || 0; totalReview += v.review || 0; });
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
    const stats = '<div class="bbdc-stats">' +
      this.stat(streak, '连续天数') +
      this.stat((totalTime / 60).toFixed(1), '累计时长(h)') +
      this.stat(totalTalk, '累计学会话') +
      this.stat(totalReview, '累计复习') +
      '</div>';
    // 近 30 天柱状（按分钟）
    const last30 = []; let c = todayStr();
    for (let i = 0; i < 30; i++) { last30.push(c); c = addDays(c, -1); }
    last30.reverse();
    const bars = '<div class="bbdc-bars">' + last30.map(dt => {
      const v = d[dt] || {}; const t = v.time || 0; const sd = !!v._seed && !t;
      const h = sd ? 6 : Math.max(2, Math.min(64, Math.round(t / 2)));
      return '<div class="bbdc-bar" title="' + dt + (t ? (': ' + t + ' 分钟') : (sd ? ': 已练（未记时长）' : ': 未练习')) + '"><div class="bbdc-bar-f" style="height:' + h + 'px"></div><span class="bbdc-bar-d">' + dt.slice(5) + '</span></div>';
    }).join('') + '</div>';
    // 热力图（近 ~140 天，按分钟着色）
    const hmDates = []; let h = todayStr();
    for (let i = 0; i < 140; i++) { hmDates.push(h); h = addDays(h, -1); }
    hmDates.reverse();
    const hm = '<div class="bbdc-hm">' + hmDates.map(dt => {
      const v = d[dt] || {}; const t = v.time || 0;
      const lvl = t > 0 ? (t <= 15 ? 1 : t <= 30 ? 2 : t <= 60 ? 3 : 4) : (v._seed ? 1 : 0);
      return '<div class="bbdc-cell lvl' + lvl + '" title="' + dt + (t ? (': ' + t + ' 分钟') : (v._seed ? ': 已练（未记时长）' : '')) + '"></div>';
    }).join('') + '</div>';
    // 最近记录（最近 10 条，倒序）
    const recent = dates.slice(-10).reverse();
    const recentHTML = '<div class="bbdc-card"><h3>最近记录</h3><div class="bbdc-recent">' +
      recent.map(dt => {
        const v = d[dt]; const parts = [];
        if (v.time) parts.push(v.time + ' 分');
        if (v.talk) parts.push('学会话' + v.talk);
        if (v.review) parts.push('复习' + v.review);
        return '<div class="bbdc-rec" data-tedit="' + dt + '">' +
          '<span class="bbdc-rec-d">' + dt + '</span>' +
          '<span class="bbdc-rec-v">' + (parts.join(' · ') || (v._seed ? '已练 · 未记时长' : '—')) + '</span>' +
          '<button class="bbdc-rec-x" data-tdel="' + dt + '">×</button></div>';
      }).join('') + '</div></div>';
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
