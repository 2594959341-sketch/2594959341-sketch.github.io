/* ============ 枝枝工作台 · 核心工具 ============ */
/* ============ 存储层 v2：根治 localStorage 配额崩溃 ============
   小配置 key 仍留 localStorage；会逐年膨胀的历史数据（BIG_KEYS）改存 IndexedDB（mumu_data），
   写入时透明 gzip 压缩（浏览器不支持时自动降级为原文），启动 boot() 把 IDB 载入内存后
   读取全走内存（同步），实现「存得下、取得快」。旧 localStorage 数据首次启动自动迁移。 */
const BIG_KEYS = new Set([
  'meals','plans','plansDaily','growthLogs','kgLogs','kgPlans','readLogs','readNotes','reviews',
  'sportLogs','sportPhotos','travelOut','travelTrips','travelJournals','travelPhotos','travelMap',
  'travelCover','workLogs','writeLogs','novel','srItems','selfRescue','mumu_chat','transcribe','readCovers',
  'ideas','recharge','funLogs'
]);
const IDB2 = {
  db: null, ok: false,
  open() {
    return new Promise(res => {
      try {
        if (IDB2.db) return res(IDB2.db);
        const r = indexedDB.open('mumu_data', 1);
        r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('kv')) r.result.createObjectStore('kv', { keyPath: 'k' }); };
        r.onsuccess = () => { IDB2.db = r.result; IDB2.ok = true; res(IDB2.db); };
        r.onerror = () => res(null);
      } catch (e) { res(null); }
    });
  },
  async put(k, v) { const db = await IDB2.open(); if (!db) return; return new Promise(res => { const t = db.transaction('kv','readwrite'); t.objectStore('kv').put({ k, v }); t.oncomplete = () => res(); t.onerror = () => res(); }); },
  async get(k) { const db = await IDB2.open(); if (!db) return null; return new Promise(res => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result ? q.result.v : null); q.onerror = () => res(null); }); },
  async getAll() { const db = await IDB2.open(); if (!db) return []; return new Promise(res => { const q = db.transaction('kv').objectStore('kv').getAll(); q.onsuccess = () => res(q.result || []); q.onerror = () => res([]); }); },
  async del(k) { const db = await IDB2.open(); if (!db) return; return new Promise(res => { const t = db.transaction('kv','readwrite'); t.objectStore('kv').delete(k); t.oncomplete = () => res(); }); }
};
function _b64(buf){ let s=''; const b=new Uint8Array(buf); for(let i=0;i<b.length;i++) s+=String.fromCharCode(b[i]); return btoa(s); }
function _buf(b64){ const s=atob(b64); const b=new Uint8Array(s.length); for(let i=0;i<s.length;i++) b[i]=s.charCodeAt(i); return b.buffer; }
async function _zip(str){ if (!(window.CompressionStream && window.DecompressionStream)) return { c:0, v:str }; try { const cs=new CompressionStream('gzip'); const w=cs.writable.getWriter(); w.write(new TextEncoder().encode(str)); w.close(); const buf=await new Response(cs.readable).arrayBuffer(); return { c:1, v:_b64(buf) }; } catch(e){ return { c:0, v:str }; } }
async function _unzip(rec){ if(!rec) return null; if(rec.c===0) return rec.v; try { const ds=new DecompressionStream('gzip'); const w=ds.writable.getWriter(); w.write(new Uint8Array(_buf(rec.v))); w.close(); const buf=await new Response(ds.readable).arrayBuffer(); return new TextDecoder().decode(buf); } catch(e){ return rec.v; } }
const Store = { mem:{}, ready:false };
async function _persist(k, jsonStr){ if(!IDB2.ok) return; const rec=await _zip(jsonStr); await IDB2.put(k, rec); }
const S = {
  get(k, def) {
    if (BIG_KEYS.has(k)) {
      if (Object.prototype.hasOwnProperty.call(Store.mem, k)) return Store.mem[k];
      const raw = localStorage.getItem('mumu_' + k);
      if (raw == null) return def;
      try { const v = JSON.parse(raw); Store.mem[k] = v; return v; } catch(e){ return def; }
    }
    const raw = localStorage.getItem('mumu_' + k);
    return raw != null ? (()=>{ try { return JSON.parse(raw); } catch(e){ return def; } })() : def;
  },
  set(k, v) {
    if (BIG_KEYS.has(k)) { Store.mem[k] = v; _persist(k, JSON.stringify(v)); return; }
    try { localStorage.setItem('mumu_' + k, JSON.stringify(v)); } catch(e){ console.warn('写入失败', k, e); }
  },
  async boot() {
    await IDB2.open();
    if (IDB2.ok) {
      for (const k of BIG_KEYS) {
        const raw = localStorage.getItem('mumu_' + k);
        if (raw != null) { try { const val = JSON.parse(raw); await _persist(k, JSON.stringify(val)); } catch(e){} localStorage.removeItem('mumu_' + k); }
      }
      try { const all = await IDB2.getAll(); for (const r of all) { try { const json = await _unzip(r.v); Store.mem[r.k] = JSON.parse(json); } catch(e){} } } catch(e){}
    }
    Store.ready = true;
  }
};
let _uidc = 0;
function uid() { return Date.now().toString(36) + (++_uidc).toString(36) + Math.random().toString(36).slice(2, 4); }
function todayStr(d) { d = d || new Date(); const p = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }
function addDays(dateStr, n) { const d = new Date(dateStr + 'T12:00:00'); d.setDate(d.getDate() + n); return todayStr(d); }
function weekStart(dateStr) { const d = new Date(dateStr + 'T12:00:00'); const wd = d.getDay(); const back = (wd + 6) % 7; return addDays(dateStr, -back); } // 周一为首列
function weekDates(dateStr) { const s = weekStart(dateStr); return Array.from({ length: 7 }, (_, i) => addDays(s, i)); }
function fmtCN(dateStr) { const d = new Date(dateStr + 'T12:00:00'); return (d.getMonth() + 1) + '月' + d.getDate() + '日 周' + '日一二三四五六'[d.getDay()]; }
function daysBetween(a, b) { return Math.round((new Date(b) - new Date(a)) / 864e5); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

/* ---- 休息日规则（运动 / 备考 / 创作 通用）----
   key 路由： sport -> sportRest, kaogong -> kgRest, work -> workRest
   规则：一周最多休息 1 天，一个月最多休息 4 天；休息日不计入连续打卡中断 */
var REST_KEYS = { sport: 'sportRest', kaogong: 'kgRest', work: 'workRest' };
function _restArr(key) { var k = REST_KEYS[key] || key; return (S.get(k, []) || []); }
function _restSet(key) { return new Set(_restArr(key)); }
function _restWrite(key, arr) { var k = REST_KEYS[key] || key; S.set(k, arr); }
function restMadeupSet(key) {
  // 该分类下所有「补签日」集合：补签 ≠ 休息，不占休息额度
  var St = window.Streak; if (!St || !St.data) return null;
  var d = St.data(); if (!d || !d.items) return null;
  var type = key === 'sport' ? 'sport' : (key === 'kaogong' ? 'kg' : 'work');
  var s = {};
  d.items.forEach(function (it) {
    if (it.type !== type || !it.madeup) return;
    Object.keys(it.madeup).forEach(function (k) { if (it.madeup[k]) s[k] = 1; });
  });
  return s;
}
function restMakeupBonus(key) {
  // 该分类下可用补签卡数量 → 额外休息额度（有补签卡就可以多休息）
  var St = window.Streak; if (!St || !St.data || !St.makeupAvail) return 0;
  var d = St.data(); if (!d || !d.items) return 0;
  var type = key === 'sport' ? 'sport' : (key === 'kaogong' ? 'kg' : 'work');
  var n = 0;
  d.items.forEach(function (it) { if (it.type === type) n += St.makeupAvail(it); });
  return n;
}
function restCountAround(key, date) {
  var arr = _restArr(key);
  var mu = restMadeupSet(key); // 补签日不算休息
  var ws = weekStart(date), we = addDays(ws, 6), ms = date.slice(0, 7);
  var week = 0, month = 0;
  arr.forEach(function (d) {
    if (mu && mu[d]) return; // 补签日不占休息额度
    if (d >= ws && d <= we) week++;
    if (d.slice(0, 7) === ms) month++;
  });
  return { week: week, month: month };
}
function restCanAdd(key, date) {
  var set = _restSet(key);
  if (set.has(date)) return { ok: false, msg: '这一天已经是休息日了' };
  var c = restCountAround(key, date);
  var bonus = restMakeupBonus(key); // 有补签卡可多休息
  var wkMax = 1 + bonus, moMax = 4 + bonus;
  if (c.week >= wkMax) return { ok: false, msg: '本周已休息 ' + c.week + ' 天啦（含补签卡额度一周最多 ' + wkMax + ' 天）' };
  if (c.month >= moMax) return { ok: false, msg: '本月已休息 ' + c.month + ' 天啦（含补签卡额度一月最多 ' + moMax + ' 天）' };
  return { ok: true };
}
function restAdd(key, date) {
  var arr = _restArr(key);
  if (!arr.includes(date)) { arr.push(date); arr.sort(); _restWrite(key, arr); }
}
function restRemove(key, date) {
  var arr = _restArr(key);
  var i = arr.indexOf(date);
  if (i >= 0) { arr.splice(i, 1); _restWrite(key, arr); }
}

/* ---- 月经假（独立健康假，不占用运动/备考/创作的「每月4天」额度）----
   规则：每月最多 2 天，必须连续休两天（点一次占今天+明天）；
   不与任何其它假期/补签日重叠；月经假日对所有板块续火花都算「休息」 */
var MENS_KEY = 'menstrualRest';
function menstrualArr() { return (S.get(MENS_KEY, []) || []); }
function menstrualSet() { return new Set(menstrualArr()); }
function menstrualCountMonth(date) {
  var ms = date.slice(0, 7);
  return menstrualArr().filter(function (d) { return d.slice(0, 7) === ms; }).length;
}
// 收集所有其它「休息 / 补签」日期（用于重叠互斥判定）
function allOtherRestDates() {
  var s = {};
  ['sportRest', 'kgRest', 'workRest'].forEach(function (k) { (S.get(k, []) || []).forEach(function (d) { s[d] = 1; }); });
  var St = window.Streak;
  if (St && St.data) {
    var d = St.data();
    if (d && d.items) d.items.forEach(function (it) { if (it.madeup) Object.keys(it.madeup).forEach(function (k) { if (it.madeup[k]) s[k] = 1; }); });
  }
  return s;
}
function menstrualCanAdd(ds) {
  var set = menstrualSet();
  if (set.has(ds)) return { ok: false, msg: '这一天已经在月经假里了' };
  var tmr = addDays(ds, 1);
  if (set.has(tmr)) return { ok: false, msg: '明天已经在月经假里了（月经假需连续两天）' };
  if (set.has(addDays(ds, -1))) return { ok: false, msg: '昨天已经在月经假里了（月经假需连续两天）' };
  if (menstrualCountMonth(ds) + 2 > 2) return { ok: false, msg: '本月月经假额度已用完（每月最多 2 天，连续休两天）' };
  var others = allOtherRestDates();
  if (others[ds]) return { ok: false, msg: fmtCN(ds) + ' 已是其它假期 / 补签日，月经假不能与之重叠' };
  if (others[tmr]) return { ok: false, msg: fmtCN(tmr) + ' 已是其它假期 / 补签日，月经假不能与之重叠' };
  return { ok: true, days: [ds, tmr] };
}
function menstrualAdd(ds) {
  var arr = menstrualArr();
  var tmr = addDays(ds, 1);
  [ds, tmr].forEach(function (d) { if (!arr.includes(d)) arr.push(d); });
  arr.sort();
  S.set(MENS_KEY, arr);
}
function menstrualRemove(ds) {
  var set = menstrualSet();
  var block = [];
  if (set.has(addDays(ds, -1))) block.push(addDays(ds, -1));
  block.push(ds);
  if (set.has(addDays(ds, 1))) block.push(addDays(ds, 1));
  var rm = {}; block.forEach(function (d) { rm[d] = 1; });
  S.set(MENS_KEY, menstrualArr().filter(function (d) { return !rm[d]; }));
}

// 月经假统一开关（供各板块长按菜单调用）：返回 {ok, removed, msg}
function menstrualToggle(ds) {
  ds = ds || todayStr();
  if (ds > todayStr()) return { ok: false, msg: '不能给未来的日期设月经假' };
  var set = menstrualSet();
  if (set.has(ds)) { menstrualRemove(ds); menstrualSyncDaily(ds, false); return { ok: true, removed: true, msg: '已取消 ' + fmtCN(ds) + ' 起的月经假（连续两天一并取消）' }; }
  var chk = menstrualCanAdd(ds);
  if (!chk.ok) return { ok: false, msg: chk.msg };
  menstrualAdd(ds); menstrualSyncDaily(ds, true);
  return { ok: true, removed: false, msg: '已将 ' + fmtCN(ds) + ' 起设为月经假（连续两天 · 所有板块续火花不受影响）' };
}

// 月经假联动每日计划：设假时把那天所有待办标「休息」划掉，取消时清除（与正常假期/补签一致）
function menstrualSyncDaily(ds, on) {
  var D = window.Daily; if (!D || !D.list) return;
  var arr = D.list(ds); var changed = false;
  arr.forEach(function (t) {
    if (t.abandoned || t.moved) return;
    if (on && !t.restDay) { t.restDay = true; changed = true; }
    else if (!on && t.restDay) { t.restDay = false; changed = true; }
  });
  if (changed) { D.setList(ds, arr); if (D._root && document.contains(D._root)) D.render(D._root); }
}

// 月经假对账：导入/启动时调用。清理与其他休息的重叠（月经假优先），并给月经假日任务补上休息标
function menstrualReconcile() {
  var mset = menstrualSet();
  if (!mset || !mset.size) return;
  ['sport', 'kaogong', 'work'].forEach(function (key) {
    var arr = S.get(REST_KEYS[key], []); if (!arr || !arr.length) return;
    if (arr.some(function (d) { return mset.has(d); })) S.set(REST_KEYS[key], arr.filter(function (d) { return !mset.has(d); }));
  });
  mset.forEach(function (ds) { menstrualSyncDaily(ds, true); });
}

// 各板块日历长按菜单：今日休息 / 月经假 并列（运动/备考/创作共用，不额外加按钮）
function openRestMenu(ds, boardKey, render, restToggleFn) {
  if (ds > todayStr()) { toast('不能给未来的日期设休息 / 月经假'); return; }
  var restSet = _restSet(boardKey);
  var mset = menstrualSet();
  var isRest = restSet.has(ds), isMens = mset.has(ds);
  if (isRest && isMens) {
    openModal('<button class="close-x" onclick="closeModal()">×</button><h3>' + fmtCN(ds) + ' · 休息 / 月经假</h3><div style="display:flex;flex-direction:column;gap:10px;margin-top:8px"><button class="btn" id="mRest">取消今日休息</button><button class="btn" id="mMens" style="color:#E26D8B">取消月经假（连续两天）</button><button class="btn ghost" onclick="closeModal()">关闭</button></div>');
    var br = document.querySelector('#mRest'); if (br) br.onclick = function () { closeModal(); restToggleFn(ds); };
    var bm = document.querySelector('#mMens'); if (bm) bm.onclick = function () { closeModal(); var r = menstrualToggle(ds); if (r.msg) toast(r.msg); render(); };
    return;
  }
  if (isRest) {
    openModal('<button class="close-x" onclick="closeModal()">×</button><h3>' + fmtCN(ds) + ' · 休息设置</h3><div style="display:flex;flex-direction:column;gap:10px;margin-top:8px"><button class="btn" id="mRest">取消今日休息</button><button class="btn ghost" onclick="closeModal()">关闭</button></div>');
    var br2 = document.querySelector('#mRest'); if (br2) br2.onclick = function () { closeModal(); restToggleFn(ds); };
    return;
  }
  if (isMens) {
    openModal('<button class="close-x" onclick="closeModal()">×</button><h3>' + fmtCN(ds) + ' · 月经假</h3><div style="display:flex;flex-direction:column;gap:10px;margin-top:8px"><button class="btn" id="mMens" style="color:#E26D8B">取消月经假（连续两天）</button><button class="btn ghost" onclick="closeModal()">关闭</button></div>');
    var bm2 = document.querySelector('#mMens'); if (bm2) bm2.onclick = function () { closeModal(); var r = menstrualToggle(ds); if (r.msg) toast(r.msg); render(); };
    return;
  }
  openModal('<button class="close-x" onclick="closeModal()">×</button><h3>' + fmtCN(ds) + ' · 设为休息</h3><div style="display:flex;flex-direction:column;gap:10px;margin-top:8px"><button class="btn" id="mRest">今日休息</button><button class="btn" id="mMens" style="color:#E26D8B">月经假（连续两天）</button><button class="btn ghost" onclick="closeModal()">关闭</button></div>');
  var br3 = document.querySelector('#mRest'); if (br3) br3.onclick = function () { closeModal(); restToggleFn(ds); };
  var bm3 = document.querySelector('#mMens'); if (bm3) bm3.onclick = function () { closeModal(); var r = menstrualToggle(ds); if (r.msg) toast(r.msg); render(); };
}

function toast(msg) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 2200);
}
function openModal(html) {
  closeModal();
  const ov = document.createElement('div'); ov.className = 'overlay'; ov.id = 'ov';
  ov.innerHTML = '<div class="modal">' + html + '</div>';
  ov.addEventListener('click', e => { if (e.target === ov) closeModal(); });
  document.body.appendChild(ov); return ov;
}
function closeModal() { const o = document.getElementById('ov'); if (o) o.remove(); }

/* ---- 图片瘦身：手机原图 base64 动辄好几 MB，直接进 localStorage 会撑爆配额 ---- */
// 把 dataURL 等比缩到最长边 max 像素内并转成 JPEG，失败时原样返回
function shrinkImage(dataURL, max, quality) {
  max = max || 720; quality = quality || 0.72;
  return new Promise(resolve => {
    let done = false;
    const res = v => { if (done) return; done = true; clearTimeout(t); resolve(v); };
    // 解码/缩放万一卡死也必须让保存流程继续（保留原图，绝不挂起、绝不崩页）
    const t = setTimeout(() => res(dataURL), 8000);
    if (typeof dataURL !== 'string' || dataURL.indexOf('data:image') !== 0) return res(dataURL);
    if (typeof createImageBitmap !== 'function') return res(dataURL); // 环境不支持则保留原图
    try {
      // 关键：createImageBitmap(blob,{resizeWidth}) 在「解码阶段」直接缩到目标尺寸，
      // 绝不分配整图位图——内存峰值恒为输出尺寸(数百 KB 级)，根治「大原图解码撑爆渲染进程→此页存在问题」。
      fetch(dataURL).then(r => r.blob()).then(blob => {
        if (!blob || !blob.size) return res(dataURL);
        createImageBitmap(blob, { resizeWidth: max, resizeQuality: 'medium' }).then(bmp => {
          try {
            const cv = document.createElement('canvas'); cv.width = bmp.width; cv.height = bmp.height;
            const ctx = cv.getContext('2d'); if (!ctx) { try { bmp.close(); } catch (e) {} return res(dataURL); }
            ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, bmp.width, bmp.height);
            ctx.drawImage(bmp, 0, 0); try { bmp.close(); } catch (e) {}
            const out = cv.toDataURL('image/jpeg', quality);
            // 输出异常(过短/未变小)则宁可保留原图，不丢数据
            res(out && out.length > 1000 && out.length < dataURL.length ? out : dataURL);
          } catch (e) { res(dataURL); }
        }).catch(() => res(dataURL));
      }).catch(() => res(dataURL));
    } catch (e) { res(dataURL); }
  });
}
// 读文件并直接返回瘦身后的 dataURL。只 resolve，绝不 reject，绝不挂起
function readImageFile(file, max, quality) {
  return new Promise(res => {
    if (!file) return res(null);
    let done = false;
    const fin = v => { if (done) return; done = true; clearTimeout(tm); res(v); };
    const tm = setTimeout(() => fin(null), 8000); // 读文件卡住也要让保存流程继续
    try {
      const fr = new FileReader();
      fr.onload = () => shrinkImage(fr.result, max, quality).then(fin, () => fin(fr.result));
      fr.onerror = () => fin(null);
      fr.onabort = () => fin(null);
      fr.readAsDataURL(file);
    } catch (e) { fin(null); }
  });
}

/* ---- IndexedDB 照片存储 ---- */
const IDB = {
  db: null,
  open() {
    return new Promise((res, rej) => {
      if (IDB.db) return res(IDB.db);
      const r = indexedDB.open('mumu_photos', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('photos', { keyPath: 'id' });
      r.onsuccess = () => { IDB.db = r.result; res(IDB.db); };
      r.onerror = () => rej(r.error);
    });
  },
  async put(rec) { const db = await IDB.open(); return new Promise((res, rej) => { const t = db.transaction('photos', 'readwrite'); t.objectStore('photos').put(rec); t.oncomplete = res; t.onerror = () => rej(t.error); }); },
  async get(id) { const db = await IDB.open(); return new Promise(res => { const q = db.transaction('photos').objectStore('photos').get(id); q.onsuccess = () => res(q.result); q.onerror = () => res(null); }); },
  async del(id) { const db = await IDB.open(); return new Promise(res => { const t = db.transaction('photos', 'readwrite'); t.objectStore('photos').delete(id); t.oncomplete = res; }); },
  async getAll() { const db = await IDB.open(); return new Promise((res, rej) => { const q = db.transaction('photos').objectStore('photos').getAll(); q.onsuccess = () => res(q.result || []); q.onerror = () => rej(q.error); }); }
};

/* ---- 数据导出 / 导入（防丢手机保险） ---- */
// 收集所有 mumu_* localStorage 键 + 照片库
async function exportData() {
  const ls = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('mumu_')) ls[k] = localStorage.getItem(k); // 保留原始字符串，导入时原样写回
  }
  // 加入 IndexedDB（mumu_data）中的历史数据：内存优先，确保是最新值
  for (const k of BIG_KEYS) {
    if (Object.prototype.hasOwnProperty.call(Store.mem, k)) { try { ls['mumu_' + k] = JSON.stringify(Store.mem[k]); } catch (e) {} }
  }
  try {
    const all = await IDB2.getAll();
    for (const r of all) { if (!ls['mumu_' + r.k]) { try { ls['mumu_' + r.k] = JSON.stringify(JSON.parse(await _unzip(r.v))); } catch (e) {} } }
  } catch (e) {}
  let photos = [];
  try { photos = await IDB.getAll(); } catch (e) { photos = []; }
  return {
    app: 'mumu-workbench',
    version: 1,
    exportedAt: new Date().toISOString(),
    localStorage: ls,
    photos: photos
  };
}
// 稳定内容签名：键排序后稳定序列化，排除易变字段（id/时间戳等），再做 djb2 短哈希。
// 绝不依赖 Math.random —— 同一份数据无论何时算都得到同一签名，这是去重幂等的根基。
var _VOLATILE = new Set(['id','_rid','uid','createdAt','updatedAt','doneAt','ts','at','syncedAt','addedAt','restAt','givenUpAt','synced','modifiedAt','editAt','t','nonce','_v']);
function _stableStr(o) {
  if (o === null || typeof o !== 'object') return '__' + JSON.stringify(o);
  if (Array.isArray(o)) return '[' + o.map(_stableStr).join(',') + ']';
  var keys = Object.keys(o).filter(function (k) { return !_VOLATILE.has(k); }).sort();
  return '{' + keys.map(function (k) { return JSON.stringify(k) + ':' + _stableStr(o[k]); }).join(',') + '}';
}
function _hash(s) {
  var h = 5381; // djb2
  for (var i = 0; i < s.length; i++) h = (((h << 5) + h) + s.charCodeAt(i)) >>> 0;
  return 'h' + h.toString(36);
}
function _sig(o) { return _hash(_stableStr(o)); }
// 身份键：仅当对象确有 id 时返回 'id:...'，否则 null（用于「id 相同也合并」通道）
function _idOf(o) { return (o && typeof o === 'object' && o.id != null) ? 'id:' + o.id : null; }
var _BOOL_OR = new Set(['done', 'manualDone', 'restDay', 'abandoned', 'moved', 'settled', 'checked', '_done', 'synced', 'auto', 'reached']);
var _MAX_SET = new Set(['doneAt', 'createdAt', 'updatedAt', 'at', 'ts', 'syncedAt']);
// 合并两个对象：状态布尔取 OR，时间戳取较大，其余现有优先、空缺补入
function _mergeObjs(a, b) {
  var out = {};
  var keys = new Set(Object.keys(a || {}).concat(Object.keys(b || {})));
  keys.forEach(function (k) {
    var av = a ? a[k] : undefined, bv = b ? b[k] : undefined;
    if (_BOOL_OR.has(k)) out[k] = !!(av) || !!(bv);
    else if (_MAX_SET.has(k)) { var an = Number(av) || 0, bn = Number(bv) || 0; out[k] = an >= bn ? av : bv; }
    else if (Array.isArray(av) && Array.isArray(bv)) out[k] = _dedupMerge(av, bv);
    else if (av !== undefined && av !== null && av !== '') out[k] = av;
    else if (bv !== undefined && bv !== null && bv !== '') out[k] = bv;
    else out[k] = av !== undefined ? av : bv;
  });
  return out;
}
// 数组去重（双通道匹配）：对每个条目算「内容签名」+「id 键」，任一命中已有分组就并入该组，
// 都不命中才新开组。这样「id 不同但内容相同」能去重，「id 相同」也保留合并能力。
// 返回去重后的数组，并通过全局计数器累加被合并掉的重复条数（供 repairAll 统计清理量）。
var _dedupDropped = 0;
function dedupArr(arr) {
  var groups = [];                 // 每个分组：{sig, idKey, val}
  var bySig = Object.create(null);
  var byId = Object.create(null);
  function findIdx(sig, idKey) {
    if (sig != null && bySig[sig] != null) return bySig[sig];
    if (idKey != null && byId[idKey] != null) return byId[idKey];
    return -1;
  }
  var dropped = 0;
  (arr || []).forEach(function (x) {
    if (x && typeof x === 'object') {
      var sig = _sig(x), idKey = _idOf(x), gi = findIdx(sig, idKey);
      if (gi >= 0) { groups[gi].val = _mergeObjs(groups[gi].val, x); dropped++; }
      else { var g = { sig: sig, idKey: idKey, val: x }; groups.push(g); var n = groups.length - 1; if (sig != null) bySig[sig] = n; if (idKey != null) byId[idKey] = n; }
    } else {
      var sk = '__' + JSON.stringify(x);
      if (bySig[sk] == null) { bySig[sk] = groups.length; groups.push({ sig: sk, idKey: null, val: x }); }
    }
  });
  _dedupDropped += dropped;
  return groups.map(function (g) { return g.val; });
}
// 合并两个数组并按分组索引去重（匹配项用 _mergeObjs 合并，避免翻倍且保留完成态）
function _dedupMerge(a, b) { return dedupArr((a || []).concat(b || [])); }
// 通用智能合并（替代旧 deepMerge）：对象递归、数组去重合并
function smartMerge(a, b) {
  if (b == null) return a;
  if (a == null) return b;
  if (Array.isArray(a) && Array.isArray(b)) return _dedupMerge(a, b);
  if (a && typeof a === 'object' && b && typeof b === 'object') {
    var out = {}, keys = new Set(Object.keys(a).concat(Object.keys(b)));
    keys.forEach(function (k) { out[k] = smartMerge(a[k], b[k]); });
    return out;
  }
  if (a !== undefined && a !== null && a !== '') return a;
  return b;
}
// 就地去重修复：递归把数组里的重复对象按分组索引合并（清理已翻倍的数据）
function repairValue(v) {
  if (Array.isArray(v)) return dedupArr(v.map(repairValue));
  if (v && typeof v === 'object') { var o = {}; Object.keys(v).forEach(function (k) { o[k] = repairValue(v[k]); }); return o; }
  return v;
}
// 全量修复：清理当前存储里所有翻倍的数组（localStorage 小键 + BIG_KEYS 内存）。返回清理掉的重复条数。
function repairAll() {
  var before = _dedupDropped;
  for (var i = 0; i < localStorage.length; i++) {
    var k = localStorage.key(i);
    if (k && k.startsWith('mumu_')) {
      try { var v = JSON.parse(localStorage.getItem(k)); var nv = repairValue(v); localStorage.setItem(k, JSON.stringify(nv)); } catch (e) {}
    }
  }
  if (typeof BIG_KEYS !== 'undefined') BIG_KEYS.forEach(function (k) { if (Store.mem[k] != null) { Store.mem[k] = repairValue(Store.mem[k]); try { _persist(k, JSON.stringify(Store.mem[k])); } catch (e) {} } });
  try { migrateKgSubjects(); } catch (e) {}
  try { migrateDailySubjects(); } catch (e) {}
  var removed = _dedupDropped - before;
  repairAll._last = removed;
  return removed;
}
// 备考科目归一：把历史数据里的「行测言语 / 行测-言语 / 言语理解」等变体统一归到规范科目名（言语/判断/…），
// 根治 v313 去前缀后旧打卡记录仍带「行测-」前缀导致界面出现两个「言语」。幂等，跑在 repairAll 与 App.init。
function migrateKgSubjects() {
  try {
    var kg = S.get('kgLogs', {});
    var changed = false;
    Object.keys(kg).forEach(function (d) {
      (kg[d] || []).forEach(function (l) {
        if (l && l.subject != null) {
          var ns = (typeof kgNorm === 'function') ? kgNorm(l.subject) : (l.subject || '').trim().replace(/^行测[\s\-－·:：]*/, '');
          if (ns && ns !== l.subject) { l.subject = ns; changed = true; }
        }
      });
    });
    if (changed) S.set('kgLogs', kg);
  } catch (e) {}
}
// 备考每日任务科目回填：固定每日任务的模板(plansDaily)与已实例化的计划(plans)里，学习类任务可能没存 extra.subject，
// 导致 linkSatisfied 的旧兜底"任一日志即满足"跨科目串味（完成一科，所有学习任务都被勾掉）。
// 这里从标题反推规范科目（常识 优先于 判断，避免「常识判断」误判成判断），幂等。
function kgSubjectFromTitle(title) {
  if (!title) return '';
  var s = String(title);
  var subs = ['综合应用能力', '常识', '时政', '申论', '面试', '言语', '资料', '数量', '判断'];
  for (var i = 0; i < subs.length; i++) { if (s.indexOf(subs[i]) >= 0) return subs[i]; }
  return '';
}
function migrateDailySubjects() {
  try {
    var tmpl = S.get('plansDaily', []);
    var tc = false;
    (tmpl || []).forEach(function (t) {
      if (t && (t.link || '').indexOf('kaogong:') === 0) {
        t.extra = t.extra || {};
        if (!t.extra.subject) { var s = kgSubjectFromTitle(t.title); if (s) { t.extra.subject = s; tc = true; } }
      }
    });
    if (tc) S.set('plansDaily', tmpl);
    var plans = S.get('plans', {});
    var pc = false;
    Object.keys(plans).forEach(function (d) {
      (plans[d] || []).forEach(function (t) {
        if (t && (t.link || '').indexOf('kaogong:') === 0) {
          t.extra = t.extra || {};
          if (!t.extra.subject) { var s = kgSubjectFromTitle(t.title); if (s) { t.extra.subject = s; pc = true; } }
        }
      });
    });
    if (pc) S.set('plans', plans);
  } catch (e) {}
}

async function importData(obj, opts) {
  if (!obj || obj.app !== 'mumu-workbench' || !obj.localStorage) throw new Error('文件格式不对，不是木木的工作台备份');
  const merge = !opts || opts.merge !== false; // 默认合并（非破坏性），除非显式 merge:false
  const stats = { keys: 0, skipped: 0, errors: 0, photosAdded: 0, photosInBackup: 0, photosFailed: 0 };
  let _srLiveNames = null;
  try { const r = (typeof S !== 'undefined') ? S.get('selfRescue') : null; if (r && Array.isArray(r.items)) _srLiveNames = new Set(r.items.map(x => x && x.name).filter(Boolean)); } catch (e) {}
  for (const k of Object.keys(obj.localStorage)) {
    const key = k.startsWith('mumu_') ? k.slice(5) : k;
    const incRaw = obj.localStorage[k];
    stats.keys++;
    try {
      if (BIG_KEYS.has(key)) {
        let inc; try { inc = JSON.parse(incRaw); } catch (e) { inc = undefined; }
        if (inc === undefined) continue;
        if (!merge) { Store.mem[key] = inc; try { await _persist(key, incRaw); } catch (e) {} continue; }
        const merged = smartMerge(Store.mem[key], inc); // 现有优先、按内容签名去重并合并属性（修复翻倍+丢完成态）
        Store.mem[key] = merged;
        try { await _persist(key, JSON.stringify(merged)); }
        catch (e) {
          // 配额不足：先删后写，仍失败则降级写回 localStorage 并标记跳过
          try { await IDB2.del(key); await _persist(key, JSON.stringify(merged)); }
          catch (e2) { try { localStorage.setItem('mumu_' + key, JSON.stringify(merged)); } catch (e3) { stats.skipped++; stats.errors++; } }
        }
      } else {
        // 小配置 key：写回 localStorage
        if (!merge) { try { localStorage.setItem(k, incRaw); } catch (e) { stats.skipped++; stats.errors++; } continue; }
        let cur, inc;
        try { cur = localStorage.getItem(k) != null ? JSON.parse(localStorage.getItem(k)) : undefined; } catch (e) { cur = undefined; }
        try { inc = JSON.parse(incRaw); } catch (e) { inc = undefined; }
        try { localStorage.setItem(k, JSON.stringify(smartMerge(cur, inc))); }
        catch (e) {
          try { localStorage.removeItem(k); localStorage.setItem(k, JSON.stringify(smartMerge(cur, inc))); }
          catch (e2) { stats.skipped++; stats.errors++; }
        }
      }
    } catch (e) { stats.errors++; }
  }
  // 照片：按 id 幂等写入 IndexedDB（mumu_photos）。
  // 关键修复：不再静默吞掉写入失败——手机端 IndexedDB 配额超限时，
  // 旧代码 t.onerror 直接 res() 导致照片「导不进去」却无任何提示。
  // 现在逐批写入、整批失败则逐张重试，并精确统计 备份数/写入数/失败数。
  if (obj.photos && obj.photos.length) {
    // 规整：确保每条有 id 与 data（缺失 id 自动补，无 data 视为废记录跳过）
    const clean = [];
    obj.photos.forEach((rec, i) => {
      if (!rec || typeof rec !== 'object') return;
      if (rec.id == null) rec.id = 'imp' + Date.now().toString(36) + '_' + i;
      if (typeof rec.data !== 'string' || !rec.data) return;
      clean.push(rec);
    });
    stats.photosInBackup = clean.length;
    try {
      const db = await IDB.open();
      if (!db) {
        stats.photosFailed = clean.length;
      } else {
        const BATCH = 20;
        for (let i = 0; i < clean.length; i += BATCH) {
          const batch = clean.slice(i, i + BATCH);
          const ok = await new Promise((res) => {
            const t = db.transaction('photos', 'readwrite');
            const store = t.objectStore('photos');
            batch.forEach(rec => store.put(rec));
            t.oncomplete = () => res(true);
            t.onerror = () => res(false);
            t.onabort = () => res(false);
          });
          if (ok) {
            stats.photosAdded += batch.length;
          } else {
            // 整批失败（多半是配额）：逐张重试，尽量多存，记录写不进的张数
            for (const rec of batch) {
              const one = await new Promise((res) => {
                const t = db.transaction('photos', 'readwrite');
                t.objectStore('photos').put(rec);
                t.oncomplete = () => res(true);
                t.onerror = () => res(false);
                t.onabort = () => res(false);
              });
              if (one) stats.photosAdded++; else stats.photosFailed++;
            }
          }
        }
      }
    } catch (e) { stats.photosFailed = clean.length - stats.photosAdded; }
  }
  // 导入后全量去重修复（清理可能已翻倍的数据）+ 月经假对账（补休息标/清重叠）
  try { if (!opts || !opts.skipRepair) { repairAll(); menstrualReconcile(); } } catch (e) { console.warn('post-import repair failed', e); }
  return stats;
}

/* 真·分块流式导入（根治新手机 OOM“此页面存在问题”崩溃）
   根因：旧逻辑用 FileReader.readAsText 把整份备份（含全部 base64 照片，可达上百 MB）一次性读成字符串，
   解析时整串 + 解析对象同时驻留内存 → 内存受限手机直接 OOM 杀进程。
   本方案：按 256KB 一块读取文件，增量扫描 JSON，照片逐张解析 → 立即写入 IndexedDB → 立即丢弃，
   内存峰值仅「一张照片 + 一个分块」，无论备份多大都不会爆内存。同时回调进度，解决“导入没有任何显示”。 */
const IMPORT_CHUNK = 256 * 1024;

// 增量备份扫描器：边喂分块文本边抽取 localStorage 对象与每张照片，照片即时经 writePhoto 写出。
function createBackupScanner(opts) {
  const onProgress = (opts && opts.onProgress) || function () {};
  const stats = { keys: 0, skipped: 0, errors: 0, photosAdded: 0, photosInBackup: 0, photosFailed: 0, photosTooBig: 0 };
  const MAX_CAP = 20 * 1024 * 1024;  // 单张照片 base64 捕获上限 20MB：超过则跳过(极端原图，可重传更小)；导入不解码、原样落盘，内存峰值=单张字符串(≤20MB)有界，正常照片全部保留
  const COVER_KEEP = 1500 * 1024;     // 娱乐封面/图标 base64 超过此值且压缩未生效时，导入阶段剥离(置空)，避免超大封面让 funLogs 驻留撑爆内存
  let buf = '';
  let pos = 0;                 // 跨分块持续的游标（已消费位置）
  let state = 'walk';          // walk | colon | value | capture | photos | done
  let pendingKey = '';
  let lsObj = null;
  // capture 态
  let capAction = null;        // 'ls' | 'photo' | 'skip'
  let capBuf = '';
  let capDepth = 0;
  let capInStr = false;
  let capTooBig = false;       // 当前 capture 已超过 MAX_CAP，仅追踪深度不再存内容（保护内存）
  let sawLS = false, sawPhotos = false;
  // funLogs 流式状态：娱乐配置值内嵌 base64 封面，捕获时【边读边剥离超大封面】(单封面>COVER_IMPORT_CAP 或整段>FUN_CAP_CEILING 即置空)，
  // 既保留全部文字数据+小封面(图标/缩略图)，又保证 capBuf 恒定有界(≤~40MB)，根治「整段 funLogs 驻留撑爆内存→86%崩溃」。被剥离的大封面可日后单张重传(上传已自动压缩)。
  let funStrip = false, funOuterPending = false, funAfterColon = false, funReadingKey = false, funCoverVal = false, funCoverStrip = false, funPendingCover = false, funAggressiveStrip = false;
  let funKeyBuf = '', funCoverLen = 0, funCoverStart = -1;
  const onConfig = (opts && opts.onConfig) || null;  // 逐键流式回调：每解析完一个配置键立即写盘，避免整段配置(含娱乐 base64 封面)一次载入内存撑爆
  let pendingLsKey = null;
  async function deliverConfig(key, rawVal) {
    if (onConfig) await onConfig(key, rawVal);   // 必须 await：否则配置键落盘是 fire-and-forget，reload 可能早于落盘
    else lsObj[key] = rawVal;
  }
  const FUN_CAP_CEILING = 40 * 1024 * 1024;  // funLogs 流式捕获【聚合内存预算】：capBuf 超过 40MB 即对所有后续封面强制置空，保证整段 funLogs 驻留内存恒定有界(≤~40MB)，彻底杜绝 OOM（86% 崩溃根因）
  const COVER_IMPORT_CAP = 512 * 1024;       // 单个封面/图标 base64 保留阈值：≤512KB 的小封面(图标/缩略图)保留；更大的(多为手机原图)在导入时流式剥离置空，避免单封面撑爆 capBuf。被剥离的封面可日后单张重传(上传已自动压缩)

  function isWs(c) { return c === ' ' || c === '\n' || c === '\r' || c === '\t'; }

  // 从 buf 的 p 处读 JSON 字符串；未闭合返回 null（需更多数据）
  function readString(p) {
    let i = p + 1, s = '';
    while (i < buf.length) {
      const c = buf[i];
      if (c === '\\') {
        i++;
        const e = buf[i];
        if (e === 'n') s += '\n'; else if (e === 't') s += '\t'; else if (e === 'r') s += '\r';
        else if (e === '"') s += '"'; else if (e === '\\') s += '\\'; else if (e === '/') s += '/';
        else if (e === 'b') s += '\b'; else if (e === 'f') s += '\f';
        else if (e === 'u') { s += String.fromCharCode(parseInt(buf.substr(i + 1, 4), 16)); i += 4; }
        i++;
      } else if (c === '"') { return { value: s, next: i + 1 }; }
      else { s += c; i++; }
    }
    return null;
  }

  // capture 态：从 from 开始消费，遇结构闭合返回结束位置（已写入 capBuf）
  // 内存保护【仅限单张照片】：照片的 base64 可能数百 MB，capBuf 超过 MAX_CAP 后不再存内容，
  // 仅追踪深度/字符串态找到闭合括号，单张超大照片最多占 MAX_CAP 内存，不撑爆整页。
  // 配置对象(localStorage)【不做上限】：它是用户全部配置的集合，必须完整捕获与解析，
  // 否则整体超过 12MB 会被整段丢弃，导致娱乐/计划/复盘等所有配置数据丢失（v300 回归）。
  function consumeCapture(from) {
    const CAP = (capAction === 'photo'); // 上限只用于照片，配置对象始终完整保留
    let i = from;
    while (i < buf.length) {
      const c = buf[i];
      if (capInStr) {
        if (c === '\\') {
          if (!(CAP && capTooBig)) { capBuf += c; if (i + 1 < buf.length) { capBuf += buf[i + 1]; i += 2; } else { i++; } }
          else { if (i + 1 < buf.length) i += 2; else i++; }
          if (CAP && !capTooBig && capBuf.length > MAX_CAP) capTooBig = true;
          continue;
        }
        if (c === '"') { capInStr = false; if (!(CAP && capTooBig)) capBuf += c; i++; continue; }
        if (!(CAP && capTooBig)) { capBuf += c; if (CAP && capBuf.length > MAX_CAP) capTooBig = true; }
        i++; continue;
      }
      if (c === '"') { capInStr = true; if (!(CAP && capTooBig)) capBuf += c; i++; continue; }
      if (c === '{' || c === '[') { capDepth++; if (!(CAP && capTooBig)) capBuf += c; i++; continue; }
      if (c === '}' || c === ']') { capDepth--; if (!(CAP && capTooBig)) capBuf += c; i++; if (capDepth === 0) return i; continue; }
      if (!(CAP && capTooBig)) { capBuf += c; if (CAP && capBuf.length > MAX_CAP) capTooBig = true; }
      i++;
    }
    return i;
  }

  // 流式读取娱乐 funLogs 值：备份里它是「JSON 字符串」，内层结构字符都被转义(\{ \}" 等)。
  // 这里边读边还原转义、边把超阈值 cover 置 null，输出写入 capBuf；绝不整段驻留内存。
  // 遇「外层闭引号」(内层已闭合、capDepth===0 时的 ") 即返回，由调用方吃掉该引号。
  function consumeFunValue(from) {
    let i = from;
    const L = buf.length;
    while (i < L) {
      let c = buf[i];
      if (c === '\\') {                 // 外层字符串里的转义 → 还原成内部真实字符
        const e = buf[i + 1];
        if (e === 'n') c = '\n'; else if (e === 't') c = '\t'; else if (e === 'r') c = '\r';
        else if (e === 'b') c = '\b'; else if (e === 'f') c = '\f';
        else if (e === '"') c = '"'; else if (e === '\\') c = '\\'; else if (e === '/') c = '/';
        else if (e === 'u') { c = String.fromCharCode(parseInt(buf.substr(i + 2, 4), 16)); i += 4; }
        else c = e;
        i += 2;
      } else { i++; }
      if (capInStr) {
        if (c === '"') {                // 内层真实闭引号（结构）
          capInStr = false;
          if (funCoverVal) {
          if (funCoverStrip) { capBuf = capBuf.slice(0, funCoverStart) + 'null'; stats.coversStripped = (stats.coversStripped || 0) + 1; } // 达上限/超大：该封面置空(记剥离数)，不堆积
          else capBuf += '"';                                                     // 普通封面值：补闭引号
          funCoverVal = false; funCoverStrip = false;
          } else if (funReadingKey) {
            funReadingKey = false; funPendingCover = (funKeyBuf === 'cover'); funKeyBuf = '';
            capBuf += '"';                                                          // 普通 key：补闭引号
          } else {
            capBuf += '"';                                                          // 普通字符串值：补闭引号
          }
          continue;
        }
        if (funCoverVal) {
          if (capBuf.length > FUN_CAP_CEILING) funAggressiveStrip = true;   // 聚合超预算：后续封面全剥离
          if (funCoverStrip || funAggressiveStrip) { funCoverLen++; continue; } // 已决定剥离超大封面：丢弃后续 base64，绝不堆积进 capBuf
          if (funCoverLen < COVER_IMPORT_CAP) capBuf += c; else funCoverStrip = true; // 单封面超 120KB 也剥离，避免单封面撑爆
          funCoverLen++;
          continue;
        }
        if (funReadingKey) { funKeyBuf += c; capBuf += c; continue; }
        capBuf += c; continue;
      }
      if (capDepth === 0 && c === '"') return i;       // 外层闭引号：返回，调用方消费
      if (c === '"') {
        capInStr = true;
        if (funAfterColon) {
          if (funPendingCover) { funCoverVal = true; funCoverStart = capBuf.length; funCoverLen = 0; funCoverStrip = funAggressiveStrip; capBuf += '"'; funPendingCover = false; }
          else capBuf += '"';
          funAfterColon = false;
        } else { funReadingKey = true; funKeyBuf = ''; capBuf += '"'; }
        continue;
      }
      if (c === '{' || c === '[') { capDepth++; capBuf += c; funAfterColon = false; funReadingKey = false; funPendingCover = false; continue; }
      if (c === '}') { capDepth--; capBuf += c; if (capDepth === 0) return i; funAfterColon = false; continue; }
      if (c === ']') { capDepth--; capBuf += c; if (capDepth === 0) return i; funAfterColon = false; continue; }
      if (c === ':') { capBuf += c; funAfterColon = true; continue; }
      capBuf += c; continue;
    }
    return i;
  }

  // 每张照片解析完【立即 await 写入并释放引用】：这是根治 OOM 的关键——
  // 旧版把全部 writePhoto 的 Promise 排队却不 await，导致所有照片对象同时驻留内存→爆内存。
  async function writePhoto(ph) {
    try { await IDB.put(ph); stats.photosAdded++; }
    catch (e) { stats.photosFailed++; }
  }

  async function finishCapture() {
    try {
      if (capAction === 'cfgval') {
        // 单个配置键的值：完整捕获（不限 12MB，否则会丢娱乐/计划等数据），
        // 内嵌封面 base64 完整保留（不剥离），娱乐封面等全部恢复；仅当整段 funLogs 超 FUN_CAP_CEILING 时后续封面兜底置空。
        sawLS = true;
        const key = pendingLsKey;
        await deliverConfig(key, capBuf);
      }
      else if (capAction === 'photo') {
        sawPhotos = true;
        stats.photosInBackup++;          // 备份中的照片总数（含超大被跳过的）
        if (capTooBig) { stats.photosTooBig++; } // 单张超过捕获上限(20MB)：跳过(极端原图)，可后续单张重传更小版本
        else {
          const ph = JSON.parse(capBuf);
          // 导入「不解码」原图：直接原样落盘。内存峰值=单张 base64 字符串(≤20MB)，有界，
          // 彻底规避「大原图解码(createImageBitmap/new Image)撑爆渲染进程→此页存在问题」。其余照片全部保留、不丢。
          if (ph && ph.id != null && typeof ph.data === 'string' && ph.data) {
            await writePhoto(ph); // 写完即释放(不解码)
          }
          await new Promise(r => setTimeout(r, 0)); // 让出主线程，GC 收一下，连续大图也不堆内存
        }
      }
    } catch (e) { /* 损坏记录跳过 */ }
    capBuf = ''; capTooBig = false;
  }

  async function process() {
    let i = pos;
    const L = buf.length;
    while (i < L) {
      const c = buf[i];
      if (state === 'done') { i++; break; }
      if (state === 'walk') {
        if (isWs(c)) { i++; continue; }
        if (c === '}') { state = 'done'; i++; break; }
        if (c === '"') {
          const r = readString(i);
          if (!r) { buf = buf.slice(i); pos = 0; return; } // 需更多数据
          pendingKey = r.value; i = r.next; state = 'colon'; continue;
        }
        i++;
      } else if (state === 'colon') {
        if (isWs(c)) { i++; continue; }
        if (c === ':') { i++; state = 'value'; continue; }
        i++;
      } else if (state === 'value') {
        if (isWs(c)) { i++; continue; }
        if (pendingKey === 'localStorage') {
          // 进入配置对象：逐键流式解析，每个键的值单独捕获→立即交付→释放，
          // 内存峰值≈单个最大配置键（而非整段配置），根治整段配置(含娱乐 base64 封面)一次载入撑爆的崩溃
          if (c === '{') { state = 'config'; i++; }
          else i++;
        } else if (pendingKey === 'photos') {
          if (c === '[') { state = 'photos'; i++; }
          else i++;
        } else {
          // 跳过其它键的值
          if (c === '{' || c === '[') { capAction = 'skip'; capBuf = c; capDepth = 1; capInStr = false; capTooBig = false; state = 'capture'; i++; }
          else if (c === '"') { const r = readString(i); if (!r) { buf = buf.slice(i); pos = 0; return; } i = r.next; state = 'walk'; }
          else { while (i < L && buf[i] !== ',' && buf[i] !== '}' && buf[i] !== ']') i++; state = 'walk'; }
        }
        continue;
      } else if (state === 'config') {
        if (isWs(c)) { i++; continue; }
        if (c === '}') { state = 'walk'; i++; continue; }   // 配置对象结束 → 回到顶层
        if (c === ',') { i++; continue; }
        if (c === '"') { const r = readString(i); if (!r) { buf = buf.slice(i); pos = 0; return; } pendingLsKey = r.value; i = r.next; state = 'colonc'; continue; }
        i++;
      } else if (state === 'colonc') {
        if (isWs(c)) { i++; continue; }
        if (c === ':') { i++; state = 'cval'; continue; }
        i++;
      } else if (state === 'cval') {
        if (isWs(c)) { i++; continue; }
        if (c === '{' || c === '[') { capAction = 'cfgval'; capBuf = c; capDepth = 1; capInStr = false; capTooBig = false; state = 'capture'; i++; continue; }
        if (c === '"') {
          const bare = pendingLsKey.startsWith('mumu_') ? pendingLsKey.slice(5) : pendingLsKey;
          if (bare === 'funLogs') {
            // 娱乐值体量可能极大（内嵌 base64 封面）：进入流式剥封面模式，边读边置空超大封面，绝不整段载入内存
            funStrip = true; funOuterPending = false; capBuf = ''; capDepth = 0; capInStr = false;
            funAfterColon = false; funReadingKey = false; funKeyBuf = ''; funCoverVal = false; funCoverStart = -1; funCoverStrip = false; funPendingCover = false;
            state = 'funval'; i++; continue;   // 吃掉外层开引号，从内层 JSON 开始流式读
          }
          const r = readString(i); if (!r) { buf = buf.slice(i); pos = 0; return; }
          // r.value 已是该配置值的「原始 JSON 文本」（字符串值自带引号；funLogs 的 JSON 串值即对象文本）。
          // 直接交付给 importData（其内部会 JSON.parse）→ 得到正确对象；切勿再 JSON.stringify 二次编码。
          await deliverConfig(pendingLsKey, r.value);
          i = r.next; state = 'config'; continue;
        }
        let j = i; while (j < L && buf[j] !== ',' && buf[j] !== '}') j++;
        await deliverConfig(pendingLsKey, buf.slice(i, j).trim()); i = j; state = 'config'; continue;
      } else if (state === 'funval') {
        if (funOuterPending) {
          // 内层 JSON 已读完，只差外层闭引号（可能跨分块）
          if (i < buf.length && buf[i] === '"') i++;
          buf = buf.slice(i); pos = 0; i = 0;
          await deliverConfig(pendingLsKey, capBuf);
          funStrip = false; funOuterPending = false;
          state = 'config'; continue;
        }
        const end = consumeFunValue(i);
        if (capDepth === 0) {
          buf = buf.slice(end); pos = 0; i = 0;
          if (i < buf.length && buf[i] === '"') { i++; buf = buf.slice(i); pos = 0; i = 0; await deliverConfig(pendingLsKey, capBuf); funStrip = false; state = 'config'; continue; }
          funOuterPending = true; return; // 外层闭引号未到，等下一块
        }
        buf = buf.slice(end); pos = 0;
        return; // 内层未完成，等下一块
      } else if (state === 'capture') {
        const start = i;
        const end = consumeCapture(i);
        if (capDepth === 0) {
          buf = buf.slice(end); pos = 0; i = 0;
          await finishCapture();
          state = (capAction === 'photo') ? 'photos' : (capAction === 'cfgval' ? 'config' : 'walk');
          capAction = null;
          continue;
        } else {
          buf = buf.slice(end); pos = 0;
          return; // 不完整，等下一块
        }
      } else if (state === 'photos') {
        if (isWs(c)) { i++; continue; }
        if (c === ']') { state = 'walk'; i++; continue; }
        if (c === '{') { capAction = 'photo'; capBuf = '{'; capDepth = 1; capInStr = false; capTooBig = false; state = 'capture'; i++; continue; }
        if (c === ',') { i++; continue; }
        i++;
      } else { i++; }
    }
    buf = buf.slice(i); pos = 0;
  }

  return {
    feed(text) { buf += text; return process(); },
    end() { return process(); },         // 末尾再跑一次
    getLocalStorage() { return lsObj || {}; },
    hasStructure() { return sawLS || sawPhotos; },
    async flush() { return stats; },
    stats() { return stats; }
  };
}

// 导入时把 funLogs 内嵌的封面/图标 base64 压缩到合理尺寸，避免 funLogs 体积爆炸（覆盖/图标只是缩略图，
// 压到 1000/600px 足够清晰，体积从数 MB 降到数百 KB）。解析失败或某张解码失败则原样保留，不丢数据。
async function shrinkFunLogsCovers(rawStr, st) {
  // 导入阶段「绝不解码图片」：实测在木木手机(小米17Pro/Edge)上，对娱乐封面/图标做任何解码(createImageBitmap/new Image)
  // 都会把大原图整张解成位图撑爆渲染进程→「此页存在问题」。故仅按 base64 长度判断：过大的封面/图标直接剥离(置空)，
  // 既不解码(不崩)、又避免超大封面让 funLogs 整段驻留 OOM。保留 ≤COVER_KEEP 的小封面/图标 + 全部文字数据。
  try {
    const obj = JSON.parse(rawStr);
    if (!obj || typeof obj !== 'object') return rawStr;
    for (const k of Object.keys(obj)) {
      const arr = obj[k];
      if (!Array.isArray(arr)) continue;
      for (const rec of arr) {
        if (!rec || typeof rec !== 'object') continue;
        if (typeof rec.cover === 'string' && rec.cover.indexOf('data:image') === 0 && rec.cover.length > COVER_KEEP) { rec.cover = null; if (st) st.coversStripped = (st.coversStripped || 0) + 1; }
        if (typeof rec.icon === 'string' && rec.icon.indexOf('data:image') === 0 && rec.icon.length > COVER_KEEP) { rec.icon = null; if (st) st.coversStripped = (st.coversStripped || 0) + 1; }
      }
    }
    return JSON.stringify(obj);
  } catch (e) { return rawStr; }
}

// 分块读取文件并流式导入：照片逐张落盘；配置逐键即时写盘(经 onConfig)，不整段驻留内存。
async function importFromFile(file, onProgress) {
  if (!file) throw new Error('没有选择文件');
  const cfg = { keys: 0, skipped: 0, errors: 0 };
  // 崩溃追踪点：导入过程中持续写入进度到 localStorage，渲染进程崩溃后该值仍在，下次打开可读出「卡在百分之几」
  try { localStorage.setItem('mumu_import_ckpt', JSON.stringify({ t: Date.now(), pct: 0, phase: 'start' })); } catch (e) {}
  const scanner = createBackupScanner({
    onProgress: onProgress,
    // 每个配置键解析完立即落盘并释放引用：内存峰值=单个最大键，根治整段配置撑爆
    onConfig: async (key, rawStr) => {
      try {
        let s;
        if (key === 'mumu_funLogs') {
          // 娱乐封面/图标导入时一并压缩（最长边 1000/600px），避免 funLogs 体积爆炸导致以后导出导入再崩
          const processed = await shrinkFunLogsCovers(rawStr, cfg);
          s = await importData({ app: 'mumu-workbench', localStorage: { [key]: processed } }, { merge: true, skipRepair: true });
        } else {
          s = await importData({ app: 'mumu-workbench', localStorage: { [key]: rawStr } }, { merge: true, skipRepair: true });
        }
        cfg.keys += s.keys; cfg.skipped += s.skipped; cfg.errors += s.errors;
      } catch (e) { cfg.errors++; }
    }
  });
  const total = file.size || 0;
  let offset = 0;
  const decoder = new TextDecoder('utf-8');
  try {
    while (offset < total) {
      const end = Math.min(offset + IMPORT_CHUNK, total);
      const slice = file.slice(offset, end);
      const ab = await slice.arrayBuffer();
      const text = decoder.decode(ab, { stream: true });
      await scanner.feed(text);
      offset = end;
      if (onProgress) onProgress({ phase: 'reading', done: offset, total: total });
      try { localStorage.setItem('mumu_import_ckpt', JSON.stringify({ t: Date.now(), pct: Math.round(offset / total * 100), phase: 'reading' })); } catch (e) {}
    }
    await scanner.feed(decoder.decode()); // flush 多字节残尾
    await scanner.end();
  } catch (e) {
    throw new Error('文件读取失败：' + (e && e.message ? e.message : e));
  }
  if (!scanner.hasStructure()) throw new Error('文件格式不对，不是木木的工作台备份');
  // 全量去重修复 + 月经假对账：逐键导入时跳过，这里统一做一次
  try { repairAll(); } catch (e) { console.warn('repairAll failed', e); }
  try { menstrualReconcile(); } catch (e) { console.warn('menstrualReconcile failed', e); }
  const st = await scanner.flush();
  Object.assign(st, { keys: cfg.keys, skipped: cfg.skipped, errors: cfg.errors });
  try { localStorage.removeItem('mumu_import_ckpt'); } catch (e) {} // 成功完成：清除追踪点
  return st;
}

function pickPhoto(cb) { // 选图并压缩为 dataURL
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = () => {
    const f = inp.files[0]; if (!f) return;
    const img = new Image(); const url = URL.createObjectURL(f);
    img.onload = () => {
      const max = 1000; let w = img.width, h = img.height;
      if (Math.max(w, h) > max) { const r = max / Math.max(w, h); w = Math.round(w * r); h = Math.round(h * r); }
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url); cb(cv.toDataURL('image/jpeg', 0.82));
    };
    img.src = url;
  };
  inp.click();
}

/* ---- 通用月历渲染 ----
   opts: {ym:'2026-07', onCell(dateStr)->htmlExtra, onClick(dateStr), marks: {dateStr:[colors]}} */
function renderMonthCal(el, opts) {
  const [y, m] = opts.ym.split('-').map(Number);
  const first = new Date(y, m - 1, 1); const startW = first.getDay();
  const daysIn = new Date(y, m, 0).getDate();
  let html = '<div class="cal-head"><button class="btn ghost sm" data-nav="-1">‹</button><b>' + y + '年' + m + '月</b><button class="btn ghost sm" data-nav="1">›</button></div>';
  html += '<div class="cal-grid">' + ['日', '一', '二', '三', '四', '五', '六'].map(w => '<div class="wd">' + w + '</div>').join('');
  for (let i = 0; i < startW; i++) html += '<div></div>';
  const today = todayStr();
  for (let d = 1; d <= daysIn; d++) {
    const ds = y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    const marks = (opts.marks && opts.marks[ds]) || [];
    const isRest = opts.restSet && (typeof opts.restSet.has === 'function' ? opts.restSet.has(ds) : opts.restSet[ds]);
    const restCls = (isRest && !marks.length) ? ' rest' : '';
    const isMens = opts.menstrualSet && (typeof opts.menstrualSet.has === 'function' ? opts.menstrualSet.has(ds) : opts.menstrualSet[ds]);
    const mensCls = (isMens && !marks.length && !isRest) ? ' mens' : '';
    html += '<div class="cal-cell' + (ds === today ? ' today' : '') + restCls + mensCls + '" data-date="' + ds + '"><div class="d">' + d + '</div>'
      + (opts.cellHTML ? (() => { try { return opts.cellHTML(ds); } catch (e) { return ''; } })() : '')
      + (marks.length ? '<div class="dots">' + marks.slice(0, 6).map(c => '<span class="dot" style="background:' + c + '"></span>').join('') + '</div>' : '')
      + '</div>';
  }
  html += '</div>';
  el.innerHTML = html;
  el.querySelectorAll('[data-nav]').forEach(b => b.onclick = () => {
    const nd = new Date(y, m - 1 + Number(b.dataset.nav), 1);
    opts.ym = nd.getFullYear() + '-' + String(nd.getMonth() + 1).padStart(2, '0');
    renderMonthCal(el, opts);
  });
  if (opts.onClick || opts.onLongPress) {
    el.querySelectorAll('.cal-cell').forEach(c => {
      const ds = c.dataset.date;
      if (opts.onClick) c.onclick = () => opts.onClick(ds);
      if (opts.onLongPress) {
        let timer = null, fired = false;
        const start = () => { fired = false; if (timer) clearTimeout(timer); timer = setTimeout(() => { fired = true; opts.onLongPress(ds); }, 480); };
        const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };
        c.addEventListener('touchstart', start, { passive: true });
        c.addEventListener('touchend', cancel);
        c.addEventListener('touchmove', cancel);
        c.addEventListener('mousedown', start);
        c.addEventListener('mouseup', cancel);
        c.addEventListener('mouseleave', cancel);
        // 长按触发后，拦截随后到来的 click，避免既长按又触发其它点击逻辑
        c.addEventListener('click', e => { if (fired) { e.stopPropagation(); e.preventDefault(); fired = false; } }, true);
      }
    });
  }
  if (opts.afterRender) opts.afterRender(el);
}

/* ---- 多月横向滑动热力图（类似 GitHub 风格）---- */
function addMonthStr(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}
function monthSeq(fromYm, toYm) {
  const [fy, fm] = fromYm.split('-').map(Number);
  const [ty, tm] = toYm.split('-').map(Number);
  const out = [];
  let y = fy, m = fm;
  while (y < ty || (y === ty && m <= tm)) {
    out.push(y + '-' + String(m).padStart(2, '0'));
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
}
function renderHeatmap(el, countMap, colorFn) {
  countMap = countMap || {};
  if (!el._hm) el._hm = { months: 3 };
  const SHOW = el._hm.months || 3;
  const todayYm = todayStr().slice(0, 7);
  // 收集所有有数据的年月
  const allYms = new Set(Object.keys(countMap).map(d => d.slice(0, 7)));
  allYms.add(todayYm);
  const dataYms = Array.from(allYms).sort();
  if (!dataYms.length) { el.innerHTML = '<div class="empty">暂无数据</div>'; return; }

  // 默认当前月在中间
  const midOffset = Math.floor(SHOW / 2);
  // 生成连续月份序列：从最早数据月到 max(最新数据月, 当前月+1)
  // 至少回退到 currentMonth - midOffset，确保当前月能居中（如 7 月时包含 6 月）
  let fromYm = dataYms[0];
  const needFrom = addMonthStr(todayYm, -midOffset);
  if (fromYm > needFrom) fromYm = needFrom;
  const toYmDefault = addMonthStr(todayYm, 1);
  const toYm = dataYms[dataYms.length - 1] > toYmDefault ? dataYms[dataYms.length - 1] : toYmDefault;
  const sortedYms = monthSeq(fromYm, toYm);

  let defStart = Math.max(0, sortedYms.indexOf(todayYm) - midOffset);
  defStart = Math.min(defStart, Math.max(0, sortedYms.length - SHOW));
  if (el._hm.startIdx == null) el._hm.startIdx = defStart;

  function draw() {
    const si = Math.max(0, Math.min(el._hm.startIdx, sortedYms.length - SHOW));
    const visible = sortedYms.slice(si, si + SHOW);
    if (!visible.length) { el.innerHTML = '<div class="empty">暂无数据</div>'; return; }

    let html = '<div class="hm-scroll-wrap"><div class="hm-scroll" style="min-width:' + (visible.length * 120) + 'px">';
    visible.forEach(ym => {
      const [yy, mm] = ym.split('-').map(Number);
      const dim = new Date(yy, mm, 0).getDate();
      const lead = (new Date(yy, mm - 1, 1).getDay() + 6) % 7;
      html += '<div class="hm-month-block">';
      html += '<div class="hm-month-label">' + mm + '月</div>';
      html += '<div class="hm-grid">';
      ['一', '二', '三', '四', '五', '六', '日'].forEach(w => { html += '<div class="hm-wd">' + w + '</div>'; });
      for (let i = 0; i < lead; i++) html += '<div class="hm-cell empty"></div>';
      for (let dd = 1; dd <= dim; dd++) {
        const ds = yy + '-' + String(mm).padStart(2, '0') + '-' + String(dd).padStart(2, '0');
        const n = countMap[ds] || 0;
        const lvl = colorFn ? colorFn(n) : Math.min(4, n);
        let cls = 'hm-cell'; if (n > 0 && lvl > 0) cls += ' hm-' + Math.min(4, lvl);
        html += '<div class="' + cls + '" title="' + ds + '：' + n + ' 次"></div>';
      }
      html += '</div></div>';
    });
    html += '</div></div>';

    const canLeft = si > 0;
    const canRight = si + SHOW < sortedYms.length;
    // 底部标签显示每个月
    var rangeLabel = visible.map(function(ym, i) {
      var parts = ym.split('-').map(Number);
      var yy = parts[0], mm = parts[1];
      var prefix = (i === 0 || mm === 1) ? yy + '年' : '';
      return prefix + mm + '月';
    }).join(' · ');
    html += '<div class="hm-nav-row">'
      + '<button class="btn ghost sm hm-nav-btn' + (canLeft ? '' : ' disabled') + '" data-hmnav="left">‹</button>'
      + '<span class="hm-range">' + rangeLabel + '</span>'
      + '<button class="btn ghost sm hm-nav-btn' + (canRight ? '' : ' disabled') + '" data-hmnav="right">›</button>'
      + '</div>';
    html += '<div class="muted" style="margin-top:4px;text-align:center">颜色越深当天记录越多 · 左右切换查看更多月份</div>';

    el.innerHTML = html;

    // 左右翻页（按 SHOW 个月翻）
    const lBtn = el.querySelector('[data-hmnav=left]');
    const rBtn = el.querySelector('[data-hmnav=right]');
    if (lBtn && canLeft) lBtn.onclick = () => { el._hm.startIdx = Math.max(0, si - SHOW); draw(); };
    if (rBtn && canRight) rBtn.onclick = () => { el._hm.startIdx = Math.min(sortedYms.length - SHOW, si + SHOW); draw(); };

    // 触摸/鼠标拖拽左右滑动
    const wrap = el.querySelector('.hm-scroll-wrap');
    if (wrap) initHmScroll(wrap, el, sortedYms.length, SHOW, draw);
  }
  draw();
}

/* 热力图触摸/鼠标横向拖拽滚动 */
function initHmScroll(wrap, el, totalMonths, showMonths, redraw) {
  let isDown = false, startX = 0, scrollLeft = 0, moved = false;
  wrap.addEventListener('pointerdown', e => {
    isDown = true; startX = e.pageX - wrap.offsetLeft;
    scrollLeft = wrap.scrollLeft; moved = false;
    wrap.style.cursor = 'grabbing';
    wrap.setPointerCapture(e.pointerId);
  });
  wrap.addEventListener('pointermove', e => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - wrap.offsetLeft;
    const walk = (x - startX) * 1.5;
    if (Math.abs(walk) > 5) moved = true;
    wrap.scrollLeft = scrollLeft - walk;
  });
  wrap.addEventListener('pointerup', e => {
    isDown = false;
    wrap.style.cursor = 'grab';
    wrap.releasePointerCapture(e.pointerId);
    // 滑到边缘时自动翻页（按 SHOW 个月翻）
    if (wrap.scrollLeft <= 10 && el._hm.startIdx > 0) {
      el._hm.startIdx = Math.max(0, el._hm.startIdx - showMonths); redraw();
    } else if (wrap.scrollLeft >= wrap.scrollWidth - wrap.clientWidth - 10) {
      el._hm.startIdx = Math.min(totalMonths - showMonths, el._hm.startIdx + showMonths); redraw();
    }
  });
  wrap.addEventListener('pointercancel', () => { isDown = false; wrap.style.cursor = 'grab'; });
}

/* ---- 简易 SVG 折线图 ---- */
function svgLine(values, labels, color) {
  color = color || '#111111';
  const W = 640, H = 150, P = 26;
  if (!values.length) return '<div class="empty">暂无数据</div>';
  const max = Math.max(...values, 1), min = Math.min(...values, 0);
  const x = i => P + i * (W - 2 * P) / Math.max(values.length - 1, 1);
  const y = v => H - P - (v - min) * (H - 2 * P) / Math.max(max - min, 1);
  let pts = values.map((v, i) => x(i) + ',' + y(v)).join(' ');
  let s = '<svg class="svg-chart" viewBox="0 0 ' + W + ' ' + H + '">';
  s += '<polyline fill="none" stroke="' + color + '" stroke-width="2.5" stroke-linejoin="round" points="' + pts + '"/>';
  values.forEach((v, i) => { s += '<circle cx="' + x(i) + '" cy="' + y(v) + '" r="3.5" fill="' + color + '"/>'; });
  labels.forEach((l, i) => { if (labels.length <= 16 || i % Math.ceil(labels.length / 16) === 0) s += '<text x="' + x(i) + '" y="' + (H - 6) + '" font-size="9" fill="#999" text-anchor="middle">' + l + '</text>'; });
  return s + '</svg>';
}
/* ---- 简易 SVG 柱状图 ---- */
function svgBars(values, labels, color) {
  color = color || '#111111';
  const W = 640, H = 160, P = 24;
  if (!values.length) return '<div class="empty">暂无数据</div>';
  const max = Math.max(...values, 1);
  const bw = Math.min(40, (W - 2 * P) / values.length * 0.62);
  let s = '<svg class="svg-chart" viewBox="0 0 ' + W + ' ' + H + '">';
  values.forEach((v, i) => {
    const x = P + (i + 0.5) * (W - 2 * P) / values.length - bw / 2;
    const h = v / max * (H - 2 * P - 14);
    s += '<rect x="' + x + '" y="' + (H - P - h) + '" width="' + bw + '" height="' + h + '" rx="4" fill="' + color + '" opacity="0.85"/>';
    if (v > 0) s += '<text x="' + (x + bw / 2) + '" y="' + (H - P - h - 4) + '" font-size="9.5" fill="#666" text-anchor="middle">' + v + '</text>';
    s += '<text x="' + (x + bw / 2) + '" y="' + (H - 7) + '" font-size="9.5" fill="#999" text-anchor="middle">' + labels[i] + '</text>';
  });
  return s + '</svg>';
}
/* ---- 雷达图 ---- */
function svgRadar(dims, values) { // values 0-100
  const C = 110, R = 78, n = dims.length;
  const pt = (i, r) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return (C + r * Math.cos(a)).toFixed(1) + ',' + (C + r * Math.sin(a)).toFixed(1); };
  let s = '<svg class="svg-chart" viewBox="0 0 220 220" style="max-width:300px;margin:auto;display:block">';
  [0.33, 0.66, 1].forEach(k => { s += '<polygon points="' + dims.map((_, i) => pt(i, R * k)).join(' ') + '" fill="none" stroke="#e5e5e5"/>'; });
  dims.forEach((_, i) => s += '<line x1="' + C + '" y1="' + C + '" x2="' + pt(i, R).split(',')[0] + '" y2="' + pt(i, R).split(',')[1] + '" stroke="#eee"/>');
  s += '<polygon points="' + values.map((v, i) => pt(i, R * Math.max(v, 4) / 100)).join(' ') + '" fill="rgba(17,17,17,.12)" stroke="#111111" stroke-width="2"/>';
  dims.forEach((d, i) => { const p = pt(i, R + 16).split(','); s += '<text x="' + p[0] + '" y="' + p[1] + '" font-size="11" fill="#666" text-anchor="middle" dominant-baseline="middle">' + d + '</text>'; });
  return s + '</svg>';
}
function copyText(t) { navigator.clipboard ? navigator.clipboard.writeText(t).then(() => toast('已复制，去粘贴给枝枝吧')) : toast('复制失败，请手动复制'); }

/* ============ 全局 SVG 线条图标 ============ */
const icons = {
  menu: '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>',
  close: '<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>',
  back: '<polyline points="15 18 9 12 15 6"/>',
  home: '<path d="M3 12l9-9 9 9"/><path d="M5 10v10h14V10"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/>',
  creation: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>',
  inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/>',
  sprout: '<path d="M12 22V12"/><path d="M12 12C12 8 9 5 5 5c0 4 3 7 7 7z"/><path d="M12 10c0-3 3-6 7-6 0 3-3 6-7 6z"/>',
  running: '<circle cx="13" cy="4" r="1.5"/><path d="M5 19l3-5 4-3-2-3-4 2"/><path d="M9 19l3-4 3 1 3 3"/><path d="M14 9l2 2"/>',
  meal: '<path d="M3 11h18"/><path d="M3 11a9 9 0 0118 0"/><line x1="5" y1="15" x2="5" y2="19"/><line x1="19" y1="15" x2="19" y2="19"/><path d="M3 19h18"/>',
  moon: '<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>',
  edit: '<path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>',
  trending: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
  stats: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  link: '<path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>',
  rescue: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>',
  sunrise: '<path d="M17 18a5 5 0 00-10 0"/><line x1="12" y1="2" x2="12" y2="9"/><line x1="4.22" y1="10.22" x2="5.64" y2="11.64"/><line x1="1" y1="18" x2="3" y2="18"/><line x1="21" y1="18" x2="23" y2="18"/><line x1="18.36" y1="11.64" x2="19.78" y2="10.22"/><polyline points="8 6 12 2 16 6"/>',
  sun: '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>',
  candy: '<line x1="3" y1="12" x2="21" y2="12"/><path d="M3 6l3 6-3 6"/><path d="M21 6l-3 6 3 6"/>',
  money: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>',
  writing: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>',
  english: '<path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>',
  ai: '<rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/>',
  finance: '<path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 6-6"/>',
  reading: '<path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>',
  diary: '<path d="M4 4h16v16H4z"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="12" y2="16"/>',
  mood: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>',
  chevronDown: '<polyline points="6 9 12 15 18 9"/>',
  chevronUp: '<polyline points="18 15 12 9 6 15"/>',
  chevronLeft: '<polyline points="15 18 9 12 15 6"/>',
  chevronRight: '<polyline points="9 18 15 12 9 6"/>',
  fire: '<path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z"/>',
  leaf: '<path d="M11 20A7 7 0 019.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  award: '<circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  camera: '<path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/>',
  play: '<polygon points="5 3 19 12 5 21 5 3"/>',
  download: '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  fun: '<rect x="2" y="6" width="20" height="14" rx="2"/><line x1="8" y1="6" x2="8" y2="2"/><line x1="16" y1="6" x2="16" y2="2"/><line x1="2" y1="12" x2="22" y2="12"/>',
  film: '<rect x="3" y="4" width="18" height="16" rx="2"/><line x1="8" y1="4" x2="8" y2="20"/><line x1="16" y1="4" x2="16" y2="20"/><line x1="3" y="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/>',
  game: '<line x1="6" y1="11" x2="18" y2="11"/><line x1="12" y1="5" x2="12" y2="19"/><circle cx="9" cy="8" r="1"/><circle cx="15" cy="8" r="1"/><circle cx="9" cy="14" r="1"/><circle cx="15" cy="14" r="1"/>',
  comic: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>',
  upload: '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
  save: '<path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
  refresh: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>',
  bell: '<path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>',
  heart: '<path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  x: '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
  tag: '<path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',
  filter: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
  clipboard: '<path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>',
  sparkles: '<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
  dumbbell: '<path d="M6.5 6.5l11 11"/><path d="M21 21l-1-1"/><path d="M3 3l1 1"/><path d="M18 22l4-4"/><path d="M2 6l4-4"/><path d="M3 10l7-7"/><path d="M14 21l7-7"/>',
  swap: '<rect x="3" y="4" width="8" height="8" rx="1.5"/><rect x="13" y="12" width="8" height="8" rx="1.5"/>',
  map: '<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>',
  plane: '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>',
  location: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>'
};
function icon(name, size) {
  size = size || 24;
  const inner = icons[name] || '';
  return '<svg class="ic-svg" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>';
}

/* 统一照片放大查看器：点击任意照片缩略图 → 放大 + 右下角下载线性图标（无文字） */
window.photoViewer = async function (key) {
  if (!key) return;
  try {
    const rec = await IDB.get(key);
    if (!rec || !rec.data) { toast('图片不存在或已删除'); return; }
    const ov = openModal(`<button class="close-x" onclick="closeModal()">×</button>
      <img class="pv-full" src="${rec.data}">
      <button class="pv-dl" id="pvDl" type="button" aria-label="下载">${icon('download', 20)}</button>`);
    ov.querySelector('#pvDl').onclick = () => {
      const a = document.createElement('a');
      a.href = rec.data; a.download = '木木_' + key + '.png';
      document.body.appendChild(a); a.click(); a.remove();
      toast('已保存到下载');
    };
  } catch (e) { console.warn('photoViewer', e); }
};

/* 全局委托：所有带 data-pid / data-view 的照片缩略图，点击即放大并带下载；
   排除日历格子 / 记录卡片 / 省份九宫格等自身已有弹窗交互的容器，避免双重弹窗 */
document.addEventListener('click', e => {
  if (e.target.closest('button')) return;
  if (e.target.closest('.cal-cell, .cal-photo, .cal-row, .pc-day, .pc-img, [data-rec], .pv-grid, .cr-ph')) return;
  const el = e.target.closest('[data-pid], [data-view]');
  if (!el) return;
  const key = el.dataset.pid || el.dataset.view;
  if (key) { e.preventDefault(); window.photoViewer(key); }
});

/* ============ 防误触：删除按钮默认隐藏，长按所在行/卡片才出现 ============ */
// 收起除 node 所在链路以外的全部已展开元素；node 为空则全部收起
function lpCollapse(node) {
  document.querySelectorAll('.lp-revealed').forEach(el => {
    if (!node || !el.contains(node)) el.classList.remove('lp-revealed');
  });
}
(function () {
  const SEL = '[data-cdel],[data-delact],[data-dellog],[data-delp],[data-delitem],[data-delplan],[data-deld],[data-delclip],[data-delstep],[data-delout],[data-deltrip],[data-delpack],[data-deln],[data-delphoto]';
  function holderOf(btn) { return btn.closest('[data-lp]') || btn.closest('.list-row') || btn.closest('.card') || btn.parentElement; }
  let timer = null, target = null;
  function clear() { clearTimeout(timer); timer = null; target = null; }
  document.addEventListener('pointerdown', e => {
    if (e.button) return;
    // 按在别处（含长按别处）→ 先收起所有与本次落点无关的展开项
    lpCollapse(e.target);
    const btn = e.target.closest(SEL);
    const h = btn ? holderOf(btn) : (e.target.closest('[data-lp]') || e.target.closest('.list-row') || e.target.closest('.card'));
    if (!h) return;
    target = h;
    clearTimeout(timer);
    timer = setTimeout(() => { if (target) target.classList.toggle('lp-revealed'); }, 480);
  }, true);
  document.addEventListener('pointerup', clear);
  document.addEventListener('pointercancel', clear);
  document.addEventListener('pointerleave', clear);
  document.addEventListener('contextmenu', e => {
    // 全局禁止长按弹出复制/剪切菜单；输入框/文本框允许正常操作
    if (/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    e.preventDefault();
  });
})();
