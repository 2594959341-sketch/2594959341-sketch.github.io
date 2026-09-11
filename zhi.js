const Zhi = {
  render(root) {
    if (!this._chat) this._chat = S.get('mumu_chat', []) || [];
    const renderMsgs = () => {
      const el = root.querySelector('#chatMsgs'); if (!el) return;
      el.innerHTML = this._chat.length
        ? this._chat.map(m => {
            const isUser = m.role === 'user';
            return `<div class="msg ${isUser ? 'user' : 'ai'}">
              <div class="who">${isUser ? '🌿' : '🌱'}</div>
              <div class="bubble-wrap">
                <div class="who-name">${isUser ? '木木' : '枝枝'}</div>
                <div class="bubble">${Zhi.fmt(m.content)}</div>
              </div>
            </div>`;
          }).join('')
        : '<div class="empty" style="text-align:center;margin:auto">嗨木木，我是枝枝 🌱 我完全基于你工作台里的真实数据来分析——不需要联网、不上传任何信息。试试下面的快捷卡片，或直接问我「我最近状态怎么样」「三餐规律吗」。</div>';
      el.scrollTop = el.scrollHeight;
    };
    root.innerHTML = `
      <div class="page-title">💬 枝枝</div>
      <div class="page-sub">本地智能 · 基于你工作台的所有数据，绝对私密</div>
      <div class="chat-card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div style="display:flex;align-items:center;gap:8px"><span style="font-size:22px">🌱</span><b>枝枝</b><span class="tag green" style="font-size:11px">本地模式</span></div>
          <button class="btn sm ghost" id="chatCfg">⚙ 设置</button>
        </div>
        <div id="chatMsgs" class="chat-msgs"></div>
        <div style="display:flex;gap:8px;margin-top:8px">
          <textarea id="chatInput" rows="1" placeholder="问我点什么…（Enter 发送 / Shift+Enter 换行）" style="flex:1;resize:none"></textarea>
          <button class="btn" id="chatSend">发送</button>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">
          <button class="btn sm ghost quick" data-q="总览">📊 我的状态总览</button>
          <button class="btn sm ghost quick" data-q="心理">🧠 心理维度</button>
          <button class="btn sm ghost quick" data-q="经济">💰 经济维度</button>
          <button class="btn sm ghost quick" data-q="计划">🎯 计划维度</button>
          <button class="btn sm ghost quick" data-q="三餐">🍚 三餐健康</button>
          <button class="btn sm ghost quick" data-q="创作">🎮 创作产出</button>
        </div>
      </div>`;
    renderMsgs();
    const input = root.querySelector('#chatInput');
    input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(120, input.scrollHeight) + 'px'; });
    const send = () => {
      const text = input.value.trim(); if (!text) return;
      input.value = ''; input.style.height = 'auto';
      this._chat.push({ role: 'user', content: text });
      this.persist(); renderMsgs();
      const ans = this.answer(text);
      this._chat.push({ role: 'ai', content: ans });
      this.persist(); renderMsgs();
    };
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
    root.querySelector('#chatSend').onclick = send;
    root.querySelectorAll('.quick').forEach(b => b.onclick = () => {
      const q = b.dataset.q;
      this._chat.push({ role: 'user', content: q });
      this.persist(); renderMsgs();
      const ans = this.answer(q);
      this._chat.push({ role: 'ai', content: ans });
      this.persist(); renderMsgs();
    });
    root.querySelector('#chatCfg').onclick = () => this.chatCfg(root);
  },
  persist() { S.set('mumu_chat', this._chat.slice(-60)); },

  /* ===== 数据聚合 ===== */
  collect() {
    const d = todayStr();
    const meals = S.get('meals', {}) || {};
    const sportLogs = S.get('sportLogs', {}) || {};
    const workLogs = S.get('workLogs', {}) || {};
    const kgLogs = S.get('kgLogs', {}) || {};
    const growthLogs = S.get('growthLogs', {}) || {};
    const reviews = S.get('reviews', {}) || {};
    const daily = (window.Daily ? window.Daily.list(d) : []) || [];
    const novel = S.get('novel', { bookName: '', goalWords: 0, totalWords: 0, daily: {} });
    const acts = (window.Work && window.Work.acts) ? window.Work.acts() : [];
    // 连续打卡天数
    const streak = (store) => {
      let n = 0; const dt = new Date();
      for (let i = 0; i < 60; i++) {
        const day = todayStr(new Date(dt - i * 864e5));
        const v = store[day];
        if (v && ((Array.isArray(v) && v.length) || (typeof v === 'object' && Object.keys(v).filter(k => v[k]).length))) n++;
        else if (i > 0) break; else break;
      }
      return n;
    };
    // 近7天有记录的天数
    const activeDays = (store) => {
      let n = 0; const dt = new Date();
      for (let i = 1; i <= 7; i++) {
        const day = todayStr(new Date(dt - i * 864e5));
        const v = store[day];
        if (v && ((Array.isArray(v) && v.length) || (typeof v === 'object' && Object.keys(v).filter(k => v[k]).length))) n++;
      }
      return n;
    };
    return {
      d, meals, sportLogs, workLogs, kgLogs, growthLogs, reviews, daily, novel, acts,
      mealStreak: streak(meals), sportStreak: streak(sportLogs), workStreak: streak(workLogs),
      kgStreak: streak(kgLogs), growthStreak: streak(growthLogs),
      meal7: activeDays(meals), sport7: activeDays(sportLogs), work7: activeDays(workLogs), kg7: activeDays(kgLogs), growth7: activeDays(growthLogs),
      sportMinToday: (sportLogs[d] || []).reduce((s, l) => s + (Number(l.minutes) || 0), 0),
      workToday: (workLogs[d] || []).length,
      kgMinToday: (kgLogs[d] || []).reduce((s, l) => s + (Number(l.minutes) || 0), 0),
      growthToday: (growthLogs[d] || []).length,
      mealsToday: meals[d] ? ['breakfast', 'lunch', 'dinner'].filter(k => meals[d][k]).length : 0,
      stats: (window.Daily && window.Daily.statsOf) ? window.Daily.statsOf(d) : { total: daily.length, done: daily.filter(t => t.manualDone || (t.steps && t.steps.length && t.steps.every(s => s.done))).length, abandoned: [] }
    };
  },

  /* ===== 回答引擎 ===== */
  answer(q) {
    const c = this.collect();
    const Q = q.toLowerCase();
    const has = (...kws) => kws.some(k => Q.includes(k));
    if (has('总览', '状态', 'overview', '怎么样', '如何')) return this.overview(c);
    if (has('心理', '情绪', '压力', '心情', '焦虑')) return this.psych(c);
    if (has('经济', '收入', '钱', '收益', '变现', 'money', '创作价值')) return this.econ(c);
    if (has('计划', '任务', '效率', '拖延', '安排')) return this.plan(c);
    if (has('三餐', '吃饭', '饮食', '健康', '营养')) return this.meals(c);
    if (has('创作', '产出', '视频', '图文', '活动')) return this.work(c);
    if (has('运动', '锻炼', '身体', '体态')) return this.sport(c);
    if (has('成长', '学习', '读书', '技能')) return this.growth(c);
    if (has('考编', '考公', '备考', '考试')) return this.kaogong(c);
    if (has('小说', '码字', '写作')) return this.novel(c);
    if (has('复盘', '总结', '反思')) return this.review(c);
    // 默认：给总览 + 提示
    return this.overview(c) + '\n\n💡 我还能从「心理 / 经济 / 计划 / 三餐 / 创作 / 运动 / 成长 / 考编」等维度帮你解析，点上面的快捷卡片或具体问问我就行～';
  },

  line(t) { return t; },

  // 轻量渲染：转义后支持 **加粗**，换行用 pre-wrap 保留
  fmt(text) {
    return esc(text)
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/^• /gm, '· ');
  },

  overview(c) {
    const s = c.stats;
    const doneRate = s.total ? Math.round(s.done / s.total * 100) : 0;
    let out = '📊 **木木今日状态总览**（基于你工作台真实数据）\n\n';
    out += `• 今日计划：${s.done}/${s.total} 完成（${doneRate}%）${doneRate >= 80 ? '👍 很棒' : doneRate >= 50 ? '👌 还不错' : '💪 慢慢来'}\n`;
    out += `• 三餐打卡：${c.mealsToday}/3 餐${c.mealsToday === 3 ? ' 🍚 齐了' : ' 🍽️ 还差' + (3 - c.mealsToday) + '餐'}\n`;
    out += `• 运动：${c.sportMinToday ? c.sportMinToday + ' 分钟' : '今天还没动'}${c.sportStreak > 1 ? '（连续 ' + c.sportStreak + ' 天）' : ''}\n`;
    out += `• 创作产出：${c.workToday} 条打卡${c.workStreak > 1 ? '（连续 ' + c.workStreak + ' 天）' : ''}\n`;
    out += `• 考编学习：${c.kgMinToday ? c.kgMinToday + ' 分钟' : '今天未打卡'}${c.kgStreak > 1 ? '（连续 ' + c.kgStreak + ' 天）' : ''}\n`;
    out += `• 成长打卡：${c.growthToday} 条${c.growthStreak > 1 ? '（连续 ' + c.growthStreak + ' 天）' : ''}\n`;
    if (c.novel && c.novel.bookName) out += `• 写小说：《${c.novel.bookName}》累计 ${c.novel.totalWords} 字（目标 ${c.novel.goalWords || '未设'}）\n`;
    // 活动进度
    const actDoing = c.acts.filter(a => !a.done && (a.targets || a.targetVideo || a.targetArticle));
    if (actDoing.length) {
      out += '\n🎮 进行中的创作活动：\n';
      actDoing.slice(0, 3).forEach(a => {
        const t = (a.targets && a.targets[0]) || {};
        const tv = t.video || a.targetVideo || 0, ta = t.article || a.targetArticle || 0, tot = tv + ta || (a.targets && a.targets.reduce((s, x) => s + (x.total || 0), 0)) || 0;
        out += `  - ${a.name}（截止 ${a.deadline || '未设'}）\n`;
      });
    }
    return out;
  },

  psych(c) {
    let out = '🧠 **心理维度解析**\n\n';
    const concerns = [];
    if (c.sportStreak === 0 && c.sport7 <= 2) concerns.push('近一周运动偏少，身体活动不足容易让情绪更低落——哪怕今天只做 5 分钟拉伸也好');
    if (c.mealStreak === 0 && c.meal7 <= 3) concerns.push('三餐记录不完整，饮食不规律会直接影响情绪稳定性，先保证"吃上了"比"吃得好"更重要');
    if (c.stats.total - c.stats.done >= 5) concerns.push(`今日计划还有 ${c.stats.total - c.stats.done} 项没完成，任务堆太多会产生焦虑——挑 1-2 件最在意的先划掉，其余明天再说`);
    if (c.kgStreak > 0 && c.kgMinToday === 0) concerns.push('考编连续打卡中断今天会打破节奏，但没关系，补 15 分钟就接上了');
    if (!concerns.length) {
      out += '目前各板块节奏都挺稳的，连续打卡习惯在建立中，心理状态应该比较从容 👍\n';
      out += '小提醒：三分钟热度也没关系，热度来的时候先干 10 分钟，比"等状态好"更靠谱。';
    } else {
      out += '我注意到几个可能影响心情的点：\n';
      concerns.forEach(x => out += '• ' + x + '\n');
      out += '\n🌱 枝枝的话：你不需要状态很好才开始，开始了状态才会好。今天只跟昨天的自己比。';
    }
    return out;
  },

  econ(c) {
    let out = '💰 **经济维度解析**（基于创作产出节奏）\n\n';
    const acts = c.acts.filter(a => !a.done);
    if (c.workStreak === 0 && c.work7 === 0) {
      out += '最近创作打卡为 0——内容创作是慢复利，断更越久恢复成本越高。今天发一条（哪怕短文）就能重启节奏。';
    } else {
      out += `创作连续打卡 ${c.workStreak} 天，近 7 天有 ${c.work7} 天在产出，节奏${c.work7 >= 4 ? '稳定 👍' : '偏稀疏，可以再密一点'}。\n`;
    }
    if (acts.length) {
      out += '\n进行中的激励活动（持续产出能拿到的收益）：\n';
      acts.slice(0, 4).forEach(a => {
        const t = (a.targets && a.targets[0]) || {};
        out += `• ${a.name} — 截止 ${a.deadline || '未设'}，建议围绕它每周稳定发 2-3 条，奖金/流量是自然结果\n`;
      });
    } else {
      out += '\n目前没有进行中的创作活动，可以挑一个平台激励计划参与，让产出有外部正反馈。';
    }
    out += '\n💡 经济建议：把"创作"当成一门小生意经营——固定频率 > 爆发式产量，稳定更新带来的算法推荐和粉丝沉淀，长期比单条爆款更值钱。';
    return out;
  },

  plan(c) {
    let out = '🎯 **计划维度解析**\n\n';
    const s = c.stats;
    if (s.total === 0) {
      out += '今天还没建任何计划任务。要不要加 1-2 件最想做的事？少而精比列一长串完不成更舒服。';
    } else {
      const rate = Math.round(s.done / s.total * 100);
      out += `今日 ${s.total} 项任务，已完成 ${s.done} 项（${rate}%）。\n`;
      if (s.total - s.done >= 6) out += '⚠️ 待办偏多，容易陷入"看着多就不想动"。建议把不重要的移到明日，今天专注 3 件核心。\n';
      else if (rate >= 80) out += '👍 今天完成度很高，给自己点个赞。\n';
      else out += '进度正常，按自己的节奏推进就好。\n';
    }
    // 关联完成情况
    const linked = c.daily.filter(t => t.link);
    if (linked.length) {
      const doneLinked = linked.filter(t => (window.Daily ? window.Daily.effDone(t, c.d) : t.manualDone)).length;
      out += `\n🔗 其中 ${linked.length} 项关联了专栏打卡，已完成 ${doneLinked} 项（专栏打卡会自动同步到这里）。`;
    }
    out += '\n🌱 把大目标拆小，把小步骤划掉，就是前进。';
    return out;
  },

  meals(c) {
    let out = '🍚 **三餐健康维度**\n\n';
    out += `今日打卡 ${c.mealsToday}/3 餐${c.mealsToday === 3 ? ' 🎉 齐了' : '，还差 ' + (3 - c.mealsToday) + ' 餐'}。\n`;
    out += `三餐连续记录 ${c.mealStreak} 天，近 7 天有 ${c.meal7} 天记录。\n`;
    // 准点分析
    const day = c.meals[c.d];
    if (day) {
      const slots = ['breakfast', 'lunch', 'dinner'];
      const names = { breakfast: '早', lunch: '午', dinner: '晚' };
      const times = slots.filter(k => day[k] && day[k].time).map(k => names[k] + day[k].time);
      if (times.length) out += '今日用餐时间：' + times.join(' / ') + '\n';
    }
    if (c.mealStreak === 0 && c.meal7 <= 3) out += '\n📌 建议：第一步先吃，第二步再固定时间段。别因为"吃晚了"就不记，记了就有数据。';
    else out += '\n📌 规律还不错，继续保持"吃齐+大致准点"就很好。';
    return out;
  },

  work(c) {
    let out = '🎮 **创作产出维度**\n\n';
    out += `今日产出 ${c.workToday} 条，连续打卡 ${c.workStreak} 天，近 7 天 ${c.work7} 天有产出。\n`;
    const logs = c.workLogs[c.d] || [];
    if (logs.length) {
      const byAct = {};
      logs.forEach(l => { if (l.actId) byAct[l.actId] = (byAct[l.actId] || 0) + 1; });
      const actNames = {};
      c.acts.forEach(a => actNames[a.id] = a.name);
      Object.keys(byAct).forEach(id => out += `• 关联活动「${actNames[id] || '未知'}」：${byAct[id]} 条\n`);
    }
    const acts = c.acts.filter(a => !a.done);
    if (acts.length) {
      out += '\n进行中活动：\n';
      acts.slice(0, 3).forEach(a => out += `• ${a.name}（截止 ${a.deadline || '未设'}）\n`);
    }
    out += '\n💡 稳定更新 > 爆发产出。今天发一条就是胜利。';
    return out;
  },

  sport(c) {
    let out = '🏃 **运动体态维度**\n\n';
    out += `今日运动 ${c.sportMinToday ? c.sportMinToday + ' 分钟' : '还没打卡'}，连续 ${c.sportStreak} 天，近 7 天 ${c.sport7} 天。\n`;
    if (c.sportStreak === 0 && c.sport7 <= 2) out += '\n身体一周没怎么动啦，先从"改善大小脸""天鹅颈"这种 5 分钟跟练捡起来，不费劲也能续上习惯。';
    else out += '\n体态改善是慢功夫，每天 10 分钟胜过周末猛练 2 小时。保持节奏 👍';
    return out;
  },

  growth(c) {
    let out = '🌿 **个人成长维度**\n\n';
    out += `今日成长打卡 ${c.growthToday} 条，连续 ${c.growthStreak} 天，近 7 天 ${c.growth7} 天。\n`;
    const logs = c.growthLogs[c.d] || [];
    if (logs.length) out += '今天涉及：' + logs.map(l => l.area).join('、') + '\n';
    out += '\n小步持续比偶尔大跨步更稳。今天学一点、记一点就很好。';
    return out;
  },

  kaogong(c) {
    let out = '📚 **考编备考维度**\n\n';
    out += `今日学习 ${c.kgMinToday ? c.kgMinToday + ' 分钟' : '还没打卡'}，连续 ${c.kgStreak} 天，近 7 天 ${c.kg7} 天。\n`;
    if (c.kgStreak === 0 && c.kg7 <= 2) out += '\n备考最怕断。今天哪怕只做 20 分钟行测题，也能接上节奏。';
    else out += '\n节奏不错，保持每天固定时段学习，比考前突击有效得多。';
    return out;
  },

  novel(c) {
    if (!c.novel || !c.novel.bookName) return '✍️ 你还没在「创作·写小说」里建书名和字数目标，建好之后我就能帮你追踪码字进度啦。';
    const n = c.novel;
    const rate = n.goalWords ? Math.round(n.totalWords / n.goalWords * 100) : 0;
    let out = `✍️ **写小说维度**\n\n《${n.bookName}》\n• 累计 ${n.totalWords} 字 / 目标 ${n.goalWords || '未设'}（${rate}%）\n`;
    const today = (n.daily && n.daily[c.d]) || 0;
    out += `• 今日码字：${today} 字\n`;
    if (n.goalWords && n.totalWords < n.goalWords && !today) out += '\n今天还没写，哪怕 200 字也是前进。';
    return out;
  },

  review(c) {
    const r = c.reviews[c.d];
    if (!r || !r.text) return '📝 今天还没写复盘。晚上花 3 分钟记一句"今天最满意的一件小事"，长期看会很有力量。';
    return '📝 **今日复盘**\n\n' + r.text;
  },

  /* ===== 设置（本地模式说明 + 可选外部Key） ===== */
  chatCfg(root) {
    const cfg = S.get('mumu_llm', {}) || {};
    openModal(`<button class="close-x" onclick="closeModal()">×</button><h3>⚙ 枝枝设置</h3>
      <div class="muted" style="margin-bottom:10px">当前为 <b>本地智能模式</b>：枝枝完全基于你工作台的真实数据做多维度解析，<b>不需要任何 API Key，不上传数据，免费</b>。<br><br>如果你想要"自由闲聊 / 深度对话"能力，可以选填下面的外部大模型 Key（可选）。不填也能正常使用全部分析功能。</div>
      <div class="form-row"><label>接口地址（Base URL，可选）</label><input id="cfgBase" value="${esc(cfg.base || 'https://api.deepseek.com/v1')}" placeholder="https://api.deepseek.com/v1"></div>
      <div class="form-row"><label>API Key（可选）</label><input id="cfgKey" type="password" value="${esc(cfg.key || '')}" placeholder="留空=纯本地模式"></div>
      <div class="form-row"><label>模型名</label><input id="cfgModel" value="${esc(cfg.model || 'deepseek-chat')}" placeholder="deepseek-chat"></div>
      <div style="display:flex;gap:8px;margin-top:6px">
        <button class="btn ghost sm" id="cfgClear">🗑️ 清空对话</button>
        <button class="btn" id="cfgOk" style="flex:1;margin-left:auto">保存</button>
      </div>`);
    document.getElementById('cfgOk').onclick = () => {
      S.set('mumu_llm', { base: document.getElementById('cfgBase').value.trim(), key: document.getElementById('cfgKey').value.trim(), model: document.getElementById('cfgModel').value.trim() });
      closeModal();
      toast(cfg.key ? '已保存，枝枝会用外部模型补充自由对话 🌱' : '已保存，枝枝保持纯本地模式 🌱');
    };
    document.getElementById('cfgClear').onclick = () => {
      this._chat = []; this.persist(); closeModal(); this.render(root); toast('对话已清空');
    };
  }
};
window.Modules.zhi = { render: r => Zhi.render(r) };
window.Zhi = Zhi;
