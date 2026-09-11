/* ============ 三餐 · 照片打卡 + 营养分析 ============ */
const Meals = {
  cur: todayStr(),
  slots: [{ k: 'breakfast', n: '早餐', ic: 'sunrise' }, { k: 'lunch', n: '午餐', ic: 'sun' }, { k: 'dinner', n: '晚餐', ic: 'moon' }, { k: 'snack', n: '零嘴', ic: 'candy' }],
  tagsPos: ['主食', '优质蛋白', '蔬菜', '水果', '奶/豆制品', '坚果', '咖啡', '外出就餐', '泡面'],
  tagsNeg: ['油炸', '甜品', '甜饮', '奶茶', '外卖', '夜宵'],
  // 垃圾食品关键词 → 自动打负面标签（保存三餐时扫描描述/份量文字）
  JUNK_MAP: [
    { tag: '油炸', keys: ['炸鸡', '薯条', '油条', '油饼', '炸串', '天妇罗', '肯德基', '麦当劳', '薯片', '炸鱼', '炸薯条', '炸酱面', '油炸'] },
    { tag: '甜品', keys: ['甜品', '蛋糕', '糖果', '冰淇淋', '冰激凌', '巧克力', '芝士蛋糕', '甜点'] },
    { tag: '甜饮', keys: ['可乐', '雪碧', '汽水'] },
    { tag: '奶茶', keys: ['奶茶'] },
    { tag: '外卖', keys: ['外卖', '麻辣烫', '螺蛳粉', '重口外卖', '辣条', '串串'] },
    { tag: '夜宵', keys: ['夜宵', '宵夜', '半夜', '深夜', '临睡前'] }
  ],
  data() { return S.get('meals', {}); }, // {date:{breakfast:{photoId,desc,tags,time},...}}
  mealTargets() { return S.get('mealTargets', { breakfast: '08:00', lunch: '12:30', dinner: '18:30' }); },
  nowTime() { const n = new Date(); return String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0'); },
  minDiff(a, b) { const [ah, am] = a.split(':').map(Number); const [bh, bm] = b.split(':').map(Number); return ah * 60 + am - (bh * 60 + bm); },
  // 垃圾食品自动识别：扫描描述/份量文字，返回应自动补打的负面标签
  junkAutoTags(text) {
    if (!text) return [];
    const t = String(text);
    const out = [];
    this.JUNK_MAP.forEach(({ tag, keys }) => { if (keys.some(k => t.includes(k))) out.push(tag); });
    return out;
  },
  // 一次性回填：把历史三餐里漏标的垃圾食品补打负面标签（只增不删，幂等，App.init 调用）
  backfillJunkTags() {
    const data = this.data(); let n = 0;
    Object.keys(data).forEach(d => {
      Object.keys(data[d]).forEach(k => {
        const m = data[d][k];
        if (!m || m.skipped) return;
        const auto = this.junkAutoTags([m.desc, m.amount].filter(Boolean).join(' '));
        if (!auto.length) return;
        const tags = m.tags || [];
        if (auto.some(t => !tags.includes(t))) { m.tags = [...new Set([...tags, ...auto])]; n++; }
      });
    });
    if (n) S.set('meals', data);
    return n;
  },

  // 营养分：估算当天的「膳食均衡度」（0~100），依据是中国居民膳食指南的食物多样原则。
  // 注意：仅基于用户勾选的食物标签 + 就餐餐次估算，不含分量/热量，属均衡度估计而非精确营养值。
  // 同一类食物在不同餐中出现时贡献递减（首餐满分，之后×0.5、再×0.25），避免重复同类刷分，
  // 从而区分「吃 1 顿均衡餐」与「吃 3 顿均衡餐」。
  dayScore(day) {
    if (!day) return null;
    const meals = this.slots.filter(s => { const m = day[s.k]; return m && !m.skipped; });
    if (!meals.length) return null;
    // 核心三餐（早/午/晚）是否吃齐，用于「完整度封顶」——零嘴不计入三餐完整性
    const coreEaten = ['breakfast', 'lunch', 'dinner'].filter(k => { const m = day[k]; return m && !m.skipped; }).length;
    // 六类食物的每日参考权重（核心三类 > 推荐两类 > 加分项），权重来自膳食指南的"食物多样、粗细搭配"
    const GROUP_W = { '主食': 20, '优质蛋白': 20, '蔬菜': 18, '水果': 12, '奶/豆制品': 12, '坚果': 8 };
    const seen = {}; let groupScore = 0, negCount = 0;
    meals.forEach(s => {
      (day[s.k].tags || []).forEach(t => {
        if (this.tagsNeg.includes(t)) { negCount++; return; }
        const w = GROUP_W[t]; if (!w) return;
        const n = (seen[t] = (seen[t] || 0) + 1);
        const factor = n === 1 ? 1 : n === 2 ? 0.5 : 0.25; // 递减，避免同类重复刷分
        groupScore += w * factor;
      });
    });
    // 餐次规律性：以核心三餐是否吃齐为准（零嘴不计），吃满3餐给足规律性分，缺餐递减
    const mealScore = coreEaten >= 3 ? 22 : coreEaten === 2 ? 12 : 6;
    // 负面标签按出现次数扣分，设上限避免一次失误清零
    let score = groupScore + mealScore - Math.min(35, negCount * 9);
    // 垃圾食品强识别：当天完全没有任何健康食物类别（只勾了负面标签/空），判定为纯垃圾日，封顶压低
    let anyPos = false, anyTagged = false;
    meals.forEach(s => {
      const ts = (day[s.k] && day[s.k].tags) || [];
      if (ts.length) anyTagged = true;
      if (ts.some(t => this.tagsPos.includes(t))) anyPos = true;
    });
    if (!anyPos && anyTagged) score = Math.min(score, 20); // 纯垃圾日：封顶20，不再因餐次规律性给高分
    // 完整度封顶：缺任一核心餐（早/午/晚没吃或没记）则不给满分——吃两顿再均衡也只是「还行」，不该100
    const cap = coreEaten >= 3 ? 100 : coreEaten === 2 ? 85 : coreEaten === 1 ? 70 : 10;
    score = Math.min(score, cap);
    return Math.max(10, Math.min(100, Math.round(score)));
  },
  // 三餐规律：本周（周一开始）每餐是否吃、是否准点
  regularity() {
    const data = this.data(); const tg = this.mealTargets(); const tol = 60;
    let onTime = 0, eaten = 0; const total = 21;
    const rows = [];
    weekDates(todayStr()).forEach(d => {
      const day = data[d];
      const cells = this.slots.map(s => {
        const m = day && day[s.k];
        if (!m) return { time: null, state: 'miss' };
        if (m.skipped) return { time: null, state: 'skip' };
        eaten++;
        if (m.time && tg[s.k] && Math.abs(this.minDiff(m.time, tg[s.k])) <= tol) { onTime++; return { time: m.time, state: 'ontime' }; }
        return { time: m.time, state: 'off' };
      });
      rows.push({ d, cells });
    });
    return { rows, eatRate: Math.round(eaten / total * 100), onRate: eaten ? Math.round(onTime / eaten * 100) : 0 };
  },
  cellStyle(state) {
    if (state === 'ontime') return 'background:#CDEBD6;color:#3f7a55';
    if (state === 'off') return 'background:#FBEEC2;color:#9a7b22';
    if (state === 'skip') return 'background:#F8D6DE;color:#c46a82';
    if (state === 'miss') return 'background:#F2F2F2;color:#bbb';
    return 'background:#F2F2F2;color:#bbb';
  },
  // 单餐状态：用于月视图逐餐着色、年总结逐餐统计（早/午/晚各自独立判断）
  mealState(d, k) {
    const day = this.data()[d]; const m = day && day[k];
    const tg = this.mealTargets(); const tol = 60;
    if (!m) return 'miss';
    if (m.skipped) return 'skip';
    if (m.time && tg[k] && Math.abs(this.minDiff(m.time, tg[k])) <= tol) return 'ontime';
    return 'off';
  },
  // 某天三核心餐（早/午/晚）的整体状态：用于按「天」聚合（全准点/全没吃等）
  mealDayState(d) {
    const counts = { ontime: 0, off: 0, skip: 0, miss: 0 };
    ['breakfast', 'lunch', 'dinner'].forEach(k => counts[this.mealState(d, k)]++);
    let level;
    if (counts.ontime === 3) level = 'ontime';
    else if (counts.miss === 3) level = 'miss';
    else if (counts.skip + counts.miss === 3) level = 'skip';
    else level = 'off';
    return { counts, level };
  },
  // 三餐规律 · 月视图：每一格按 早/午/晚 三小格逐餐着色（准点/偏时/没吃/没记），可切换月份
  mealMonthRegModal(root) {
    const map = { ontime: '#CDEBD6', off: '#FBEEC2', skip: '#F8D6DE', miss: '#F2F2F2' };
    const modalHTML = `<style>
      .mmr-cell{display:flex;align-items:center;justify-content:center;gap:2px;padding:3px 0}
      .mmr-seg{width:8px;height:16px;border-radius:2px;display:block}
      .mmr-fut{opacity:.3}
    </style>
      <button class="close-x" onclick="closeModal()">×</button>
      <h3>${icon('calendar',18)} 三餐规律 · 月视图</h3>
      <div id="mmRegSummary" class="muted" style="margin:6px 0 8px;font-size:13px"></div>
      <div id="mmRegCal"></div>
      <div class="muted" style="margin-top:8px;font-size:12px;line-height:1.7">
        <span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:#CDEBD6;vertical-align:middle;margin-right:3px"></span>准点
        <span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:#FBEEC2;vertical-align:middle;margin-right:3px;margin-left:8px"></span>偏时
        <span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:#F8D6DE;vertical-align:middle;margin-right:3px;margin-left:8px"></span>没吃
        <span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:#F2F2F2;vertical-align:middle;margin-right:3px;margin-left:8px"></span>没记
        <div style="margin-top:2px">每格内三小格从左到右分别为：早 · 午 · 晚</div>
      </div>`;
    openModal(modalHTML);
    const calEl = document.getElementById('mmRegCal');
    const summaryEl = document.getElementById('mmRegSummary');
    const opts = {
      ym: this.cur.slice(0, 7),
      cellHTML: ds => {
        const segs = ['breakfast', 'lunch', 'dinner'].map(k => `<i class="mmr-seg" style="background:${map[this.mealState(ds, k)]}"></i>`).join('');
        const fut = ds > todayStr() ? ' mmr-fut' : '';
        return `<div class="mmr-cell${fut}">${segs}</div>`;
      },
      afterRender: el => {
        const [yy, mm] = opts.ym.split('-').map(Number);
        const daysIn = new Date(yy, mm, 0).getDate();
        const cnt = { ontime: 0, off: 0, skip: 0, miss: 0 };
        let allOnDays = 0;
        const t = todayStr();
        for (let d = 1; d <= daysIn; d++) {
          const ds = opts.ym + '-' + String(d).padStart(2, '0');
          if (ds > t) break;
          const states = ['breakfast', 'lunch', 'dinner'].map(k => this.mealState(ds, k));
          states.forEach(s => cnt[s]++);
          if (states.every(s => s === 'ontime')) allOnDays++;
        }
        summaryEl.innerHTML = `<b style="color:#3f7a55">全准点 ${allOnDays} 天</b>　·　准点 ${cnt.ontime} 顿　偏时 ${cnt.off} 顿　没吃 ${cnt.skip} 顿　没记 ${cnt.miss} 顿`;
      }
    };
    renderMonthCal(calEl, opts);
  },

  render(root) {
    const data = this.data(); const day = data[this.cur];
    const tg = this.mealTargets(); const reg = this.regularity();
    const score = this.dayScore(day);
    const week = weekDates(todayStr()).map(d => ({ d, s: this.dayScore(data[d]) }));
    const ym = todayStr().slice(0, 7);
    const monthDays = Object.keys(data).filter(d => d.startsWith(ym));
    const monthScores = monthDays.map(d => this.dayScore(data[d])).filter(x => x != null);
    const monthAvg = monthScores.length ? Math.round(monthScores.reduce((a, b) => a + b, 0) / monthScores.length) : 0;

    root.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:0 12px 8px 0">
          <span class="meals-main-title" style="margin:0;padding:0">三餐</span>
          <span style="display:flex;align-items:center;gap:10px;padding-right:4px">
            <span id="mealDateClick" style="font-weight:600;color:var(--ink);cursor:pointer;font-size:14px;border-bottom:1px dashed var(--sub)">${this.cur.slice(5)}</span>
            ${score != null ? `<span class="tag" style="font-size:13px">营养分 ${score}</span>` : '<span class="tag" style="font-size:13px">尚无记录</span>'}
          </span>
        </div>
      </div>
      <input type="date" id="mDate" value="${this.cur}" style="position:absolute;opacity:0;pointer-events:none">
      <div class="meals-grid-4" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
        ${this.slots.map(s => {
          const m = day && day[s.k];
          const desc = m && m.desc ? m.desc : '';
          const tags = (m && m.tags) || [];
          return `<div class="card meal-card-square" style="margin:0;padding:10px">
          <div class="meal-h"><span class="meal-name" style="display:flex;align-items:center;gap:4px">${icon(s.ic,16)} ${s.n}</span>${m && m.time ? `<span class="tag" style="font-size:10px">${esc(m.time)}</span>` : ''}</div>
          ${m && m.skipped ? `<div style="min-height:80px;display:flex;align-items:center;justify-content:center;color:#bbb;font-size:13px">没吃</div>
            <button class="btn sm ghost" data-redo="${s.k}" style="margin-top:6px;font-size:11px">补记</button>`
          : m ? `<img class="photo-thumb" id="mimg_${s.k}" style="height:80px;margin:4px 0" alt="${s.n}">
            <div style="font-size:11px;color:var(--sub);line-height:1.4;max-height:32px;overflow:hidden">${esc(desc)}</div>
            <div style="display:flex;gap:2px;flex-wrap:wrap;margin-top:4px">${tags.slice(0, 3).map(t => `<span class="chip sm" style="font-size:10px;padding:1px 5px;background:#f0f0f0;color:#555">${t}</span>`).join('')}${tags.length > 3 ? `<span class="chip sm" style="font-size:10px;padding:1px 5px;background:#f7f7f7;color:#999">+${tags.length - 3}</span>` : ''}</div>
            <button class="btn sm ghost" data-redo="${s.k}" style="margin-top:6px;font-size:11px">编辑</button>`
          : `<div class="photo-slot" data-add="${s.k}" style="min-height:80px;font-size:13px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px">${icon('camera',20)}打卡</div>`}
          </div>`;
        }).join('')}
      </div>
      <div class="card" style="margin-top:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">
          <h3>${icon('clock',16)} 三餐规律</h3>
          <span style="display:flex;align-items:center;gap:6px"><button class="icon-btn" id="mMonthReg" title="月视图" aria-label="月视图">${icon('calendar',14)}</button><button class="icon-btn" id="mTgt" title="目标饭点" aria-label="目标饭点">${icon('settings',14)}</button></span>
        </div>
        <div class="muted" style="margin:4px 0 10px">${icon('sunrise',14)} ${esc(tg.breakfast)}　${icon('sun',14)} ${esc(tg.lunch)}　${icon('moon',14)} ${esc(tg.dinner)}　·　准点率 <b>${reg.onRate}%</b></div>
        <div style="display:grid;grid-template-columns:46px repeat(3,1fr);gap:5px;font-size:12px">
          <div></div><div style="text-align:center;color:#888">早</div><div style="text-align:center;color:#888">午</div><div style="text-align:center;color:#888">晚</div>
          ${reg.rows.map(r => `<div style="color:#999;align-self:center">${r.d.slice(5)}</div>` + r.cells.slice(0, 3).map(c => `<div style="text-align:center;padding:7px 2px;border-radius:7px;${this.cellStyle(c.state)}">${c.time || '—'}</div>`).join('')).join('')}
        </div>
        <div class="muted" style="margin-top:8px"><span style="color:#CDEBD6">●</span> 准点（目标±1h）　<span style="color:#FBEEC2">●</span> 吃了但偏时　<span style="color:#F8D6DE">●</span> 没吃　<span style="color:#F2F2F2">●</span> 没记</div>
      </div>
      <div class="card" style="margin-top:16px">
        <div class="cp-rec-head" data-mealcaltoggle>
          <span>${icon('camera',16)} 三餐照片日历</span>
          <span id="mealCalToggleTxt">${this._mealCalOpen === false ? '▸' : '▾'}</span>
        </div>
        <div id="mealCalWrap" ${this._mealCalOpen === false ? 'style="display:none"' : ''}>
          <div style="display:flex;gap:6px;margin:8px 0">
            <button class="btn sm ghost mealcal-mode ${this._mealCalMode !== 'week' && this._mealCalMode !== 'month' ? 'active' : ''}" data-mc="day">每日</button>
            <button class="btn sm ghost mealcal-mode ${this._mealCalMode === 'week' ? 'active' : ''}" data-mc="week">每周</button>
            <button class="btn sm ghost mealcal-mode ${this._mealCalMode === 'month' ? 'active' : ''}" data-mc="month">每月</button>
          </div>
          <div id="mealCalBody"></div>
        </div>
      </div>
      <div class="card" style="margin-top:16px"><h3>${icon('trending',16)} 近7天营养分趋势</h3>
        ${svgLine(week.map(x => x.s == null ? 0 : x.s), week.map(x => x.d.slice(8) + '日'))}
        <div class="muted">没记录的天计为0，分数仅供参考——认真记录才准确</div>
        <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
          <button class="btn sm" id="mWeek">${icon('stats',14)} 看周报</button>
          <button class="btn sm" id="mMonth">${icon('trending',14)} 看月报</button>
        </div>
      </div>`;

    // 加载照片
    this.slots.forEach(async s => {
      const m = day && day[s.k];
      if (m && m.photoId) { const rec = await IDB.get(m.photoId); const img = root.querySelector('#mimg_' + s.k); if (rec && img) { img.src = rec.data; img.dataset.pid = m.photoId; } }
    });
    // 点击日期切换
    const mealDateEl = root.querySelector('#mealDateClick');
    const dateInput = root.querySelector('#mDate');
    if (mealDateEl) mealDateEl.onclick = () => dateInput.showPicker ? dateInput.showPicker() : dateInput.click();
    dateInput.onchange = e => { this.cur = e.target.value; this.render(root); };
    root.querySelectorAll('[data-add],[data-redo]').forEach(el => el.onclick = () => this.mealDialog(root, el.dataset.add || el.dataset.redo));
    root.querySelector('#mWeek').onclick = () => this.report(root, 7);
    root.querySelector('#mMonth').onclick = () => this.report(root, 30, todayStr().slice(0, 7));
    root.querySelectorAll('[data-expand]').forEach(b => b.onclick = e => {
      e.stopPropagation();
      const k = b.dataset.expand;
      this._expanded = this._expanded || {};
      this._expanded[k] = !this._expanded[k];
      this.render(root);
    });
    const tgtBtn = root.querySelector('#mTgt');
    if (tgtBtn) tgtBtn.onclick = () => {
      const t = this.mealTargets();
      openModal(`<button class="close-x" onclick="closeModal()">×</button><h3>${icon('settings',16)} 目标饭点</h3>
        <div class="muted" style="margin-bottom:8px">设一个你想慢慢固定的时间段，不用精确，先有个奔头。一开始难做到，慢慢来</div>
        ${this.slots.map(s => `<div class="form-row"><label style="display:flex;align-items:center;gap:4px">${icon(s.ic,14)} ${s.n}</label><input type="time" id="mt_${s.k}" value="${t[s.k]}"></div>`).join('')}
        <button class="btn" id="mtOk" style="width:100%">保存</button>`);
      document.getElementById('mtOk').onclick = () => {
        const nt = {}; this.slots.forEach(s => nt[s.k] = document.getElementById('mt_' + s.k).value || t[s.k]);
        S.set('mealTargets', nt); closeModal(); this.render(root); toast('目标饭点已更新');
      };
    };
    const regBtn = root.querySelector('#mMonthReg');
    if (regBtn) regBtn.onclick = () => this.mealMonthRegModal(root);
    /* 三餐照片日历 */
    const calWrap = root.querySelector('#mealCalWrap');
    const calBody = root.querySelector('#mealCalBody');
    const drawMealCal = () => this.drawMealCal(calBody, this._mealCalMode || 'day', root);
    drawMealCal();
    const mct = root.querySelector('[data-mealcaltoggle]');
    if (mct) mct.onclick = e => {
      if (e.target.closest('.mealcal-mode')) return;
      this._mealCalOpen = !(this._mealCalOpen !== false);
      const open = this._mealCalOpen !== false;
      calWrap.style.display = open ? '' : 'none';
      root.querySelector('#mealCalToggleTxt').textContent = open ? '▾' : '▸';
    };
    root.querySelectorAll('.mealcal-mode').forEach(b => b.onclick = () => {
      root.querySelectorAll('.mealcal-mode').forEach(x => x.classList.remove('active'));
      b.classList.add('active'); this._mealCalMode = b.dataset.mc; drawMealCal();
    });
  },

  repPidOf(day) { return day ? ((day.breakfast && day.breakfast.photoId) || (day.lunch && day.lunch.photoId) || (day.dinner && day.dinner.photoId)) : null; },
  drawMealCal(body, mode, root) {
    const data = this.data();
    const loadImg = (el, pid) => { if (!pid) return; IDB.get(pid).then(rec => { if (rec) { const img = new Image(); img.src = rec.data; img.className = 'pc-img'; el.appendChild(img); } }); };
    if (mode === 'day') {
      const allDates = Object.keys(data);
      const initYm = allDates.length ? allDates.slice().sort().pop().slice(0, 7) : todayStr().slice(0, 7);
      const calOpts = {
        ym: this._mealCalYm || initYm,
        cellHTML: ds => {
          const day = data[ds];
          const pid = day ? this.repPidOf(day) : null;
          if (!pid) return '';
          return `<div class="cal-photo" data-pid="${esc(pid)}"></div>`;
        },
        onClick: ds => { if (data[ds]) this.dayReport(ds, data[ds]); },
        afterRender: el => {
          this._mealCalYm = calOpts.ym;
          el.querySelectorAll('.cal-photo').forEach(async pe => {
            try { const rec = await IDB.get(pe.dataset.pid); if (rec) { const img = new Image(); img.src = rec.data; img.className = 'pc-img'; pe.appendChild(img); } } catch (e) {}
          });
          el.querySelectorAll('.cal-cell').forEach(c => { if (c.querySelector('.cal-photo')) c.classList.add('has-photo'); });
        }
      };
      body.classList.add('meal-cal');
      renderMonthCal(body, calOpts);
    } else if (mode === 'week') {
      let html = '<div class="cal-list">';
      for (let i = 0; i < 8; i++) {
        const end = addDays(todayStr(), -i * 7); const start = addDays(end, -6);
        const days = []; for (let k = 0; k < 7; k++) { const d = addDays(start, k); if (data[d]) days.push(d); }
        const rep = days.find(d => data[d].breakfast && data[d].breakfast.photoId) || days.find(d => data[d].lunch && data[d].lunch.photoId) || days[0];
        const repPid = rep ? this.repPidOf(data[rep]) : null;
        const count = days.reduce((s, d) => s + (data[d].breakfast && data[d].breakfast.photoId ? 1 : 0) + (data[d].lunch && data[d].lunch.photoId ? 1 : 0) + (data[d].dinner && data[d].dinner.photoId ? 1 : 0), 0);
        html += `<div class="cal-row" data-range="${start}|${end}"><div class="cr-label">${start.slice(5)}~${end.slice(5)}</div>${repPid ? `<span class="cr-ph" data-pid="${repPid}"></span>` : '<span class="muted">无</span>'}<span class="cr-n">${count}张</span></div>`;
      }
      html += '</div>'; body.innerHTML = html;
      body.querySelectorAll('.cr-ph').forEach(el => loadImg(el, el.dataset.pid));
      body.querySelectorAll('.cal-row').forEach(r => r.onclick = () => { const [s, e] = r.dataset.range.split('|'); this.mealWeekModal(s, e, data, root); });
    } else {
      const y = Number(todayStr().slice(0, 4)); const mNow = Number(todayStr().slice(5, 7));
      let html = '<div class="cal-list">';
      for (let i = 0; i < 12; i++) { let mm = mNow - i; let yy = y; if (mm < 1) { mm += 12; yy--; } const ym2 = yy + '-' + String(mm).padStart(2, '0');
        const days = Object.keys(data).filter(d => d.startsWith(ym2));
        const rep = days.find(d => data[d].breakfast && data[d].breakfast.photoId) || days.find(d => data[d].lunch && data[d].lunch.photoId) || days[0];
        const repPid = rep ? this.repPidOf(data[rep]) : null;
        const count = days.reduce((s, d) => s + (data[d].breakfast && data[d].breakfast.photoId ? 1 : 0) + (data[d].lunch && data[d].lunch.photoId ? 1 : 0) + (data[d].dinner && data[d].dinner.photoId ? 1 : 0), 0);
        html += `<div class="cal-row" data-ym="${ym2}"><div class="cr-label">${mm}月</div>${repPid ? `<span class="cr-ph" data-pid="${repPid}"></span>` : '<span class="muted">无</span>'}<span class="cr-n">${count}张</span></div>`;
      }
      html += '</div>'; body.innerHTML = html;
      body.querySelectorAll('.cr-ph').forEach(el => loadImg(el, el.dataset.pid));
      body.querySelectorAll('.cal-row[data-ym]').forEach(r => r.onclick = () => this.mealMonthModal(r.dataset.ym, data, root));
    }
  },
  mealWeekModal(s, e, data, root) {
    const days = []; for (let k = 0; k < 7; k++) { const d = addDays(s, k); if (data[d]) days.push(d); }
    openModal(`<button class="close-x" onclick="closeModal()">×</button><h3>${icon('camera',18)} ${s.slice(5)} ~ ${e.slice(5)} 的三餐</h3><div class="grid3" style="gap:8px">${days.map(d => `<div class="day-card" data-day="${d}" style="position:relative"><img class="photo-thumb" data-pv="${d}"></div>`).join('') || '<div class="empty">这周没有三餐记录</div>'}</div><div class="muted" style="margin-top:8px">点任意一天看三餐</div>`);
    days.forEach(d => { const pid = this.repPidOf(data[d]); if (pid) IDB.get(pid).then(rec => { if (rec) { const img = document.querySelector('[data-pv="' + d + '"]'); if (img) img.src = rec.data; } }); });
    document.querySelectorAll('.day-card').forEach(c => c.onclick = () => this.dayReport(c.dataset.day, data[c.dataset.day] || {}));
  },
  mealMonthModal(ym, data, root) {
    const days = Object.keys(data).filter(d => d.startsWith(ym)).sort();
    openModal(`<button class="close-x" onclick="closeModal()">×</button><h3>${icon('camera',18)} ${ym.slice(5)} 月的三餐</h3><div class="grid4" style="gap:8px">${days.map(d => `<div class="day-card" data-day="${d}" style="position:relative"><img class="photo-thumb" data-pv="${d}"></div>`).join('') || '<div class="empty">这个月没有三餐记录</div>'}</div><div class="muted" style="margin-top:8px">点任意一天看三餐</div>`);
    days.forEach(d => { const pid = this.repPidOf(data[d]); if (pid) IDB.get(pid).then(rec => { if (rec) { const img = document.querySelector('[data-pv="' + d + '"]'); if (img) img.src = rec.data; } }); });
    document.querySelectorAll('.day-card').forEach(c => c.onclick = () => this.dayReport(c.dataset.day, data[c.dataset.day] || {}));
  },

  mealDialog(root, slot) {
    const s = this.slots.find(x => x.k === slot);
    const existing = (this.data()[this.cur] || {})[slot];
    const exTime = existing && existing.time ? existing.time : this.nowTime();
    const exDesc = existing && !existing.skipped ? existing.desc || '' : '';
    const exTags = (existing && existing.tags) || [];
    const exAmount = (existing && existing.amount) || '';
    const exPhoto = existing && existing.photoId ? existing.photoId : null;
    let photoData = null;
    const photoSlotHTML = exPhoto
      ? `<img id="mpShow" style="max-width:100%;max-height:180px;border-radius:10px" alt="已选照片"><span id="mpTip" style="font-size:12px;color:var(--sub)">点击更换照片</span>`
      : `${icon('camera',26)}<span id="mpTip">点击选择照片（可选）</span>`;
    openModal(`<button class="close-x" onclick="closeModal()">×</button><h3>${icon(s.ic,18)} 编辑${s.n} · ${fmtCN(this.cur)}</h3>
      <div class="photo-slot" id="mpPick" style="min-height:120px;margin-bottom:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;cursor:pointer">${photoSlotHTML}</div>
      <div class="form-row"><label>${icon('clock',14)} 几点吃的</label><input type="time" id="mpTime" value="${exTime}"></div>
      <div class="form-row"><label>吃了什么？</label><input id="mpDesc" value="${esc(exDesc)}" placeholder="例如：牛肉面 + 卤蛋 + 凉拌黄瓜"></div>
      <div class="form-row"><label>大概份量<span class="muted" style="font-weight:400">（选填）</span></label><input id="mpAmount" value="${esc(exAmount)}" placeholder="例如：半碗大米饭 · 2包小面包"></div>
      <div class="form-row"><label>包含哪些类型？（如实勾选）</label>
        <div style="display:flex;gap:6px;flex-wrap:wrap">${[...this.tagsPos, ...this.tagsNeg].map(t => `<label class="chip" style="cursor:pointer"><input type="checkbox" value="${t}" ${exTags.includes(t) ? 'checked' : ''} style="accent-color:#111;margin-right:4px">${t}</label>`).join('')}</div></div>
      <button class="btn ghost" id="mpSkip" style="width:100%;margin-bottom:8px;color:#999">没吃</button>
      <button class="btn" id="mpOk" style="width:100%">保存</button>`);
    if (exPhoto) { IDB.get(exPhoto).then(rec => { const el = document.getElementById('mpShow'); if (rec && el) el.src = rec.data; }).catch(() => {}); }
    document.getElementById('mpPick').onclick = () => pickPhoto(d => {
      photoData = d;
      let show = document.getElementById('mpShow');
      if (!show) { show = document.createElement('img'); show.id = 'mpShow'; show.style.maxWidth = '100%'; show.style.maxHeight = '180px'; show.style.borderRadius = '10px'; document.getElementById('mpPick').prepend(show); }
      show.src = d;
      const tip = document.getElementById('mpTip'); if (tip) tip.textContent = '已选新照片 ✓（再点可换）';
    });
    // （AI 估营养功能已移除：国内无法登录 Gemini 且浏览器直连被 CORS 拦，改用选填「大概份量」字段）
    document.getElementById('mpSkip').onclick = () => {
      const data = this.data(); data[this.cur] = data[this.cur] || {};
      data[this.cur][slot] = { skipped: true, desc: '没吃', tags: [], time: null };
      S.set('meals', data); closeModal();
      const mLinkKey = slot === 'breakfast' ? 'b' : slot === 'lunch' ? 'l' : slot === 'dinner' ? 'd' : slot;
      if (window.Daily) window.Daily.autoFromColumn('meals:' + mLinkKey, this.cur, s.n + '打卡');
      this.render(root); toast(s.n + '标记为没吃');
    };
    document.getElementById('mpOk').onclick = async () => {
      const manualTags = [...document.querySelectorAll('.modal input[type=checkbox]:checked')].map(c => c.value);
      const desc = document.getElementById('mpDesc').value.trim();
      const amount = document.getElementById('mpAmount').value.trim();
      const time = document.getElementById('mpTime').value;
      if (!desc && !amount && !photoData && !exPhoto) return toast('至少拍张照或写一笔吃了什么');
      // 垃圾食品自动识别：描述/份量含泡面/炸鸡/奶茶等关键词 → 自动补打负面标签
      const autoTags = this.junkAutoTags(desc + ' ' + amount);
      const tags = [...new Set([...manualTags, ...autoTags])];
      const data = this.data(); data[this.cur] = data[this.cur] || {};
      let photoId = (data[this.cur][slot] || {}).photoId || null;
      if (photoData) { photoId = photoId || uid(); await IDB.put({ id: photoId, data: photoData }); }
      data[this.cur][slot] = { photoId, desc: desc || (data[this.cur][slot] && data[this.cur][slot].desc) || '', tags, time, amount: amount || (data[this.cur][slot] && data[this.cur][slot].amount) || '' };
      S.set('meals', data); closeModal();
      const mLinkKey = slot === 'breakfast' ? 'b' : slot === 'lunch' ? 'l' : slot === 'dinner' ? 'd' : slot;
      if (window.Daily) window.Daily.autoFromColumn('meals:' + mLinkKey, this.cur, s.n + '打卡');
      // 同步甜品 / 甜饮 / 咖啡 / 外卖 到频率页（v221 新增；奶茶手动记、不自动同步）
      if (window.Freq) window.Freq.syncFromMeals(this.cur, tags, desc + ' ' + amount);
      const newlyAuto = autoTags.filter(t => !manualTags.includes(t));
      this.render(root);
      toast(newlyAuto.length ? s.n + '已更新 · 自动标记垃圾食品：' + newlyAuto.join('、') : s.n + '已更新');
    };
  },

  // 调用 Gemini 多模态接口（已移除：国内无法登录且浏览器直连被 CORS 拦，改用「大概份量」选填字段）

  report(root, days, ym, woff) {
    const data = this.data();
    const isMonth = !!ym || days === 30;
    woff = woff || 0;
    let list;
    if (ym) {
      const [yy, mm] = ym.split('-').map(Number); const dim = new Date(yy, mm, 0).getDate();
      list = []; for (let dd = 1; dd <= dim; dd++) { const ds = ym + '-' + String(dd).padStart(2, '0'); if (data[ds]) list.push({ d: ds, day: data[ds] }); }
    } else if (days === 7) {
      // 周报 = 选定周（周一至周日）数据；woff>0 表示往回看第几周
      const wkBase = addDays(todayStr(), -7 * woff);
      list = weekDates(wkBase).map(d => data[d] ? { d, day: data[d] } : null).filter(x => x);
    } else {
      list = []; for (let i = days - 1; i >= 0; i--) { const d = addDays(todayStr(), -i); if (data[d]) list.push({ d, day: data[d] }); }
    }
    if (!list.length) return openModal(`<button class="close-x" onclick="closeModal()">×</button><h3>报告</h3><div class="empty">${isMonth ? '这个月' : '最近' + days + '天'}还没有记录</div>`);
    const scores = list.map(x => this.dayScore(x.day)).filter(x => x != null);
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const cover = {}; [...this.tagsPos, ...this.tagsNeg].forEach(t => cover[t] = 0);
    let mealsTotal = 0, negTotal = 0;
    list.forEach(x => {
      this.slots.forEach(s => { const m = x.day[s.k]; if (m && !m.skipped) { mealsTotal++; (m.tags || []).forEach(t => cover[t]++); if ((m.tags || []).some(t => this.tagsNeg.includes(t))) negTotal++; } });
    });
    const tgR = this.mealTargets(); let onR = 0, eatR = 0; const totalR = list.length * 3;
    list.forEach(x => this.slots.forEach(s => { const m = x.day[s.k]; if (m && !m.skipped) { eatR++; if (m.time && tgR[s.k] && Math.abs(this.minDiff(m.time, tgR[s.k])) <= 60) onR++; } }));
    const eatRateR = Math.round(eatR / totalR * 100); const onRateR = eatR ? Math.round(onR / eatR * 100) : 0;
    const photoCal = (days === 7 || isMonth) ? `
      <div class="card" style="margin-top:14px"><h3>${icon('camera',16)} 三餐照片日历</h3>
        <div class="photo-cal">${list.map(x => `<div class="pc-day" data-day="${x.d}">
          <div class="pc-date"><span>${x.d.slice(5,7)}</span><span>${x.d.slice(8)}</span></div>
          ${(() => { const _ms = ['breakfast', 'lunch', 'dinner']; for (const _m of _ms) { const _mm = x.day[_m]; if (_mm && _mm.photoId) return `<img class="pc-img" data-pid="${esc(_mm.photoId)}" alt="${_m}">`; } return '<div class="pc-noimg">·</div>'; })()}
          <div class="pc-score">${this.dayScore(x.day) != null ? this.dayScore(x.day) : '·'}</div>
        </div>`).join('')}</div>
        <div class="muted" style="margin-top:6px">点任意一天看当天三餐 · 早餐为首图</div>
      </div>` : '';
    const titleYm = ym || todayStr().slice(0, 7);
    const wkRange = days === 7 ? (() => { const s = weekStart(addDays(todayStr(), -7 * woff)); const e = addDays(s, 6); return s.slice(5).replace('-', '/') + '–' + e.slice(5).replace('-', '/'); })() : '';
    const html = `<button class="close-x" onclick="closeModal()">×</button>
      <h3 style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">${days === 7 ? icon('stats',18) + ' 饮食周报' : icon('trending',18) + ' 饮食月报'}
        ${isMonth ? `<button class="icon-btn" id="mRepCal" title="切换月份" style="margin-left:auto">${icon('calendar',16)}</button><input type="month" id="mRepMonth" value="${titleYm}" style="position:absolute;opacity:0;pointer-events:none;width:1px;height:1px">` : (days === 7 ? `<button class="icon-btn" id="mRepPrev" title="上一周" style="margin-left:auto">◀</button><span class="muted" style="font-size:12px">${wkRange}</span><button class="icon-btn" id="mRepNext" title="下一周" ${woff === 0 ? 'disabled style="opacity:.3;cursor:default"' : ''}>▶</button><button class="icon-btn" id="mRepCal" title="选择某一周">${icon('calendar',16)}</button><input type="date" id="mRepDay" value="${todayStr()}" style="position:absolute;opacity:0;pointer-events:none;width:1px;height:1px">` : '')}
      </h3>
      <div class="grid3" style="margin-bottom:12px">
        <div class="card" style="text-align:center;margin:0"><div class="stat-num">${avg}</div><div class="stat-lab">平均营养分</div></div>
        <div class="card" style="text-align:center;margin:0"><div class="stat-num">${mealsTotal}</div><div class="stat-lab">记录餐数</div></div>
        <div class="card" style="text-align:center;margin:0"><div class="stat-num" style="color:${negTotal > days * 0.3 ? '#111' : '#111'}">${negTotal}</div><div class="stat-lab">油炸/甜品/甜饮等次数</div></div>
        <div class="card" style="text-align:center;margin:0"><div class="stat-num">${onRateR}%</div><div class="stat-lab">准点率</div></div>
      </div>
      ${svgBars(this.tagsPos.map(t => cover[t]), this.tagsPos)}
      ${photoCal}`;
    openModal(html);
    if (days === 7 || isMonth) {
      document.querySelectorAll('.pc-img').forEach(async el => { try { const rec = await IDB.get(el.dataset.pid); if (rec) el.src = rec.data; } catch (e) {} });
      document.querySelectorAll('.pc-day').forEach(el => el.onclick = () => this.dayReport(el.dataset.day, data[el.dataset.day] || {}));
    }
    if (isMonth) {
      const calBtn = document.getElementById('mRepCal');
      const mInput = document.getElementById('mRepMonth');
      if (calBtn && mInput) calBtn.onclick = () => { if (mInput.showPicker) mInput.showPicker(); else mInput.click(); };
      if (mInput) mInput.onchange = () => { if (mInput.value) this.report(root, 30, mInput.value); };
    }
    if (days === 7) {
      const prev = document.getElementById('mRepPrev');
      const next = document.getElementById('mRepNext');
      const calBtn = document.getElementById('mRepCal');
      const dayInput = document.getElementById('mRepDay');
      if (prev) prev.onclick = () => this.report(root, 7, null, woff + 1);
      if (next && woff > 0) next.onclick = () => this.report(root, 7, null, woff - 1);
      if (calBtn && dayInput) calBtn.onclick = () => { if (dayInput.showPicker) dayInput.showPicker(); else dayInput.click(); };
      if (dayInput) dayInput.onchange = () => {
        if (!dayInput.value) return;
        const selOff = Math.max(0, Math.round((new Date(weekStart(todayStr()) + 'T12:00:00') - new Date(weekStart(dayInput.value) + 'T12:00:00')) / 86400000 / 7));
        this.report(root, 7, null, selOff);
      };
    }
  },

  dayReport(d, day) {
    openModal(`<button class="close-x" onclick="closeModal()">×</button><h3>${icon('meal',18)} ${fmtCN(d)} 的三餐</h3>
      ${this.slots.map(s => { const m = day[s.k]; const desc = m && m.desc ? m.desc : ''; const tags = (m && m.tags) || []; const descCol = desc.length > 10; const tagsCol = tags.length > 2; const needExp = descCol || tagsCol; return `<div class="card" style="margin-bottom:10px">
        <h3 style="display:flex;align-items:center;gap:4px">${icon(s.ic,16)} ${s.n}${m && m.time ? ` <span class="tag" style="font-size:11px">${icon('clock',12)} ${esc(m.time)}</span>` : ''}</h3>
        ${m ? (m.skipped ? '<div class="muted" style="padding:8px 0">没吃</div>' : (m.photoId ? `<img class="photo-thumb" id="dr_${s.k}" style="margin-bottom:8px">` : '') + `<div class="meal-desc${descCol ? ' collapsed' : ''}" data-drdesc="${s.k}" style="font-size:13px">${esc(desc)}</div>` + (m && m.amount ? `<div class="muted" style="font-size:11px;margin-top:2px">份量：${esc(m.amount)}</div>` : '') + (() => { const show = tagsCol ? tags.slice(0, 2) : tags; return show.map(t => `<span class="tag" style="margin:2px 3px 0 0">${esc(t)}</span>`).join('') + (tagsCol ? `<span class="tag" style="margin:2px 3px 0 0;cursor:pointer" data-drexpand="${s.k}">+${tags.length - 2}</span>` : ''); })() + (needExp ? `<button class="link sm" data-drexpand="${s.k}" style="margin-top:6px;display:block">展开 ▾</button>` : '')) : '<div class="muted">没记录</div>'}
      </div>`; }).join('')}
    `);
    // 就地展开/收起（不重渲染弹窗，保留已加载图片）
    document.querySelectorAll('[data-drexpand]').forEach(b => b.onclick = () => {
      const k = b.dataset.drexpand; const m = day[k];
      const descEl = document.querySelector(`[data-drdesc="${k}"]`);
      const tagsBox = b.previousElementSibling;
      const expanded = b.textContent.includes('展开');
      if (expanded) {
        if (descEl) descEl.classList.remove('collapsed');
        if (m && m.tags) { tagsBox.innerHTML = m.tags.map(t => `<span class="tag" style="margin:2px 3px 0 0">${esc(t)}</span>`).join(''); }
        b.textContent = '收起 ▴';
      } else {
        const desc = m && m.desc ? m.desc : '';
        if (desc.length > 10 && descEl) descEl.classList.add('collapsed');
        const tags = (m && m.tags) || [];
        if (tags.length > 2) { tagsBox.innerHTML = tags.slice(0, 2).map(t => `<span class="tag" style="margin:2px 3px 0 0">${esc(t)}</span>`).join('') + `<span class="tag" style="margin:2px 3px 0 0;cursor:pointer" data-drexpand="${k}">+${tags.length - 2}</span>`; }
        b.textContent = '展开 ▾';
        // 重新绑定新生成的 +N 按钮
        const newBtn = tagsBox.querySelector('[data-drexpand]');
        if (newBtn) newBtn.onclick = () => b.onclick();
      }
    });
    this.slots.forEach(async s => { const m = day[s.k]; if (m && m.photoId) { try { const rec = await IDB.get(m.photoId); const img = document.getElementById('dr_' + s.k); if (rec && img) { img.src = rec.data; img.dataset.pid = m.photoId; } } catch (e) {} } });
  },
};
window.Modules.meals = { render: r => Meals.render(r) };
window.Meals = Meals;
