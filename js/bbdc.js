/* 墨墨背单词 · 手动记录面板（v427 建，v432 由「不背单词」改名）
 * 数据存本地 localStorage（mumu_bbdc），形状：
 *   { updated:'YYYY-MM-DD', data:{ 'YYYY-MM-DD':{time:分钟, learn:新学, review:复习} } }
 * 不依赖任何远程接口：所有统计 / 连续天数 / 热力图都由本地真实记录驱动。
 * 续火花 'growth:墨墨' 由 streak.js 的 refreshFromBbdc() 从此数据重建 done。
 */
const BBDC = {
  KEY: 'mumu_bbdc',
  get() {
    const d = S.get(this.KEY, null);
    if (!d || typeof d !== 'object') return { updated: '', data: {} };
    if (!d.data || typeof d.data !== 'object') d.data = {};
    return d;
  },
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
    body.querySelectorAll('[data-bdel]').forEach(b => b.onclick = (e) => { e.stopPropagation(); this.del(b.dataset.bdel); });
    body.querySelectorAll('[data-bedit]').forEach(r => r.onclick = () => this.openForm(r.dataset.bedit));
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
    const isEdit = !!(cur.time || cur.learn || cur.review);
    form.innerHTML =
      '<div class="bbdc-form-row"><label>日期<input type="date" data-fd value="' + d + '"></label></div>' +
      '<div class="bbdc-form-row bbdc-form-3">' +
        '<label>时长(分)<input class="bbdc-num" type="text" inputmode="numeric" data-ft value="' + (cur.time || '') + '"></label>' +
        '<label>新学<input class="bbdc-num" type="text" inputmode="numeric" data-fl value="' + (cur.learn || '') + '"></label>' +
        '<label>复习<input class="bbdc-num" type="text" inputmode="numeric" data-fr value="' + (cur.review || '') + '"></label>' +
      '</div>' +
      '<div class="bbdc-form-actions">' +
        '<button class="bbdc-btn ghost" data-fc>取消</button>' +
        '<button class="bbdc-btn" data-fs>' + (isEdit ? '更新' : '保存') + '</button>' +
      '</div>';
    mount.querySelector('#bbdcBody').before(form);
    form.querySelector('[data-fc]').onclick = () => form.remove();
    form.querySelector('[data-fs]').onclick = () => {
      const fd = form.querySelector('[data-fd]').value || todayStr();
      const ft = parseInt(form.querySelector('[data-ft]').value, 10) || 0;
      const fl = parseInt(form.querySelector('[data-fl]').value, 10) || 0;
      const fr = parseInt(form.querySelector('[data-fr]').value, 10) || 0;
      const obj = this.get();
      if (ft || fl || fr) obj.data[fd] = { time: ft, learn: fl, review: fr };
      else delete obj.data[fd];
      obj.updated = todayStr();
      this.set(obj);
      if (window.Streak && Streak.refreshFromBbdc) Streak.refreshFromBbdc();
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
    if (window.Streak && Streak.refreshFromBbdc) Streak.refreshFromBbdc();
    this.draw();
  },
  dashboard(data) {
    const d = data.data || {};
    const dates = Object.keys(d).sort();
    let totalTime = 0, totalLearn = 0, totalReview = 0;
    dates.forEach(dt => { const v = d[dt]; totalTime += v.time || 0; totalLearn += v.learn || 0; totalReview += v.review || 0; });
    let streak = 0; let cur = todayStr();
    while (cur >= '2025-01-01') { const v = d[cur]; if (v && (v.time > 0 || v.learn > 0 || v.review > 0)) streak++; else break; cur = addDays(cur, -1); }
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
      const v = d[dt] || {}; const t = v.time || 0;
      const h = Math.max(2, Math.min(64, Math.round(t / 2)));
      return '<div class="bbdc-bar" title="' + dt + (t ? (': ' + t + ' 分钟') : ': 未学习') + '"><div class="bbdc-bar-f" style="height:' + h + 'px"></div><span class="bbdc-bar-d">' + dt.slice(5) + '</span></div>';
    }).join('') + '</div>';
    // 热力图（近 ~140 天，按分钟着色）
    const hmDates = []; let h = todayStr();
    for (let i = 0; i < 140; i++) { hmDates.push(h); h = addDays(h, -1); }
    hmDates.reverse();
    const hm = '<div class="bbdc-hm">' + hmDates.map(dt => {
      const v = d[dt] || {}; const t = v.time || 0;
      const lvl = t <= 0 ? 0 : t <= 15 ? 1 : t <= 30 ? 2 : t <= 60 ? 3 : 4;
      return '<div class="bbdc-cell lvl' + lvl + '" title="' + dt + (t ? (': ' + t + ' 分钟') : '') + '"></div>';
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
          '<span class="bbdc-rec-v">' + (parts.join(' · ') || '—') + '</span>' +
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
