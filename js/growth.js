/* ============ 个人成长 ============ */
const Growth = {
  sub: null,
  _matLib: false,
  areas() { return (S.get('growthAreas', ['阅读', '理财']) || []).filter(x => x !== '英语'); },
  logs() { return S.get('growthLogs', {}); },
  _areaMap: { english: '英语', reading: '阅读', finance: '理财' },

  render(root) {
    // 默认进入英语页面（从首页或其他模块导航进来时 sub 为 null）
    if (!this.sub) this.sub = 'skill';
    // 分支视图：只显示单个领域
    if (this.sub === 'idea') this.sub = 'skill';   // v269：idea 模块下线，统一走技能页
    if (this.sub) {
      if (this.sub === 'skill') {
        if (this._skBadge) {
          root.innerHTML = `<div id="gwBody"></div>`;
          root.querySelector('#gwBody').innerHTML = this.badgeWall();
          this.bindBadgeEvents(root);
          root.insertAdjacentHTML('beforeend', this.growthNavHTML());
          this.bindGrowthNav(root);
          return;
        }
        if (this._skOpen) {
          root.innerHTML = `<div id="gwBody"></div>`;
          root.querySelector('#gwBody').innerHTML = this.skillDetail(this._skOpen);
          this.bindSkillDetailEvents(root);
          root.insertAdjacentHTML('beforeend', this.growthNavHTML());
          this.bindGrowthNav(root);
          return;
        }
        root.innerHTML = `<div id="gwBody"></div>`;
        root.querySelector('#gwBody').innerHTML = this.skillPage();
        this.bindSkillEvents(root);
        root.insertAdjacentHTML('beforeend', this.growthNavHTML());
        this.bindGrowthNav(root);
        return;
      }
      const a = this._areaMap[this.sub];
      const recs = window.MUMU_GROWTH_RECS || { items: [], updated: '-' };
      const learnedToday = S.get('recDone_' + recs.updated, []);
      if (this.sub === 'reading') {
        if (this._rdYear) {
          root.innerHTML = `<div id="gwBody"></div>`;
          root.querySelector('#gwBody').innerHTML = this.readingYearPage(root);
          this.bindReadingYearEvents(root);
          root.insertAdjacentHTML('beforeend', this.growthNavHTML());
          this.bindGrowthNav(root);
          return;
        }
        root.innerHTML = `<div id="gwBody"></div>`;
        root.querySelector('#gwBody').innerHTML = this.readingPage(recs.items, learnedToday, root);
        this.bindReadingEvents(root, recs);
        root.insertAdjacentHTML('beforeend', this.growthNavHTML());
        this.bindGrowthNav(root);
        return;
      }
      const todayLog = (this.logs()[todayStr()] || []);
      if (this.sub === 'english') {
        root.innerHTML = `<div id="gwBody"></div>`;
        const body = root.querySelector('#gwBody');
        body.innerHTML = `<div class="eng-page-head"><button class="icon-btn" id="engPageBack" title="返回">${icon('back',18)}</button></div>` + this.englishCard(recs.items);
        body.querySelector('#engPageBack').onclick = () => { this.sub = 'skill'; this.render(root); };
        this.bindEnglishCard(root, body);
        return;
      }
      root.innerHTML = `<div id="gwBody"></div>`;
      const body = root.querySelector('#gwBody');
      body.innerHTML = `<div style="display:flex;flex-direction:column;gap:12px">${this.areaCard(a, recs.items, todayLog, learnedToday)}</div>`;
      body.querySelectorAll('[data-done]').forEach(b => b.onclick = () => {
        const i = Number(b.dataset.done);
        if (!learnedToday.includes(i)) {
          const arr = S.get('recDone_' + recs.updated, []); arr.push(i); S.set('recDone_' + recs.updated, arr);
          const r = recs.items[i]; const lg = this.logs(); lg[todayStr()] = lg[todayStr()] || [];
          lg[todayStr()].push({ id: uid(), area: r.area, content: r.title, minutes: 15, takeaway: '完成今日精选' });
          S.set('growthLogs', lg); toast('已记录！学完就是赚到');
        }
        this.render(root);
      });
      body.querySelectorAll('[data-add]').forEach(b => b.onclick = () => this.checkIn(root, b.dataset.add));
      root.insertAdjacentHTML('beforeend', this.growthNavHTML());
      this.bindGrowthNav(root);
      return;
    }

    const recs = (window.MUMU_GROWTH_RECS || { items: [], updated: '-' });
    const logs = this.logs();
    const learnedToday = S.get('recDone_' + recs.updated, []);
    const allL = Object.entries(logs).flatMap(([d, arr]) => arr.map(l => ({ ...l, date: d })));
    const todayLog = logs[todayStr()] || [];
    const countMap = {}; Object.keys(logs).forEach(d => countMap[d] = logs[d].length);
    const week = allL.filter(l => l.date >= weekStart(todayStr()));
    const trackAreas = this.areas().filter(a => a !== '英语');
    const byArea = {}; trackAreas.forEach(a => byArea[a] = 0);
    week.forEach(l => { if (byArea[l.area] !== undefined) byArea[l.area] += l.minutes || 0; });
    const coldest = Object.entries(byArea).sort((a, b) => a[1] - b[1])[0];

    root.innerHTML = `
      ${recs.updated && recs.updated !== '-' ? `<div class="muted" style="margin-bottom:10px">${icon('leaf',14)} 最近更新：${esc(recs.updated)}</div>` : ''}
      ${coldest && week.length ? `<div class="banner warn">「<b>${coldest[0]}</b>」最近被冷落了（近7天仅 ${coldest[1]} 分钟），今天优先看看它。</div>` : ''}
      <div style="display:flex;flex-direction:column;gap:12px">
        ${this.areas().map(a => this.areaCard(a, recs.items, todayLog, learnedToday)).join('')}
      </div>
      <div class="grid2" style="margin-top:14px">
        <div class="card"><h3>${icon('stats',16)} 近7天投入（分钟）</h3>${svgBars(Object.values(byArea), Object.keys(byArea))}</div>
        <div class="card"><h3>${icon('fire',16)} 成长热力图</h3><div id="gwHm"></div>
          <button class="btn sm" id="gwArea" style="margin-top:10px">＋ 添加领域</button></div>
      </div>`;

    const gwHmEl = root.querySelector('#gwHm');
    gwHmEl._hm = { months: 3 };
    renderHeatmap(gwHmEl, countMap, null);

    root.querySelectorAll('[data-done]').forEach(b => b.onclick = () => {
      const i = Number(b.dataset.done);
      if (!learnedToday.includes(i)) {
        const arr = S.get('recDone_' + recs.updated, []); arr.push(i); S.set('recDone_' + recs.updated, arr);
        const r = recs.items[i]; const lg = this.logs(); lg[todayStr()] = lg[todayStr()] || [];
        lg[todayStr()].push({ id: uid(), area: r.area, content: r.title, minutes: 15, takeaway: '完成今日精选' });
        S.set('growthLogs', lg); toast('已记录！学完就是赚到');
      }
      this.render(root);
    });
    root.querySelectorAll('[data-add]').forEach(b => b.onclick = () => this.checkIn(root, b.dataset.add));
    const duoBtn2 = root.querySelector('#duoCheckIn');
    if (duoBtn2) duoBtn2.onclick = () => this.duoCheckIn(root);
    const dp2 = root.querySelector('#duoParts'); if (dp2) dp2.onchange = () => { const m = S.get('duoParts', {}); m[todayStr()] = Number(dp2.value) || 0; S.set('duoParts', m); };
    root.querySelectorAll('[data-englock]').forEach(b => b.onclick = () => {
      const desc = b.querySelector('.eng-lock-desc');
      if (desc) desc.style.display = desc.style.display === 'none' ? '' : 'none';
    });
    const tipBtn3 = root.querySelector('#engTipRefresh');
    if (tipBtn3) tipBtn3.onclick = () => {
      const tipEl = root.querySelector('#engTip');
      if (tipEl) tipEl.innerHTML = this.englishTip();
    };
    root.querySelector('#gwArea').onclick = () => {
      openModal(`<button class="close-x" onclick="closeModal()">×</button><h3>添加成长领域</h3>
        <div class="form-row"><input id="naArea" placeholder="例如：心理学 / 写作 / 摄影"></div>
        <button class="btn" id="naOk" style="width:100%">添加</button>`);
      document.getElementById('naOk').onclick = () => {
        const v = document.getElementById('naArea').value.trim(); if (!v) return;
        const a = this.areas(); if (!a.includes(v)) { a.push(v); S.set('growthAreas', a); }
        closeModal(); this.render(root); toast('已添加领域：' + v);
      };
    };
  },

  growthNavHTML() {
    const items = [['skill', '技能'], ['reading', '阅读']];
    return `<div class="subnav">${items.map(([k, l]) => `<button class="${this.sub === k ? 'on' : ''}" data-gsub="${k}">${l}</button>`).join('')}</div>`;
  },
  bindGrowthNav(root) {
    root.querySelectorAll('[data-gsub]').forEach(b => b.onclick = () => {
      this.sub = b.dataset.gsub;
      this._skOpen = null; this._skBadge = false;
      this.render(root);
    });
  },

  // ===== 技能体系（v268，并入成长模块）=====
  // 预置技能库（可增删改；用户改动存 mumu_skillLib）
  DEFAULT_SKILLS() {
    return [
      { id: 'sk_english', name: '英语', cat: '语言' },
      { id: 'sk_clip', name: '剪辑', cat: '创作' },
      { id: 'sk_write', name: '写作', cat: '创作' },
      { id: 'sk_cook', name: '做饭', cat: '生活' },
      { id: 'sk_photo', name: '摄影', cat: '兴趣' },
      { id: 'sk_draw', name: '画画', cat: '兴趣' },
      { id: 'sk_money', name: '理财', cat: '生活' },
      { id: 'sk_code', name: '编程', cat: '其他' },
      { id: 'sk_yoga', name: '瑜伽', cat: '生活' },
      { id: 'sk_guitar', name: '吉他', cat: '兴趣' }
    ];
  },
  skillLib() {
    const lib = S.get('mumu_skillLib', null);
    if (lib && lib.length) return lib;
    const d = this.DEFAULT_SKILLS(); S.set('mumu_skillLib', d); return d;
  },
  saveSkillLib(lib) { S.set('mumu_skillLib', lib); },
  skillLogs() { return S.get('mumu_skillLogs', {}); },
  // 累计分钟 → 自动等级（新手 → 上手5h → 熟练20h → 精通50h → 达人100h）
  SKILL_LEVELS() {
    return [
      { min: 0, name: '新手', lv: 1 },
      { min: 300, name: '上手', lv: 2 },
      { min: 1200, name: '熟练', lv: 3 },
      { min: 3000, name: '精通', lv: 4 },
      { min: 6000, name: '达人', lv: 5 }
    ];
  },
  skillLevelOf(minutes) {
    const L = this.SKILL_LEVELS();
    let cur = L[0], next = L[1] || null;
    for (let i = 0; i < L.length; i++) {
      if (minutes >= L[i].min) { cur = L[i]; next = L[i + 1] || null; }
    }
    const pct = next ? Math.min(100, Math.max(0, Math.round((minutes - cur.min) / (next.min - cur.min) * 100))) : 100;
    return { lv: cur.lv, name: cur.name, pct: pct, next: next, toNext: next ? Math.max(0, next.min - minutes) : 0 };
  },
  skillMinutes(name) {
    const lg = this.skillLogs(); let n = 0;
    Object.keys(lg).forEach(d => (lg[d] || []).forEach(r => { if (r.skill === name) n += (Number(r.minutes) || 0); }));
    return n;
  },
  skillDays(name) {
    const lg = this.skillLogs(); const s = new Set();
    Object.keys(lg).forEach(d => (lg[d] || []).forEach(r => { if (r.skill === name) s.add(d); }));
    return s.size;
  },
  // 等级辅助计算：学习分钟 + 打卡天数(辅助因子)
  // 注：英语的「等级/分钟」现在来自每日计划打卡写入的 mumu_skillLogs（不再用多邻国「部分」折算）
  skillCombinedMinutes(name) {
    return this.skillMinutes(name) + this.skillDays(name) * 15;
  },
  // ===== 多邻国分数模型（v273：由「部分制」改为「分数制」）=====
  // 8 个阶段，共 129 分；阶段由绝对分数自动判定
  engStages() {
    return [
      { stage: 1, lo: 0, hi: 9, name: '第1阶段', d: '入门基础' },
      { stage: 2, lo: 10, hi: 19, name: '第2阶段', d: '进阶语法' },
      { stage: 3, lo: 20, hi: 29, name: '第3阶段', d: '口语练习' },
      { stage: 4, lo: 30, hi: 59, name: '第4阶段', d: '阅读理解' },
      { stage: 5, lo: 60, hi: 79, name: '第5阶段', d: '听力强化' },
      { stage: 6, lo: 80, hi: 99, name: '第6阶段', d: '写作训练' },
      { stage: 7, lo: 100, hi: 114, name: '第7阶段', d: '综合运用' },
      { stage: 8, lo: 115, hi: 128, name: '第8阶段', d: '通关冲刺' }
    ];
  },
  engStageOf(score) {
    const s = Number(score) || 0;
    const ST = this.engStages();
    for (const st of ST) { if (s >= st.lo && s <= st.hi) return { ...st, practice: false }; }
    if (s >= 129) return { stage: 9, lo: 129, hi: 129, name: '巩固练习', d: '每日巩固', practice: true };
    return { ...ST[0], practice: false };
  },
  // 迁移 + 规范化 engProgress：旧「部分制」(stageTotalParts/stageDoneParts) → 新「分数制」(score + dailyLog{date:{min,delta}})
  migrateEngProgress() {
    const raw = S.get('engProgress', null);
    if (!raw) { const ep = { score: 44, dailyLog: {} }; S.set('engProgress', ep); return ep; }
    if ('stageTotalParts' in raw || 'stageDoneParts' in raw) {
      const score = raw.stageScore || 0;
      const dailyLog = {};
      const old = raw.dailyLog || {};
      Object.keys(old).forEach(d => {
        const v = old[d];
        if (typeof v === 'number') dailyLog[d] = { min: v * 15, delta: 0 }; // 旧「部分」≈ 15 分钟/部分，仅作历史近似
        else if (v && typeof v === 'object') dailyLog[d] = { min: v.min || 0, delta: v.delta || 0 };
      });
      const ep = { score, dailyLog }; S.set('engProgress', ep); return ep;
    }
    const ep = { score: raw.score || 0, dailyLog: raw.dailyLog || {} }; S.set('engProgress', ep); return ep;
  },
  // 每日计划打卡 / 英语页打卡 统一入口：更新绝对分 + 当天 {min, delta}
  recordEngCheckIn(date, mins, delta) {
    const ep = this.migrateEngProgress();
    ep.score = (ep.score || 0) + (Number(delta) || 0);
    ep.dailyLog = ep.dailyLog || {};
    const cur = ep.dailyLog[date] || { min: 0, delta: 0 };
    cur.min = (cur.min || 0) + (Number(mins) || 0);
    cur.delta = (cur.delta || 0) + (Number(delta) || 0);
    ep.dailyLog[date] = cur;
    S.set('engProgress', ep);
  },
  // 写一条技能打卡（双写成长日志，供统计页成长板块日历/热力图）
  addSkillLog(name, mins, note) {
    const d = todayStr();
    const lg = this.skillLogs(); lg[d] = lg[d] || [];
    lg[d].push({ id: uid(), skill: name, minutes: mins, note: note });
    S.set('mumu_skillLogs', lg);
    const g = S.get('growthLogs', {}); g[d] = g[d] || [];
    g[d].push({ id: uid(), area: name, content: note || (name + ' 练习 ' + mins + ' 分钟'), minutes: mins, takeaway: '技能打卡' });
    S.set('growthLogs', g);
  },
  ringSVG(pct, label, sub) {
    const r = 26, c = 2 * Math.PI * r, off = c * (1 - Math.max(0, Math.min(100, pct)) / 100);
    return '<svg width="64" height="64" viewBox="0 0 64 64">'
      + '<circle cx="32" cy="32" r="' + r + '" fill="none" stroke="var(--line)" stroke-width="6"/>'
      + '<circle cx="32" cy="32" r="' + r + '" fill="none" stroke="var(--accent)" stroke-width="6" stroke-linecap="round" stroke-dasharray="' + c + '" stroke-dashoffset="' + off + '" transform="rotate(-90 32 32)"/>'
      + '<text x="32" y="30" text-anchor="middle" font-size="13" font-weight="700" fill="var(--text)">' + label + '</text>'
      + '<text x="32" y="44" text-anchor="middle" font-size="9" fill="var(--sub)">' + sub + '</text></svg>';
  },
  miniBar(pct) {
    return '<div class="mini-bar"><i style="width:' + Math.max(0, Math.min(100, pct)) + '%"></i></div>';
  },
  skillPage() {
    const lib = this.skillLib();
    const tiles = lib.map(sk => {
      const cm = this.skillCombinedMinutes(sk.name);
      const lv = this.skillLevelOf(cm);
      const locked = cm <= 0;
      const isEng = sk.name === '英语';
      const h = cm >= 60 ? (cm / 60).toFixed(1) + 'h' : cm + 'm';
      const cls = locked ? 'badge-locked' : 'badge-lv' + lv.lv;
      const attr = isEng ? 'data-skeng="1"' : 'data-skopen="' + esc(sk.name) + '"';
      return '<div class="sk-tile ' + (isEng ? 'sk-tile-eng ' : '') + (locked ? 'sk-tile-locked' : '') + '" ' + attr + '>'
        + '<div class="sk-badge ' + cls + '">' + (locked ? '🔒' : '★') + '</div>'
        + '<div class="sk-tile-name">' + esc(sk.name) + '</div>'
        + '<div class="sk-tile-cat">' + esc(sk.cat || '') + '</div>'
        + '<div class="sk-tile-lv">Lv' + lv.lv + ' · ' + lv.name + '</div>'
        + '<div class="sk-tile-min">' + h + '</div>'
        + '</div>';
    }).join('');
    let h = '<div class="sk-top">'
      + '<button class="sk-badge-btn" id="skBadge">' + icon('award', 16) + ' 徽章墙</button>'
      + '</div>';
    h += '<div class="sk-grid">' + tiles + '<div class="sk-tile sk-tile-add" id="skAddTile">＋</div></div>';
    h += '<div class="sk-foot"><button class="sk-fbtn" id="skAdd">＋ 新技能</button><button class="sk-fbtn ghost" id="skManage">管理</button></div>';
    return h;
  },
  bindSkillEvents(root) {
    root.querySelectorAll('[data-skopen]').forEach(b => b.onclick = () => { this._skOpen = b.dataset.skopen; this.render(root); });
    root.querySelectorAll('[data-skeng]').forEach(b => b.onclick = () => { this.sub = 'english'; this._skOpen = null; this._skBadge = false; this.render(root); });
    const add = root.querySelector('#skAdd'); if (add) add.onclick = () => this.skillEditDialog(root, null);
    const addTile = root.querySelector('#skAddTile'); if (addTile) addTile.onclick = () => this.skillEditDialog(root, null);
    const mg = root.querySelector('#skManage'); if (mg) mg.onclick = () => this.skillManageDialog(root);
    const bw = root.querySelector('#skBadge'); if (bw) bw.onclick = () => { this._skBadge = true; this.render(root); };
  },
  skillCheckIn(root, name) {
    openModal('<button class="close-x" onclick="closeModal()">×</button><h3>' + esc(name) + ' · 打卡</h3>'
      + '<div class="form-row"><label>练了多久（分钟）</label><input id="skMin" type="number" value="30" placeholder="例如 30"></div>'
      + '<div class="form-row"><label>今天练了什么（选填）</label><input id="skNote" placeholder="例如：跟读第 3 课"></div>'
      + '<button class="btn" id="skOk">记录</button>');
    setTimeout(() => {
      const ok = document.getElementById('skOk');
      if (!ok) return;
      ok.onclick = () => {
        const mins = Number(document.getElementById('skMin').value) || 0;
        if (mins <= 0) return toast('填一下练了多少分钟吧');
        const note = (document.getElementById('skNote').value || '').trim();
        const before = this.skillMinutes(name);
        this.addSkillLog(name, mins, note || (name + ' 练习 ' + mins + ' 分钟'));
        closeModal();
        const lvB = this.skillLevelOf(before), lvA = this.skillLevelOf(this.skillMinutes(name));
        if (lvA.lv > lvB.lv) toast('「' + name + '」升级到 ' + lvA.name + ' 🎉');
        else toast('已记录 ' + mins + ' 分钟');
        this.render(root);
      };
    }, 0);
  },
  skillEditDialog(root, sk) {
    const isNew = !sk;
    openModal('<button class="close-x" onclick="closeModal()">×</button><h3>' + (isNew ? '＋ 新技能' : '编辑技能') + '</h3>'
      + '<div class="form-row"><label>技能名称</label><input id="skName" value="' + (sk ? esc(sk.name) : '') + '" placeholder="例如：剪辑 / 做饭 / 英语"></div>'
      + '<div class="form-row"><label>分类</label><input id="skCat" value="' + (sk ? esc(sk.cat || '') : '') + '" placeholder="语言 / 创作 / 生活 / 兴趣"></div>'
      + '<button class="btn" id="skSave">' + (isNew ? '添加' : '保存') + '</button>');
    setTimeout(() => {
      const btn = document.getElementById('skSave');
      if (!btn) return;
      btn.onclick = () => {
        const name = document.getElementById('skName').value.trim();
        if (!name) return toast('写个技能名吧');
        const lib = this.skillLib();
        if (isNew) {
          if (lib.some(x => x.name === name)) return toast('已经有这个技能了');
          lib.push({ id: 'sk_' + Date.now(), name: name, cat: document.getElementById('skCat').value.trim() || '其他' });
        } else {
          const t = lib.find(x => x.id === sk.id); if (!t) return;
          const old = t.name;
          t.name = name;
          t.cat = document.getElementById('skCat').value.trim() || t.cat;
          if (old !== name) this._renameSkillLogs(old, name);
        }
        this.saveSkillLib(lib);
        if (this._skOpen) this._skOpen = name;
        closeModal(); this.render(root);
        toast(isNew ? '技能已添加' : '已保存');
      };
    }, 0);
  },
  _renameSkillLogs(oldName, newName) {
    const lg = this.skillLogs(); let ch = false;
    Object.keys(lg).forEach(d => (lg[d] || []).forEach(r => { if (r.skill === oldName) { r.skill = newName; ch = true; } }));
    if (ch) S.set('mumu_skillLogs', lg);
  },
  skillManageDialog(root) {
    const lib = this.skillLib();
    openModal('<button class="close-x" onclick="closeModal()">×</button><h3>管理技能</h3>'
      + lib.map(sk => '<div style="display:flex;align-items:center;gap:8px;padding:9px 0;border-top:1px solid var(--line)">'
        + '<span style="flex:1;font-size:13px">' + esc(sk.name) + ' <span class="muted">' + esc(sk.cat || '') + '</span></span>'
        + '<button class="btn sm ghost" data-sked="' + sk.id + '">改</button>'
        + '<button class="btn sm ghost" data-skdel="' + sk.id + '">删</button></div>').join('')
      + '<button class="btn" id="skAdd2" style="margin-top:10px">＋ 新技能</button>');
    setTimeout(() => {
      document.querySelectorAll('[data-sked]').forEach(b => b.onclick = () => {
        const sk = this.skillLib().find(x => x.id === b.dataset.sked); closeModal(); this.skillEditDialog(root, sk);
      });
      document.querySelectorAll('[data-skdel]').forEach(b => b.onclick = () => {
        const id = b.dataset.skdel;
        const lib2 = this.skillLib(); const t = lib2.find(x => x.id === id); if (!t) return;
        if (!window.confirm('删除技能「' + t.name + '」？该技能的打卡记录也会一并删除。')) return;
        this.saveSkillLib(lib2.filter(x => x.id !== id));
        const lg = this.skillLogs(); let ch = false;
        Object.keys(lg).forEach(d => {
          const before = (lg[d] || []).length;
          lg[d] = (lg[d] || []).filter(r => r.skill !== t.name);
          if (lg[d].length !== before) ch = true;
          if (!lg[d].length) delete lg[d];
        });
        if (ch) S.set('mumu_skillLogs', lg);
        closeModal(); this.render(root); toast('已删除「' + t.name + '」');
      });
      const a2 = document.getElementById('skAdd2');
      if (a2) a2.onclick = () => { closeModal(); this.skillEditDialog(root, null); };
    }, 0);
  },

  readLogs() { return S.get('readLogs', {}); },
  readNotes() { return S.get('readNotes', []); }, // 好词好句+读后感记录库
  readCovers() { return S.get('readCovers', {}); }, // 历史遗留的独立封面（新数据不再写入）
  // 某天首图封面：取当天第一条带封面的记录（按打卡顺序的第一本）
  dayCover(date, rLogs) {
    const arr = (rLogs || this.readLogs())[date] || [];
    for (let i = 0; i < arr.length; i++) if (arr[i] && arr[i].cover) return arr[i].cover;
    return null;
  },
  // 封面日历数据源：封面本身就存在阅读记录里，历史 readCovers 仅作兜底
  coverMap() {
    const map = Object.assign({}, this.readCovers());
    const rLogs = this.readLogs();
    Object.keys(rLogs).forEach(d => {
      const cov = this.dayCover(d, rLogs);
      if (cov) map[d] = cov;
    });
    return map;
  },
  // 当天所有记录用过的封面（删记录前取快照，供 syncReadCover 比对）
  dayCoverSet(date) {
    return (this.readLogs()[date] || []).map(l => l.cover).filter(Boolean);
  },
  // 封面不再二次存储。只回收内容完全相同的那份副本；内容不同的是木木单独传过的封面，保留
  // known: 删记录场景下传入删除前的封面快照，否则刚被删掉的那份会被误判成独立封面留下来
  syncReadCover(date, known) {
    const covers = this.readCovers();
    const old = covers[date];
    if (!old) return;
    const dup = (this.readLogs()[date] || []).some(l => l.cover === old) || (known || []).indexOf(old) >= 0;
    if (!dup) return;
    delete covers[date];
    S.set('readCovers', covers);
  },
  _rdYear: false,
  _rdYearSel: null,
  _rdCalYm: null, // 阅读日历当前年月
  _rdView: 'cal', // 'cal' | 'photo' | 'notes'
  // 半星渲染（用于评分展示/选择）：v 可为 0/0.5/1.../5
  rdStarHTML(v) {
    if (!v) return '';
    let s = '';
    for (let i = 1; i <= 5; i++) {
      const pct = v >= i ? 100 : (v >= i - 0.5 ? 50 : 0);
      s += `<span style="position:relative;display:inline-block;width:1em;color:#e0e0e0">★<span style="position:absolute;left:0;top:0;overflow:hidden;white-space:nowrap;color:#f5a623;width:${pct}%">★</span></span>`;
    }
    return s;
  },
  // 长按检测：长按 ~500ms 触发 cb
  bindLongPress(el, cb) {
    let timer = null;
    const start = () => { timer = setTimeout(() => { timer = null; cb(); }, 500); };
    const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchend', cancel);
    el.addEventListener('touchmove', cancel);
    el.addEventListener('mousedown', start);
    el.addEventListener('mouseup', cancel);
    el.addEventListener('mouseleave', cancel);
  },
  /* ---------- 阅读分类体系 ---------- */
  READ_CATS: [
    { key: 'lit', name: '文学', color: '#7C93C3' },
    { key: 'self', name: '自我成长', color: '#7CB390' },
    { key: 'money', name: '理财', color: '#E0A458' },
    { key: 'sci', name: '科普', color: '#6BAFBD' },
    { key: 'other', name: '其他', color: '#B0A8B9' }
  ],
  readCat(l) {
    const k = l && l.cat;
    let c = this.READ_CATS.find(x => x.key === k || x.name === k);
    if (!c) c = this.READ_CATS.find(x => x.key === (l && l.mood === 'bad' ? 'other' : 'other'));
    return c;
  },
  readCatTag(l, fs) { const c = this.readCat(l); return `<span class="tag" style="background:${c.color};color:#fff;border:none;font-size:${fs || 10}px;padding:1px 7px">${c.name}</span>`; },
  readCatDot(l, sz) { const c = this.readCat(l); const s = sz || 7; return `<span style="display:inline-block;width:${s}px;height:${s}px;border-radius:50%;background:${c.color}"></span>`; },
  readingPage(allRecs, learnedToday, root) {
    if (!this._rdCalYm) this._rdCalYm = todayStr().slice(0, 7);
    const rLogs = this.readLogs();
    const notes = this.readNotes();
    const covers = this.coverMap();
    const recs = allRecs.map((r, i) => ({ r, i })).filter(x => x.r.area === '阅读');
    const allRead = Object.entries(rLogs).flatMap(([d, arr]) => arr.map(l => ({ ...l, date: d }))).sort((a, b) => b.date.localeCompare(a.date));
    const todayRead = rLogs[todayStr()] || [];
    const ym = this._rdCalYm;
    const [yy, mm] = ym.split('-').map(Number);
    const dim = new Date(yy, mm, 0).getDate();

    // 日历数据：每天按分类去重取色点
    const calDots = {}; Object.entries(rLogs).forEach(([d, arr]) => {
      if (!d.startsWith(ym)) return;
      const seen = []; (arr || []).forEach(l => { const c = this.readCat(l); if (!seen.some(x => x.key === c.key)) seen.push(c); });
      if (seen.length) calDots[d] = seen.slice(0, 3);
    });
    const usedCats = [];
    Object.values(calDots).forEach(list => list.forEach(c => { if (!usedCats.some(x => x.key === c.key)) usedCats.push(c); }));
    const lead = (new Date(yy, mm - 1, 1).getDay() + 6) % 7;
    const isPhoto = this._rdView === 'photo';
    let calHTML = `<div class="${isPhoto ? 'hm-grid' : 'rdcal-grid'}" style="margin:0 auto;max-width:${isPhoto ? '260px' : '320px'}">`;
    ['一','二','三','四','五','六','日'].forEach(w => calHTML += `<div class="${isPhoto ? 'hm-wd' : 'rdcal-wd'}">${w}</div>`);
    for (let i = 0; i < lead; i++) calHTML += `<div class="${isPhoto ? 'hm-cell empty' : 'rdcal-cell empty'}"></div>`;
    for (let dd = 1; dd <= dim; dd++) {
      const ds = ym + '-' + String(dd).padStart(2, '0');
      if (isPhoto) {
        // 封面日历：有封面的格子被封面铺满且不显示日期，点击看大图；没封面的只显示日期
        const cv = covers[ds];
        calHTML += cv
          ? `<div class="hm-cell hm-photo-cell" data-cvview="${ds}" title="${ds}" style="background-image:url('${cv}')"></div>`
          : `<div class="hm-cell"><span class="hm-day-num">${dd}</span></div>`;
      } else {
        // 常规日历：线性框 + 日期居中 + 底部分类彩色小圆点
        const dots = calDots[ds] || [];
        calHTML += `<div class="rdcal-cell${ds === todayStr() ? ' today' : ''}" title="${ds}" data-rdate="${ds}">
          <span class="rdcal-num">${dd}</span>
          <span class="rdcal-dots">${dots.map(c => `<i style="background:${c.color}"></i>`).join('')}</span>
        </div>`;
      }
    }
    calHTML += '</div>';
    const legendHTML = usedCats.length
      ? `<div class="rdcal-legend">${usedCats.map(c => `<span><i style="background:${c.color}"></i>${c.name}</span>`).join('')}</div>`
      : `<div class="rdcal-legend">${this.READ_CATS.map(c => `<span><i style="background:${c.color}"></i>${c.name}</span>`).join('')}</div>`;

    return `<div style="display:flex;flex-direction:column;gap:12px">
      <div class="card">
        <h3>阅读打卡 <button class="btn sm" id="readCheckIn" style="margin-left:auto">＋ 打卡</button></h3>
        ${todayRead.length ? todayRead.map(l => `<div class="list-row" data-editread="${l.id}" style="cursor:pointer">
          ${this.readCatTag(l, 11)}
          ${l.rating ? `<span style="letter-spacing:1px">${this.rdStarHTML(l.rating)}</span>` : ''}
          <div style="flex:1"><b>${esc(l.book || '')}</b>${l.pages ? `<span class="muted"> · 读到 ${l.pages}</span>` : ''}</div>
          <button class="del" data-delread="${l.id}">✕</button></div>`).join('') : '<div class="empty">今天还没读书打卡</div>'}
      </div>
      <div class="card">
        <h3 style="display:flex;justify-content:space-between;align-items:center">阅读时间轴
          <span style="display:flex;gap:6px;align-items:center">
            <button class="icon-btn" id="rdYearBtn" title="阅读年轴" style="font-size:14px">${icon('calendar',14)}</button>
            <span class="muted" id="rdAxisToggle" style="cursor:pointer">${this._rdAxisOpen === false ? '▸' : '▾'}</span>
          </span></h3>
        <div id="rdAxisBody" ${this._rdAxisOpen === false ? 'style="display:none"' : ''}>
          ${this.readingTimelineHTML(rLogs)}
        </div>
      </div>
      <!-- 积累快捷记录（时间轴与精选推荐之间） -->
      <div class="card"><h3>积累 <button class="btn sm" id="rnAdd" style="margin-left:auto;font-size:12px">＋ 记录</button>
        <button class="icon-btn" id="rnLib" title="记录库" style="font-size:14px">${icon('book',14)}</button></h3>
        ${notes.filter(n => n.type !== 'review').length ? notes.filter(n => n.type !== 'review').slice(-3).reverse().map(n => `<div class="list-row" style="align-items:flex-start">
          <div style="flex:1"><b>${esc(n.book)}</b><div class="muted" style="font-size:12px">${esc(n.content?.slice(0, 60) || '')}${(n.content|| '').length > 60 ? '…' : ''}</div></div>
        </div>`).join('') : '<div class="empty" style="font-size:12px">读到好句子就记下来吧</div>'}
      </div>
      <div class="card"><h3>精选推荐</h3>
        ${recs.length ? recs.map(({ r }) => `<div class="list-row" style="align-items:flex-start">
          <span class="tag">推荐</span>
          <div style="flex:1"><b>${esc(r.title)}</b>${r.link ? ` <a href="${r.link}" target="_blank">↗</a>` : ''}
          <div class="muted">${esc(r.why)}</div></div></div>`).join('') : '<div class="empty">每天 14:00 枝枝会更新精选</div>'}
      </div>
      <!-- 阅读日历 / 照片日历 -->
      <div class="card"><h3 style="display:flex;align-items:center;gap:8px">${isPhoto ? '封面日历' : '阅读日历'}
        <span class="muted" style="font-size:12px;font-weight:400">${yy}.${String(mm).padStart(2,'0')}</span>
        <div style="margin-left:auto;display:flex;gap:4px">
          <button class="btn sm ghost" id="rdCalPrev" title="上个月">‹</button>
          <button class="btn sm ghost" id="rdCalNext" title="下个月">›</button>
          <button class="btn sm ghost" id="rdToggleView" title="切换视图">${isPhoto ? icon('camera',14) : icon('calendar',14)}</button>
        </div></h3>
        ${calHTML}
        ${isPhoto ? '' : legendHTML}
      </div>
    </div>`;
  },
  readingTimelineHTML(rLogs) {
    if (!this._rdTlWeek) this._rdTlWeek = weekStart(todayStr());
    const wk = this._rdTlWeek;
    const WD = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    // 只保留有打卡活动的日期
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(wk, i);
      const list = (rLogs[d] || []).slice();
      if (list.length) days.push({ d, wd: WD[i], list });
    }
    const end = addDays(wk, 6);
    const rows = days.length ? days.map(({ d, wd, list }) => {
      const books = list.map(l => {
        const tags = (l.tags || []).slice(0, 2);
        const tagHTML = tags.length ? `<div class="rd-tl-tags">${tags.map(t => `<span class="tag" style="background:#eee;color:#444;border:none;font-size:10px;padding:1px 6px">${esc(t)}</span>`).join('')}</div>` : '';
        return `<div class="rd-tl-book" data-edittl="${l.id}" data-date="${d}" style="cursor:pointer;display:flex;gap:8px;align-items:flex-start;padding:4px 0">
          ${l.cover ? `<img src="${l.cover}" style="width:34px;height:48px;object-fit:cover;border-radius:5px;flex-shrink:0">` : ''}
          <div style="flex:1;min-width:0">
            <b style="font-size:13px">${esc(l.book || '未命名')}</b>
            <div style="display:flex;gap:6px;align-items:center;margin-top:2px;flex-wrap:wrap">
              ${this.readCatTag(l)}
              ${l.rating ? `<span style="letter-spacing:1px;font-size:12px">${this.rdStarHTML(l.rating)}</span>` : ''}
              <span class="muted" style="font-size:11px">${l.finished ? '已读完' : (l.pages ? esc(l.pages) : '在读')}</span>
            </div>
            ${tagHTML}
          </div>
          <div class="rd-tl-acts" data-acts="${l.id}">
            <button class="rd-tl-edit" data-tledit="${l.id}" title="编辑">✎</button>
            <button class="rd-tl-del" data-tldel="${l.id}" title="删除">✕</button>
          </div>
        </div>`;
      }).join('');
      return `<div class="rd-tl-row on${d === todayStr() ? ' today' : ''}">
        <div class="rd-tl-wd">${wd}</div>
        <div class="rd-tl-rail"><span class="rd-tl-dot"></span></div>
        <div class="rd-tl-content"><div class="rd-tl-date">${d.slice(5).replace('-', '/')}</div>${books}</div>
      </div>`;
    }).join('') : '<div class="muted" style="font-size:12px;padding:6px 0">本周暂无阅读记录</div>';
    // 周日期范围移到框下方，切换键放两侧（图标，非圆圈）
    const foot = `<div class="rd-tl-foot">
      <button class="rd-tl-nav" id="rdWkPrev" title="上一周" aria-label="上一周">${icon('chevronLeft',18)}</button>
      <span class="rd-tl-range">${wk.slice(5).replace('-', '/')} – ${end.slice(5).replace('-', '/')}</span>
      <button class="rd-tl-nav" id="rdWkNext" title="下一周" aria-label="下一周">${icon('chevronRight',18)}</button>
    </div>`;
    return `<div class="rd-tl-week">${rows}</div>${foot}`;
  },
  weekIndex(wk) {
    const [y] = wk.split('-').map(Number);
    const firstMon = weekStart(y + '-01-01');
    return Math.floor(daysBetween(firstMon, wk) / 7) + 1;
  },
  bindReadingEvents(root, recs) {
    root.querySelector('#readCheckIn').onclick = () => this.readDialog(root);
    const rh = root.querySelector('#rdAxisToggle');
    if (rh) rh.onclick = () => {
      this._rdAxisOpen = !this._rdAxisOpen;
      const b = root.querySelector('#rdAxisBody'); if (b) b.style.display = this._rdAxisOpen === false ? 'none' : '';
      rh.textContent = this._rdAxisOpen === false ? '▸' : '▾';
    };
    const ryBtn = root.querySelector('#rdYearBtn');
    if (ryBtn) ryBtn.onclick = () => { this._rdYear = true; if (!this._rdYearSel) this._rdYearSel = todayStr().slice(0, 4); this.render(root); };
    // 时间轴周切换
    const wkPrev = root.querySelector('#rdWkPrev');
    if (wkPrev) wkPrev.onclick = () => { this._rdTlWeek = addDays(this._rdTlWeek || weekStart(todayStr()), -7); this.render(root); };
    const wkNext = root.querySelector('#rdWkNext');
    if (wkNext) wkNext.onclick = () => { this._rdTlWeek = addDays(this._rdTlWeek || weekStart(todayStr()), 7); this.render(root); };
    root.querySelectorAll('[data-delread]').forEach(b => b.onclick = () => {
      const rLogs = this.readLogs();
      const known = this.dayCoverSet(todayStr()); // 删之前先记下当天用过的封面
      rLogs[todayStr()] = (rLogs[todayStr()] || []).filter(l => l.id !== b.dataset.delread);
      S.set('readLogs', rLogs);
      this.syncReadCover(todayStr(), known); // 封面随记录一起消失
      // 同步清理每日计划里由该阅读打卡生成的 autoGen 任务（与长按删除路径保持一致，避免月时间轴留孤儿块）
      try { if (window.Daily) { window.Daily.removePlanBySrc('growth:阅读', b.dataset.delread); window.Daily.reconcileReadingPlans(); } } catch (e) { console.warn(e); }
      this.render(root);
    });
    // 点击今日打卡项 → 编辑
    root.querySelectorAll('[data-editread]').forEach(el => el.onclick = (e) => {
      if (e.target.closest('.del')) return;
      const id = el.dataset.editread;
      const entry = (this.readLogs()[todayStr()] || []).find(l => l.id === id);
      if (entry) this.readDialog(root, { edit: entry });
    });
    // 阅读时间轴：单击查看（只读），长按出现编辑/删除标
    root.querySelectorAll('[data-edittl]').forEach(el => {
      const id = el.dataset.edittl;
      el.onclick = (e) => {
        if (el._lp) { el._lp = false; return; }       // 长按刚触发，吞掉这次点击
        if (e.target.closest('.rd-tl-acts')) return;   // 点的是编辑/删除标，交给下面的处理
        const entry = this._findRead(id);
        if (entry) this.readView(root, entry);
      };
      // 长按切换编辑/删除标：再长按一次收回
      this.bindLongPress(el, () => { el._lp = true; el.classList.toggle('lp-revealed'); });
    });
    root.querySelectorAll('[data-tledit]').forEach(b => b.onclick = (e) => {
      e.stopPropagation();
      const entry = this._findRead(b.dataset.tledit);
      if (entry) this.readDialog(root, { edit: entry });
    });
    root.querySelectorAll('[data-tldel]').forEach(b => b.onclick = (e) => {
      e.stopPropagation();
      const id = b.dataset.tldel;
      const rLogs = this.readLogs();
      let delDate = null;
      for (const d in rLogs) { if (rLogs[d].some(l => l.id === id)) { delDate = d; break; } }
      if (delDate) {
        const known = this.dayCoverSet(delDate); // 删之前先记下当天用过的封面
        rLogs[delDate] = rLogs[delDate].filter(l => l.id !== id);
        S.set('readLogs', rLogs);
        this.syncReadCover(delDate, known); // 封面随记录一起消失
        const notes = this.readNotes().filter(n => n.eid !== id);
        S.set('readNotes', notes);
        /* 同步删除每日计划里 link='growth:阅读'（中文归一化后）且 srcId=本记录id 的任务
           （保证月时间轴/今日列表不会留下孤儿任务） */
        try {
          const all = S.get('plans', {});
          let removed = 0;
          Object.keys(all).forEach(d => {
            const before = all[d].length;
            all[d] = all[d].filter(t => !(t.autoGen && t.srcId === id && (t.link === 'growth:reading' || t.link === 'growth:阅读')));
            removed += before - all[d].length;
          });
          S.set('plans', all);
          if (removed) console.log('[growth] 阅读删除同步清每日计划', removed, '条');
          if (window.Daily && Daily.reconcileReadingPlans) Daily.reconcileReadingPlans();
        } catch (e) { console.warn('growth→plans sync delete failed', e); }
        this.render(root); toast('已删除');
      }
    });
    // 点击日历日期 → 补打卡
    root.querySelectorAll('[data-rdate]').forEach(c => c.onclick = () => this.readDialog(root, { date: c.dataset.rdate }));
    // 日历月份切换
    const calPrev = root.querySelector('#rdCalPrev');
    if (calPrev) calPrev.onclick = () => {
      const [y, m] = this._rdCalYm.split('-').map(Number);
      const d = new Date(y, m - 2, 1);
      this._rdCalYm = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      this.render(root);
    };
    const calNext = root.querySelector('#rdCalNext');
    if (calNext) calNext.onclick = () => {
      const [y, m] = this._rdCalYm.split('-').map(Number);
      const d = new Date(y, m, 1);
      this._rdCalYm = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      this.render(root);
    };
    // 视图切换（日历 ↔ 照片日历）
    const toggleView = root.querySelector('#rdToggleView');
    if (toggleView) toggleView.onclick = () => {
      this._rdView = this._rdView === 'photo' ? 'cal' : 'photo';
      this.render(root);
    };
    // 好词好句记录
    const rnAdd = root.querySelector('#rnAdd');
    if (rnAdd) rnAdd.onclick = () => this.readNoteDialog(root);
    // 记录库
    const rnLib = root.querySelector('#rnLib');
    if (rnLib) rnLib.onclick = () => this.readNotesPage(root);
    // 封面日历：只读，点有封面的格子看大图
    root.querySelectorAll('[data-cvview]').forEach(c => c.onclick = () => this.coverView(c.dataset.cvview));
  },
  readingYearPage(root) {
    if (!this._rdYearSel) this._rdYearSel = todayStr().slice(0, 4);
    const ysel = this._rdYearSel;
    const rLogs = this.readLogs();
    // 只保留有记录的月份
    const months = [];
    for (let m = 1; m <= 12; m++) {
      const ym = ysel + '-' + String(m).padStart(2, '0');
      const entries = Object.entries(rLogs)
        .filter(([d]) => d.startsWith(ym))
        .flatMap(([d, arr]) => arr.map(l => ({ ...l, date: d })))
        .sort((a, b) => b.date.localeCompare(a.date));
      if (entries.length) months.push({ m, entries });
    }
    // 可选年份：有记录的年份 ∪ 今年 ∪ 当前选中年
    const yearSet = new Set(Object.keys(rLogs).filter(d => (rLogs[d] || []).length).map(d => d.slice(0, 4)));
    yearSet.add(todayStr().slice(0, 4)); yearSet.add(ysel);
    const years = Array.from(yearSet).sort().reverse();
    return `<div class="ry-page">
      <div class="ry-header">
        <div class="ry-title" id="ryTitleWrap">
          <b>${ysel}年阅读轴</b>
          <span class="ry-caret">${icon('chevronDown',16)}</span>
          <select id="rySelect" aria-label="切换年份">${years.map(y => `<option value="${y}" ${y === ysel ? 'selected' : ''}>${y}年</option>`).join('')}</select>
        </div>
        <button class="icon-btn" id="ryBack" title="返回阅读">${icon('chevronLeft',18)}</button>
      </div>
      <div class="ry-axis">
        ${months.length ? months.map(mm => `<div class="ry-node on">
          <span class="ry-dot"></span>
          <div class="ry-content">
            <div class="ry-month">${mm.m} 月 · ${mm.entries.length} 本/篇</div>
            ${mm.entries.map(l => {
              const tags = l.tags || [];
              const tagHTML = tags.length ? `<div class="rd-tl-tags ry-tags" data-rytags="${l.id}">
                ${tags.map((t, i) => `<span class="tag ry-tag${i >= 2 ? ' ry-tag-extra' : ''}" style="background:#eee;color:#444;border:none;font-size:10px;padding:1px 6px">${esc(t)}</span>`).join('')}
                ${tags.length > 2 ? `<span class="ry-tag-more" data-rytoggle="${l.id}">+${tags.length - 2}</span>` : ''}
              </div>` : '';
              return `<div class="list-row" style="align-items:flex-start" data-ryentry="${l.id}">
                ${l.cover ? `<img src="${l.cover}" style="width:30px;height:42px;object-fit:cover;border-radius:5px;flex-shrink:0">` : ''}
                <div style="flex:1"><b>${esc(l.book || '未命名')}</b>
                  <div style="display:flex;gap:6px;align-items:center;margin-top:2px;flex-wrap:wrap">
                    ${this.readCatTag(l)}
                    ${l.rating ? `<span style="letter-spacing:1px">${this.rdStarHTML(l.rating)}</span>` : ''}
                    <span class="muted" style="font-size:11px">${l.date.slice(5)}${l.finished ? ' · 已读完' : (l.pages ? ' · ' + esc(l.pages) : '')}</span>
                  </div>
                  ${tagHTML}
                </div></div>`;
            }).join('')}
          </div>
        </div>`).join('') : '<div class="empty">这一年还没有阅读记录</div>'}
      </div>
    </div>`;
  },
  bindReadingYearEvents(root) {
    const back = root.querySelector('#ryBack');
    if (back) back.onclick = () => { this._rdYear = false; this.render(root); };
    const sel = root.querySelector('#rySelect');
    if (sel) sel.onchange = () => { this._rdYearSel = sel.value; this.render(root); };
    // 单击书 → 只读查看
    root.querySelectorAll('[data-ryentry]').forEach(el => el.onclick = (e) => {
      if (e.target.closest('.ry-tag-more')) return;
      const entry = this._findRead(el.dataset.ryentry);
      if (entry) this.readView(root, entry);
    });
    // 标签「+N」→ 展开剩余标签
    root.querySelectorAll('[data-rytoggle]').forEach(b => b.onclick = (e) => {
      e.stopPropagation();
      const wrap = b.closest('.ry-tags');
      if (wrap) wrap.classList.toggle('ry-expanded');
    });
  },
  _findRead(id) {
    const rLogs = this.readLogs();
    for (const d in rLogs) { const f = rLogs[d].find(l => l.id === id); if (f) return Object.assign({}, f, { date: d }); }
    return null;
  },
  // 阅读打卡 ↔ 阅读目标关联（v271）：打卡后若命中当前周期的「阅读」类目标，自动记进度/完成
  syncReadingGoals(date, book, finished) {
    const gs = S.get('mumu_goals', []);
    const wks = weekStart(date), ym = date.slice(0, 7);
    const norm = s => (s || '').replace(/[《》\s]/g, '').toLowerCase();
    const nb = norm(book);
    const cand = gs.filter(g => !g.done && (g.link === 'growth:阅读' || /读/.test(g.title)) && (
      (g.scope === 'day' && g.period === date) ||
      (g.scope === 'week' && g.period === wks) ||
      (g.scope === 'month' && g.period === ym)
    ));
    if (!cand.length) return;
    const hit = cand.find(g => { const ng = norm(g.title); return nb && (ng.indexOf(nb) >= 0 || nb.indexOf(ng) >= 0); }) || cand[0];
    hit.done = true; hit.doneDate = date; hit.progress = (hit.progress || 0) + 1;
    if (!hit.link) hit.link = 'growth:阅读';
    S.set('mumu_goals', gs);
    toast('已关联阅读目标：' + hit.title);
  },
  // 只读查看：展示一本书的全部信息（封面/分类/评分/标签/读后感），不可编辑
  readView(root, entry) {
    const cat = this.readCat(entry);
    const statusTxt = entry.finished ? '已读完' : (entry.pages ? '在读 · ' + entry.pages : '在读');
    const tags = entry.tags || [];
    openModal(`<button class="close-x" onclick="closeModal()">×</button>
      <div style="display:flex;gap:12px;align-items:flex-start">
        ${entry.cover ? `<img src="${entry.cover}" style="width:64px;height:90px;object-fit:cover;border-radius:8px;flex-shrink:0">` : ''}
        <div style="flex:1;min-width:0">
          <h3 style="margin:0">${esc(entry.book || '未命名')}</h3>
          <div style="display:flex;gap:6px;align-items:center;margin-top:6px;flex-wrap:wrap">
            <span class="tag" style="background:${cat.color};color:#fff;border:none;font-size:11px;padding:1px 8px">${cat.name}</span>
            ${entry.rating ? `<span style="letter-spacing:1px">${this.rdStarHTML(entry.rating)}</span>` : ''}
          </div>
          <div class="muted" style="margin-top:6px;font-size:12px">${statusTxt} · ${entry.date}</div>
        </div>
      </div>
      ${tags.length ? `<div style="margin-top:12px"><div class="muted" style="font-size:11px;margin-bottom:4px">标签</div><div class="rd-tl-tags">${tags.map(t => `<span class="tag" style="background:#eee;color:#444;border:none;font-size:11px;padding:2px 8px">${esc(t)}</span>`).join('')}</div></div>` : ''}
      ${entry.review ? `<div style="margin-top:12px"><div class="muted" style="font-size:11px;margin-bottom:4px">读后感</div><div style="white-space:pre-wrap;font-size:13px">${esc(entry.review)}</div></div>` : ''}`);
  },
  readDialog(root, opts = {}) {
    const edate = opts.date || todayStr();
    const edit = opts.edit || null;
    const isEdit = !!edit;
    const curCat = isEdit ? this.readCat(edit).key : 'other';
    const isBackdate = !isEdit && edate !== todayStr();
    openModal(`<button class="close-x" onclick="closeModal()">×</button><h3>阅读打卡${isEdit ? ' · 编辑' : (isBackdate ? ' · 补打卡' : '')}</h3>
      <div class="form-row"><label>打卡日期${isBackdate ? '（补打卡）' : ''}</label>
        <input type="date" id="rdDate" value="${esc(edate)}" max="${esc(todayStr())}" style="max-width:200px"></div>
      <div class="form-row"><label>书名</label><input id="rdBook" placeholder="在读哪本书？" value="${esc(edit ? (edit.book || '') : '')}"></div>
      <div class="form-row"><label>阅读状态</label>
        <select id="rdStatus"><option value="reading">未读完</option><option value="done">已读完</option></select></div>
      <div id="rdProgress"><div class="form-row"><label>读到第几页/第几章</label><input id="rdPages" placeholder="例如：P120 / 第5章" value="${esc(edit && !edit.finished ? (edit.pages || '') : '')}"></div></div>
      <div id="rdDoneExtra" style="display:none">
        <div class="form-row"><label>评分</label><div id="rdRateBox" style="font-size:24px;cursor:pointer;letter-spacing:4px"></div></div>
        <div class="form-row"><label>读后感</label><textarea id="rdReview" rows="3" placeholder="读完这本书，你的感受、收获、想记住的话…">${esc(edit && edit.review ? edit.review : '')}</textarea></div>
      </div>
      <div class="form-row"><label>书籍分类</label>
        <div class="rd-cat-pick" style="display:flex;gap:6px;margin-top:4px;flex-wrap:wrap">${this.READ_CATS.map(c => `<button class="btn sm ghost rd-cat-btn${c.key === curCat ? ' active' : ''}" data-cat="${c.key}" data-color="${c.color}" style="border:2px solid ${c.color};${c.key === curCat ? `background:${c.color};color:#fff` : `background:#fff;color:${c.color}`}">${c.name}</button>`).join('')}</div></div>
      <div class="form-row"><label>标签（空格或逗号分隔，时间轴最多显示前 2 个）</label><input id="rdTags" placeholder="例如：小说 成长 治愈" value="${esc(edit && edit.tags ? edit.tags.join(' ') : '')}"></div>
      <div class="form-row"><label>封面</label><input type="file" id="rdCover" accept="image/*"></div>
      <button class="btn" id="rdOk" style="width:100%;margin-top:12px">${isEdit ? '保存修改' : '打卡'}</button>`);
    let cat = curCat, rating = edit ? (edit.rating || 0) : 0;
    document.querySelectorAll('.rd-cat-btn').forEach(b => b.onclick = () => {
      document.querySelectorAll('.rd-cat-btn').forEach(x => {
        x.classList.remove('active');
        x.style.background = '#fff'; x.style.color = x.dataset.color;
      });
      b.classList.add('active'); b.style.background = b.dataset.color; b.style.color = '#fff';
      cat = b.dataset.cat;
    });
    const rateBox = document.getElementById('rdRateBox');
    const paintRate = () => {
      rateBox.innerHTML = [1, 2, 3, 4, 5].map(n => `<span data-rstar="${n}" style="position:relative;display:inline-block;width:1em;color:#e0e0e0">★<span style="position:absolute;left:0;top:0;overflow:hidden;white-space:nowrap;color:#f5a623;width:${rating >= n ? 100 : (rating >= n - 0.5 ? 50 : 0)}%">★</span></span>`).join('');
      rateBox.querySelectorAll('[data-rstar]').forEach(s => s.onclick = () => {
        const n = Number(s.dataset.rstar);
        if (rating === n) rating = 0;            // 全亮 → 灭
        else if (rating === n - 0.5) rating = n;  // 半亮 → 全亮
        else rating = n - 0.5;                    // 灭 → 半亮
        paintRate();
      });
    };
    paintRate();
    document.getElementById('rdStatus').onchange = e => {
      const isDone = e.target.value === 'done';
      document.getElementById('rdProgress').style.display = isDone ? 'none' : '';
      const extra = document.getElementById('rdDoneExtra');
      if (extra) extra.style.display = isDone ? '' : 'none';
    };
    // 编辑模式：按已有数据初始化状态展示
    if (edit) {
      document.getElementById('rdStatus').value = edit.finished ? 'done' : 'reading';
      document.getElementById('rdStatus').dispatchEvent(new Event('change'));
    }
    document.getElementById('rdOk').onclick = () => {
      const book = document.getElementById('rdBook').value.trim();
      if (!book) return toast('填一下书名');
      /* 用户在弹窗顶部可以改打卡日期；不能晚于今天（避免把未来的某天记录为已打卡）。
         如果用户没改，等于弹窗初始化的 edate（新建=今天/补打卡=昨天；编辑=原 entry.date）。 */
      const pickedDate = document.getElementById('rdDate').value;
      const useDate = pickedDate && pickedDate <= todayStr() ? pickedDate : edate;
      const file = document.getElementById('rdCover').files[0];
      const status = document.getElementById('rdStatus').value;
      const review = status === 'done' ? (document.getElementById('rdReview')?.value.trim() || '') : '';
      const save = (cover) => {
        const tagsRaw = (document.getElementById('rdTags').value || '').trim();
        const tags = tagsRaw ? tagsRaw.split(/[\s,，]+/).filter(Boolean) : [];
        const rLogs = this.readLogs();
        /* useDate 是用户在弹窗顶部选的日期（默认 edate）。落盘时：
           · 新建：写到 rLogs[useDate]；entry.date = useDate；同步读后感 date = useDate
           · 编辑：edit 可能跨日期移动（用 useDate 代替原 edit.date），同步读后感 date 跟着改 */
        const targetDate = isEdit ? useDate : useDate;
        const entry = {
          book, pages: status === 'reading' ? (document.getElementById('rdPages').value.trim() || '') : '',
          finished: status === 'done', cat,
          cover: cover || (isEdit ? (edit.cover || null) : null),
          rating: status === 'done' ? rating : 0, review,
          tags,
          time: (isEdit && edit.time) ? edit.time : new Date().toTimeString().slice(0, 5)
        };
        let notes = null; // 需要落盘时才不为 null
        if (isEdit) {
          /* 编辑跨日期：从原 rLogs[edit.date] 移到 rLogs[useDate]（如果日期变了） */
          const oldDate = edit.date || targetDate;
          if (oldDate !== targetDate) {
            rLogs[oldDate] = (rLogs[oldDate] || []).filter(l => l.id !== edit.id);
          }
          rLogs[targetDate] = (rLogs[targetDate] || []).map(l => l.id === edit.id ? Object.assign({}, l, entry, { id: edit.id, date: targetDate }) : l);
          // 同步读后感到记录库
          notes = this.readNotes();
          const idx = notes.findIndex(n => n.eid === edit.id);
          if (review) {
            if (idx >= 0) { notes[idx].content = '[读后感] ' + review; notes[idx].rating = rating; notes[idx].book = book; notes[idx].date = targetDate; }
            else notes.push({ id: uid(), book, content: '[读后感] ' + review, thought: '', image: null, date: targetDate, type: 'review', rating, eid: edit.id });
          } else if (idx >= 0) notes.splice(idx, 1);
        } else {
          entry.id = uid(); entry.date = useDate;
          rLogs[useDate] = rLogs[useDate] || [];
          rLogs[useDate].push(entry);
          if (review) {
            notes = this.readNotes();
            notes.push({ id: uid(), book, content: '[读后感] ' + review, thought: '', image: null, date: useDate, type: 'review', rating, eid: entry.id });
          }
        }
        // 先关弹窗：无论后面哪一步出错，都不会再出现「点了没反应」
        closeModal();
        let saved = true;
        try {
          S.set('readLogs', rLogs);
          if (notes) S.set('readNotes', notes);
          this.syncReadingGoals(targetDate, book, entry.finished);
        } catch (e) { saved = false; console.warn(e); }
        /* 同步封面：当天如果是跨日编辑，原日期的封面可能要清理（保守策略不主动清 readCovers[oldDate]，但记录删掉后 dayCover 取最新） */
        try {
          if (isEdit && edit.date && edit.date !== targetDate) {
            const knownOld = this.dayCoverSet(edit.date);
            this.syncReadCover(edit.date, knownOld);
          }
          this.syncReadCover(targetDate);
        } catch (e) { console.warn(e); }
        try {
          /* 阅读打卡 ↔ 每日计划双向同步：
             · 新建：无论今天还是补打卡（往日），都记在所选日期 useDate 上，带 srcId=entry.id
             · 编辑（含跨日补打卡）：先按 srcId 移除旧的每日计划任务，再在 useDate 重建，避免留孤儿空块
             · 最后 reconcile 清理任何悬空孤儿（删除/移动后同步） */
          if (saved && window.Daily) {
            const catName = (this.READ_CATS.find(x => x.key === cat) || {}).name || '';
            const extra = {
              '书名': book,
              '分类': catName,
              '进度': entry.finished ? '已读完' : (entry.pages || '在读'),
              '评分': entry.rating ? entry.rating + ' 星' : '',
              '标签': (tags || []).join('、')
            };
            if (isEdit) {
              window.Daily.removePlanBySrc('growth:阅读', edit.id);
              window.Daily.autoFromColumn('growth:阅读', useDate, book, null, extra, edit.id);
            } else {
              window.Daily.autoFromColumn('growth:阅读', useDate, book, null, extra, entry.id);
            }
            window.Daily.reconcileReadingPlans();
          }
        } catch (e) { console.warn(e); }
        this.render(root);
        const wasBack = !isEdit && useDate !== todayStr();
        toast(saved ? (isEdit ? '已保存修改' : (wasBack ? '已补打卡到 ' + useDate : '已打卡') + (entry.rating ? ' · ' + entry.rating + '星' : '')) : '存储空间已满，没能保存');
      };
      if (file) readImageFile(file, 720, 0.72).then(save).catch(() => save(null));
      else save(null);
    };
  },
  readNoteDialog(root) {
    openModal(`<button class="close-x" onclick="closeModal()">×</button><h3>积累</h3>
      <div class="form-row"><label>书名</label><input id="rnBook" placeholder="来自哪本书？"></div>
      <div class="form-row"><label>想记录的内容</label><textarea id="rnContent" rows="3" placeholder="把好句子、好段落贴进来…"></textarea></div>
      <div class="form-row"><label>原句照片（可选）</label><input type="file" id="rnImage" accept="image/*"></div>
      <div class="form-row"><label>我的感想</label><textarea id="rnThought" rows="3" placeholder="为什么被打动？想到了什么？"></textarea></div>
      <button class="btn" id="rnOk" style="width:100%;margin-top:12px">保存</button>`);
    document.getElementById('rnOk').onclick = () => {
      const book = document.getElementById('rnBook').value.trim();
      if (!book) return toast('记一下书名');
      const content = document.getElementById('rnContent').value.trim();
      const thought = document.getElementById('rnThought').value.trim();
      const file = document.getElementById('rnImage').files[0];
      const save = (image) => {
        const notes = this.readNotes();
        notes.push({ id: uid(), book, content, thought, image: image || null, date: todayStr(), type: 'sentence' });
        closeModal();
        let saved = true;
        try { S.set('readNotes', notes); } catch (e) { saved = false; console.warn(e); }
        this.render(root);
        toast(saved ? '已收入记录库' : '存储空间已满，没能保存');
      };
      if (file) readImageFile(file, 900, 0.75).then(save).catch(() => save(null));
      else save(null);
    };
  },
  readNotesPage(root) {
    const all = this.readNotes().slice().reverse();
    root.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <span class="branch-title" style="margin:0;padding:0;border:none;font-size:20px">${icon('book',18)}</span>
        <button class="icon-btn" id="rnBack" title="返回阅读">${icon('chevronLeft',18)}</button>
      </div>
      <div style="margin-bottom:10px"><input id="rnSearch" placeholder="按书名搜索…" style="width:100%;padding:9px 12px;border:1px solid var(--line);border-radius:10px;font-size:14px"></div>
      <div id="rnList" style="display:flex;flex-direction:column;gap:10px"></div>`;
    const listEl = root.querySelector('#rnList');
    const renderList = (filter) => {
      const f = (filter || '').trim().toLowerCase();
      const items = f ? all.filter(n => (n.book || '').toLowerCase().includes(f)) : all;
      if (!items.length) { listEl.innerHTML = '<div class="empty">还没有记录</div>'; return; }
      listEl.innerHTML = items.map(n => `<div class="card note-card" style="margin:0" data-note="${n.id}">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><b>${esc(n.book)}</b>
          <span style="display:flex;align-items:center;gap:6px;flex-shrink:0"><span class="muted" style="font-size:11px">${n.date}</span><button class="del" data-note-del="${n.id}" style="display:none">✕</button></span></div>
        ${n.type === 'review' ? '<span class="tag" style="background:#7CB390;color:#fff;border:none;font-size:10px;margin-top:4px;display:inline-block">读后感</span>' : '<span class="tag" style="background:#cbd5e1;color:#334;font-size:10px;margin-top:4px;display:inline-block">积累</span>'}
        ${n.rating ? `<span style="letter-spacing:1px;margin-top:4px;display:inline-block">${this.rdStarHTML(n.rating)}</span>` : ''}
        ${n.content ? `<div style="margin-top:6px;white-space:pre-wrap;font-size:13px">${esc(n.content)}</div>` : ''}
        ${n.image ? `<img src="${n.image}" style="max-width:100%;margin-top:8px;border-radius:8px">` : ''}
        ${n.thought ? `<div class="muted" style="margin-top:6px">💭 ${esc(n.thought)}</div>` : ''}
      </div>`).join('');
      // 长按卡片 → 切换删除按钮，再长按一次收回
      listEl.querySelectorAll('.note-card').forEach(card => {
        this.bindLongPress(card, () => {
          const delBtn = card.querySelector('[data-note-del]');
          if (delBtn) delBtn.style.display = delBtn.style.display === 'none' ? '' : 'none';
        });
      });
      listEl.querySelectorAll('[data-note-del]').forEach(b => b.onclick = (e) => {
        e.stopPropagation();
        const id = b.dataset.noteDel;
        const notes = this.readNotes().filter(n => n.id !== id);
        S.set('readNotes', notes); this.readNotesPage(root); toast('已删除');
      });
    };
    renderList('');
    root.querySelector('#rnSearch').oninput = e => renderList(e.target.value);
    const back = root.querySelector('#rnBack');
    if (back) back.onclick = () => { this.sub = 'reading'; this._rdView = 'cal'; this.render(root); };
  },
  // 写作相关：materialLibPage 已迁移至 work.js

  // 封面日历：点击有封面的格子，看大图（当天所有封面，多本并列）+ 当天书名
  coverView(date) {
    const dayLogs = this.readLogs()[date] || [];
    const covAll = dayLogs.map(l => l.cover).filter(Boolean);
    if (!covAll.length) return;
    const books = dayLogs.map(l => l.book).filter(Boolean);
    const gallery = covAll.map(c => `<img src="${c}" class="rd-cover-big">`).join('');
    openModal(`<button class="close-x" onclick="closeModal()">×</button>
      <div class="rd-cover-gallery">${gallery}</div>
      ${books.length ? `<div class="rd-cover-title">${esc(books.join(' · '))}</div>` : ''}
      <div class="muted" style="font-size:12px;text-align:center;margin-top:2px">${covAll.length > 1 ? '当天共 ' + covAll.length + ' 本' : ''}</div>
      <button class="btn sm ghost" id="cvDel" style="margin-top:14px">删除当天封面</button>`);
    const ov = document.querySelector('.modal');
    if (ov) ov.querySelector('#cvDel').onclick = () => {
      // 新书封面存在阅读记录里（readLogs），历史遗留才在 readCovers，两处都清
      const rLogs = S.get('readLogs', {});
      if (rLogs[date]) { rLogs[date] = rLogs[date].map(l => { const x = Object.assign({}, l); delete x.cover; return x; }); S.set('readLogs', rLogs); }
      const covers = S.get('readCovers', {});
      if (covers[date]) { delete covers[date]; S.set('readCovers', covers); }
      closeModal();
      // 重新刷新当前页（阅读页或年轴页）
      const main = document.querySelector('.main');
      if (main) this.render(main);
      toast('已删除');
    };
  },
  // 写作相关函数已迁移至 work.js（创作·写作 分支）

  areaCard(a, allRecs, todayLog, learnedToday) {
    if (a === '英语') return this.englishCard(allRecs);
    const isFinance = a === '理财';
    const recs = allRecs.map((r, i) => ({ r, i })).filter(x => x.r.area === a);
    const myLog = todayLog.filter(l => l.area === a);
    const tagCls = 'grey';
    // 理财专属推荐
    const finTopics = [
      { t: '指数基金定投入门', d: '最适合普通人的理财方式，每月几百就能开始' },
      { t: '记账习惯养成', d: '先搞清楚钱花在哪里，再谈投资' },
      { t: '财务自由三步走', d: '应急金 → 保险 → 长期投资' }
    ];
    return `<div class="card">
      <h3>${esc(a)} <span class="tag">${recs.length}</span>
        <button class="btn sm" data-add="${esc(a)}" style="margin-left:auto">＋ 打卡</button></h3>
      ${isFinance ? `<div style="margin-bottom:8px">${finTopics.map(t => `<div class="list-row"><span class="tag">建议</span><div style="flex:1"><b>${esc(t.t)}</b><div class="muted">${esc(t.d)}</div></div></div>`).join('')}</div>` : ''}
      ${recs.length ? `<div style="margin:6px 0">${recs.map(({ r, i }) => `<div class="list-row" style="align-items:flex-start">
        <span class="tag">精选</span>
        <div style="flex:1"><b>${esc(r.title)}</b>${r.link ? ` <a href="${r.link}" target="_blank">↗</a>` : ''}
          <div class="muted">${esc(r.why)}</div>
          <div style="font-size:12.5px;color:var(--sub)">${esc(r.action)}</div></div>
        <button class="btn sm ${learnedToday.includes(i) ? 'ghost' : ''}" data-done="${i}">${learnedToday.includes(i) ? '已学 ✓' : '标记已学'}</button>
      </div>`).join('')}</div>` : ''}
      ${myLog.length ? myLog.map(l => `<div class="list-row"><span class="tag">${esc(l.area)}</span><div style="flex:1"><b>${esc(l.content)}</b>
        ${l.rating ? `<div style="letter-spacing:2px">${'★'.repeat(l.rating)}</div>` : ''}
        ${l.review ? `<div class="muted">${esc(l.review)}</div>` : ''}
        ${l.takeaway ? `<div class="muted">${esc(l.takeaway)}</div>` : ''}
        <div class="muted">${l.minutes}min</div></div></div>`).join('') : '<div class="empty">今天还没打卡</div>'}
    </div>`;
  },

  englishCard(allRecs) {
    const recs = allRecs.map((r, i) => ({ r, i })).filter(x => x.r.area === '英语');
    const engStep = S.get('growthEngStep', 1) || 1;
    // 多邻国分数模型（v273：分数制，阶段由绝对分自动判定）
    const ep = this.migrateEngProgress();
    const st = this.engStageOf(ep.score);
    const showPool = [
      { name: '老友记 Friends', level: '初级', why: '日常对话多，词汇实用，难度适中', total: 236 },
      { name: '摩登家庭 Modern Family', level: '初中级', why: '家庭场景，口语地道，笑点多', total: 250 },
      { name: '我们这一天 This Is Us', level: '中级', why: '语速适中，情感丰富，适合精听', total: 106 },
      { name: '硅谷 Silicon Valley', level: '中高级', why: '科技词汇 + 创业话题', total: 53 },
      { name: '黑镜 Black Mirror', level: '高级', why: '独立故事，科幻词汇，适合挑战', total: 27 },
      { name: '生活大爆炸 The Big Bang Theory', level: '中级', why: '科学梗多，笑点密集', total: 279 },
      { name: '怪奇物语 Stranger Things', level: '初中级', why: '青少年口语，语速适中', total: 34 },
      { name: '权力的游戏 Game of Thrones', level: '高级', why: '史诗对白，词汇量爆炸', total: 73 },
      { name: '实习医生格蕾 Grey’s Anatomy', level: '中高级', why: '医疗词汇 + 情感对白', total: 400 },
      { name: '小谢尔顿 Young Sheldon', level: '初中级', why: '生活化表达，适合精听跟读', total: 100 },
      { name: '绝望主妇 Desperate Housewives', level: '中高级', why: '叙事复杂，词汇丰富', total: 180 },
      { name: '好汉两个半 Two and a Half Men', level: '初中级', why: '情景喜剧，口语松弛自然', total: 262 }
    ];
    this._showPool = showPool;
    let showsArr = S.get('engShows', null);
    if (!showsArr) {
      showsArr = showPool.slice(0, 5).map(s => ({ id: uid(), name: s.name, level: s.level, why: s.why, total: s.total, done: 0 }));
      S.set('engShows', showsArr);
    }
    const tMin = this.skillMinutes('英语');
    const tH = tMin / 60;
    const lv = this.skillLevelOf(this.skillCombinedMinutes('英语'));
    const ring = this.ringSVG(lv.pct, 'Lv' + lv.lv, lv.name);
    const stageTag = st.practice ? '巩固练习' : st.name;
    const totalPct = Math.min(100, Math.round(ep.score / 129 * 100));
    return `<div class="card eng-card">
      <div class="eng-head">
        <h3>英语学习 <span class="tag">${esc(stageTag)}</span></h3>
        <button class="icon-btn" id="engSetStage" title="设置分数">${icon('settings',16)}</button>
      </div>
      <div class="eng-level">
        ${ring}
        <div class="eng-level-info">
          <div><b>Lv${lv.lv} · ${lv.name}</b></div>
          <div class="muted">${lv.next ? '距 ' + lv.next.name + ' ' + Math.ceil(lv.toNext / 60) + ' 小时' : '已满级'}</div>
          <div class="muted">累计 ${tH >= 1 ? tH.toFixed(1) + ' 小时' : tMin + ' 分钟'} · ${this.skillDays('英语')} 天</div>
        </div>
      </div>
      <div class="eng-bars">
        <div class="eng-bar-row"><span class="eb-label">学习时长</span>${this.miniBar(lv.pct)}<span class="eb-val">${tH >= 1 ? tH.toFixed(1) + 'h' : tMin + 'm'}</span></div>
        <div class="eng-bar-row"><span class="eb-label">累计分</span>${this.miniBar(totalPct)}<span class="eb-val">${ep.score}/129</span></div>
      </div>
      ${Object.keys(ep.dailyLog).length ? `<div style="margin-top:10px">
        <div class="coll-head" data-englog-toggle style="cursor:pointer;display:flex;align-items:center;gap:4px;font-size:13px;font-weight:600;user-select:none"><span class="car">${this._engLogOpen === false ? '▸' : '▾'}</span> 近期学习记录</div>
        <div class="eng-log-body" style="${this._engLogOpen === false ? 'display:none' : ''}">
          ${Object.entries(ep.dailyLog).slice(-7).reverse().map(([d, v]) => `<div class="list-row"><span class="muted" style="flex-shrink:0">${d.slice(5)}</span><span style="flex:1">学习 <b>${v.min || 0}</b> 分钟 · 多邻国 <b>${v.delta > 0 ? '+' + v.delta : v.delta}</b> 分</span></div>`).join('')}
        </div>
      </div>` : ''}
      <div style="margin-top:10px"><h4 style="margin:4px 0;font-size:13px">每日英语小知识</h4>
        <div class="banner info" id="engTip">${this.englishTip()}</div>
        <button class="btn sm ghost" id="engTipRefresh" style="margin-top:4px">${icon('refresh',12)} 换一条</button>
      </div>
      ${recs.length ? `<div style="margin-top:10px"><div class="muted" style="margin:4px 0">今日英语精选</div>${recs.map(({ r }) => `<div class="list-row" style="align-items:flex-start"><span class="tag">精选</span><div style="flex:1"><b>${esc(r.title)}</b>${r.link ? ` <a href="${r.link}" target="_blank">↗</a>` : ''}<div class="muted">${esc(r.why)}</div><div style="font-size:12.5px;color:var(--sub)">${esc(r.action)}</div></div></div>`).join('')}</div>` : '<div class="empty">每天 14:00 枝枝会更新精选</div>'}
      ${engStep >= 1 ? `<div style="margin-top:10px"><h4 style="margin:4px 0;font-size:13px">推荐美剧（看完整部自动换下一部）</h4>
        ${showsArr.map(s => { const p = s.total > 0 ? Math.round(s.done / s.total * 100) : 0; return `<div class="eng-show">
          <div class="eng-show-head">
            <span class="tag">${esc(s.level)}</span>
            <b style="flex:1;font-size:13px">${esc(s.name)}</b>
            <span class="muted" style="font-size:12px">${s.done}/${s.total}</span>
            <button class="icon-btn" data-engshow-toggle="${s.id}" title="看进度/记录">▾</button>
          </div>
          <div class="progress-bar" style="height:10px;margin:6px 0"><i style="width:${p}%"></i></div>
          <div class="eng-show-body" id="engShowBody_${s.id}" style="display:none">
            <div class="muted" style="font-size:12px;line-height:1.5">${esc(s.why)}</div>
            <div style="display:flex;gap:6px;margin-top:7px;flex-wrap:wrap;align-items:center">
              <button class="btn sm" data-engshow-inc="${s.id}">＋ 看一集</button>
              <button class="btn sm ghost" data-engshow-dec="${s.id}">－</button>
              <input type="number" id="engShowSet_${s.id}" value="${s.done}" min="0" max="${s.total}" style="width:62px;padding:4px 6px;border:1px solid var(--line);border-radius:8px">
              <button class="btn sm ghost" data-engshow-set="${s.id}">设定</button>
              <button class="del" data-engshow-del="${s.id}" title="不感兴趣，移除">✕</button>
            </div>
          </div>
        </div>`; }).join('')}
      </div>` : ''}
    </div>`;
  },

  bindEnglishCard(root, body) {
    const engSetBtn = body.querySelector('#engSetStage');
    if (engSetBtn) engSetBtn.onclick = () => this.engStageDialog(root);
    const tipBtn2 = body.querySelector('#engTipRefresh');
    if (tipBtn2) tipBtn2.onclick = () => { const tipEl = body.querySelector('#engTip'); if (tipEl) tipEl.innerHTML = this.englishTip(); };
    const engLogTgl = body.querySelector('[data-englog-toggle]');
    if (engLogTgl) engLogTgl.onclick = () => {
      this._engLogOpen = !(this._engLogOpen !== false);
      const open = this._engLogOpen !== false;
      const car = engLogTgl.querySelector('.car'); if (car) car.textContent = open ? '▾' : '▸';
      const bd = body.querySelector('.eng-log-body'); if (bd) bd.style.display = open ? '' : 'none';
    };
    const engShowSave = (id, done) => {
      const pool = this._showPool || [];
      let arr = S.get('engShows', []);
      const s = arr.find(x => x.id === id); if (!s) return;
      s.done = Math.max(0, Math.min(done, s.total));
      const finished = s.done >= s.total;
      if (finished) {
        arr = arr.filter(x => x.id !== id);
        const used = new Set(arr.map(x => x.name));
        const next = pool.find(p => !used.has(p.name));
        if (next) arr.push({ id: uid(), name: next.name, level: next.level, why: next.why, total: next.total, done: 0 });
        S.set('engShows', arr);
        this.render(root); toast('看完啦！已自动换一部新剧 🎬');
      } else {
        S.set('engShows', arr); this.render(root);
      }
    };
    body.querySelectorAll('[data-engshow-toggle]').forEach(b => b.onclick = () => {
      const bd = body.querySelector('#engShowBody_' + b.dataset.engshowToggle); if (bd) bd.style.display = bd.style.display === 'none' ? '' : 'none';
    });
    body.querySelectorAll('[data-engshow-inc]').forEach(b => b.onclick = () => { const arr = S.get('engShows', []); const s = arr.find(x => x.id === b.dataset.engshowInc); if (!s) return; engShowSave(s.id, s.done + 1); });
    body.querySelectorAll('[data-engshow-dec]').forEach(b => b.onclick = () => { const arr = S.get('engShows', []); const s = arr.find(x => x.id === b.dataset.engshowDec); if (!s) return; engShowSave(s.id, s.done - 1); });
    body.querySelectorAll('[data-engshow-set]').forEach(b => b.onclick = () => { const arr = S.get('engShows', []); const s = arr.find(x => x.id === b.dataset.engshowSet); if (!s) return; const v = Number(body.querySelector('#engShowSet_' + s.id)?.value) || 0; engShowSave(s.id, v); });
    body.querySelectorAll('[data-engshow-del]').forEach(b => b.onclick = () => {
      if (!confirm('移除这部剧的推荐？')) return;
      const pool = this._showPool || [];
      let arr = S.get('engShows', []).filter(x => x.id !== b.dataset.engshowDel);
      const used = new Set(arr.map(x => x.name));
      const next = pool.find(p => !used.has(p.name));
      if (next) arr.push({ id: uid(), name: next.name, level: next.level, why: next.why, total: next.total, done: 0 });
      S.set('engShows', arr); this.render(root);
    });
  },

  englishTip() {
    const tips = [
      '"Fewer" 和 "Less" 怎么分？Fewer 用于可数名词（fewer books），Less 用于不可数名词（less water）。口诀：数量数得清用 fewer，数不清用 less。',
      '"Its" vs "It\'s"：It\'s = It is 或 It has 的缩写（It\'s raining），而 Its 是所有格（The dog wagged its tail）。看有没有撇号就行。',
      '常见中式英语误区：「我很热」不要说 I\'m hot（意思是我很性感），要说 I feel hot 或 It\'s hot.',
      '"Advice" 不可数！不能说 an advice，要说 a piece of advice。同理 "information"、"furniture" 也是不可数。',
      '听力提分技巧：不要试图听懂每个单词，先抓「谁、做了什么、结果」三个关键信息。练习时先用 0.75 倍速听，再正常速度。',
      '美式 vs 英式小区别：电梯 = elevator(美) / lift(英)；公寓 = apartment(美) / flat(英)；地铁 = subway(美) / tube(英)。',
      '口语自然小技巧：多用 "kind of" / "sort of" 代替 "a little"，比如 "I\'m kind of tired" 比 "I\'m a little tired" 更像母语者。',
      '"Since" 和 "For" 区别：Since + 时间点（since 2020 / since Monday），For + 时间段（for 3 years / for 2 hours）。',
      '发音小贴士：单词结尾的 -ed 有三种读法：清辅音后读/t/（worked→workt），浊辅音和元音后读/d/（played→playd），t/d后读/ɪd/（wanted→wantid）。'
    ];
    return tips[Math.floor(Math.random() * tips.length)];
  },
  engStageDialog(root) {
    const ep = this.migrateEngProgress();
    const st = this.engStageOf(ep.score);
    openModal(`<button class="close-x" onclick="closeModal()">×</button><h3>${icon('settings',18)} 英语学习设置</h3>
      <div class="muted" style="margin-bottom:10px">阶段会根据分数自动判定（第4阶段 30–59 · 第5阶段 60–79 · 第6阶段 80–99 · 第7阶段 100–114 · 第8阶段 115–128 · 之后巩固练习）。只改分数即可。</div>
      <div class="form-row"><label>当前多邻国分数</label><input id="epScore" type="number" min="0" value="${ep.score || 0}" placeholder="如：44"></div>
      <div class="form-row"><label>当前阶段（自动）</label><input id="epStageView" value="${st.practice ? '巩固练习' : st.name + '（' + st.lo + '–' + st.hi + '）'}" disabled></div>
      <button class="btn" id="epOk" style="width:100%;margin-top:12px">保存</button>`);
    document.getElementById('epOk').onclick = () => {
      const score = Number(document.getElementById('epScore').value) || 0;
      const ns = this.engStageOf(score);
      S.set('engProgress', { score, dailyLog: ep.dailyLog || {} });
      closeModal(); this.render(root); toast('已更新：' + (ns.practice ? '巩固练习' : ns.name) + ' · ' + score + ' 分');
    };
  },
  duoCheckIn(root) {
    const streaks = S.get('duoStreaks', []);
    if (!streaks.includes(todayStr())) {
      streaks.push(todayStr());
      // 只保留最近 60 天
      const recent = streaks.filter(d => d >= addDays(todayStr(), -60));
      S.set('duoStreaks', recent);
      // 记一条技能日志（同时写入 mumu_skillLogs + 成长日志 area=英语），让「技能·英语」分钟数增长
      this.addSkillLog('英语', 10, '多邻国打卡');
      const s = (() => { let c = 0, d = todayStr(); while (recent.includes(d)) { c++; d = addDays(d, -1); } return c; })();
      toast('多邻国打卡成功！连续 ' + s + ' 天');
    }
    this.render(root);
  },

  checkIn(root, area) {
    const isRead = area === '阅读';
    openModal(`<button class="close-x" onclick="closeModal()">×</button><h3>${icon('leaf',18)} ${esc(area)} · 打卡</h3>
      <div class="form-row"><label>${isRead ? '书名' : '学了什么'}</label><input id="gaCon" placeholder="${isRead ? '例如：《被讨厌的勇气》' : '例如：BBC 6分钟英语一期'}"></div>
      ${isRead ? `<div class="form-row"><label>评分</label><div id="rateBox" style="font-size:24px;cursor:pointer;letter-spacing:4px">${[1,2,3,4,5].map(n => `<span data-star="${n}" style="opacity:.35">★</span>`).join('')}</div></div>
      <div class="form-row"><label>观后感</label><textarea id="gaReview" rows="3" placeholder="一句话感想、触动你的点、想记住的话…"></textarea></div>` : `<div class="form-row"><label>收获一句话</label><input id="gaTake" placeholder="今天记住了什么？"></div>`}
      <div class="form-row"><label>时长（分钟）</label><input type="number" id="gaMin" value="20"></div>
      <button class="btn" id="gaOk" style="width:100%">打卡</button>`);
    let rating = 0;
    const box = document.getElementById('rateBox');
    if (box) box.querySelectorAll('[data-star]').forEach(s => s.onclick = () => {
      rating = Number(s.dataset.star);
      box.querySelectorAll('[data-star]').forEach(x => { const on = Number(x.dataset.star) <= rating; x.style.opacity = on ? '1' : '.35'; });
    });
    document.getElementById('gaOk').onclick = () => {
      const c = document.getElementById('gaCon').value.trim(); if (!c) return toast(isRead ? '记一下书名' : '记一下学了什么');
      const lg = this.logs(); lg[todayStr()] = lg[todayStr()] || [];
      const rec = { id: uid(), area, content: c, minutes: Number(document.getElementById('gaMin').value) || 0, time: new Date().toTimeString().slice(0, 5) };
      if (isRead) { rec.rating = rating; rec.review = document.getElementById('gaReview').value.trim(); }
      else rec.takeaway = document.getElementById('gaTake').value.trim();
      lg[todayStr()].push(rec); S.set('growthLogs', lg); closeModal();
      if (window.Daily) window.Daily.autoFromColumn('growth:' + area, todayStr(), c, null, {
        '领域': area, '内容': c,
        '时长': rec.minutes ? rec.minutes + '分钟' : '',
        '收获': rec.takeaway || '',
        '评分': rec.rating ? rec.rating + ' 星' : ''
      });
      this.render(root); toast('打卡成功');
    };
  },

  // ===== 不成熟 idea（突发奇想，行动点逐步纳入计划）=====
  ideaPage(root) {
    const ideas = S.get('ideas', []) || [];
    const pending = ideas.filter(i => !i.done);
    const done = ideas.filter(i => i.done);
    const listHTML = (arr, isDone) => arr.length ? arr.map(i => {
      const steps = (i.steps || []).map(s => `<div class="idea-step ${s.done ? 'done' : ''}"><span class="stext">${esc(s.text)}</span>${!isDone ? `<button class="del" data-ideastep="${i.id}|${s.id}">✕</button>` : ''}</div>`).join('');
      return `<div class="card idea-card" data-idea="${i.id}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
          <div style="flex:1"><b style="font-size:15px">${esc(i.title)}</b>${i.note ? `<div class="muted" style="margin-top:4px">${esc(i.note)}</div>` : ''}</div>
          ${!isDone ? `<button class="btn sm" data-ideatoplan="${i.id}">纳入今日计划</button>` : '<span class="tag">已尝试</span>'}
        </div>
        <div class="muted" style="margin:8px 0 4px;font-size:12px">行动点（逐步纳入计划）</div>
        <div class="idea-steps">${steps || '<div class="muted">还没设行动点，点编辑加几个小步骤</div>'}</div>
        ${!isDone ? `<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;align-items:center">
          <button class="link sm" data-ideaedit="${i.id}">✎ 编辑</button>
          <button class="link sm" data-ideadone="${i.id}">标记已尝试</button>
          <button class="del" data-ideadel="${i.id}" style="margin-left:auto">删除</button>
        </div>` : `<div style="margin-top:8px"><button class="del" data-ideadel="${i.id}">删除</button></div>`}
      </div>`;
    }).join('') : '<div class="empty">还没有不成熟的小想法。刷到想学的、想做的，先丢进来，再一步步变成行动。</div>';
    return `<div class="card" style="display:flex;align-items:center;gap:10px">
        <div style="flex:1"><b>把脑子里的「想试试」先接住</b><div class="muted" style="font-size:12px">不勉强马上做，设几个行动点，有精力时再纳入今日计划</div></div>
        <button class="btn sm" id="ideaAdd">＋ 添加 idea</button>
      </div>
      ${listHTML(pending, false)}
      ${done.length ? `<div class="muted" style="margin:14px 0 6px;font-size:13px">已尝试的 idea（${done.length}）</div>${listHTML(done, true)}` : ''}`;
  },
  bindIdeaEvents(root) {
    const gw = root.querySelector('#gwBody');
    if (!gw) return;
    const add = gw.querySelector('#ideaAdd');
    if (add) add.onclick = () => this.addIdea(root);
    gw.querySelectorAll('[data-ideatoplan]').forEach(b => b.onclick = () => {
      const i = (S.get('ideas', []) || []).find(x => x.id === b.dataset.ideatoplan); if (!i) return;
      if (window.Daily) window.Daily.addTaskFromIdea(i);
      toast('已加入今日计划 🌱 去计划页看看');
    });
    gw.querySelectorAll('[data-ideaedit]').forEach(b => b.onclick = () => this.addIdea(root, b.dataset.ideaedit));
    gw.querySelectorAll('[data-ideadone]').forEach(b => b.onclick = () => {
      const arr = S.get('ideas', []); const i = arr.find(x => x.id === b.dataset.ideadone); if (!i) return; i.done = true; S.set('ideas', arr); this.render(root); toast('标记已尝试，棒！');
    });
    gw.querySelectorAll('[data-ideadel]').forEach(b => b.onclick = () => {
      if (!confirm('删除这个 idea？')) return;
      const arr = (S.get('ideas', []) || []).filter(x => x.id !== b.dataset.ideadel); S.set('ideas', arr); this.render(root);
    });
    gw.querySelectorAll('[data-ideastep]').forEach(b => b.onclick = () => {
      const [iid, sid] = b.dataset.ideastep.split('|'); const arr = S.get('ideas', []); const i = arr.find(x => x.id === iid); if (!i) return;
      i.steps = (i.steps || []).filter(s => s.id !== sid); S.set('ideas', arr); this.render(root);
    });
  },
  addIdea(root, editId) {
    const arr = S.get('ideas', []) || [];
    const ed = editId ? arr.find(x => x.id === editId) : null;
    const stepsHTML = ed ? (ed.steps || []).map(s => `<div class="idea-edit-step" data-sid="${s.id}"><input value="${esc(s.text)}" class="ies-text"><button class="del ies-del">✕</button></div>`).join('') : '';
    openModal(`<button class="close-x" onclick="closeModal()">×</button><h3>${ed ? '编辑 idea' : '＋ 添加不成熟 idea'}</h3>
      <div class="form-row"><label>想试什么？</label><input id="ideaTitle" placeholder="例如：练口语 / 学做手冲咖啡" value="${ed ? esc(ed.title) : ''}"></div>
      <div class="form-row"><label>备注（为什么想做 / 灵感来源）</label><textarea id="ideaNote" rows="2" placeholder="今天刷视频看到的…">${ed ? esc(ed.note || '') : ''}</textarea></div>
      <div class="muted" style="margin:4px 0 6px;font-size:12px">拆成几个小行动点，有精力时一个个纳入计划</div>
      <div id="ideaSteps">${stepsHTML || '<div class="muted" id="ideaStepsEmpty">还没加行动点</div>'}</div>
      <button class="btn sm ghost" id="ideaAddStep" style="margin:6px 0">＋ 加一个行动点</button>
      <button class="btn" id="ideaOk" style="width:100%;margin-top:10px">${ed ? '保存' : '保存 idea'}</button>`);
    const box = document.getElementById('ideaSteps');
    document.getElementById('ideaAddStep').onclick = () => {
      const empty = box.querySelector('#ideaStepsEmpty'); if (empty) empty.remove();
      const d = document.createElement('div'); d.className = 'idea-edit-step'; d.innerHTML = `<input class="ies-text" placeholder="小步骤…"><button class="del ies-del">✕</button>`;
      box.appendChild(d); d.querySelector('.ies-del').onclick = () => d.remove();
    };
    box.querySelectorAll('.ies-del').forEach(b => b.onclick = () => b.closest('.idea-edit-step').remove());
    document.getElementById('ideaOk').onclick = () => {
      const title = document.getElementById('ideaTitle').value.trim(); if (!title) return toast('写下想试什么吧');
      const note = document.getElementById('ideaNote').value.trim();
      const steps = Array.from(box.querySelectorAll('.idea-edit-step')).map(d => {
        const t = d.querySelector('.ies-text').value.trim(); if (!t) return null;
        return { id: d.dataset.sid || uid(), text: t };
      }).filter(Boolean);
      if (ed) { ed.title = title; ed.note = note; ed.steps = steps; }
      else arr.push({ id: uid(), title, note, steps, createdAt: Date.now(), done: false });
      S.set('ideas', arr); closeModal(); this.render(root); toast(ed ? '已更新' : 'idea 已接住，慢慢来 🌱');
    };
  },
  // ===== 技能详情页 / 徽章墙（v270）=====
  skillDetail(name) {
    const cm = this.skillCombinedMinutes(name);
    const lv = this.skillLevelOf(cm);
    const m = this.skillMinutes(name);
    const days = this.skillDays(name);
    const isEng = name === '英语';
    const totalH = m / 60;
    const ring = this.ringSVG(lv.pct, 'Lv' + lv.lv, lv.name);
    const lib = this.skillLib();
    const sk = lib.find(x => x.name === name);
    const cat = sk ? (sk.cat || '') : '';
    const lg = this.skillLogs();
    const recs = [];
    Object.keys(lg).sort().reverse().slice(0, 7).forEach(d => (lg[d] || []).forEach(r => { if (r.skill === name) recs.push({ d: d, r: r }); }));
    const recHTML = recs.length ? recs.map(x => `<div class="list-row"><span class="muted" style="flex-shrink:0">${x.d.slice(5)}</span><span style="flex:1">${esc(x.r.note || '练习')}</span><span class="muted">${x.r.minutes}分</span></div>`).join('')
      : '<div class="empty">还没有打卡记录，点上面的「打卡」开始吧</div>';
    return `<div class="card sk-detail">
      <div class="sk-detail-head">
        <h3>${esc(name)} <span class="tag">${esc(cat)}</span></h3>
        <button class="icon-btn" id="skBack" title="返回">${icon('back',18)}</button>
      </div>
      <div class="sk-detail-level">${ring}
        <div>
          <div><b>Lv${lv.lv} · ${lv.name}</b></div>
          <div class="muted">${lv.next ? '距 ' + lv.next.name + ' ' + Math.ceil(lv.toNext / 60) + ' 小时' : '已满级'}</div>
          <div class="muted">累计 ${totalH >= 1 ? totalH.toFixed(1) + ' 小时' : m + ' 分钟'} · ${days} 天</div>
        </div>
      </div>
      ${isEng ? `<div class="eng-bars" style="margin:10px 0"><div class="eng-bar-row"><span class="eb-label">学习时长</span>${this.miniBar(lv.pct)}<span class="eb-val">${totalH >= 1 ? totalH.toFixed(1) + 'h' : m + 'm'}</span></div></div>` : ''}
      <button class="btn" id="skCheck" style="width:100%;margin:4px 0 12px">${icon('check',14)} 打卡</button>
      <div class="muted" style="margin:4px 0 6px;font-size:13px;font-weight:600">最近打卡</div>
      <div class="sk-detail-rec">${recHTML}</div>
      <div class="sk-detail-ops">
        <button class="btn sm ghost" id="skRename">改名</button>
        <button class="btn sm ghost del" id="skDel">删除</button>
      </div>
    </div>`;
  },
  bindSkillDetailEvents(root) {
    const back = root.querySelector('#skBack'); if (back) back.onclick = () => { this._skOpen = null; this.render(root); };
    const check = root.querySelector('#skCheck'); if (check) check.onclick = () => this.skillCheckIn(root, this._skOpen);
    const ren = root.querySelector('#skRename'); if (ren) ren.onclick = () => { const sk = this.skillLib().find(x => x.name === this._skOpen); this.skillEditDialog(root, sk); };
    const del = root.querySelector('#skDel'); if (del) del.onclick = () => {
      const name = this._skOpen; const lib = this.skillLib(); const t = lib.find(x => x.name === name); if (!t) return;
      if (!window.confirm('删除技能「' + name + '」？打卡记录也会一并删除。')) return;
      this.saveSkillLib(lib.filter(x => x.name !== name));
      const lg = this.skillLogs(); let ch = false;
      Object.keys(lg).forEach(d => { const b = (lg[d] || []).length; lg[d] = (lg[d] || []).filter(r => r.skill !== name); if (lg[d].length !== b) ch = true; if (!lg[d].length) delete lg[d]; });
      if (ch) S.set('mumu_skillLogs', lg);
      this._skOpen = null; this.render(root); toast('已删除「' + name + '」');
    };
  },
  badgeWall() {
    const lib = this.skillLib();
    const items = lib.map(sk => {
      const cm = this.skillCombinedMinutes(sk.name);
      const lv = this.skillLevelOf(cm);
      const locked = cm <= 0;
      const cls = locked ? 'badge-locked' : 'badge-lv' + lv.lv;
      return '<div class="badge-item">'
        + '<div class="sk-badge ' + cls + '">' + (locked ? '🔒' : '★') + '</div>'
        + '<div class="badge-name">' + esc(sk.name) + '</div>'
        + '<div class="badge-lv">' + (locked ? '未点亮' : ('Lv' + lv.lv + ' · ' + lv.name)) + '</div>'
        + '</div>';
    }).join('');
    return `<div class="card badge-wall-card">
      <div class="sk-detail-head"><h3>${icon('award',18)} 技能徽章墙</h3><button class="icon-btn" id="badgeBack" title="返回">${icon('back',18)}</button></div>
      <div class="muted" style="margin:4px 0 12px;font-size:12px">每点亮一个阶段，徽章就更亮一点。坚持练习，让这面墙越来越炫酷。</div>
      <div class="badge-wall">${items}</div>
    </div>`;
  },
  bindBadgeEvents(root) {
    const back = root.querySelector('#badgeBack'); if (back) back.onclick = () => { this._skBadge = false; this.render(root); };
  },
};
window.Modules.growth = { render: r => Growth.render(r) };
window.Growth = Growth;
