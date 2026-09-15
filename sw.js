/* 木木的工作台 · Service Worker
 * - 应用外壳与代码：网络优先（在线即最新）+ 离线回落缓存（保证强刷看得到新版本）
 * - 每日数据(js/data/)：网络优先，联网即用最新，断网回退缓存
 * - 枝枝喵资源：两套主题都预缓存，一键切换可离线
 *   · png/    = cat（当前枝枝喵）
 *   · zhiya/  = zhiya（旧版枝丫）
 */
const CACHE = 'mumu-v304';
const CAT = [
  'icon-192.png','icon-512.png','icon-maskable-512.png','apple-touch-180.png','logo-64.png','splash-kitty.png',
  'mood-great.png','mood-ok.png','mood-tired.png','mood-over.png',
  'section-plan.png','section-work.png','section-study.png','section-growth.png','section-finance.png',
  'section-sport.png','section-meals.png','section-travel.png','section-review.png','section-fun.png'
];
const ZHIYA = [
  'icon-192.png','icon-512.png','icon-maskable-512.png','apple-touch-180.png','logo-64.png','avatar-42.png','splash.png'
];
const CORE = [
  'index.html?v=mumu-v304', 'manifest.json?v=mumu-v304', 'icon.svg?v=mumu-v304', 'css/style.css?v=mumu-v304', 'css/travel.css?v=mumu-v304',
  'js/app.js?v=mumu-v304', 'js/core.js?v=mumu-v304', 'js/daily.js?v=mumu-v304', 'js/work.js?v=mumu-v304', 'js/kaogong.js?v=mumu-v304',
  'js/growth.js?v=mumu-v304', 'js/sport.js?v=mumu-v304', 'js/meals.js?v=mumu-v304', 'js/review.js?v=mumu-v304', 'js/travel.js?v=mumu-v304',
  'js/finance.js?v=mumu-v304', 'js/fun.js?v=mumu-v304', 'js/theme.js?v=mumu-v304', 'js/streak.js?v=mumu-v304', 'js/freq.js?v=mumu-v304',
  'js/data/incentives.js?v=mumu-v304', 'js/data/shizheng.js?v=mumu-v304', 'js/data/kaogong.js?v=mumu-v304',
  'js/data/growth.js?v=mumu-v304', 'js/data/sport.js?v=mumu-v304', 'js/data/watch_games.js?v=mumu-v304', 'js/data/kepu.js?v=mumu-v304',
  'js/data/chinamap.js?v=mumu-v304',
  // 枝枝喵 · cat 主题（png/）
  ...CAT.map(n => 'assets/kitty/png/' + n + '?v=mumu-v304'),
  // 枝枝喵 · zhiya 主题（zhiya/）旧版枝丫
  ...ZHIYA.map(n => 'assets/kitty/zhiya/' + n + '?v=mumu-v304')
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // 逐个缓存，单文件失败不影响整体安装
    await Promise.allSettled(CORE.map(u => fetch(u, {cache:'no-store'}).then(r => { if (r && r.ok) return c.put(u, r.clone()); }).catch(err => console.warn('SW 缓存失败:', u, err))));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const p = url.pathname;
  // 外壳（index.html / sw.js / manifest）：网络优先，保证部署立即可见；离线回落缓存
  const isShell = p === '/' || p.endsWith('index.html') || p.endsWith('sw.js') || p.endsWith('manifest.json');
  if (isShell) {
    e.respondWith((async () => {
      try {
        const r = await fetch(req);
        if (r && r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
        return r;
      } catch (err) {
        return (await caches.match(req)) || Response.error();
      }
    })());
    return;
  }
  // 其余资源（均带 ?v= 版本号）：缓存优先 + 后台静默更新（秒开；版本一变 URL 即变，自动重新拉取）
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);
    if (cached) {
      fetch(req).then(r => { if (r && r.ok) cache.put(req, r.clone()); }).catch(() => {});
      return cached;
    }
    try {
      const r = await fetch(req);
      if (r && r.ok) cache.put(req, r.clone());
      return r;
    } catch (err) {
      return (await caches.match(req)) || Response.error();
    }
  })());
});