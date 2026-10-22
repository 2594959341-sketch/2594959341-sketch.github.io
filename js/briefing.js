/* 每日简报（v412）：聚合三个自动化任务的产出
 * 数据来自同源 GitHub Pages 上的 briefings/<type>.json（网络优先，自动更新）。
 * 自动化任务每天跑完会把最新简报写进对应 JSON 并部署，这里只负责拉取与渲染。
 */
const Briefing = {
  types: [
    { key: 'shizheng', title: '时政要闻', icon: 'book' },
    { key: 'ai', title: 'AI 重点资讯', icon: 'sparkles' },
    { key: 'game', title: '游戏行业资讯', icon: 'game' }
  ],
  render(root) {
    root.innerHTML =
      '<div class="brf-head"><div class="brf-title">' + icon('clipboard', 20) + ' 每日简报</div>' +
      '<button class="brf-refresh" data-bref>' + icon('refresh', 14) + ' 刷新</button></div>' +
      '<div id="brfList" class="brf-list">' + this.types.map(t =>
        '<div class="brf-card"><div class="brf-card-h">' + icon(t.icon, 16) + '<b>' + esc(t.title) + '</b>' +
        '<span class="brf-date" data-d="' + t.key + '"></span></div>' +
        '<div class="brf-card-b" data-b="' + t.key + '"><div class="muted">加载中…</div></div></div>'
      ).join('') + '</div>';
    const btn = root.querySelector('[data-bref]');
    if (btn) btn.onclick = () => this.load(root, true);
    this.load(root, false);
  },
  async load(root, force) {
    const box = root.querySelector('#brfList');
    if (!box) return;
    for (const t of this.types) {
      const body = box.querySelector('[data-b="' + t.key + '"]');
      const dateEl = box.querySelector('[data-d="' + t.key + '"]');
      if (!body) continue;
      body.innerHTML = '<div class="muted">加载中…</div>';
      try {
        const url = 'briefings/' + t.key + '.json' + (force ? '?_=' + Date.now() : '');
        const ctl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
        const timer = ctl ? setTimeout(() => ctl.abort(), 8000) : null;
        const r = await fetch(url, force ? { cache: 'no-store', signal: ctl.signal } : (ctl ? { signal: ctl.signal } : undefined));
        if (timer) clearTimeout(timer);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const data = await r.json();
        if (dateEl) dateEl.textContent = data.date ? ('更新于 ' + data.date) : '';
        body.innerHTML = this.renderItems(data.items || []);
      } catch (e) {
        body.innerHTML = '<div class="muted">暂无更新</div>';
      }
    }
  },
  renderItems(items) {
    if (!items || !items.length) return '<div class="muted">暂无内容</div>';
    const groups = {};
    items.forEach(it => {
      const c = (it.cat || '').trim();
      (groups[c] = groups[c] || []).push(it.text || '');
    });
    return Object.keys(groups).map(c =>
      (c ? '<div class="brf-cat">' + esc(c) + '</div>' : '') +
      '<ul class="brf-items">' + groups[c].filter(Boolean).map(t => '<li>' + esc(t) + '</li>').join('') + '</ul>'
    ).join('');
  }
};
window.Modules.briefing = { render: r => Briefing.render(r) };
