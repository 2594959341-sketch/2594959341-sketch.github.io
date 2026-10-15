/* ============ AI 助手（枝枝喵）· 基于本地数据的日常问答与分析 ============ */
/* 复用设置里的 DeepSeek Key（mumu_llm）：base/key/model。浏览器直连 api.deepseek.com（已验证 CORS 可行）。
   数据全部来自本机 localStorage/IndexedDB，仅在你提问时随问题发给模型。 */
const AI = {
  KEY: 'mumu_ai_chat',
  _root: null,
  chat() { return S.get(this.KEY, []) || []; },
  saveChat(arr) { S.set(this.KEY, arr.slice(-40)); },   // 最多保留 40 条，控制体积
  clearChat() { S.set(this.KEY, []); this.render(this._root); },

  render(root) {
    this._root = root;
    root.innerHTML = `
      <div class="ai-head">
        <button class="icon-btn" id="aiBack" title="返回">${icon('back', 18)}</button>
        <div class="ai-title"><span class="ai-ava">🐱</span> 枝枝喵 · AI 助手</div>
        <button class="icon-btn" id="aiClear" title="清空对话">${icon('refresh', 16)}</button>
      </div>
      <div class="ai-box" id="aiBox"></div>
      <div class="ai-chips" id="aiChips">
        ${['本周打卡率怎么样', '洗澡频率最近趋势', '这个月创作产出汇总', '给我一句今日鼓励'].map(c => `<button class="ai-chip">${esc(c)}</button>`).join('')}
      </div>
      <div class="ai-input">
        <textarea id="aiText" rows="1" placeholder="问点什么？比如：我最近坚持得最好的是哪项？"></textarea>
        <button class="btn" id="aiSend">发送</button>
      </div>
      <div class="ai-proxy"><input id="aiProxy" placeholder="可选：Cloudflare Worker 代理地址（解决浏览器直连 CORS）" value="${esc(S.get('mumu_ai_proxy', ''))}"></div>
      <div class="muted ai-note">数据来自你本机工作台；仅在你提问时随问题发给 DeepSeek。没配 Key？去「设置」填 DeepSeek Key。若提示跨域/CORS，在上方填一个代理地址即可（步骤问枝枝）。</div>`;
    this.renderMessages();
    root.querySelector('#aiBack').onclick = () => { if (window.App) App.go('home'); };
    const clear = root.querySelector('#aiClear'); if (clear) clear.onclick = () => { if (confirm('清空对话记录？')) this.clearChat(); };
    const px = root.querySelector('#aiProxy'); if (px) px.oninput = () => { S.set('mumu_ai_proxy', px.value.trim()); };
    root.querySelector('#aiSend').onclick = () => this.submit();
    const ta = root.querySelector('#aiText');
    ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.submit(); } });
    root.querySelectorAll('.ai-chip').forEach(b => b.onclick = () => { ta.value = b.textContent; this.submit(); });
    const box = root.querySelector('#aiBox'); if (box) box.scrollTop = box.scrollHeight;
  },

  renderMessages() {
    const box = this._root.querySelector('#aiBox'); if (!box) return;
    const list = this.chat();
    if (!list.length) {
      box.innerHTML = `<div class="ai-empty">嗨 ${esc(S.get('name') || '木木')}～我是枝枝喵。\n你可以问我关于你工作台数据的问题：打卡情况、习惯频率、创作产出……我帮你复盘分析 💡</div>`;
      return;
    }
    box.innerHTML = list.map(m => `<div class="ai-msg ai-${m.role}${m.loading ? ' ai-loading' : ''}"><div class="ai-bubble">${m.loading ? '枝枝喵思考中…' : esc(m.content)}</div></div>`).join('');
  },

  submit() {
    const ta = this._root.querySelector('#aiText');
    const q = (ta.value || '').trim(); if (!q) return;
    ta.value = '';
    const chat = this.chat();
    chat.push({ role: 'user', content: q });
    this.saveChat(chat);
    this.renderMessages();
    this.ask(q);
  },

  async ask(q) {
    const cfg = S.get('mumu_llm');
    if (!cfg || !cfg.key) {
      const chat = this.chat();
      chat.push({ role: 'assistant', content: '还没配置 AI 钥匙～去「设置」里填一下 DeepSeek Key（平台 platform.deepseek.com 注册，新用户有免费额度），就能用我啦。' });
      this.saveChat(chat); this.renderMessages();
      toast('没找到 DeepSeek Key，去「设置」填一下');
      return;
    }
    // 占位思考中
    const chat = this.chat();
    chat.push({ role: 'assistant', content: '', loading: true });
    this.saveChat(chat); this.renderMessages();
    const box = this._root.querySelector('#aiBox'); if (box) box.scrollTop = box.scrollHeight;

    const ctx = this.gatherContext();
    const sys = '你是「枝枝喵」，木木（用户）的个人工作台 AI 助手。你基于木木工作台导出的本地数据（打卡、续火花、频率习惯、创作、阅读、自救计划等）回答她的问题，帮她做日常复盘与数据分析。规则：1) 用简体中文、温柔鼓励的语气，像关心她的朋友；2) 只基于提供的数据回答，不编造；数据不足时如实说；3) 涉及趋势/统计尽量给具体数字和小结；4) 控制长度，必要时用要点；5) 用户叫木木，你叫枝枝喵。';
    const all = this.chat().filter(m => !m.loading);
    const hist = all.slice(0, -1);                 // 排除刚加入的当前问题
    const recent = hist.slice(-10);
    const messages = [
      { role: 'system', content: sys },
      { role: 'user', content: '【我的工作台数据快照】\n' + ctx + '\n\n以上是我当前的数据，请基于此回答我接下来的问题。' },
      ...recent.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: q }
    ];
    try {
      const proxy = S.get('mumu_ai_proxy', '');
      const url = proxy ? (proxy.replace(/\/+$/, '') + '/chat/completions') : ((cfg.base || 'https://api.deepseek.com/v1').replace(/\/+$/, '') + '/chat/completions');
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.key },
        body: JSON.stringify({ model: cfg.model || 'deepseek-chat', messages: messages, temperature: 0.7, max_tokens: 1200 })
      });
      const data = await res.json();
      const out = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
      const c2 = this.chat();
      c2[c2.length - 1] = { role: 'assistant', content: out || '（AI 没有返回内容，稍后重试）' };
      this.saveChat(c2); this.renderMessages();
      const b2 = this._root.querySelector('#aiBox'); if (b2) b2.scrollTop = b2.scrollHeight;
    } catch (e) {
      const c2 = this.chat();
      c2[c2.length - 1] = { role: 'assistant', content: '请求失败了：' + (e && e.message ? e.message : e) + '\n若是跨域/CORS 报错，说明 DeepSeek 不允许浏览器直连（它不发预检头）。请在上方「代理地址」填一个 Cloudflare Worker 代理即可解决——具体步骤问枝枝要。' };
      this.saveChat(c2); this.renderMessages();
    }
  },

  dayHasAny(ds) {
    return (S.get('workLogs', {})[ds] || []).length > 0
      || (S.get('writeLogs', {})[ds] || []).length > 0
      || (S.get('kgLogs', {})[ds] || []).length > 0
      || (S.get('sportLogs', {})[ds] || []).length > 0
      || (S.get('growthLogs', {})[ds] || []).length > 0
      || (function () { const m = S.get('meals', {})[ds]; return m && (m.breakfast || m.lunch || m.dinner); })()
      || (S.get('funLogs', {})[ds] || []).length > 0
      || (S.get('readLogs', {})[ds] || []).length > 0
      || (S.get('travelOut', {})[ds] || []).length > 0;
  },

  gatherContext() {
    const d = todayStr();
    const L = [];
    const ym = d.slice(0, 7);
    L.push('【今日概览 ' + d + '】');
    const plan = (window.Daily && Daily.statsOf) ? Daily.statsOf(d) : null;
    if (plan) L.push('每日计划: ' + plan.done + '/' + plan.total + ' 完成');
    L.push('创作产出: ' + ((S.get('workLogs', {})[d] || []).length + (S.get('writeLogs', {})[d] || []).length) + ' 条');
    L.push('备考学习: ' + (S.get('kgLogs', {})[d] || []).reduce((s, l) => s + (l.minutes || 0), 0) + ' 分钟');
    L.push('个人成长打卡: ' + (S.get('growthLogs', {})[d] || []).length + ' 次');
    L.push('运动: ' + (S.get('sportLogs', {})[d] || []).reduce((s, l) => s + (l.minutes || 0), 0) + ' 分钟');
    const meals = S.get('meals', {})[d]; L.push('三餐: ' + (meals ? ['breakfast', 'lunch', 'dinner'].filter(k => meals[k]).length : 0) + '/3');
    L.push('娱乐: ' + (S.get('funLogs', {})[d] || []).length + ' 部; 阅读: ' + (S.get('readLogs', {})[d] || []).length + ' 本');

    L.push('');
    L.push('【续火花·当前连续天数】');
    if (window.Streak) {
      try { Streak.ensureItems().forEach(it => { L.push('- ' + it.name + ': 连续 ' + Streak.curStreak(it) + ' 天'); }); } catch (e) {}
    }

    L.push('');
    L.push('【近30天每日是否有任意打卡(1/0, 从30天前到今天)】');
    const seq = [];
    for (let i = 29; i >= 0; i--) seq.push(this.dayHasAny(addDays(d, -i)) ? 1 : 0);
    L.push(seq.join(''));

    L.push('【近7天(周一~今天)每日计划完成率】');
    const wkStart = mondayOf(d);
    let wTot = 0, wDone = 0;
    for (let i = 0; i <= daysBetween(wkStart, d); i++) {
      const ds = addDays(wkStart, i);
      const p = (S.get('plans', {})[ds] || []);
      wTot += p.length;
      wDone += p.filter(t => (window.Daily && Daily.effDone) ? Daily.effDone(t, ds) : (t.done || t.isDone)).length;
    }
    L.push('本周计划 ' + wDone + '/' + wTot + ' 完成 (' + (wTot ? Math.round(wDone / wTot * 100) : 0) + '%)');

    L.push('');
    L.push('【频率习惯·近30天(仅列有记录的天)】');
    if (window.Freq) {
      try {
        const fq = Freq.ensure();
        fq.events.forEach(ev => {
          const days = [];
          for (let i = 29; i >= 0; i--) {
            const ds = addDays(d, -i);
            const lk = fq.links ? fq.links[ev] : null;
            const auto = lk ? Freq.countOf(lk, ds) : 0;
            const man = (fq.dates[ds] && fq.dates[ds][ev] != null) ? Number(fq.dates[ds][ev]) : 0;
            const c = auto + man;
            if (c > 0) days.push(ds.slice(5) + ':' + c);
          }
          const tot = days.reduce((s, x) => s + (Number(x.split(':')[1]) || 0), 0);
          L.push('- ' + ev + ': 近30天 ' + tot + ' 次; 明细 ' + days.slice(-12).join(' '));
        });
      } catch (e) {}
    }

    L.push('');
    L.push('【创作产出·本月(' + ym + ')与近14天】');
    const wl = S.get('workLogs', {}), wlall = S.get('writeLogs', {});
    let mN = 0; const wlist = [];
    Object.keys(wl).concat(Object.keys(wlall)).forEach(ds => {
      if (ds.slice(0, 7) === ym) mN += (wl[ds] || []).length + (wlall[ds] || []).length;
    });
    Object.keys(wl).slice(-14).forEach(ds => (wl[ds] || []).slice(0, 2).forEach(l => wlist.push(ds.slice(5) + ' ' + (l.title || l.type || '产出'))));
    L.push('本月共 ' + mN + ' 条产出; 近14天样例: ' + wlist.slice(0, 8).join(' / '));

    L.push('');
    L.push('【阅读·近14天】');
    const rl = S.get('readLogs', {}); let rN = 0; const rlist = [];
    Object.keys(rl).slice(-14).forEach(ds => { rN += (rl[ds] || []).length; (rl[ds] || []).slice(0, 2).forEach(l => rlist.push(ds.slice(5) + ' ' + (l.book || l.title || '读物'))); });
    L.push('近14天 ' + rN + ' 本/篇; 样例: ' + rlist.slice(0, 8).join(' / '));

    const sr = S.get('selfRescue');
    if (sr) { const srDay = Math.max(1, daysBetween((sr.start || '2026-07-13'), d) + 1); L.push(''); L.push('【365天自救】第 ' + srDay + ' 天'); }
    return L.join('\n');
  }
};
window.Modules.ai = { render: r => AI.render(r) };
window.AI = AI;
