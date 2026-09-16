/* ============ 备考考编 · 内蒙古为主，东三省为辅 ============ */
const KG = {
  // 科目列表（v282 前这里被误用成「错题题型」，现拆分：SUBJECTS=科目，QS_BY_SUBJ=各科目下的细分题型）
  SUBJECTS: ['言语', '判断', '资料', '数量', '常识', '申论', '综合应用能力', '时政', '面试'],
  get QTYPES() { return this.SUBJECTS; },
  QS_BY_SUBJ: {
    '言语': ['中心理解', '逻辑填空', '语句填空', '语句排序', '标题填入', '细节判断', '词句理解', '接语选择'],
    '判断': ['图形推理', '定义判断', '类比推理', '逻辑判断', '事件排序'],
    '资料': ['简单计算', '增长率', '增长量', '比重', '平均数', '倍数', '综合分析'],
    '数量': ['工程问题', '行程问题', '排列组合', '概率问题', '利润问题', '容斥问题', '几何问题', '最值问题', '浓度问题', '年龄问题', '日期问题', '方程问题'],
    '常识': ['政治', '法律', '经济', '人文历史', '科技常识', '地理国情', '管理公文'],
    '申论': ['归纳概括', '综合分析', '提出对策', '贯彻执行', '文章写作'],
    '综合应用能力': ['案例分析', '公文写作', '辨析题', '教育方案设计'],
    '时政': ['重要会议', '重要讲话', '科技成就', '重大政策', '其他时政'],
    '面试': ['综合分析', '组织管理', '应急应变', '人际关系', '自我认知', '情景模拟']
  },
  // 科目 → 题型列表（自由文本科目用关键词兜底匹配）
  subjQTypes(subj) {
    const s = String(subj || '');
    if (this.QS_BY_SUBJ[s]) return this.QS_BY_SUBJ[s];
    const rules = [['言语', '言语'], ['判断', '判断'], ['资料', '资料'], ['数量', '数量'],
      ['常识', '常识'], ['公基', '常识'], ['申论', '申论'],
      ['综应', '综合应用能力'], ['综合应用', '综合应用能力'], ['时政', '时政'], ['面试', '面试']];
    for (let i = 0; i < rules.length; i++) { if (s.indexOf(rules[i][0]) >= 0) return this.QS_BY_SUBJ[rules[i][1]]; }
    return this.QS_BY_SUBJ['言语'];
  },
  subjOpts(sel) { return this.SUBJECTS.map(t => `<option ${t === sel ? 'selected' : ''}>${t}</option>`).join(''); },
  qWrongOpts(sel, subj) { return '<option value="">错题题型</option>' + this.subjQTypes(subj).map(t => `<option ${t === sel ? 'selected' : ''}>${t}</option>`).join(''); },
  renderWrong(wrap, count, prev, subj) { count = Math.max(0, count | 0); let h = ''; for (let i = 0; i < count; i++) { const sel = (prev && prev[i] && prev[i].type) || ''; h += `<div class="form-row"><label>错的第${i + 1}题 题型</label><select class="klWrongType">${this.qWrongOpts(sel, subj)}</select></div>`; } wrap.innerHTML = h; },
  readWrong(wrap, subj) { if (!wrap) return []; const a = []; wrap.querySelectorAll('.klWrongType').forEach(s => { if (s.value) a.push({ type: s.value, subj: subj || '' }); }); return a; },
  tab: 'sz',
  interviewBank: [
    { q: '你负责组织一次社区反诈宣传活动，但报名人数很少，你怎么办？', a: '思路：①分析原因（时间冲突/宣传不到位/形式没吸引力）②针对性补救（联合物业/学校，改线上线下结合，加互动环节）③活动后总结经验形成机制。答题框架：帽子(表态)→分析→对策→总结。' },
    { q: '领导把同事的工作失误算在你头上并批评了你，你怎么办？', a: '思路：①摆正心态不当场顶撞 ②事后主动沟通说明情况，但重点放在「如何补救工作」而非「分清责任」③反思自己是否有可改进处 ④不影响与同事、领导关系。考察：情绪稳定+大局观。' },
    { q: '谈谈你对「基层工作是年轻人最好的课堂」这句话的理解。', a: '思路：①点题表态（基层是了解国情民意的第一线）②分层论证：练本领（群众工作能力）、接地气（了解真实需求）、磨心性 ③结合自身：报考基层岗位的初心 ④升华：把论文写在大地上。' },
    { q: '你的工作和搭档的工作有交叉，他总是推诿，导致进度落后，你怎么办？', a: '思路：①先自查分工是否明确 ②私下真诚沟通，了解他的困难（可能任务过载）③明确分工找领导确认机制 ④以工作完成为最高目标，必要时先顶上再理顺。' },
    { q: '单位要推行无纸化办公，老同事不适应有抵触情绪，领导让你负责推进，你怎么办？', a: '思路：①调研摸底（困难点在哪）②分类施策：培训帮带、操作手册、设置过渡期 ③树标杆、传帮带结对 ④收集反馈迭代优化。考察：组织协调+同理心。' },
    { q: '谈谈你对人工智能在政务服务中应用的看法。', a: '思路：①肯定趋势（提效便民，如智能审批、一网通办）②辩证看待：数据安全、数字鸿沟（老年人）、不能以「智」代「治」③对策：适老化改造、人工兜底、制度规范 ④结合时政：可提「人工智能+」行动。' },
    { q: '为什么报考这个岗位？你没有工作经验，如何胜任？', a: '思路：①动机真诚（服务家乡+职业稳定性与价值感，避免只谈稳定）②优势重构：自由职业经历=自我管理、内容能力、抗压学习能力 ③补短板计划：向前辈学、从小事做起 ④表决心但不空喊口号。' },
    { q: '组织一次单位内部的业务技能比武活动，你怎么组织？', a: '思路：①前期：定方案（主题、形式、评分规则）报领导审批，摸底参与意愿 ②中期：宣传动员、场地物料、评委安排、应急预案 ③后期：颁奖总结、优秀经验推广。答组织题记住「事前-事中-事后」。' }
  ],
  shenlunGuide: '申论小题四步法：\n① 审题：圈出「作答对象/范围/字数/特殊要求」\n② 找点：回材料按段落标注要点（问题/原因/对策/意义）\n③ 加工：合并同类项，按「主体/层面」分类\n④ 书写：序号化、关键词前置\n\n大作文万能结构：\n开头（引材料亮观点）→ 分论点2-3个（对策型或意义型，每段：观点+例证+分析+回扣）→ 结尾（升华，联系「十五五」等时政背景）\n\n每周至少完整写1套真题，写完对照答案用红笔改。',

  render(root) {
    root.innerHTML = `<div id="kgBody"></div>`;
    this['render_' + this.tab](root.querySelector('#kgBody'), root);
    root.insertAdjacentHTML('beforeend', this.kaogongNavHTML());
    this.bindKgNav(root);
  },

  kaogongNavHTML() {
    const items = [['log', '备考打卡'], ['sz', '每日时政'], ['news', '报考资讯'], ['plan', '备考规划']];
    return `<div class="subnav">${items.map(([k, l]) => `<button class="${this.tab === k ? 'on' : ''}" data-ksub="${k}">${l}</button>`).join('')}</div>`;
  },
  bindKgNav(root) {
    root.querySelectorAll('[data-ksub]').forEach(b => b.onclick = () => {
      this.tab = b.dataset.ksub;
      this.render(root);
    });
  },

  /* ---- 资讯 ---- */
  render_news(box) {
    const D = window.MUMU_KAOGONG;
    box.innerHTML = `

      ${D.news.map(n => `<div class="card">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span class="tag">${esc(n.region)}</span><span class="tag">${esc(n.tag)}</span><b>${esc(n.title)}</b></div>
        <p style="margin:8px 0">${esc(n.brief)}</p>
        <div class="muted">${icon('clock',14)} ${esc(n.time)} · <a href="${n.source}" target="_blank">官方来源 ↗</a></div>
      </div>`).join('')}
      <div class="card"><h3>${icon('link',16)} 官方报名入口（收藏级）</h3>
        ${D.official.map(o => `<div class="list-row"><span style="flex:1">${esc(o.name)}</span><a class="btn sm" href="${o.url}" target="_blank">进入 ↗</a></div>`).join('')}
      </div>`;
  },

  /* ---- 备考规划 ---- */
  plans() { return S.get('kgPlans', []); },
  // 记录归属计划：单计划场景下，无 planId 的记录默认归属唯一计划
  // （木木的学习打卡多在每日计划里打，不会手动去关联计划下拉，于是 planId 为空）
  planOfRecord(l) {
    if (l.planId) return l.planId;
    const plans = this.plans();
    return plans.length === 1 ? plans[0].id : null;
  },
  // 科目配色：固定调色板按科目名取色（与运动 sportColor 同理）
  subjectColor(name) {
    if (!this._sc) this._sc = {};
    if (this._sc[name]) return this._sc[name];
    const subs = ['言语', '判断', '资料', '数量', '常识', '申论', '综合应用能力', '时政', '面试'];
    const palette = ['#E8746B', '#4A90D9', '#F0A45B', '#9B7FD4', '#5FB58E', '#D98CC4', '#E0C44B', '#7FB069', '#5BC0BE'];
    let idx = subs.indexOf(name), c;
    if (idx >= 0) c = palette[idx % palette.length];
    else { let h = 0; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0; c = palette[h % palette.length]; }
    this._sc[name] = c; return c;
  },
  render_plan(box, root) {
    let plans = this.plans(); const D = window.MUMU_KAOGONG;
    // 同步：把旧的「事业编」计划统一视为 D类，并重排 D类阶段规划
    let synced = false;
    plans = plans.map(p => {
      if ((p.type || '').includes('事业编') && !(p.type || '').includes('D类')) {
        synced = true;
        return Object.assign({}, p, { type: '事业编·D类（职测D类+综应D类）', phases: this.buildPhases('事业编·D类（职测D类+综应D类）', p.hpd || 2, todayStr(), Math.max(daysBetween(todayStr(), p.date), 14)) });
      }
      return p;
    });
    if (synced) S.set('kgPlans', plans);
    const isD = plans.some(p => (p.type || '').includes('D类'));
    const teach = isD ? (D.teachersD || D.teachers) : D.teachers;
    const KEP = window.MUMU_KEPU || { updated: '-', items: [] };
    const kItems = KEP.items || [];
    const kIdx = kItems.length ? Math.floor(Date.now() / 86400000) % kItems.length : -1;
    const kToday = kIdx >= 0 ? kItems[kIdx] : null;
    const kOthers = kIdx >= 0 ? kItems.filter((_, i) => i !== kIdx).slice(0, 3) : kItems.slice(0, 3);
    box.innerHTML = `
      <div class="card"><h3>${icon('target',16)} 我的考试计划 <button class="btn sm" id="kgAddPlan" style="margin-left:auto">＋ 制定新计划</button></h3>
        ${plans.map(p => {
          const left = daysBetween(todayStr(), p.date);
          const logs = S.get('kgLogs', {});
          const mins = Object.values(logs).flat().filter(l => this.planOfRecord(l) === p.id).reduce((s, l) => s + (l.minutes || 0), 0);
          return `<div class="card" style="margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;align-items:center">
            <b>${esc(p.name)}</b>
            <span><span class="tag">${left >= 0 ? '倒计时 ' + left + ' 天' : '已过考期'}</span> <button class="del" data-delplan="${p.id}">✕</button></span></div>
          <div class="muted" style="margin:4px 0">${icon('calendar',14)} ${p.date} · ${esc(p.type)} · 已累计学习 <b>${Math.round(mins / 60 * 10) / 10}</b> 小时 / 目标 ${p.targetHours} 小时</div>
          <div class="progress-bar"><i style="width:${Math.min(100, mins / 60 / p.targetHours * 100)}%"></i></div>
          <details style="margin-top:10px"><summary style="cursor:pointer;font-weight:600;color:var(--ink)">${icon('clipboard',14)} 查看枝枝给你的阶段规划</summary>
            <div style="margin-top:8px">${p.phases.map(ph => `<div class="step-row" style="align-items:flex-start"><span>${icon(ph.icon in icons ? ph.icon : 'tag', 16)}</span><div class="stext"><b>${esc(ph.name)}</b>（${esc(ph.range)}）<br><span class="muted">${esc(ph.todo)}</span></div></div>`).join('')}</div>
          </details></div>`;
        }).join('') || '<div class="empty">还没有考试计划。点右上角，告诉我你要考哪场，我来帮你排。</div>'}
      </div>
      <div class="grid2">
        <div class="card"><h3>${icon('book',16)} 网课老师推荐（口碑之选）</h3>
          ${teach.map(t => `<div class="list-row"><div style="flex:1"><b>${esc(t.module)}</b>：${esc(t.names)}<div class="muted">${esc(t.tip)}</div></div>
          <a class="btn sm" target="_blank" href="https://search.bilibili.com/all?keyword=${encodeURIComponent(t.names.split('、')[0].replace(/（.*?）/g, ''))}">B站 ↗</a></div>`).join('')}
        </div>
        <div class="card"><h3>${icon('bulb',16)} 每日科普 <span class="muted" style="font-weight:400;font-size:11.5px;margin-left:4px">${esc(KEP.updated || '')}</span></h3>
          ${kToday ? `<div class="kb-today" style="margin-bottom:10px"><div class="kb-q">${esc(kToday.q)}</div><div class="kb-a">${esc(kToday.a)}</div></div>` : '<div class="empty">今天还没有科普内容</div>'}
          ${kOthers.map(k => `<div class="list-row" style="align-items:flex-start"><span style="color:var(--sub);margin-top:2px">${icon('sparkles',14)}</span><div style="flex:1"><b style="font-weight:600">${esc(k.q)}</b><div class="muted" style="margin-top:3px;line-height:1.5">${esc(k.a)}</div></div></div>`).join('')}
        </div>
      </div>`;
    box.querySelector('#kgAddPlan').onclick = () => this.planDialog(root);
    box.querySelectorAll('[data-delplan]').forEach(b => b.onclick = () => { S.set('kgPlans', plans.filter(x => x.id !== b.dataset.delplan)); this.render(root); });
  },
  // 生成阶段规划（D类 用职测D类+综应D类+教综，其它类别用通用文案）
  buildPhases(type, hpd, today, days) {
    const isD = type.includes('D类');
    const isSL = type.includes('申论');
    const sub1 = isD ? '职测(D类)' : type.includes('教师') ? '教基' : isSL ? '行测' : '职测';
    const sub2 = isD ? '综应(D类)' : type.includes('教师') ? '学科知识' : isSL ? '申论' : '综合应用能力';
    const seg = (a, b) => addDays(today, Math.round(days * a)) + ' ~ ' + addDays(today, Math.round(days * b));
    const r1 = Math.round(hpd * 0.7 * 10) / 10, r2 = Math.round(hpd * 0.3 * 10) / 10;
    if (isD) {
      return [
        { icon: 'book', name: '基础期（40%时间）', range: seg(0, 0.4), todo: `跟网课把职测(D类)五大模块（常识判断/言语理解/数量分析/判断推理/策略选择）各过一遍方法论，每学完一模块做50题消化；综应(D类)先学题型认知（辨析题/案例分析/教育方案设计）与教综基础（教育学、心理学、教育法规）。每天${hpd}小时：${r1}h 职测 + ${r2}h 综应/教综。` },
        { icon: 'fire', name: '强化期（30%时间）', range: seg(0.4, 0.7), todo: `职测分模块刷题（判断推理+数量分析优先，策略选择题练教育情境应对）；综应(D类)每周完整写1套真题（辨析+案例+方案设计）并对照答案改；教综口诀滚动背。时政跟着工作台每日14点更新走。` },
        { icon: 'target', name: '真题冲刺（20%时间）', range: seg(0.7, 0.9), todo: `近5年D类真题成套限时刷，职测严格掐表；综应(D类)必须动笔写完整答案（不能只看）。总结做题顺序与放弃策略；错题本二刷。` },
        { icon: 'award', name: '模考调整（10%时间）', range: seg(0.9, 1), todo: `每2天一次全真模考（按真实考试时间：职测08:30-10:00、综应10:00-12:00），调作息到考试节奏；最后3天只看错题本+教育热点（双减、新课改）。` }
      ];
    }
    return [
      { icon: 'book', name: '基础期（40%时间）', range: seg(0, 0.4), todo: `跟网课把${sub1}五大模块（言语/判断/资料/数量/常识）各过一遍方法论，每学完一模块做50题消化；${sub2}先看题型认知课，积累素材。每天${hpd}小时：${r1}h ${sub1} + ${r2}h ${sub2}/时政。` },
      { icon: 'fire', name: '强化期（30%时间）', range: seg(0.4, 0.7), todo: `分模块刷题（资料和判断优先），整理错题本；${sub2}每周完整写1套真题并批改。时政跟着工作台每日14点更新走。` },
      { icon: 'target', name: '真题冲刺（20%时间）', range: seg(0.7, 0.9), todo: `近5年真题成套限时刷，${sub1}严格掐表；总结自己的做题顺序和放弃策略；错题本二刷。` },
      { icon: 'award', name: '模考调整（10%时间）', range: seg(0.9, 1), todo: `每2天一次全真模考（按真实考试时间），调作息到考试节奏；最后3天只看错题本和时政必背。` }
    ];
  },
  planDialog(root) {
    openModal(`<button class="close-x" onclick="closeModal()">×</button><h3>${icon('target',18)} 制定考试计划</h3>
      <div class="form-row"><label>考试名称</label><input id="kpName" placeholder="例如：2027年度内蒙古事业编联考"></div>
      <div class="form-row"><label>考试日期（不确定就填预估）</label><input type="date" id="kpDate" value="${addDays(todayStr(), 90)}"></div>
      <div class="form-row"><label>考试类型</label><select id="kpType">
        <option>事业编·D类（职测D类+综应D类）</option><option>公务员省考（行测+申论）</option><option>国考（行测+申论）</option><option>教师编（教基+学科）</option></select></div>
      <div class="form-row"><label>每天能学几小时？</label><select id="kpH"><option value="2">2小时（稳妥起步·推荐）</option><option value="4">4小时</option><option value="6">6小时（全职备考）</option></select></div>
      <button class="btn" id="kpOk" style="width:100%">生成我的备考规划</button>`);
    document.getElementById('kpOk').onclick = () => {
      const name = document.getElementById('kpName').value.trim(); if (!name) return toast('先填考试名称');
      const date = document.getElementById('kpDate').value;
      const type = document.getElementById('kpType').value;
      const hpd = Number(document.getElementById('kpH').value);
      const days = Math.max(daysBetween(todayStr(), date), 14);
      const phases = this.buildPhases(type, hpd, todayStr(), days);
      const plans = this.plans();
      plans.unshift({ id: uid(), name, date, type, hpd, targetHours: Math.round(days * hpd * 0.85), phases });
      S.set('kgPlans', plans); closeModal(); this.render(root); toast('规划已生成！从今天的2小时开始');
    };
  },

  /* ---- 学习打卡 ---- */
  render_log(box, root) {
    const logs = S.get('kgLogs', {});
    const plans = this.plans();
    const countMap = {}; Object.keys(logs).forEach(d => countMap[d] = logs[d].length);
    const allL = Object.entries(logs).flatMap(([d, arr]) => arr.map(l => ({ ...l, date: d })));
    const bySub = {}; allL.forEach(l => bySub[l.subject] = (bySub[l.subject] || 0) + (l.minutes || 0));
    const totalH = Math.round(allL.reduce((s, l) => s + (l.minutes || 0), 0) / 60 * 10) / 10;
    const quizTotal = allL.reduce((s, l) => s + (l.qTotal || 0), 0);
    // 正确率模型：记「刷了几道 / 对了几道」；旧 qWrong 数据降级为 qCorrect = 总 - 错
    const quizCorrect = allL.reduce((s, l) => s + (l.qCorrect != null ? l.qCorrect : ((l.qTotal || 0) - (l.qWrong || 0))), 0);
    const quizAcc = quizTotal > 0 ? Math.round(quizCorrect / quizTotal * 100) : 0;
    const accOf = l => (l.qTotal > 0) ? Math.round(((l.qCorrect != null ? l.qCorrect : ((l.qTotal || 0) - (l.qWrong || 0))) ) / l.qTotal * 100) : 0;
    // 连续天数（休息日不计入中断）
    const _kgStData = S.get('mumu_streak', { items: [] });
    const _kgMadeup = [];
    (_kgStData.items || []).forEach(function(it){ if (it && it.type === 'kg' && it.madeup) Object.keys(it.madeup).forEach(function(d){ _kgMadeup.push(d); }); });
    const restSet = new Set([].concat(S.get('kgRest', []) || [], S.get('menstrualRest', []) || [], _kgMadeup));
    // 日历用"不含月经假"的休息集：月经假单独走 menstrualSet 上粉色，避免被 rest 绿色覆盖（火花/连续天数仍用上面的 restSet）
    const calRestSet = new Set([].concat(S.get('kgRest', []) || [], _kgMadeup));
    const todayIsRest = restSet.has(todayStr());
    let streak = 0; let d = todayStr();
    if (!((logs[d] && logs[d].length) || restSet.has(d))) d = addDays(d, -1);
    while ((logs[d] && logs[d].length) || restSet.has(d)) { streak++; d = addDays(d, -1); }
    // 日历科目图例
    const allSubs = new Set(Object.keys(bySub));
    ['言语', '判断', '资料', '数量', '常识', '申论', '综合应用能力', '时政', '面试'].forEach(s => allSubs.add(s));
    const legendHTML = [...allSubs].map(s => `<span class="sp-leg"><span class="sp-leg-dot" style="background:${this.subjectColor(s)}"></span>${esc(s)}</span>`).join('');
    // 最近学习轨迹：以「当前备考计划」为一个周期记录（只展示关联当前计划的记录；无计划时回退到全局最近）
    const curPlan = plans[0];
    const trailBase = curPlan ? allL.filter(l => this.planOfRecord(l) === curPlan.id) : allL;
    const trail = trailBase.slice().sort((a, b) => b.date.localeCompare(a.date));
    const trail2 = trail.slice(0, 2);
    const trailMore = trail.slice(2);
    box.innerHTML = `
      <div class="grid3" style="margin-bottom:14px">
        <div class="card" style="text-align:center;margin:0"><div class="stat-num">${streak}</div><div class="stat-lab">连续学习天数</div></div>
        <div class="card" style="text-align:center;margin:0"><div class="stat-num">${totalH}</div><div class="stat-lab">累计学习小时</div></div>
        <div class="card" style="text-align:center;margin:0"><div class="stat-num">${(logs[todayStr()] || []).reduce((s, l) => s + l.minutes, 0)}</div><div class="stat-lab">今日学习分钟</div></div>
      </div>
      ${quizTotal > 0 ? `<div class="muted" style="margin:-4px 0 12px">刷题累计 <b>${quizTotal}</b> 题 · 对 <b>${quizCorrect}</b> 道 · 平均正确率 <b>${quizAcc}%</b></div>` : ''}
      <div class="card"><h3>今天学了什么 <span style="margin-left:auto;display:flex;align-items:center;gap:4px"><button class="icon-btn" id="kgLogAdd" title="打卡">${icon('plus',16)}</button><button class="icon-btn" id="kgRestBtn" title="${todayIsRest ? '取消今日休息' : '今日休息'}（长按日历里那一天可补记）" style="${todayIsRest ? 'color:#e74c3c' : ''}">${icon(todayIsRest ? 'sun' : 'moon',16)}</button></span></h3>
        ${(logs[todayStr()] || []).map(l => `<div class="list-row" data-kglog="${l.id}"><span class="tag">${esc(l.subject)}</span><span class="tag" style="background:#eef">${esc(l.mode || '网课')}</span><div style="flex:1">${esc(l.content)}${l.progress ? `<div class="muted">学到：${esc(l.progress)}</div>` : ''}${l.mode === '刷题' && l.qTotal ? `<div class="muted">刷题 ${l.qTotal} 题 · 正确率 ${accOf(l)}%</div>` : ''}</div><span class="muted">${l.minutes}min</span><button class="del" data-kgdel="${l.id}" title="删除">✕</button></div>`).join('') || '<div class="empty">今天还没打卡，学完一节课就来记一笔</div>'}
        <h3 class="section-gap">各科累计投入</h3>
        ${Object.keys(bySub).length ? svgBars(Object.values(bySub).map(m => Math.round(m / 60 * 10) / 10), Object.keys(bySub)) : '<div class="empty">暂无数据</div>'}
        ${(() => { const wm = {}; allL.forEach(l => (l.qWrongTypes || []).forEach(x => { if (x && x.type) { const k = x.subj ? (x.subj + '·' + x.type) : x.type; wm[k] = (wm[k] || 0) + 1; } })); const ents = Object.entries(wm).sort((a, b) => b[1] - a[1]); if (!ents.length) return ''; const mx = ents[0][1]; return `<div class="card" style="margin-top:12px"><h3>薄弱题型</h3>${ents.map(([tp, c]) => `<div class="qt-wbar"><span class="qt-wlab">${esc(tp.split('·').pop())}</span><span class="qt-wtrack"><span class="qt-wfill" style="width:${Math.round(c / mx * 100)}%"></span></span><span class="qt-wcnt">${c}</span></div>`).join('')}<div class="muted" style="font-size:11px;margin-top:6px">统计所有「刷题」打卡里记录的错题题型，帮你定位弱项</div></div>`; })()}
      </div>
      <div class="card">
        <div class="sp-today-head"><h3>学习日历</h3><button class="icon-btn" id="kgCalLegendToggle" title="折叠/展开科目图例">▾</button></div>
        <div id="kgMonthCal"></div>
        <div class="sp-rest-note"><span class="sp-rest-sq"></span>休息<span class="muted" style="font-size:11px;margin-left:6px">· 长按日历某天可补记</span></div>
        <div class="sp-mens-note"><span class="sp-mens-sq"></span>月经假<span class="muted" style="font-size:11px;margin-left:6px">· 连续两天 · 与其他假不重叠</span></div>
        <div class="sp-legend collapsed" id="kgCalLegend">${legendHTML}</div>
      </div>
      <div class="card"><h3>学习热力图</h3><div id="kgHm"></div>
        <h3 class="section-gap">最近学习轨迹 <button class="icon-btn" id="kgPastTrails" title="往期备考计划学习轨迹" style="margin-left:auto">${icon('calendar',15)}</button></h3>
        ${curPlan ? `<div class="muted" style="font-size:11px;margin-bottom:6px">所属周期：${esc(curPlan.name)}（倒计时 ${daysBetween(todayStr(), curPlan.date)} 天）</div>` : ''}
        ${trail2.length ? trail2.map(l => `<div class="list-row kg-trail-row"><span class="tag">${l.date.slice(5)}</span><span class="tag">${esc(l.subject)}</span>${l.mode ? `<span class="tag" style="background:#eef">${esc(l.mode)}</span>` : ''}<div style="flex:1">${esc(l.content)} <span class="muted">${l.progress ? '→ ' + esc(l.progress) : ''}</span>${l.mode === '刷题' && l.qTotal ? ` · 刷题 ${l.qTotal} 题 · 正确率 ${accOf(l)}%` : ''}</div></div>`).join('') : `<div class="empty">本期计划还没有关联的学习记录。打卡时选「关联考试计划」即可归入本期轨迹；点右上角 📅 可回顾往期计划的学习轨迹。</div>`}
        ${trailMore.length ? `<details class="kg-trail-more"><summary style="cursor:pointer;color:var(--sub);font-size:13px;margin-top:6px">展开更早的 ${trailMore.length} 条轨迹</summary>${trailMore.map(l => `<div class="list-row kg-trail-row"><span class="tag">${l.date.slice(5)}</span><span class="tag">${esc(l.subject)}</span><div style="flex:1">${esc(l.content)} <span class="muted">${l.progress ? '→ ' + esc(l.progress) : ''}</span></div></div>`).join('')}</details>` : ''}
        ${plans.length ? `
          <div style="margin-top:10px;padding:10px;background:#f7f7f7;border-radius:10px">
            <div class="muted" style="font-size:11px;margin-bottom:6px">备考计划：${esc(plans[0].name)}</div>
            <div style="display:flex;gap:10px">
              <div style="flex:1;text-align:center"><div style="font-size:18px;font-weight:700;color:#111">${daysBetween(todayStr(), plans[0].date)}</div><div class="muted" style="font-size:11px">剩余天数</div></div>
              <div style="flex:1;text-align:center"><div style="font-size:18px;font-weight:700;color:#111">${plans[0].hpd}</div><div class="muted" style="font-size:11px">每日计划(小时)</div></div>
              <div style="flex:1;text-align:center"><div style="font-size:18px;font-weight:700;color:#111">${Math.max(0, plans[0].targetHours - totalH).toFixed(0)}</div><div class="muted" style="font-size:11px">还需投入(小时)</div></div>
            </div>
          </div>` : ''}
      </div>`;
    // 学习日历（各科彩色圆点 + 红色休息，复用通用月历组件，底层逻辑与运动打卡日历一致）
    const ym = todayStr().slice(0, 7);
    const marksProxy = new Proxy({}, { get(t, ds) {
      const arr = logs[ds] || [];
      if (!arr.length) return [];
      const seen = {}; const out = [];
      arr.forEach(l => { const c = KG.subjectColor(l.subject); if (!seen[c]) { seen[c] = 1; out.push(c); } });
      return out;
    }});
    renderMonthCal(box.querySelector('#kgMonthCal'), { ym, marks: marksProxy, restSet: calRestSet, menstrualSet: menstrualSet(), onLongPress: ds => openRestMenu(ds, 'kaogong', () => this.render(root), d => this.toggleRest(root, d)) });
    const calLegendTgl = box.querySelector('#kgCalLegendToggle');
    const calLegendEl = box.querySelector('#kgCalLegend');
    if (calLegendTgl) calLegendTgl.onclick = () => { calLegendEl.classList.toggle('collapsed'); calLegendTgl.textContent = calLegendEl.classList.contains('collapsed') ? '▾' : '▸'; };
    const restBtn = box.querySelector('#kgRestBtn');
    if (restBtn) restBtn.onclick = () => this.toggleRest(root);
    const pastBtn = box.querySelector('#kgPastTrails');
    if (pastBtn) pastBtn.onclick = () => this.pastTrailsModal();

    // 热力图：三个月并排
    const kgHmEl = box.querySelector('#kgHm');
    kgHmEl._hm = { months: 3 };
    renderHeatmap(kgHmEl, countMap);
    box.querySelector('#kgLogAdd').onclick = () => {
      openModal(`<button class="close-x" onclick="closeModal()">×</button><h3>${icon('check',18)} 学习打卡</h3>
        <div class="form-row"><label>科目</label><select id="klSub"><option>言语</option><option>判断</option><option>资料</option><option>数量</option><option>常识</option><option>申论</option><option>综合应用能力</option><option>时政</option><option>面试</option></select></div>
        <div class="form-row"><label>学习方式</label><select id="klMode"><option value="网课">网课</option><option value="刷题">刷题</option></select></div>
        <div class="form-row" id="klConWrap"><label>学了什么</label><input id="klCon" placeholder="例如：欣说言语 第3课 中心理解题"></div>
        <div class="form-row" id="klProgWrap"><label>学到哪儿了（进度标记·网课用）</label><input id="klProg" placeholder="例如：看完P3，做题30道，正确率70%"></div>
        <div class="form-row"><label>时长（分钟）</label><input type="number" id="klMin" value="60"></div>
        <div id="klQuizWrap" style="display:none">
          <div class="form-row"><label>刷了几道题</label><input type="number" id="klQ" placeholder="例如：50"></div>
          <div class="form-row"><label>对了几道</label><input type="number" id="klC" placeholder="例如：42"></div>
          <div id="klWrongWrap"></div>
        </div>
        <div class="form-row"><label>关联考试计划</label><select id="klPlan"><option value="">不关联</option>${this.plans().map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></div>
        <button class="btn" id="klOk" style="width:100%">打卡</button>`);
      const klModeEl = document.getElementById('klMode');
      const klSubEl = document.getElementById('klSub');
      const curSub = () => (klSubEl ? klSubEl.value : '言语');
      if (klModeEl) klModeEl.onchange = () => { const quiz = document.getElementById('klQuizWrap'); const prog = document.getElementById('klProgWrap'); const wrong = document.getElementById('klWrongWrap'); const conWrap = document.getElementById('klConWrap'); if (quiz) quiz.style.display = klModeEl.value === '刷题' ? '' : 'none'; if (prog) prog.style.display = klModeEl.value === '刷题' ? 'none' : ''; if (conWrap) conWrap.style.display = klModeEl.value === '刷题' ? 'none' : ''; if (wrong) KG.renderWrong(wrong, klModeEl.value === '刷题' ? Math.max(0, (Number(document.getElementById('klQ').value) || 0) - (Number(document.getElementById('klC').value) || 0)) : 0, [], curSub()); };
      const klQEl = document.getElementById('klQ'), klCEl = document.getElementById('klC');
      const reRenderWrong = () => { const wrong = document.getElementById('klWrongWrap'); if (wrong) KG.renderWrong(wrong, Math.max(0, (Number(klQEl.value) || 0) - (Number(klCEl.value) || 0)), KG.readWrong(wrong, curSub()), curSub()); };
      // 换科目则清空已选题型（不同科目题型不同，保留会串）
      const onSubChange = () => { const wrong = document.getElementById('klWrongWrap'); if (wrong) KG.renderWrong(wrong, Math.max(0, (Number(klQEl.value) || 0) - (Number(klCEl.value) || 0)), [], curSub()); };
      if (klQEl) klQEl.oninput = reRenderWrong;
      if (klCEl) klCEl.oninput = reRenderWrong;
      if (klSubEl) klSubEl.onchange = onSubChange;
      document.getElementById('klOk').onclick = () => {
        const kgSub = document.getElementById('klSub').value;
        const kgMode = document.getElementById('klMode').value;
        const kgQ = kgMode === '刷题' ? (Number(document.getElementById('klQ').value) || 0) : 0;
        const conRaw = document.getElementById('klCon').value.trim();
        let con;
        if (kgMode === '刷题') { con = conRaw || (kgQ ? '刷题 ' + kgQ + ' 题' : kgSub); }
        else { if (!conRaw) return toast('记一下学了什么吧'); con = conRaw; }
        const lg = S.get('kgLogs', {}); lg[todayStr()] = lg[todayStr()] || [];
        const kgProg = document.getElementById('klProg').value.trim();
        const kgMin = Number(document.getElementById('klMin').value) || 0;
        const kgC = kgMode === '刷题' ? (Number(document.getElementById('klC').value) || 0) : 0;
        if (kgC > kgQ) return toast('对的题数不能超过刷的总题数哦～');
        const kgWrong = kgMode === '刷题' ? KG.readWrong(document.getElementById('klWrongWrap'), kgSub) : [];
        const cid = uid();
        lg[todayStr()].push({ id: cid, srcId: cid, subject: kgSub, mode: kgMode, content: con, progress: kgProg, minutes: kgMin, qTotal: kgQ, qCorrect: kgC, qWrongTypes: kgWrong.length ? kgWrong : undefined, planId: document.getElementById('klPlan').value, time: new Date().toTimeString().slice(0, 5) });
        S.set('kgLogs', lg); closeModal();
        const extra = { '科目': kgSub, '方式': kgMode, '内容': con, '时长': kgMin + '分钟' };
        if (kgMode === '网课' && kgProg) extra['学到哪里'] = kgProg;
        if (kgMode === '刷题') { const acc = kgQ > 0 ? Math.round(kgC / kgQ * 100) : 0; extra['做题'] = kgQ + ' 题'; extra['对题'] = kgC + ' 道'; extra['正确率'] = acc + '%'; extra['错题题型'] = kgWrong.map(x => x.type).join('、') || '-'; }
        if (window.Daily) window.Daily.autoFromColumn('kaogong:study', todayStr(), con, null, extra, cid);
        this.render(root); toast('已打卡，积少成多');
      };
    };
    // 今天学了什么：✕ 按钮 + 长按均可删除（同步清掉自动写入每日计划的关联记录由每日计划侧处理）
    const delKgLog = (id) => { const lg = S.get('kgLogs', {}); const d = todayStr(); if (lg[d]) { lg[d] = lg[d].filter(l => l.id !== id); S.set('kgLogs', lg); } };
    box.querySelectorAll('[data-kgdel]').forEach(b => b.onclick = e => { e.stopPropagation(); delKgLog(b.dataset.kgdel); this.render(root); toast('已删除该条学习记录'); });
    box.querySelectorAll('[data-kglog]').forEach(row => {
      let timer = null;
      const start = () => { timer = setTimeout(() => { if (confirm('删除这条学习记录？')) { delKgLog(row.dataset.kglog); this.render(root); } }, 550); };
      const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };
      row.addEventListener('touchstart', start, { passive: true });
      row.addEventListener('touchend', cancel);
      row.addEventListener('touchmove', cancel);
      row.addEventListener('mousedown', start);
      row.addEventListener('mouseup', cancel);
      row.addEventListener('mouseleave', cancel);
    });
  },

  /* ---- 备考搭子（已移除：用户认为用处不大） ---- */

  // 备考打卡页「今日休息」：直接写 kgRest 数组，不计入连续学习中断（一周最多 1 天，一月最多 4 天）
  // ds 缺省为今天；传入过去日期即可「补记」休息（连续学习天数自动续上）
  toggleRest(root, ds) {
    ds = ds || todayStr();
    if (ds > todayStr()) { toast('不能给未来的日期设休息'); return; }
    const set = _restSet('kaogong');
    const D = window.Daily;
    if (set.has(ds)) {
      restRemove('kaogong', ds);
      if (D) { const arr = D.list(ds); arr.forEach(t => { if (t.cat === 'kaogong') t.restDay = false; }); D.setList(ds, arr); }
      toast('已取消 ' + fmtCN(ds) + ' 的休息 · 连续学习重新计算');
    } else {
      if (menstrualSet().has(ds)) { toast(fmtCN(ds) + ' 已是月经假，不再叠加其他休息'); return; }
      const lg = S.get('kgLogs', {});
      if (lg[ds] && lg[ds].length) { toast(fmtCN(ds) + ' 已经有学习打卡，不能设为休息'); return; }
      const chk = restCanAdd('kaogong', ds);
      if (!chk.ok) { toast(chk.msg); return; }
      restAdd('kaogong', ds);
      if (D) { const arr = D.list(ds); arr.forEach(t => { if (t.cat === 'kaogong') t.restDay = true; }); D.setList(ds, arr); }
      toast('已将 ' + fmtCN(ds) + ' 设为休息日 · 连续学习不受影响');
    }
    this.render(root);
  },

  // 往期备考计划学习轨迹：按 planId 聚合各周期的学习记录（已结束的计划也能回看）
  pastTrailsModal() {
    const plans = this.plans();
    const logs = S.get('kgLogs', {});
    const allL = Object.entries(logs).flatMap(([d, arr]) => arr.map(l => ({ ...l, date: d })));
    let html = `<button class="close-x" onclick="closeModal()">×</button><h3>${icon('calendar',18)} 往期备考计划 · 学习轨迹</h3>
      <div class="muted" style="margin-bottom:10px">按「关联考试计划」归档，每个周期独立回看；未关联的记录在底部。</div>`;
    if (!plans.length) {
      html += '<div class="empty">还没有备考计划。制定后在打卡页关联它，就能按周期回看学习轨迹。</div>';
    } else {
      html += plans.map(p => {
        const ended = p.date < todayStr();
        const recs = allL.filter(l => this.planOfRecord(l) === p.id).sort((a, b) => b.date.localeCompare(a.date));
        const mins = recs.reduce((s, l) => s + (l.minutes || 0), 0);
        return `<div class="card" style="margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;gap:6px;align-items:center;flex-wrap:wrap">
            <b>${esc(p.name)}</b>
            <span><span class="tag">${ended ? '已结束' : '进行中'}</span><span class="tag">${esc(p.date)}</span></span>
          </div>
          <div class="muted" style="margin:4px 0">${recs.length} 条学习记录 · 累计 ${Math.round(mins / 60 * 10) / 10} 小时 / 目标 ${p.targetHours} 小时</div>
          ${recs.length ? recs.map(l => `<div class="list-row"><span class="tag">${l.date.slice(5)}</span><span class="tag">${esc(l.subject)}</span><div style="flex:1">${esc(l.content)} <span class="muted">${l.progress ? '→ ' + esc(l.progress) : ''}</span></div><span class="muted">${l.minutes}min</span></div>`).join('') : '<div class="empty" style="margin:6px 0">本期还没有关联的学习记录</div>'}
        </div>`;
      }).join('');
    }
    const unlinked = allL.filter(l => this.planOfRecord(l) === null).sort((a, b) => b.date.localeCompare(a.date));
    if (unlinked.length) {
      html += `<details class="card" style="margin-top:6px"><summary style="cursor:pointer;font-weight:600">未关联备考计划的学习记录（${unlinked.length}条）</summary>
        ${unlinked.slice(0, 60).map(l => `<div class="list-row"><span class="tag">${l.date.slice(5)}</span><span class="tag">${esc(l.subject)}</span><div style="flex:1">${esc(l.content)} <span class="muted">${l.progress ? '→ ' + esc(l.progress) : ''}</span></div><span class="muted">${l.minutes}min</span></div>`).join('')}
      </details>`;
    }
    openModal(html);
  },

  /* ---- 时政 ---- */
  render_sz(box) {
    const D = window.MUMU_SHIZHENG || { items: [], must_know: [], updated: '-', history: [] };
    const learned = S.get('szLearned', {});
    const deleted = S.get('szDeleted', {});
    box.innerHTML = `

      <div class="card"><h3>${icon('star',16)} 今日必背</h3>
        ${D.must_know.map(m => `<div class="banner warn" style="margin-bottom:8px">${esc(m)}</div>`).join('')}
      </div>
      <details class="card" open><summary style="cursor:pointer;font-weight:600;display:flex;align-items:center;gap:6px">${icon('clipboard',16)} 时政要闻 & 考点提炼（${D.items.filter((_, i) => !deleted[D.updated + '_' + i]).length}条）<span class="car">▾</span></summary>
        ${D.items.map((it, i) => { const k = D.updated + '_' + i; if (deleted[k]) return ''; const ok = learned[k]; return `<div class="step-row ${ok ? 'done' : ''}" style="align-items:flex-start">
          <input type="checkbox" ${ok ? 'checked' : ''} data-sz="${k}" title="已掌握">
          <div class="stext" style="flex:1"><b>${esc(it.title)}</b><div class="muted">${esc(it.brief)}</div>
          <div style="font-size:12.5px;margin-top:3px;color:var(--sub)">${icon('target',12)} ${esc(it.point)}</div></div>
          <button class="del" data-szdel="${k}" title="删掉">✕</button></div>`; }).join('')}
      </details>
      ${(D.history || []).length ? `<div class="card"><h3>${icon('archive' in icons ? 'archive' : 'book', 16)} 历史时政</h3>${D.history.map(h => { const vis = h.items.map((it, j) => ({ it, j })).filter(o => !deleted[h.date + '_' + o.j]); return vis.length ? `<details style="margin-bottom:8px"><summary style="cursor:pointer">${esc(h.date)}（${vis.length}条）</summary>${vis.map(o => { const k = h.date + '_' + o.j; const ok = learned[k]; return `<div class="step-row ${ok ? 'done' : ''}" style="align-items:flex-start">
          <input type="checkbox" ${ok ? 'checked' : ''} data-sz="${k}" title="已掌握">
          <div class="stext" style="flex:1"><b>${esc(o.it.title)}</b><div class="muted">${icon('target',12)} ${esc(o.it.point)}</div></div>
          <button class="del" data-szdel="${k}" title="删掉">✕</button></div>`; }).join('')}</details>` : ''; }).join('')}</div>` : ''}`;
    box.querySelectorAll('[data-sz]').forEach(cb => cb.onchange = () => {
      const l = S.get('szLearned', {}); l[cb.dataset.sz] = cb.checked; S.set('szLearned', l); this.render_sz(box);
    });
    box.querySelectorAll('[data-szdel]').forEach(b => b.onclick = () => {
      const l = S.get('szDeleted', {}); l[b.dataset.szdel] = 1; S.set('szDeleted', l); this.render_sz(box);
    });
  },

  /* ---- 备考搭子（已移除：用户认为用处不大） ---- */
};
window.Modules.kaogong = { render: r => KG.render(r) };
window.KG = KG;
