/* ============ 理财 ============ */
const Finance = {
  sub: 'snapshot',
  _root: null,
  labels: { snapshot: '财务快照', fund: '基金分析', learn: '理财学习', system: '理财体系' },
  render(root) {
    if (!this.sub) this.sub = 'snapshot';
    this._root = root;
    root.innerHTML = `<div id="finBody"></div>`;
    const body = root.querySelector('#finBody');
    if (this.sub === 'snapshot') this.renderSnapshot(body);
    else if (this.sub === 'fund') this.renderFund(body);
    else if (this.sub === 'learn') this.renderLearn(body);
    else if (this.sub === 'system') this.renderSystem(body);
    root.insertAdjacentHTML('beforeend', this.financeNavHTML());
    this.bindFinNav(root);
  },
  financeNavHTML() {
    const items = [['snapshot', '财务快照'], ['fund', '基金分析'], ['learn', '理财学习'], ['system', '理财体系']];
    return `<div class="subnav">${items.map(([k, l]) => `<button class="${this.sub === k ? 'on' : ''}" data-fsub="${k}">${l}</button>`).join('')}</div>`;
  },
  bindFinNav(root) {
    root.querySelectorAll('[data-fsub]').forEach(b => b.onclick = () => { this.sub = b.dataset.fsub; this.render(root); });
  },
  /* ---------- 0. 财务快照 ---------- */
  renderSnapshot(body) {
    const s = S.get('finSnapshot', null) || {
      debt: '', income: [{ name: '内容变现', amount: '' }, { name: '家人支持', amount: '' }], expense: '', cash: ''
    };
    // 单向同步：创作收入（本月结算）→ 内容变现（在创作记录即可，不用在财务再记一遍）
    const ym = todayStr().slice(0, 7);
    const cet = window.Work ? window.Work.creationTotal(ym) : 0;    // 本月结算
    const cetAll = window.Work ? window.Work.creationTotal() : 0;   // 累计（仅作提示，不影响合计）
    let cv = (s.income || []).find(x => x.name === '内容变现');
    if (cv) cv.amount = cet; else { s.income = (s.income || []).concat([{ name: '内容变现', amount: cet }]); }
    S.set('finSnapshot', s);
    const incSum = (s.income || []).reduce((a, x) => a + (Number(x.amount) || 0), 0);
    const exp = Number(s.expense) || 0;
    const bal = incSum - exp;
    const cash = Number(s.cash) || 0;
    const debt = Number(s.debt) || 0;
    const cover = exp > 0 ? cash / exp : 0;
    let level, advice;
    if (bal < 0) { level = '入不敷出'; advice = '当前收入覆盖不了支出。先别急着投资或还债，最要紧的是：① 用记账搞清楚钱具体去哪了；② 在不影响基本生活前提下，尽量挤一点进应急金，先稳住现金流。'; }
    else if (debt > 0 && bal < exp * 0.2) { level = '勉强结余'; advice = '有结余但很薄。顺序：先存一笔应急金（目标 3-6 个月支出）→ 再用多余的钱还高息债务 → 投资等应急金建立后再小额开始。'; }
    else if (debt > 0) { level = '结余可规划'; advice = '现金流为正、有结余。可按顺序推进：应急金 → 还高息债 → 指数基金定投。'; }
    else { level = '无负债积累期'; advice = '没有债务、现金流为正，是很稳的起点。按顺序：应急金 → 长期定投，慢慢把雪球滚起来。'; }
    body.innerHTML = `
      <div class="card">
        <h3>我的财务现状</h3>
        <div class="form-row"><label>当前外债总额（元）</label><input id="fsDebt" type="number" min="0" value="${debt}" placeholder="例如：50000"></div>
        <div style="margin:10px 0 4px" class="muted">每月收入来源</div>
        <div id="fsInc"></div>
        <div class="muted" style="font-size:11px;margin:-2px 0 8px">内容变现取「本月结算」的创作收入，累计 ¥${cetAll}</div>
        <button class="btn sm ghost" id="fsAddInc" style="margin-top:6px">＋ 添加来源</button>
        <div class="form-row" style="margin-top:10px"><label>每月必要支出（元）</label><input id="fsExp" type="number" min="0" value="${exp}" placeholder="房租+吃饭+交通…"></div>
        <div class="form-row"><label>当前可用资金 / 活期（元）</label><input id="fsCash" type="number" min="0" value="${cash}" placeholder="手头能马上用的钱"></div>
      </div>
      <div class="card">
        <h3>本月一眼看清</h3>
        <div class="stat-combined">
          <div class="sc-half"><div class="sc-val">${incSum}</div><div class="sc-lab">月收入合计</div></div>
          <div class="sc-half"><div class="sc-val" style="color:${bal < 0 ? '#c0392b' : '#2e7d57'}">${bal}</div><div class="sc-lab">月结余</div></div>
        </div>
        <div style="margin-top:8px">
          <div class="list-row"><span class="muted">负债</span><b>${debt} 元</b></div>
          <div class="list-row"><span class="muted">应急金覆盖</span><b>${cover.toFixed(1)} 个月支出</b></div>
        </div>
      </div>
      <div class="fin-advice">
        <span class="fa-tag" style="background:${bal < 0 ? '#c0392b' : (debt > 0 ? '#b9770e' : '#2e7d57')}">${level}</span>
        <div class="fa-text">${advice}</div>
      </div>
      <div class="muted" style="font-size:12px;margin-top:8px;text-align:center">本月结余 ${bal} 元 · 应急金可覆盖 ${cover.toFixed(1)} 个月必要支出 · 当前外债 ${debt} 元</div>`;
    // 收入来源行
    const incBox = body.querySelector('#fsInc');
    const paintInc = () => {
      incBox.innerHTML = (s.income || []).map((x, i) => { const sync = x.name === '内容变现'; return `<div style="display:flex;gap:6px;margin-bottom:6px;align-items:center">
        <input id="fsIncN${i}" value="${esc(x.name)}" placeholder="来源名" style="flex:1.2" ${sync ? 'readonly' : ''}>
        <input id="fsIncA${i}" type="number" min="0" value="${x.amount}" placeholder="金额" style="flex:1" ${sync ? 'readonly title="由创作收入自动同步"' : ''}>
        <button class="del" data-incdel="${i}" ${sync ? 'style="visibility:hidden"' : ''}>✕</button></div>`; }).join('');
      incBox.querySelectorAll('[data-incdel]').forEach(b => b.onclick = () => { s.income.splice(Number(b.dataset.incdel), 1); this._saveSnap(s, body); });
    };
    paintInc();
    body.querySelector('#fsAddInc').onclick = () => { s.income.push({ name: '', amount: '' }); this._saveSnap(s, body); };
    const reBindInc = () => {
      (s.income || []).forEach((x, i) => {
        const n = body.querySelector('#fsIncN' + i), a = body.querySelector('#fsIncA' + i);
        if (n) n.onchange = () => { s.income[i].name = n.value; this._saveSnap(s, body); };
        if (a) a.onchange = () => { s.income[i].amount = a.value; this._saveSnap(s, body); };
      });
    };
    reBindInc();
    const bind = (id, key) => { const el = body.querySelector(id); if (el) el.onchange = () => { s[key] = el.value; this._saveSnap(s, body); }; };
    bind('#fsDebt', 'debt'); bind('#fsExp', 'expense'); bind('#fsCash', 'cash');
  },
  _saveSnap(s, body) {
    S.set('finSnapshot', s);
    this.renderSnapshot(body);
  },
  /* ---------- 1. 基金分析 ---------- */
  renderFund(body) {
    const funds = S.get('finFunds', null);
    if (!funds) {
      // 首次：用木木真实持有的一只基金做种子（成本300多、盈利2块多），金额留空让她自己填最新市值
      const seed = [{ id: uid(), name: '持仓基金（待填）', code: '', shares: '', costTotal: '', currentValue: '', buyDate: '', note: '我目前持有一只300多元买的小基金，拿很久了，目前算下来赚了两块多。' }];
      S.set('finFunds', seed); return this.renderFund(body);
    }
    const list = funds;
    const kb = [
      { icon: '📈', t: '定投', d: '不在意短期涨跌，固定周期（如每月）买一点，跌时多买份额、涨时少买，长期摊平成本。', link: 'https://www.bilibili.com/search?keyword=指数基金定投入门' },
      { icon: '🔍', t: '低估', d: '指数估值低时（如市盈率处于历史偏低）更适合分批买；追涨杀跌是大忌。', link: 'https://www.bilibili.com/search?keyword=基金估值怎么看' },
      { icon: '🎯', t: '止盈', d: '设一个目标收益率（常见 20%~30%），到达后分批卖、不贪心；止损看是否能承受、是否急用钱。', link: 'https://www.bilibili.com/search?keyword=基金止盈策略' },
      { icon: '⚖️', t: '资产配置', d: '股票 / 债券 / 现金按比例搭配，别 All in 单一品种，波动更平滑。', link: 'https://www.bilibili.com/search?keyword=资产配置基础' },
      { icon: '🛡️', t: '先保人', d: '基础医保 / 意外险到位再谈投资，保险不能替代应急金。', link: 'https://www.bilibili.com/search?keyword=保险基础小白' }
    ];
    const kbCard = k => `<a class="fund-kb-item" href="${k.link}" target="_blank" rel="noopener"><span class="kb-ic">${k.icon}</span><span class="kb-t">${esc(k.t)}</span><span class="kb-d">${esc(k.d)}</span><span class="kb-go">↗</span></a>`;
    body.innerHTML = `
      <div class="card"><h3>我的基金 ${list.length ? '' : '<button class="btn sm" id="fdAdd" style="margin-left:auto">＋ 添加</button>'}</h3>
        ${list.length ? list.map(f => this.fundCard(f)).join('') : '<div class="empty">还没有记录，点上面＋添加你的基金</div>'}
        ${list.length ? '<button class="btn sm" id="fdAdd" style="margin-top:8px">＋ 添加基金</button>' : ''}
      </div>
      <details class="card fund-kb-wrap" open><summary><h3 style="display:inline">基金小知识</h3><span class="car">▾</span></summary>
        <div class="fund-kb">
          ${kb.slice(0, 2).map(k => kbCard(k)).join('')}
          <details class="fund-kb-more"><summary>查看更多小知识 ▾</summary>
            ${kb.slice(2).map(k => kbCard(k)).join('')}
          </details>
        </div>
      </details>`;
    body.querySelector('#fdAdd').onclick = () => this.fundDialog(body);
    list.forEach(f => {
      const e = body.querySelector('#fdEdit' + f.id); if (e) e.onclick = () => this.fundDialog(body, f);
      const sy = body.querySelector('#fdSync' + f.id); if (sy) sy.onclick = () => this.syncFund(f, body);
      const d = body.querySelector('#fdDel' + f.id); if (d) d.onclick = () => {
        if (!confirm('删除这只基金记录？')) return;
        S.set('finFunds', S.get('finFunds').filter(x => x.id !== f.id)); this.renderFund(body); toast('已删除');
      };
    });
  },
  fundCard(f) {
    const cost = Number(f.costTotal) || 0, val = Number(f.currentValue) || 0;
    const rate = cost > 0 ? (val - cost) / cost * 100 : 0;
    const profit = val - cost;
    const tips = this.fundAdvice(f, cost, val, rate, profit);
    const hist = (f.navHistory && f.navHistory.length) ? f.navHistory : [];
    const spark = hist.length >= 2 ? this.fundSpark(hist) : '';
    const lastSync = hist.length ? hist[hist.length - 1].date : '';
    return `<div class="card" style="margin:0 0 10px">
      <div style="display:flex;align-items:center;gap:8px"><b>${esc(f.name || '未命名')}</b>${f.code ? `<span class="muted">${esc(f.code)}</span>` : ''}
        <span style="margin-left:auto;display:flex;gap:6px">${f.code ? `<button class="icon-btn" id="fdSync${f.id}" title="同步最新净值" aria-label="同步最新净值">${icon('refresh',14)}</button>` : ''}<button class="icon-btn" id="fdEdit${f.id}" title="编辑" aria-label="编辑">${icon('edit',15)}</button><button class="del" id="fdDel${f.id}">✕</button></span></div>
      <div class="stat-combined" style="margin-top:8px">
        <div class="sc-half"><div class="sc-val">${cost}</div><div class="sc-lab">累计成本</div></div>
        <div class="sc-half"><div class="sc-val" style="color:${profit >= 0 ? '#2e7d57' : '#c0392b'}">${profit >= 0 ? '+' : ''}${profit.toFixed(2)}</div><div class="sc-lab">当前盈亏（${profit >= 0 ? '+' : ''}${rate.toFixed(1)}%）</div></div>
      </div>
      <div class="muted" style="margin-top:4px">持仓份额 ${esc(f.shares || '-')} · 当前市值 ${val || '-'} · 买入 ${esc(f.buyDate || '-')}</div>
      ${spark ? `<div style="margin-top:8px"><div class="muted" style="font-size:11px;margin-bottom:3px">净值走势${lastSync ? '（' + esc(lastSync) + ' 起）' : ''} · 同步后更新</div>${spark}</div>` : ''}
      ${f.note ? `<div class="muted" style="margin-top:4px;white-space:pre-wrap;font-size:12px">${esc(f.note)}</div>` : ''}
      <div style="margin-top:8px" class="fund-tips">${tips.map(t => `<details class="fund-tip" open><summary><span class="ft-t">${esc(t.t)}</span><span class="car">▾</span></summary><div class="ft-d">${esc(t.d)}</div></details>`).join('')}</div>
    </div>`;
  },
  // 迷你净值走势（sparkline）：观测基金随每日同步浮动的趋势
  fundSpark(hist) {
    const vals = hist.map(h => Number(h.value) || 0);
    const min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    const W = 240, H = 40, pad = 4;
    const span = (max - min) || 1;
    const pts = vals.map((v, i) => {
      const x = pad + (vals.length === 1 ? 0 : (i / (vals.length - 1)) * (W - pad * 2));
      const y = H - pad - ((v - min) / span) * (H - pad * 2);
      return x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');
    const up = vals[vals.length - 1] >= vals[0];
    const color = up ? '#2e7d57' : '#c0392b';
    const lastXY = pts.split(' ').pop().split(',');
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" preserveAspectRatio="none" style="display:block">
      <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${lastXY[0]}" cy="${lastXY[1]}" r="2.6" fill="${color}"/>
    </svg>`;
  },
  // 同步最新单位净值（天天基金 pingzhongdata，纯前端 JSONP；有代码才能同步）
  async syncFund(f, body) {
    if (!f.code) { toast('填基金代码才能同步'); return; }
    toast('同步中…');
    try {
      const d = await this._fetchNav(f.code);
      const nav = Number(d.nav);
      if (!nav) throw new Error('未取到净值');
      const shares = Number(f.shares) || 0;
      const val = shares > 0 ? nav * shares : (Number(f.currentValue) || 0);
      const all = S.get('finFunds', []);
      const rec = all.find(x => x.id === f.id);
      if (rec) {
        rec.currentValue = val.toFixed(2);
        rec.navHistory = rec.navHistory || [];
        const last = rec.navHistory[rec.navHistory.length - 1];
        if (last && last.date === d.date) last.value = val; else rec.navHistory.push({ date: d.date, value: val, nav: nav });
        if (rec.navHistory.length > 60) rec.navHistory = rec.navHistory.slice(-60);
        S.set('finFunds', all);
      }
      this.renderFund(body);
      toast('已同步：最新净值 ' + nav + (d.date ? '（' + d.date + '）' : ''));
    } catch (e) {
      toast('同步失败：' + e.message);
    }
  },
  // 天天基金净值接口：注入 pingzhongdata/<code>.js，脚本执行后全局 Data_netWorthTrend 末项即最新单位净值
  _fetchNav(code) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      let done = false;
      const cleanup = () => { if (s.parentNode) s.parentNode.removeChild(s); };
      s.onload = () => {
        if (done) return; done = true; cleanup();
        try {
          const arr = window.Data_netWorthTrend;
          if (!arr || !arr.length) throw new Error('接口未返回数据');
          const last = arr[arr.length - 1];
          const nav = Number(last.y);
          const date = last.x ? new Date(last.x).toISOString().slice(0, 10) : todayStr();
          resolve({ nav: nav, date: date });
        } catch (err) { reject(err); }
      };
      s.onerror = () => { if (done) return; done = true; cleanup(); reject(new Error('网络错误，无法加载净值接口')); };
      s.src = 'https://fund.eastmoney.com/pingzhongdata/' + encodeURIComponent(code) + '.js?_=' + Date.now();
      document.head.appendChild(s);
      setTimeout(() => { if (done) return; done = true; cleanup(); reject(new Error('请求超时，请稍后重试')); }, 9000);
    });
  },
  fundAdvice(f, cost, val, rate, profit) {
    const tips = [];
    if (cost > 0 && val > 0) {
      if (rate >= 20) tips.push({ t: '止盈参考', d: `当前收益率约 +${rate.toFixed(1)}%，到了常见止盈区间。若急用钱或觉得估值偏高，可分批卖出锁定收益，不必一次清仓。` });
      else if (rate <= -10) tips.push({ t: '加仓参考', d: `当前收益率约 ${rate.toFixed(1)}%，若长期看好、已有应急金且不影响生活，可在下跌时分批小额定投摊低成本；切忌借钱加仓或一次性重仓。` });
      else tips.push({ t: '持有观察', d: `当前收益率约 ${rate.toFixed(1)}%，处于小幅波动区间，小额基金不必频繁操作，继续观察即可。` });
    } else {
      tips.push({ t: '补全数据', d: '填一下「累计成本」和「当前市值」，我才能帮你算收益率和给加仓/出售建议。市值可在基金 App 里查到。' });
    }
    tips.push({ t: '你的现状提示', d: `你外债在身、月结余有限，这只基金（成本 ${cost || '?'} 元、现盈利约 ${profit.toFixed(2)} 元）规模很小，长期持有的意义主要是「练手+理解市场」，别指望它赚钱翻身。资金优先级：先应急金 → 再还高息债 → 最后才考虑加仓。` });
    return tips;
  },
  fundDialog(body, edit) {
    const f = edit || { name: '', code: '', shares: '', costTotal: '', currentValue: '', buyDate: '', note: '' };
    openModal(`<button class="close-x" onclick="closeModal()">×</button><h3>基金${edit ? ' · 编辑' : ' · 添加'}</h3>
      <div class="form-row"><label>基金名称</label><input id="fdName" value="${esc(f.name)}" placeholder="例如：沪深300ETF联接"></div>
      <div class="form-row"><label>基金代码（选填）</label><input id="fdCode" value="${esc(f.code)}" placeholder="如：110020"></div>
      <div class="form-row"><label>持仓份额（选填）</label><input id="fdShares" value="${esc(f.shares)}" placeholder="份"></div>
      <div class="form-row"><label>累计投入成本（元）</label><input id="fdCost" type="number" min="0" value="${esc(f.costTotal)}" placeholder="你一共投进去多少"></div>
      <div class="form-row"><label>当前市值（元）</label><input id="fdVal" type="number" min="0" value="${esc(f.currentValue)}" placeholder="现在值多少（基金App查）"></div>
      <div class="form-row"><label>买入日期（选填）</label><input id="fdDate" type="date" value="${esc(f.buyDate)}" max="${todayStr()}"></div>
      <div class="form-row"><label>备注（选填）</label><textarea id="fdNote" rows="2" placeholder="你的想法、为什么买、打算怎么处理…">${esc(f.note)}</textarea></div>
      <button class="btn" id="fdOk" style="width:100%;margin-top:12px">${edit ? '保存' : '添加'}</button>`);
    document.getElementById('fdOk').onclick = () => {
      const rec = {
        id: f.id || uid(),
        name: document.getElementById('fdName').value.trim() || '未命名',
        code: document.getElementById('fdCode').value.trim(),
        shares: document.getElementById('fdShares').value.trim(),
        costTotal: document.getElementById('fdCost').value.trim(),
        currentValue: document.getElementById('fdVal').value.trim(),
        buyDate: document.getElementById('fdDate').value.trim(),
        note: document.getElementById('fdNote').value.trim()
      };
      const all = S.get('finFunds', []);
      let recRef = null;
      if (edit) { const i = all.findIndex(x => x.id === f.id); if (i >= 0) { all[i] = Object.assign({}, all[i], rec); recRef = all[i]; } }
      else { all.push(rec); recRef = rec; }
      // 记录净值历史（用于走势观测）：同一天覆盖，跨天追加，最多保留 60 点
      if (recRef) {
        const cv = Number(recRef.currentValue) || 0;
        recRef.navHistory = recRef.navHistory || [];
        const tday = todayStr();
        const lst = recRef.navHistory[recRef.navHistory.length - 1];
        if (lst && lst.date === tday) lst.value = cv; else recRef.navHistory.push({ date: tday, value: cv });
        if (recRef.navHistory.length > 60) recRef.navHistory = recRef.navHistory.slice(-60);
      }
      S.set('finFunds', all); closeModal(); this.renderFund(body); toast('已保存');
    };
  },
  /* ---------- 2. 理财学习（输入 + 输出） ---------- */
  renderLearn(body) {
    let inList = S.get('finLearnIn', null);
    if (!inList) {
      inList = [
        { id: uid(), topic: '记账与账单分析：先搞清钱去哪了', status: 'want', note: '' },
        { id: uid(), topic: '应急金是什么、存多少（3-6 个月支出）', status: 'want', note: '' },
        { id: uid(), topic: '复利与时间的力量', status: 'want', note: '' },
        { id: uid(), topic: '指数基金定投入门', status: 'want', note: '' },
        { id: uid(), topic: '资产配置基础：股票 / 债券 / 现金', status: 'want', note: '' },
        { id: uid(), topic: '债务管理：雪球法 vs 雪崩法', status: 'want', note: '' },
        { id: uid(), topic: '保险基础：先保人再保钱', status: 'want', note: '' },
        { id: uid(), topic: '消费观：需要 vs 想要', status: 'want', note: '' }
      ];
      S.set('finLearnIn', inList);
    }
    const outList = S.get('finLearnOut', []);
    const stMap = { want: '想学', doing: '在学', done: '已学' };
    const total = inList.length;
    const doneList = inList.filter(x => x.status === 'done');
    const done = doneList.length;
    const active = inList.filter(x => x.status !== 'done');
    const pct = total ? Math.round(done / total * 100) : 0;
    body.innerHTML = `
      <div class="card">
        <h3>理财成长 · 小白 → 大佬</h3>
        <div class="ln-progress"><div class="ln-bar" style="width:${pct}%"></div></div>
        <div class="muted" style="font-size:12px;margin-top:4px">已学 ${done}/${total} · 每学完一个，它会从待学里消失，进度往前走一步</div>
      </div>
      <div class="card">
        <h3>学习入口</h3>
        <div class="ln-links">
          <a class="link-card" href="https://www.bilibili.com/search?keyword=指数基金定投入门" target="_blank" rel="noopener">📺 B站 · 定投入门</a>
          <a class="link-card" href="https://weread.qq.com/" target="_blank" rel="noopener">📚 微信读书 · 理财书单</a>
          <a class="link-card" href="https://www.csrc.gov.cn/" target="_blank" rel="noopener">🏛️ 证监会投教基地</a>
        </div>
      </div>
      <div class="card"><h3>待学清单 <button class="btn sm" id="lnAdd" style="margin-left:auto">＋ 加</button></h3>
        ${active.length ? active.map(x => `<div class="list-row" style="align-items:flex-start">
          <div style="flex:1"><b>${esc(x.topic)}</b>${x.note ? `<div class="muted" style="font-size:12px">${esc(x.note)}</div>` : ''}</div>
          <select data-ln="${x.id}" style="font-size:12px;padding:3px 6px;border:1px solid var(--line);border-radius:8px">
            ${Object.entries(stMap).map(([k, v]) => `<option value="${k}" ${x.status === k ? 'selected' : ''}>${v}</option>`).join('')}
          </select>
          <button class="del" data-lndel="${x.id}">✕</button></div>`).join('') : '<div class="empty">待学清单清空啦，你已经是进阶选手 ✨</div>'}
      </div>
      ${done ? `<details class="card ln-done-wrap"><summary>已学过的内容（${done}）<span class="car">▾</span></summary>
        ${doneList.map(x => `<div class="list-row" style="align-items:flex-start">
          <div style="flex:1"><b style="text-decoration:line-through;color:var(--sub)">${esc(x.topic)}</b></div>
          <button class="btn sm ghost" data-lnreset="${x.id}">重新学</button>
          <button class="del" data-lndel="${x.id}">✕</button></div>`).join('')}
      </details>` : ''}
      <div class="card"><h3>输出 · 我的理财笔记 <button class="btn sm" id="loAdd" style="margin-left:auto">＋ 记</button></h3>
        ${outList.length ? outList.slice().reverse().map(n => `<div class="list-row" style="align-items:flex-start">
          <div style="flex:1"><b>${esc(n.title)}</b><span class="muted" style="font-size:11px"> · ${n.date}</span>
          <div class="muted" style="font-size:13px;white-space:pre-wrap;margin-top:2px">${esc(n.content)}</div></div>
          <button class="del" data-lodel="${n.id}">✕</button></div>`).join('') : '<div class="empty">把学到的、想通的、踩过的坑写下来，输出才是真学会</div>'}
      </div>`;
    body.querySelector('#lnAdd').onclick = () => {
      openModal(`<button class="close-x" onclick="closeModal()">×</button><h3>想学的内容</h3>
        <div class="form-row"><label>主题</label><input id="lnTopic" placeholder="例如：怎么看基金估值"></div>
        <div class="form-row"><label>备注</label><textarea id="lnNote" rows="2" placeholder="为什么想学"></textarea></div>
        <button class="btn" id="lnOk" style="width:100%">添加</button>`);
      document.getElementById('lnOk').onclick = () => {
        const t = document.getElementById('lnTopic').value.trim(); if (!t) return toast('填一下主题');
        const all = S.get('finLearnIn', []); all.push({ id: uid(), topic: t, status: 'want', note: document.getElementById('lnNote').value.trim() });
        S.set('finLearnIn', all); closeModal(); this.renderLearn(body);
      };
    };
    body.querySelector('#loAdd').onclick = () => {
      openModal(`<button class="close-x" onclick="closeModal()">×</button><h3>理财笔记</h3>
        <div class="form-row"><label>标题</label><input id="loTitle" placeholder="例如：今天想通了应急金"></div>
        <div class="form-row"><label>内容</label><textarea id="loContent" rows="4" placeholder="我的理解、行动、反思…"></textarea></div>
        <button class="btn" id="loOk" style="width:100%">保存</button>`);
      document.getElementById('loOk').onclick = () => {
        const t = document.getElementById('loTitle').value.trim(); if (!t) return toast('起个标题');
        const all = S.get('finLearnOut', []); all.push({ id: uid(), title: t, content: document.getElementById('loContent').value.trim(), date: todayStr() });
        S.set('finLearnOut', all); closeModal(); this.renderLearn(body);
      };
    };
    body.querySelectorAll('[data-ln]').forEach(s => s.onchange = () => {
      const all = S.get('finLearnIn', []); const i = all.findIndex(x => x.id === s.dataset.ln);
      if (i >= 0) { all[i].status = s.value; S.set('finLearnIn', all); this.renderLearn(body); }
    });
    body.querySelectorAll('[data-lndel]').forEach(b => b.onclick = () => {
      S.set('finLearnIn', S.get('finLearnIn', []).filter(x => x.id !== b.dataset.lndel)); this.renderLearn(body);
    });
    body.querySelectorAll('[data-lnreset]').forEach(b => b.onclick = () => {
      const all = S.get('finLearnIn', []); const i = all.findIndex(x => x.id === b.dataset.lnreset);
      if (i >= 0) { all[i].status = 'want'; S.set('finLearnIn', all); this.renderLearn(body); }
    });
    body.querySelectorAll('[data-lodel]').forEach(b => b.onclick = () => {
      S.set('finLearnOut', S.get('finLearnOut', []).filter(x => x.id !== b.dataset.lodel)); this.renderLearn(body);
    });
  },
  /* ---------- 3. 理财体系（良性循环框架） ---------- */
  renderSystem(body) {
    const stage = S.get('finStage', 1);
    const steps = [
      { n: '理清现状', d: '记账 + 财务快照，先看清钱从哪来、到哪去、欠多少。这一步你已经在做了。' },
      { n: '建立应急金', d: '先存一小笔能cover 3-6 个月必要支出的钱，放在随时能取的地方。它是你敢拒绝、敢试错的底气。' },
      { n: '管理债务', d: '外债优先还高息的（雪崩法：先还利率最高的）；或先还最小额的建立信心（雪球法）。' },
      { n: '守住保障', d: '先保人再保钱：基础医保/意外险到位，再谈投资。别用买保险替代应急金。' },
      { n: '开始投资', d: '有余力后，从指数基金定投开始，小额、长期、不择时。别加杠杆、别All in。' },
      { n: '持续优化', d: '定期复盘账单和快照，调整预算与比例。理财不是一次搞懂，是持续校准。' }
    ];
    body.innerHTML = `
      <div class="card"><h3>我的理财体系</h3>
        <div class="muted" style="font-size:12px;margin-bottom:8px">一步步来，不急。选一个你当前所在的阶段：</div>
        <div id="sysSel" style="display:flex;flex-direction:column;gap:6px">
          ${steps.map((s, i) => `<button class="btn sm ${stage === i + 1 ? '' : 'ghost'}" data-sys="${i + 1}">${i + 1}. ${s.n}</button>`).join('')}
        </div>
      </div>
      <div id="sysFlow"></div>`;
    const paintFlow = () => {
      const cur = S.get('finStage', 1);
      body.querySelector('#sysFlow').innerHTML = `<div class="card"><h3>良性循环路径</h3>
        ${steps.map((s, i) => `<div class="list-row" style="align-items:flex-start;border-left:3px solid ${i + 1 <= cur ? '#2e7d57' : '#e0e0e0'};padding-left:8px;margin-bottom:6px">
          <span class="tag" style="background:${i + 1 < cur ? '#2e7d57' : (i + 1 === cur ? '#E0A458' : '#bbb')};border:none;color:#fff">${i + 1 <= cur ? (i + 1 < cur ? '✓' : '进行') : '待'}</span>
          <div style="flex:1"><b>${s.n}</b><div class="muted" style="font-size:12.5px">${s.d}</div></div></div>`).join('')}
        <div class="muted" style="margin-top:6px">你目前在「<b>${steps[cur - 1].n}</b>」。先把这个阶段做扎实，再进下一步。</div>
      </div>`;
    };
    paintFlow();
    body.querySelectorAll('[data-sys]').forEach(b => b.onclick = () => { S.set('finStage', Number(b.dataset.sys)); this.renderSystem(body); });
  }
};
window.Modules.finance = { render: r => Finance.render(r) };
window.Finance = Finance;
