/* 不背单词自动同步面板（v426）
 * 数据来自同源 GitHub Pages 上的 data/bbdc.json（网络优先，每日自动更新）。
 * 由自动化任务用 user_id 拉取不背单词公开统计接口，写入 bbdc.json 并部署。
 * 本模块只负责拉取、本地缓存(mumu_bbdc)、渲染看板，并把有学习的日子同步进续火花。
 */
const BBDC = {
  url: 'data/bbdc.json',
  async render(mount) {
    if (!mount) return;
    mount.innerHTML =
      '<div class="bbdc-head"><div class="bbdc-title">不背单词 · 学习数据</div>' +
      '<button class="bbdc-refresh" data-bref>刷新</button></div>' +
      '<div class="bbdc-updated" data-bdate></div>' +
      '<div id="bbdcBody" class="bbdc-body"><div class="muted">加载中…</div></div>';
    const btn = mount.querySelector('[data-bref]');
    if (btn) btn.onclick = () => this.load(mount, true);
    this.load(mount, false);
  },
  async load(mount, force) {
    const body = mount.querySelector('#bbdcBody');
    const dateEl = mount.querySelector('[data-bdate]');
    if (!body) return;
    body.innerHTML = '<div class="muted">加载中…</div>';
    try {
      const u = this.url + (force ? '?_=' + Date.now() : '');
      const r = await fetch(u, force ? { cache: 'no-store' } : undefined);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const data = await r.json();
      S.set('mumu_bbdc', data);                       // 供续火花读取
      if (window.Streak && Streak.refreshFromBbdc) Streak.refreshFromBbdc();
      if (dateEl) dateEl.textContent = data.updated ? ('更新于 ' + data.updated) : '';
      body.innerHTML = this.dashboard(data);
    } catch (e) {
      body.innerHTML = '<div class="bbdc-empty">还没有同步数据呀～<br>把不背单词的 <b>user_id</b> 告诉枝枝，我就能每天自动把学习数据接进来啦。</div>';
    }
  },
  dashboard(data) {
    const d = (data && data.data) || {};
    const dates = Object.keys(d).sort();
    if (!dates.length) return '<div class="bbdc-empty">还没有同步数据呀～<br>把不背单词的 <b>user_id</b> 告诉枝枝，我就能每天自动把学习数据接进来啦。</div>';
    let totalTime = 0, totalLearn = 0, totalReview = 0;
    dates.forEach(dt => { const v = d[dt]; totalTime += v.time || 0; totalLearn += v.learn || 0; totalReview += v.review || 0; });
    // 连续天数：从今天往前数有学习的连续天数
    let streak = 0; let cur = todayStr();
    while (cur >= '2025-01-01') { const v = d[cur]; if (v && (v.time > 0 || v.learn > 0 || v.review > 0)) streak++; else break; cur = addDays(cur, -1); }
    const stats =
      '<div class="bbdc-stats">' +
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
      return '<div class="bbdc-bar" title="' + dt + (t ? ('：' + t + ' 分钟') : '：未学习') + '"><div class="bbdc-bar-f" style="height:' + h + 'px"></div><span class="bbdc-bar-d">' + dt.slice(5) + '</span></div>';
    }).join('') + '</div>';
    // 热力图（近 ~140 天，按分钟着色）
    const hmDates = []; let h = todayStr();
    for (let i = 0; i < 140; i++) { hmDates.push(h); h = addDays(h, -1); }
    hmDates.reverse();
    const hm = '<div class="bbdc-hm">' + hmDates.map(dt => {
      const v = d[dt] || {}; const t = v.time || 0;
      const lvl = t <= 0 ? 0 : t <= 15 ? 1 : t <= 30 ? 2 : t <= 60 ? 3 : 4;
      return '<div class="bbdc-cell lvl' + lvl + '" title="' + dt + (t ? ('：' + t + ' 分钟') : '') + '"></div>';
    }).join('') + '</div>';
    return stats +
      '<div class="bbdc-card"><h3>学习热力图（按分钟）</h3>' + hm + '</div>' +
      '<div class="bbdc-card"><h3>近 30 天学习时长</h3>' + bars + '</div>';
  },
  stat(n, label) {
    return '<div class="bbdc-stat"><div class="n">' + n + '</div><div class="l">' + label + '</div></div>';
  }
};
window.BBDC = BBDC;
