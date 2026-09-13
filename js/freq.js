/* ============ 频率 · 事件 × 日期 记录统计 ============ */
/* 纯新增模块（v221）：事件×日期网格，有记录即在当天小方块打勾。
 * 初始事件：洗澡 / 敷面膜 / 臭臭；三餐打卡时自动同步：甜品 / 咖啡 / 外卖 / 奶茶（甜饮 v230 起不再同步）。
 * v230：卡片标题长按进入编辑态（右上角 × 删除 + 拖拽排序）；日期格长按打卡保持不动。
 */
// 长按触发（防误触）：按住 ~450ms 才生效；移动（拖动）/短按/松手提前均取消
function bindLongPress(el, cb) {
  let timer = null, sx = 0, sy = 0;
  const start = (e) => {
    sx = e && (e.clientX != null) ? e.clientX : 0; sy = e && (e.clientY != null) ? e.clientY : 0;
    el.classList.add('pressing');
    timer = setTimeout(() => { timer = null; el.classList.remove('pressing'); el.classList.add('held'); cb(); setTimeout(() => el.classList.remove('held'), 200); }, 450);
  };
  const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } el.classList.remove('pressing'); };
  const move = (e) => {
    const x = e && (e.clientX != null) ? e.clientX : sx, y = e && (e.clientY != null) ? e.clientY : sy;
    if (timer && (Math.abs(x - sx) > 8 || Math.abs(y - sy) > 8)) cancel();
  };
  el.addEventListener('pointerdown', start);
  el.addEventListener('pointerup', cancel);
  el.addEventListener('pointerleave', cancel);
  el.addEventListener('pointercancel', cancel);
  el.addEventListener('pointermove', move);
  el.addEventListener('contextmenu', e => e.preventDefault());
}

const Freq = {
  KEY: 'mumu_freq',
  data() { return S.get(this.KEY, { events: ['洗澡', '敷面膜', '臭臭'], dates: {} }); },
  save(d) { S.set(this.KEY, d); },
  ensure() {
    const d = this.data();
    if (!d.events) d.events = ['洗澡', '敷面膜', '臭臭'];
    if (!d.dates) d.dates = {};
    // 迁移：大便情况 → 臭臭（v228）
    if (d.events && d.events.includes('大便情况')) {
      d.events = d.events.map(e => e === '大便情况' ? '臭臭' : e);
      d.events = Array.from(new Set(d.events));
      Object.keys(d.dates).forEach(date => {
        if (d.dates[date] && d.dates[date]['大便情况'] !== undefined) {
          if (!d.dates[date]['臭臭']) d.dates[date]['臭臭'] = d.dates[date]['大便情况'];
          delete d.dates[date]['大便情况'];
        }
      });
    }
    // 回灌：从历史三餐记录补充真实次数（纯镜像到频率页，不改 meals 数据）；仅首次执行，避免覆盖手动清除
    if (!d._mealBackfilled) {
      const meals = S.get('meals', {}) || {};
      this.MEAL_MAP.forEach(({ ev, keys }) => {
        Object.keys(meals).forEach(date => {
          const slots = meals[date]; if (!slots) return;
          let cnt = 0;
          Object.keys(slots).forEach(slot => {
            const rec = slots[slot];
            if (rec && rec.tags && rec.tags.some(t => keys.some(k => (t || '').includes(k)))) cnt++;
          });
          if (cnt > 0) { d.dates[date] = d.dates[date] || {}; d.dates[date][ev] = cnt; if (!d.events.includes(ev)) d.events.push(ev); }
        });
      });
      d._mealBackfilled = true;
    }
    // 用户手动新增「水果」事件后，首次补回历史三餐里的水果记录（避免两边分别打卡 / 历史漏统计）
    if (!d._fruitBackfilled && d.events.includes('水果')) {
      const meals = S.get('meals', {}) || {};
      Object.keys(meals).forEach(date => {
        const slots = meals[date]; if (!slots) return;
        let cnt = 0;
        Object.keys(slots).forEach(slot => {
          const rec = slots[slot];
          if (rec && rec.tags && rec.tags.some(t => ['水果'].some(k => (t || '').includes(k)))) cnt++;
        });
        if (cnt > 0) { d.dates[date] = d.dates[date] || {}; d.dates[date]['水果'] = cnt; }
      });
      d._fruitBackfilled = true;
    }
    // 回灌：从历史三餐补充「外出就餐 / 泡面」真实次数（与上面同理，仅首次执行）
    if (!d._outBackfilled) {
      const meals = S.get('meals', {}) || {};
      const OUT_MAP = [{ ev: '外出就餐', keys: ['外出就餐'] }, { ev: '泡面', keys: ['泡面', '方便面'] }];
      OUT_MAP.forEach(({ ev, keys }) => {
        Object.keys(meals).forEach(date => {
          const slots = meals[date]; if (!slots) return;
          let cnt = 0;
          Object.keys(slots).forEach(slot => {
            const rec = slots[slot];
            if (rec && rec.tags && rec.tags.some(t => keys.some(k => (t || '').includes(k)))) cnt++;
          });
          if (cnt > 0) { d.dates[date] = d.dates[date] || {}; d.dates[date][ev] = cnt; if (!d.events.includes(ev)) d.events.push(ev); }
        });
      });
      d._outBackfilled = true;
    }
    // 清理历史甜饮（v230 起甜饮不再自动同步；奶茶用户手动记，不受影响）
    if (d.events && d.events.includes('甜饮')) {
      d.events = d.events.filter(e => e !== '甜饮');
      Object.keys(d.dates).forEach(date => { if (d.dates[date] && d.dates[date]['甜饮'] !== undefined) delete d.dates[date]['甜饮']; });
    }
    // v278：一次性把「洗澡 / 敷面膜 / 身体乳」自动关联到每日计划的同名任务（免得完成计划后再去频率手动打卡）。
    // 只跑一次；之后用户自己改的关联不会被覆盖回去。事件不存在则补建。
    if (!d._dailyLinkV278) {
      const AUTO = ['洗澡', '敷面膜', '身体乳'];
      d.links = d.links || {};
      AUTO.forEach(ev => {
        if (!d.events.includes(ev)) d.events.push(ev);
        if (!d.links[ev]) d.links[ev] = { mod: 'daily', ref: ev };
      });
      d._dailyLinkV278 = 1;
    }
    this.save(d);
    return d;
  },
  // 三餐保存时同步：甜品 / 咖啡 / 外卖 / 奶茶 / 水果（甜饮 v230 起不再同步）
  MEAL_MAP: [
    { ev: '甜品', keys: ['甜品', '甜饮/甜品', '蛋糕', '甜点'] },
    { ev: '咖啡', keys: ['咖啡'] },
    { ev: '外卖', keys: ['外卖', '重口外卖'] },
    { ev: '奶茶', keys: ['奶茶'] },
    { ev: '水果', keys: ['水果'] },
    { ev: '外出就餐', keys: ['外出就餐'] },
    { ev: '泡面', keys: ['泡面', '方便面'] }
  ],
  // 三餐保存时同步：重算该日期所有餐记录里匹配事件的真实次数（一天多次外卖 → 显示对应次数）
  syncFromMeals(date, tags, text) {
    const d = this.ensure();
    const meals = S.get('meals', {}) || {};
    const slots = meals[date];
    if (slots) {
      const counts = {};
      Object.keys(slots).forEach(slot => {
        const rec = slots[slot]; if (!rec) return;
        const hay = (rec.tags || []).join(' ') + ' ' + (rec.text || '');
        this.MEAL_MAP.forEach(({ ev, keys }) => { if (keys.some(k => hay.includes(k))) counts[ev] = (counts[ev] || 0) + 1; });
      });
      Object.keys(counts).forEach(ev => {
        d.dates[date] = d.dates[date] || {};
        d.dates[date][ev] = counts[ev];
        if (!d.events.includes(ev)) d.events.push(ev);
      });
    }
    this.save(d);
  },

  /* ===== 事件关联板块（v253）=====
   * 关联后次数由对应专栏日志「实时反查」，无需手动点格子，也不必往各专栏插同步钩子。
   * d.links = { 事件名: { mod, ref } }；未关联的事件沿用 d.dates 手动计数。 */
  MODULES() {
    return [
      { k: 'custom', label: '不关联（手动点格子记录）', sub: false, tip: '每天自己点日期格记录' },
      { k: 'daily', label: '每日计划', sub: 'text', subLabel: '任务名称', ph: '留空=任意任务；如：洗澡', tip: '完成该任务即自动计次' },
      { k: 'sport', label: '运动', sub: 'text', subLabel: '运动项目', ph: '留空=任意运动；如：天鹅颈', tip: '完成该运动项目即自动计次' },
      { k: 'kg', label: '学习·考编', sub: 'text', subLabel: '学习科目', ph: '留空=任意科目；如：言语', tip: '完成该科目打卡即自动计次' },
      { k: 'work', label: '创作', sub: false, tip: '当天有创作产出即自动计次' },
      { k: 'growth', label: '成长', sub: 'text', subLabel: '成长领域', ph: '留空=任意领域；如：英语', tip: '完成该领域打卡即自动计次' },
      { k: 'read', label: '阅读', sub: false, tip: '当天有阅读记录即自动计次' },
      { k: 'travel', label: '出行', sub: false, tip: '当天有外出记录即自动计次' },
      {
        k: 'fun', label: '娱乐', sub: 'select', subLabel: '娱乐类型', tip: '记录对应类型的娱乐即自动计次',
        options: [['', '任意'], ['小说', '小说'], ['影视', '影视'], ['漫画', '漫画'], ['游戏', '游戏']]
      },
      {
        k: 'meals', label: '三餐', sub: 'select', subLabel: '餐次', tip: '打卡对应餐次即自动计次',
        options: [['', '任意一餐都算'], ['breakfast', '早餐'], ['lunch', '午餐'], ['dinner', '晚餐']]
      }
    ];
  },
  linkOf(name) { return (this.data().links || {})[name] || null; },
  // 某天该关联项的真实次数（实时反查专栏日志）
  countOf(lk, date) {
    if (!lk) return 0;
    const arr = (k) => S.get(k, {})[date] || [];
    if (lk.mod === 'daily') {
      // 反查每日计划：当天任务名包含 ref（留空=任意任务）且已完成 → 计次
      const tasks = arr('plans');
      return tasks.filter(t => {
        if (!(window.Daily && Daily.effDone && Daily.effDone(t, date))) return false;
        return !lk.ref || (t.title || '').indexOf(lk.ref) >= 0;
      }).length;
    }
    if (lk.mod === 'sport') return arr('sportLogs').filter(l => !lk.ref || (l.project || '') === lk.ref).length;
    if (lk.mod === 'kg') return arr('kgLogs').filter(l => !lk.ref || (l.subject || '').indexOf(lk.ref) >= 0).length;
    if (lk.mod === 'work') return arr('workLogs').length;
    if (lk.mod === 'growth') return arr('growthLogs').filter(l => !lk.ref || (l.area || '') === lk.ref).length;
    if (lk.mod === 'read') return arr('readLogs').length;
    if (lk.mod === 'travel') return arr('travelOut').length;
    if (lk.mod === 'fun') return arr('funLogs').filter(r => !lk.ref || r.type === lk.ref).length;
    if (lk.mod === 'meals') {
      const day = S.get('meals', {})[date]; if (!day) return 0;
      return lk.ref ? (day[lk.ref] ? 1 : 0) : ['breakfast', 'lunch', 'dinner'].filter(k => day[k]).length;
    }
    return 0;
  },

  // ================= 渲染 =================
  render(box) {
    const d = this.ensure();
    if (!Daily._monthYm) Daily._monthYm = todayStr().slice(0, 7);
    const ym = Daily._monthYm;
    const [yy, mm] = ym.split('-').map(Number);
    const dim = new Date(yy, mm, 0).getDate();
    const firstDow = new Date(yy, mm - 1, 1).getDay(); // 0=周日，用于把方格对齐成真实月历
    const editing = !!this._edit;
    box.innerHTML = '';
    const top = document.createElement('div'); top.style.marginBottom = '12px'; box.appendChild(top);
    const bar = document.createElement('div');
    bar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-top:10px';
    bar.innerHTML = `<div style="display:flex;gap:5px;align-items:center">
        <span class="branch-title" style="margin:0;padding:0;border:none;font-size:17px">${yy}年${mm}月</span>
        <button class="icon-btn" id="fqCal" title="选择年月">${icon('calendar', 18)}</button>
      </div>
      <div style="display:flex;gap:2px;align-items:center">
        ${editing ? `<button class="icon-btn" id="fqDone" title="完成编辑">${icon('check', 18)}</button>` : ''}
        <button class="icon-btn" id="fqAdd" title="新增事件">${icon('plus', 18)}</button>
        <button class="icon-btn" id="fqBack" title="返回">${icon('back', 18)}</button>
      </div>`;
    top.appendChild(bar);
    const tip = document.createElement('div');
    tip.className = 'muted'; tip.style.cssText = 'margin:2px 0 4px;font-size:12px';
    tip.textContent = editing ? '编辑中：点右上角 × 删除事件，按住卡片拖动可排序' : '点日期格 +1 · 长按日期格清除当天 · 长按卡片标题排序/删除';
    top.appendChild(tip);
    // 一个事件一个独立方块：方块内是当月按日期排序的小方格（有记录=绿，点一下切换）
    const cards = document.createElement('div'); cards.className = 'freq-cards'; box.appendChild(cards);
    const FREQ_MAC = ['#F4A6B8', '#8FB8E0', '#7CB390', '#F6C56E', '#B8A4D4', '#4FB0AE', '#F5B971', '#9BD0C9', '#E08BA0', '#C9A66B', '#E59AC0', '#A8B5C4'];
    d.events.forEach((ev, ei) => {
      const mac = FREQ_MAC[ei % FREQ_MAC.length];
      let onN = 0;
      let sq = '';
      const lk = this.linkOf(ev);   // 关联了板块 → 次数实时反查，且格子只读
      for (let i = 0; i < firstDow; i++) sq += '<div class="freq-sq empty-cell"></div>';
      for (let dd = 1; dd <= dim; dd++) {
        const ds = ym + '-' + String(dd).padStart(2, '0');
        const cnt = lk ? this.countOf(lk, ds) : ((d.dates[ds] && d.dates[ds][ev]) ? (Number(d.dates[ds][ev]) || 1) : 0);
        const on = cnt > 0;
        if (on) onN++;
        sq += `<div class="freq-sq ${on ? 'on' : ''}${lk ? ' linked' : ''}" data-ev="${esc(ev)}" data-ds="${ds}" title="${ds}${cnt > 1 ? ' · ' + cnt + ' 次' : ''}">${cnt > 1 ? cnt : (on ? '✓' : dd)}</div>`;
      }
      const card = document.createElement('div');
      card.className = 'freq-card' + (editing ? ' edit' : '');
      card.draggable = editing;
      card.dataset.ev = esc(ev);
      card.dataset.ei = ei;
      card.style.setProperty('--mac', mac);
      card.innerHTML = `<button class="freq-del" data-ev="${esc(ev)}" title="删除该事件">×</button>
        <div class="freq-card-h"><span class="freq-card-t"><span class="freq-dot" style="background:${mac}"></span>${esc(ev)}${lk ? '<span class="freq-auto">自动</span>' : ''}</span><span class="cnt">${onN}天</span></div>
        <div class="freq-sq-grid">${sq}</div>`;
      cards.appendChild(card);
    });
    // 日期格：短按 +1（易加），长按清除当天该事件（易删，不会误删整条事件）
    cards.querySelectorAll('.freq-sq[data-ev]').forEach(c => {
      // 关联板块的事件由专栏/每日计划打卡自动统计，格子只读，避免手动数与实际打卡打架
      if (this.linkOf(c.dataset.ev)) {
        c.addEventListener('click', () => toast('「' + c.dataset.ev + '」已关联板块，次数由打卡自动同步'));
        return;
      }
      let longFired = false;
      bindLongPress(c, () => {
        longFired = true;
        const ev = c.dataset.ev, ds = c.dataset.ds;
        const dd = this.data();
        dd.dates[ds] = dd.dates[ds] || {};
        dd.dates[ds][ev] = 0;   // 长按 = 清除当天该事件记录
        this.save(dd); this.render(box);
        toast('已清除 ' + ev + ' · ' + ds.slice(5));
      });
      c.addEventListener('click', () => {
        if (longFired) { longFired = false; return; }  // 忽略长按后的误触发 click
        const ev = c.dataset.ev, ds = c.dataset.ds;
        const dd = this.data();
        dd.dates[ds] = dd.dates[ds] || {};
        const cnt = (dd.dates[ds][ev] ? (Number(dd.dates[ds][ev]) || 0) : 0) + 1;
        dd.dates[ds][ev] = cnt;
        this.save(dd); this.render(box);
        toast((cnt === 1 ? '已记录 ' : '已追加 ') + ev + ' · ' + ds.slice(5) + (cnt > 1 ? ' ×' + cnt : ''));
      });
    });
    // 卡片标题长按：进入 / 退出编辑态；编辑态下短按标题 = 改这个事件的关联（只改 links，历史记录不动）
    cards.querySelectorAll('.freq-card-h').forEach(h => bindLongPress(h, () => { this._edit = !this._edit; this.render(box); }));
    cards.querySelectorAll('.freq-card-t').forEach(t => t.addEventListener('click', (e) => {
      if (!this._edit) return;
      e.stopPropagation();
      const card = t.closest('.freq-card');
      const ev = card ? d.events[Number(card.dataset.ei)] : '';
      if (ev) this.linkDialog(box, ev);
    }));
    // 删除按钮（阻止冒泡，避免触发卡片拖动）
    cards.querySelectorAll('.freq-del').forEach(b => {
      b.addEventListener('pointerdown', e => e.stopPropagation());
      b.onclick = (e) => { e.stopPropagation(); this.delEvent(box, b.dataset.ev); };
    });
    // 拖拽排序
    if (editing) this.bindReorder(cards, box);
    box.querySelector('#fqBack').onclick = () => { Daily._sub = null; Daily.render(Daily._root); };
    box.querySelector('#fqCal').onclick = () => this.openCalPicker(box, ym);
    box.querySelector('#fqAdd').onclick = () => this.addDialog(box);
    const doneBtn = box.querySelector('#fqDone'); if (doneBtn) doneBtn.onclick = () => { this._edit = false; this.render(box); };
    box.appendChild(Daily.renderSubTabs(box, 'freq'));
  },

  // 编辑态：拖拽排序
  bindReorder(container, box) {
    const self = this;
    container.querySelectorAll('.freq-card').forEach(card => {
      card.addEventListener('dragstart', () => { card.classList.add('dragging'); });
      card.addEventListener('dragend', () => { card.classList.remove('dragging'); });
      card.addEventListener('dragover', (e) => {
        e.preventDefault();
        const dragEl = container.querySelector('.freq-card.dragging');
        if (!dragEl) return;
        const after = self.getDragAfter(container, e.clientY);
        if (after == null) container.appendChild(dragEl);
        else container.insertBefore(dragEl, after);
      });
      card.addEventListener('drop', (e) => { e.preventDefault(); self.reorderFromDOM(container, box); });
    });
  },
  getDragAfter(container, y) {
    const els = [...container.querySelectorAll('.freq-card:not(.dragging)')];
    let closest = { offset: -Infinity, element: null };
    els.forEach(child => {
      const b = child.getBoundingClientRect();
      const offset = y - b.top - b.height / 2;
      if (offset < 0 && offset > closest.offset) closest = { offset, element: child };
    });
    return closest.element;
  },
  reorderFromDOM(container, box) {
    const dec = s => { const t = document.createElement('textarea'); t.innerHTML = s; return t.value; };
    const decoded = [...container.querySelectorAll('.freq-card')].map(c => dec(c.dataset.ev));
    const d = this.data();
    const seen = new Set(), next = [];
    decoded.forEach(n => { if (d.events.includes(n) && !seen.has(n)) { seen.add(n); next.push(n); } });
    d.events = next.concat(d.events.filter(e => !next.includes(e)));
    this.save(d); this.render(box);
  },
  delEvent(box, raw) {
    const ev = (() => { const t = document.createElement('textarea'); t.innerHTML = raw; return t.value; })();
    if (!confirm('删除「' + ev + '」？该事件所有打卡记录会一起删掉。')) return;
    const d = this.data();
    d.events = d.events.filter(e => e !== ev);
    Object.keys(d.dates).forEach(date => { if (d.dates[date] && d.dates[date][ev] !== undefined) delete d.dates[date][ev]; });
    this.save(d); this._edit = false; this.render(box); toast('已删除 ' + ev);
  },

  openCalPicker(box, ym) {
    let [yy, mm] = ym.split('-').map(Number);
    const draw = () => {
      const months = Array.from({ length: 12 }, (_, i) => i + 1);
      openModal(`<button class="close-x" onclick="closeModal()">×</button><h3>选择年月</h3>
        <div style="display:flex;align-items:center;justify-content:center;gap:14px;margin:12px 0">
          <button class="icon-btn" id="calYmPrev" title="上一年">${icon('chevronLeft', 18)}</button>
          <span style="font-size:18px;font-weight:700;min-width:80px;text-align:center">${yy}年</span>
          <button class="icon-btn" id="calYmNext" title="下一年">${icon('chevronRight', 18)}</button>
        </div>
        <div class="cal-month-grid">${months.map(m => `<button class="cal-month ${m === mm ? 'active' : ''}" data-m="${m}">${m}月</button>`).join('')}</div>`);
      document.getElementById('calYmPrev').onclick = () => { yy--; draw(); };
      document.getElementById('calYmNext').onclick = () => { yy++; draw(); };
      document.querySelectorAll('.cal-month').forEach(b => b.onclick = () => {
        Daily._monthYm = yy + '-' + String(Number(b.dataset.m)).padStart(2, '0');
        closeModal(); this.render(box);
      });
    };
    draw();
  },

  addDialog(box) {
    const mods = this.MODULES();
    openModal(`<button class="close-x" onclick="closeModal()">×</button><h3>新增记录事件</h3>
      <div class="muted" style="font-size:12px;margin:6px 0 12px;line-height:1.6">可以给事件<b>关联一个板块</b>：关联后由每日计划/专栏的打卡自动统计次数，不用手动点格子。不关联就是纯手动记录。</div>
      <div class="form-row"><label>事件名</label><input id="fqName" placeholder="例如：泡脚"></div>
      <div class="form-row"><label>关联板块</label>
        <select id="fqMod">${mods.map(m => `<option value="${m.k}">${esc(m.label)}</option>`).join('')}</select>
      </div>
      <div class="form-row" id="fqSubRow" style="display:none"><label id="fqSubLab">细分</label>
        <input id="fqSubText" placeholder="" autocomplete="off">
        <select id="fqSubSel" style="display:none"></select>
      </div>
      <div class="muted" id="fqTip" style="font-size:11px;margin-bottom:10px;line-height:1.5"></div>
      <button class="btn" id="fqOk" style="width:100%">添加</button>`);
    const sel = document.getElementById('fqMod');
    const row = document.getElementById('fqSubRow');
    const txt = document.getElementById('fqSubText');
    const selSub = document.getElementById('fqSubSel');
    const lab = document.getElementById('fqSubLab');
    const tip = document.getElementById('fqTip');
    const sync = () => {
      const m = mods.find(x => x.k === sel.value) || mods[0];
      tip.textContent = m.tip || '';
      if (!m.sub) { row.style.display = 'none'; return; }
      row.style.display = '';
      lab.textContent = m.subLabel || '细分';
      if (m.sub === 'select') {
        txt.style.display = 'none'; selSub.style.display = '';
        selSub.innerHTML = (m.options || []).map(o => `<option value="${esc(o[0])}">${esc(o[1])}</option>`).join('');
      } else {
        txt.style.display = ''; selSub.style.display = 'none';
        txt.placeholder = m.ph || '';
      }
    };
    sel.onchange = sync; sync();
    document.getElementById('fqOk').onclick = () => {
      const name = document.getElementById('fqName').value.trim();
      if (!name) return toast('请输入事件名');
      const m = mods.find(x => x.k === sel.value) || mods[0];
      let ref = '';
      if (m.sub === 'text') ref = (txt.value || '').trim();
      else if (m.sub === 'select') ref = (selSub.value || '').trim();
      const d = this.data();
      d.links = d.links || {};
      if (m.k === 'custom') delete d.links[name]; else d.links[name] = { mod: m.k, ref };
      if (!d.events.includes(name)) d.events.push(name);
      this.save(d); closeModal();
      toast(m.k === 'custom' ? '已添加，点日期格即可记录' : '已添加「' + name + '」，关联' + m.label + '后自动统计');
      this.render(box);
    };
  },
  // 修改已有事件的关联：只改 links，不动 events / dates —— 不像 delEvent 会把该事件的历史记录全清掉
  linkDialog(box, ev) {
    const mods = this.MODULES();
    const cur = this.linkOf(ev) || { mod: 'custom', ref: '' };
    openModal(`<button class="close-x" onclick="closeModal()">×</button><h3>「${esc(ev)}」的关联</h3>
      <div class="muted" style="font-size:12px;margin:6px 0 12px;line-height:1.6">关联后次数由对应板块的打卡<b>自动统计</b>，不用手动点格子。选「不关联」就恢复手动记录，<b>已经记录的历史不会丢</b>。</div>
      <div class="form-row"><label>关联板块</label>
        <select id="fqMod">${mods.map(m => `<option value="${m.k}"${m.k === cur.mod ? ' selected' : ''}>${esc(m.label)}</option>`).join('')}</select>
      </div>
      <div class="form-row" id="fqSubRow" style="display:none"><label id="fqSubLab">细分</label>
        <input id="fqSubText" value="${esc(cur.ref || '')}" placeholder="" autocomplete="off">
        <select id="fqSubSel" style="display:none"></select>
      </div>
      <div class="muted" id="fqTip" style="font-size:11px;margin-bottom:10px;line-height:1.5"></div>
      <button class="btn" id="fqOk" style="width:100%">保存</button>`);
    const sel = document.getElementById('fqMod');
    const row = document.getElementById('fqSubRow');
    const txt = document.getElementById('fqSubText');
    const selSub = document.getElementById('fqSubSel');
    const lab = document.getElementById('fqSubLab');
    const tip = document.getElementById('fqTip');
    const sync = () => {
      const m = mods.find(x => x.k === sel.value) || mods[0];
      tip.textContent = m.tip || '';
      if (!m.sub) { row.style.display = 'none'; return; }
      row.style.display = '';
      lab.textContent = m.subLabel || '细分';
      if (m.sub === 'select') {
        txt.style.display = 'none'; selSub.style.display = '';
        selSub.innerHTML = (m.options || []).map(o => `<option value="${esc(o[0])}"${o[0] === (cur.ref || '') ? ' selected' : ''}>${esc(o[1])}</option>`).join('');
      } else {
        txt.style.display = ''; selSub.style.display = 'none';
        txt.placeholder = m.ph || '';
      }
    };
    sel.onchange = sync; sync();
    document.getElementById('fqOk').onclick = () => {
      const m = mods.find(x => x.k === sel.value) || mods[0];
      let ref = '';
      if (m.sub === 'text') ref = (txt.value || '').trim();
      else if (m.sub === 'select') ref = (selSub.value || '').trim();
      const d = this.data();
      d.links = d.links || {};
      if (m.k === 'custom') delete d.links[ev]; else d.links[ev] = { mod: m.k, ref };
      this.save(d); closeModal();
      toast(m.k === 'custom' ? '已恢复手动记录（历史保留）' : '已关联' + m.label + '，次数自动统计');
      this.render(box);
    };
  }
};
window.Freq = Freq;
