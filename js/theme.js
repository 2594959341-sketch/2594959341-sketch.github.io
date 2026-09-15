/* 枝枝喵主题切换（v167+）
 * 两套主题：
 *   cat   = 当前枝枝喵（Hello Kitty 形象），资源 assets/kitty/png/
 *   zhiya = 最后一版枝丫（绿芽形象），资源 assets/kitty/zhiya/
 * 旧 localStorage 值 'v161'/'v162' 自动映射为 'cat'，向后兼容。
 * 默认 cat，cat 主题下 HTML 已写好 png/ 路径，无需改写；切到 zhiya 时由 applyChrome 改写顶部 chrome。
 */
(function () {
  var THEMES = {
    cat:   { dir: 'png',   ver: 'mumu-v307' },
    zhiya: { dir: 'zhiya', ver: 'mumu-v307' }
  };
  var KEY = 'mumu_theme';
  var raw = localStorage.getItem(KEY);
  var cur = (raw === 'cat' || raw === 'zhiya') ? raw : 'cat';
  if (raw !== cur) { try { localStorage.setItem(KEY, cur); } catch (e) {} }
  window.MUMU_THEME = cur;
  window.MUMU_THEME_LIST = [
    { id: 'cat',   label: '新版（枝枝喵）' },
    { id: 'zhiya', label: '旧版（枝丫）' }
  ];
  window.MUMU_THEME_IS_ZHIYA = function () { return cur === 'zhiya'; };
  // 助理名：cat 主题叫「枝枝喵」(枝枝喵形象),zhiya 主题叫「枝枝」(绿芽)
  window.MUMU_ASSISTANT = function () { return cur === 'zhiya' ? '枝枝' : '枝枝喵'; };
  // 枝枝状态 emoji —— 仅 zhiya 主题使用（cat 主题走 PNG 状态图）
  window.MOOD_EMOJI = { st0: '🌱', st1: '🌳', st2: '🍂', st3: '🪵' };
  // 动态资源统一走这里：状态图 / 板块图 / 头像 / splash 等
  window.KITTY_RES = function (name) {
    var t = THEMES[cur];
    return 'assets/kitty/' + t.dir + '/' + name + '?v=' + t.ver;
  };
  // 顶部 chrome（apple-touch / PWA 图标 / splash / 侧栏头像）在切到 zhiya 时改写为绿芽资源
  function applyChrome() {
    if (cur === 'cat') return; // 默认 cat，HTML 已写好 png/ 路径，无需处理
    var qsa = document.querySelectorAll.bind(document);
    // PWA PNG 图标（rel="icon" type="image/png"）
    qsa('link[rel="icon"][type="image/png"]').forEach(function (l) {
      var size = (l.getAttribute('sizes') || '').split('x')[0];
      var nm = size === '192' ? 'icon-192.png' : 'icon-512.png';
      l.setAttribute('href', KITTY_RES(nm));
    });
    // apple-touch-icon
    qsa('link[rel="apple-touch-icon"]').forEach(function (l) {
      l.setAttribute('href', KITTY_RES('apple-touch-180.png'));
    });
    // 开场动画 splash（绿芽图）
    var sp = document.querySelector('.splash-img');
    if (sp) sp.src = KITTY_RES('splash.png');
    // 侧栏头像（绿芽 logo）
    var av = document.querySelector('.sidebar-avatar img');
    if (av) { av.src = KITTY_RES('logo-64.png'); av.width = 36; av.height = 36; }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyChrome);
  else applyChrome();
})();