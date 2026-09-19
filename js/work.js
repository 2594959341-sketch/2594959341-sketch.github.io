/* ============ 工作 · 游戏内容创作 ============ */
const Work = {
  tool: null, ym: todayStr().slice(0, 7), view: 'month',

  /* 平台创作者中心活动页深链：直接跳 APP 内"创作者中心"激励入口。
     搜一搜只是兜底——很多游戏在站内搜不到激励信息，但创作者中心里其实有。 */
  PLAT_CENTERS: {
    'TapTap':   'https://www.taptap.cn/creator',
    '小红书':    'https://creator.xiaohongshu.com/new-home',
    '好游快爆':  'https://www.3839.com/creator/',
    'B站':      'https://member.bilibili.com/v2/#/campaign/home',
    '抖音':      'https://creator.douyin.com/creator-micro/home',
    '快手':      'https://cp.kuaishou.com/article/articlePongList'
  },

  searchURLs(game) {
    const q2 = encodeURIComponent(game);
    /* 搜索作为兜底，排在创作者中心下方 */
    return [
      { name: 'TapTap 搜', url: 'https://www.taptap.cn/search/' + q2, mode: 'search' },
      { name: '小红书 搜', url: 'https://www.xiaohongshu.com/search_result?keyword=' + encodeURIComponent(game + ' 创作激励'), mode: 'search' },
      { name: '好游快爆 搜', url: 'https://www.3839.com/so/' + q2 + '.html', mode: 'search' },
      { name: 'B站 搜', url: 'https://search.bilibili.com/all?keyword=' + encodeURIComponent(game + ' 创作激励'), mode: 'search' },
      { name: '抖音 搜', url: 'https://www.douyin.com/search/' + encodeURIComponent(game + ' 创作激励'), mode: 'search' },
      { name: '快手 搜', url: 'https://www.kuaishou.com/search/video?searchKey=' + encodeURIComponent(game + ' 创作激励'), mode: 'search' }
    ];
  },

  /* 一键直达六大平台创作者中心活动页（深链） */
  centerURLs() {
    return Object.entries(this.PLAT_CENTERS).map(([n, u]) => ({ name: n, url: u }));
  },

  PLATS: ['TapTap', '小红书', '好游快爆', 'B站', '抖音', '快手'],
  platColor(name) {
    return '#111111';
  },

  render(root) {
    if (this._actHistory) {
      root.innerHTML = `<div style="padding:4px 0 8px;display:flex;align-items:center"><button class="icon-btn" id="actHistBack" title="返回">${icon('chevronLeft',18)}</button></div><div id="workBody"></div>`;
      const body = root.querySelector('#workBody');
      this.render_act_history(body, root);
      const bk = root.querySelector('#actHistBack');
      if (bk) bk.onclick = () => { this._actHistory = false; this.render(root); };
      return;
    }
    if (this._workView === 'collection') {
      root.innerHTML = `<div style="padding:4px 0 8px;display:flex;align-items:center;gap:8px"><button class="icon-btn coll-back" title="返回活动规划">${icon('chevronLeft',18)}</button><b style="font-size:16px">活动收集箱</b></div><div id="workBody"></div>`;
      const body = root.querySelector('#workBody');
      this.render_collection(body, root);
      const cb = root.querySelector('.coll-back');
      if (cb) cb.onclick = () => { this._workView = null; this.render(root); };
      return;
    }
    // 创作打卡（默认竖排总览）：无 tabs
    if (!this.tool) {
      root.innerHTML = `<div id="workBody"></div>`;
      const body = root.querySelector('#workBody');
      this.renderStack(body, root);
      root.insertAdjacentHTML('beforeend', this.workNavHTML());
      this.bindWorkNav(root);
      return;
    }
    // 子工具：内容，无 tabs（当前分支由底部固定导航指示）
    root.innerHTML = `<div id="workBody"></div>`;
    const body = root.querySelector('#workBody');
    this['render_' + this.tool](body, root);
    root.insertAdjacentHTML('beforeend', this.workNavHTML());
    this.bindWorkNav(root);
  },

  workNavHTML() {
    const cur = this.tool || '';
    const items = [['', '剪视频'], ['writing', '写作']];
    return `<div class="subnav">${items.map(([k, l]) => `<button class="${cur === k ? 'on' : ''}" data-wsub="${k}">${l}</button>`).join('')}</div>`;
  },
  bindWorkNav(root) {
    root.querySelectorAll('[data-wsub]').forEach(b => b.onclick = () => {
      this.tool = b.dataset.wsub || null;
      this.render(root);
    });
  },

  /* ---------- 竖排总览（默认进入） ---------- */
  renderStack(box, root) {
    box.innerHTML = `
      <div class="sec" id="sec-chk"></div>
      <div class="sec" id="sec-act"></div>
      <div class="sec" id="sec-per">
        <h3 style="margin:0 0 10px;font-size:14px;color:var(--sub);font-weight:600">产出概览</h3>
        <div class="prod-grid">
          <div id="ptWk"></div><div id="ptMo"></div><div id="ptYr"></div>
        </div>
      </div>
      <div class="sec" id="sec-cal"></div>
      <div class="sec" id="sec-earn"></div>
      <div class="sec" id="sec-hm"></div>
      <details class="wcoll"><summary>✂️ 剪辑灵感</summary><div id="sec-clip"></div></details>`;
    this.render_clip(box.querySelector('#sec-clip'));
    this.render_chk(box.querySelector('#sec-chk'), root);
    this.render_act(box.querySelector('#sec-act'), root);
    this.render_wk(box.querySelector('#ptWk'), root);
    this.render_mo(box.querySelector('#ptMo'), root);
    this.render_yr(box.querySelector('#ptYr'), root);
    this.render_cal(box.querySelector('#sec-cal'), root);
    this.render_earn(box.querySelector('#sec-earn'), root);
    this.render_hm(box.querySelector('#sec-hm'), root);
  },
  periodItems(kind) {
    const all = this.allLogs();
    if (kind === 'wk') { const ws = weekStart(todayStr()); return all.filter(l => l.date >= ws && l.date <= todayStr()); }
    if (kind === 'mo') { const m = todayStr().slice(0, 7); return all.filter(l => l.date.startsWith(m)); }
    const y = new Date().getFullYear() + ''; return all.filter(l => l.date.startsWith(y));
  },
  prodTile(box, root, items, title, ic) {
    box.innerHTML = `<div class="prod-tile" data-per="${esc(title)}">
      <div class="stat-num">${items.length}</div>
      <div class="stat-lab">${title}</div>
    </div>`;
    box.querySelector('.prod-tile').onclick = () => this.perModal(root, items, title, ic);
  },
  perModal(root, items, title, ic) {
    openModal(`<button class="close-x" onclick="closeModal()">×</button><h3>${ic} ${title} · 共 ${items.length} 条</h3>
      ${items.length ? items.slice().reverse().map(l => this.logRow(l, l.date)).join('') : '<div class="empty">这段时间还没有产出记录</div>'}`);
    this.bindLogRows(document, root);
  },

  /* ---------- 激励雷达 ---------- */
  render_radar(box, root) {
    const D = window.MUMU_INCENTIVES || { updated: '-', campaigns: [], platforms: [], note: '' };
    const watch = S.get('watchGames', []);
    const hidden = S.get('radarHidden', []);
    const kw = this._kw || '';
    const list = D.campaigns
      .filter(c => c.deadline !== '长期')
      .filter(c => !kw || c.game.includes(kw) || c.title.includes(kw) || c.game === '通用')
      .filter(c => !hidden.includes(c.game + '||' + c.title))
      /* 截止日已过 / 已标注「已截止」的活动自动从雷达剔除，不再收录（保留在 D.campaigns 原数据里，不丢） */
      .filter(c => {
        if (c.title && c.title.indexOf('已截止') >= 0) return false;
        if (!/^\d{4}-\d{2}-\d{2}/.test(c.deadline)) return true;
        return daysBetween(todayStr(), c.deadline) >= 0;
      })
      .sort((a, b) => (b.platforms ? b.platforms.length : 0) - (a.platforms ? a.platforms.length : 0));
    box.innerHTML = `

      <div class="card">
        <h3>${icon('search',16)} 搜一搜：这个游戏有没有创作激励？</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <input id="gameKw" class="search" placeholder="输入游戏名，如：造梦西游4" style="flex:1;min-width:200px" value="${esc(kw)}">
          <button class="btn" id="doSearch">搜索</button>
          <button class="btn ghost" id="addWatch">＋ 加入关注</button>
        </div>
        <div id="platLinks" style="margin-top:12px">${kw ? `
          <div class="muted" style="margin-bottom:6px">一键直达六大平台创作者中心（APP 内的活动页）：</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">${this.centerURLs().map(p => `<a class="plat-badge plat-center" href="${p.url}" target="_blank">${p.name} ↗</a>`).join('')}</div>
          <div class="muted" style="margin-bottom:6px">如果不知道创作者中心在哪，先站内搜「${esc(kw)} 创作激励」：</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">${this.searchURLs(kw).map(p => `<a class="plat-badge" href="${p.url}" target="_blank">${p.name} ↗</a>`).join('')}</div>` : ''}</div>
        ${watch.length ? `<div style="margin-top:12px" class="muted">${icon('star',14)} 关注中：${watch.map(g => `<span class="tag" style="margin-right:5px">${esc(g)} <a style="cursor:pointer" data-unwatch="${esc(g)}">✕</a></span>`).join('')}</div>` : ''}
      </div>
      <div class="card">
        <h3>${icon('clipboard',16)} 当前收录的激励活动 <span class="tag">${list.length}</span></h3>
        <div class="muted" style="margin-bottom:10px">${esc(D.note)}</div>
        ${hidden.length ? `<div class="muted" style="margin-bottom:8px;font-size:12px">已隐藏 ${hidden.length} 个活动 · <a style="cursor:pointer;color:var(--sub)" id="radarRestore">点此恢复全部</a></div>` : ''}
        ${list.map(c => {
          const left = /^\d{4}/.test(c.deadline) ? daysBetween(todayStr(), c.deadline) : null;
          const rk = c.game + '||' + c.title;
          return `<div class="card radar-card" data-rkey="${esc(rk)}" style="margin-bottom:10px;position:relative;padding-right:30px">
          <span class="radar-del-wrap" data-rkey="${esc(rk)}"><button class="del radar-del-btn" data-rk="${esc(rk)}" title="长按卡片后点此删除">✕</button></span>
          <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center">
            <b>${esc(c.title)}</b>
            ${left === null ? '<span class="tag">长期</span>' : `<span class="tag">还剩 ${left} 天</span>`}
          </div>
          <div style="margin:6px 0">${c.platforms.map(p => `<span class="tag" style="margin-right:4px">${esc(p)}</span>`).join('')} <span class="tag">${esc(c.game)}</span></div>
          <div class="muted">${icon('money',14)} ${esc(c.reward)}</div>
          <div class="muted">${icon('calendar',14)} ${esc(c.period)}</div>
          <div class="muted">${icon('tag',14)} ${esc(c.require)}</div>
          <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
            <a class="btn sm" href="${c.source}" target="_blank">查看官方原文 ↗</a>
            <button class="btn sm ghost" data-plan="${esc(c.title)}|${esc(c.deadline)}">${icon('target',14)} 规划成创作任务</button>
          </div></div>`;
        }).join('') || '<div class="empty">没搜到相关活动，试试上面的平台直达链接，或让枝枝帮你搜</div>'}
      </div>`;

    const doS = () => { this._kw = box.querySelector('#gameKw').value.trim(); this.render_radar(box, root); };
    box.querySelector('#doSearch').onclick = doS;
    box.querySelector('#gameKw').onkeydown = e => { if (e.key === 'Enter') doS(); };
    box.querySelector('#addWatch').onclick = () => {
      const g = box.querySelector('#gameKw').value.trim(); if (!g) return toast('先输入游戏名');
      const w = S.get('watchGames', []); if (!w.includes(g)) { w.push(g); S.set('watchGames', w); }
      toast('已关注「' + g + '」，记得在对话里也告诉枝枝一声，我每天7点帮你盯'); this.render_radar(box, root);
    };
    box.querySelectorAll('[data-unwatch]').forEach(a => a.onclick = () => {
      S.set('watchGames', S.get('watchGames', []).filter(x => x !== a.dataset.unwatch)); this.render_radar(box, root);
    });
    box.querySelectorAll('[data-plan]').forEach(b => b.onclick = () => {
      const [name, dl] = b.dataset.plan.split('|');
      this.tool = null; this.render(root);
      setTimeout(() => { const el = root.querySelector('#sec-act'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); this.activityDialog(root, { name, deadline: /^\d{4}/.test(dl) ? dl : '' }); }, 60);
    });
    const restore = box.querySelector('#radarRestore');
    if (restore) restore.onclick = () => { S.set('radarHidden', []); this.render_radar(box, root); toast('已恢复全部隐藏活动'); };
    box.querySelectorAll('.radar-card').forEach(card => {
      const btn = card.querySelector('.radar-del-btn');
      if (!btn) return;
      let timer = null;
      const cancel = () => { clearTimeout(timer); };
      card.addEventListener('pointerdown', () => {
        timer = setTimeout(() => { btn.style.opacity = '1'; btn.style.pointerEvents = 'auto'; card.classList.add('lp-revealed'); }, 500);
      });
      card.addEventListener('pointerup', cancel);
      card.addEventListener('pointercancel', cancel);
      card.addEventListener('pointerleave', cancel);
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const key = btn.dataset.rk;
        const h = S.get('radarHidden', []);
        if (!h.includes(key)) { h.push(key); S.set('radarHidden', h); }
        toast('已从雷达隐藏该活动');
        this.render_radar(box, root);
      });
    });
  },

  /* ---------- 文案助手 ---------- */
  copyTypes: {
    '安利向': {
      ref: '安利',
      hooks: [
        '「我不允许还有人没玩过___」',
        '「玩了3年游戏，第一次为一款游戏熬到凌晨」',
        '「如果你也喜欢__类型，这款真的可以闭眼入」',
        '「朋友安利给我，结果我比他还上头」',
        '「本来只想随便试试，结果一整个周末没放下手机」',
        '「这款游戏把我那个从不玩游戏的闺蜜都拉下水了」',
        '「别被它的画风骗了，上手之后根本停不下来」',
        '「年度最被低估的一款，今天必须安利给你们」',
        '「玩之前：这画质值一个GOTY；玩之后：真香」',
        '「它可能不是年度最佳，但一定是我今年最上头的一款」',
        '「熬夜打完，第二天上班都在想它」',
        '「安利给100个人，99个说真香」',
        '「别问值不值得，问就是闭眼冲」',
        '「我妈问我为什么跪着玩」',
        '「这种游戏，玩的就是心跳和快乐」',
        '「入坑warning：以下游戏极易上头，慎入」',
        '「它不火我替它委屈」',
        '「同类型里，它把我拿捏得死死的」',
        '「玩了才知道，原来快乐这么简单」',
        '「朋友：你又安利？我：最后一次，真的」',
        '「从路人到死忠，我只用了一个周末」',
        '「这款的隐藏玩法，我能聊一整晚」',
        '「别看它小众，圈子里人均真爱」',
        '「我愿称之为本周最被低估的宝藏」'
      ],
      titles: [
        '__，是我今年最上头的一款',
        '安利给所有人：__真的可以闭眼入',
        '玩了__一周，说点大实话',
        '如果你也喜欢这种类型，__别错过',
        '从路人到死忠，我只用了玩__的一个周末',
        '__入坑指南：新手必看',
        '年度最被低估的宝藏：__',
        '别被画风骗了，__上手就停不下来'
      ],
      bodies: [
        '先说入坑契机：我其实是因为朋友安利 / 刷到一条视频才下的，本来只想随便看看，结果第一个周末就彻底陷进去了。这种「意外上头」的体验，才是好游戏最迷人的地方。',
        '最打动我的其实是它的核心玩法 —— 不用硬夸，把你真实被击中的那个瞬间写出来，比如「副本机制有新意」「立绘每一张都能当壁纸」，比任何形容词都管用。',
        '__的节奏把握得特别好：日常不肝、活动有意思，属于那种「想玩就玩、不玩也不焦虑」的舒服状态。对打工人 / 学生党来说，这点真的加分很多。',
        '说点缺点反而更可信：它前期引导略啰嗦、某个系统稍微有点肝。但瑕不掩瑜，整体体验我愿意给好评。建议大家先试玩再决定，别光看别人吹。',
        '我愿称之为本周最被低估的宝藏。圈子里人均真爱，但外面知道的人不多。如果你正好在找这类游戏，__值得你花一个周末试试。',
        '朋友的安利我本来半信半疑，结果自己玩完直呼真香。这种「真香定律」在__身上再次应验 —— 你以为你不会喜欢，玩两小时就回不去了。',
        '它可能不是年度最佳，但一定是我今年最上头的一款。没有复杂的社交压力，一个人也能玩得很开心，这点对我来说太重要了。',
        '入坑 warning：以下极易上头，慎入。我那个从不玩游戏的朋友都被我拉下水了，现在比我还肝。',
        '玩之前：这画质也就那样；玩之后：真香。__用实际行动告诉我，好玩和画质真不一定挂钩，玩法才是灵魂。',
        '从路人到死忠，我只用了一个周末。现在每次打开都有新东西可看可玩，这种持续的新鲜感很难得。'
      ],
      closings: [
        '你们玩到哪个章节 / 段位了？评论区聊聊你最上头的是哪一段，我再去抄抄作业。',
        '总之，__值得一试。觉得有用点个赞，更多游戏安利我会持续更新。',
        '入坑不亏，退坑随意。但至少，给它一个周末的机会吧。',
        '有同好吗？咱评论区建个坑友群，互相安利互相种草。',
        '以上就是我的真实安利，不恰饭纯分享。祝大家玩得开心！',
        '你也在玩__吗？说说你的入坑故事，我先来：是被某个人 / 某条视频骗进来的。'
      ]
    },
    '攻略向': {
      ref: '攻略',
      hooks: [
        '「新手死活过不去的__关，其实只需要3步」',
        '「全网最全__搭配，抄作业就行」',
        '「别再乱点天赋了！这套加点亲测省一半资源」',
        '「__这个Boss卡了我三天，原来诀窍这么简单」',
        '「零氪党必看：__资源这样分配才不亏」',
        '「__版本最强配队，我拿实战数据说话」',
        '「手把手教你__，看完直接抄」',
        '「__这关的隐藏机制，官方都没写清楚」',
        '「__新手村必看：这5个设置不改，前期多吃一半苦」',
        '「__资源党狂喜：白嫖党也能满配的路线」',
        '「__这个隐藏成就，90%的人不知道」',
        '「__PVP上分密码，照着抄就行」',
        '「__副本开荒实录：我们团灭了3次才摸清机制」',
        '「__装备选择别纠结，这套万能」',
        '「__速通攻略：15分钟带你过主线」',
        '「__新手最容易踩的坑，我替你踩完了」',
        '「__版本答案就在这套阵容里」',
        '「__这关卡了我两小时，原来差这一步」',
        '「__配队思路拆解：为什么这么搭最强」',
        '「__每日必做清单，省下你一半时间」',
        '「__BOSS机制全解析，看懂直接过」',
        '「__最全地图彩蛋，一个不落」',
        '「__零基础也能懂的入门攻略」',
        '「__这波更新，这几个改动最影响体验」'
      ],
      titles: [
        '__新手避坑指南，看完少走一半弯路',
        '__最强配队思路，照着抄就行',
        '__这个 Boss 卡了我三天，诀窍在这',
        '__零氪党必看的资源分配',
        '__版本答案，就在这套阵容',
        '__速通主线，15分钟带你过',
        '__新手最容易踩的坑，我替你踩完了',
        '__每日必做清单，省下你一半时间'
      ],
      bodies: [
        '先说结论：直接给最优解一句话，比如「零氪优先把某资源拉满，别分散投资」。这条建议我实测有效，照着做能省下至少一截资源。',
        '分步拆解最关键的一步：第一步做什么 → 第二步做什么 → 第三步做什么。每一步我都配了游戏内截图，关键处圈出来，照着点就行，不用动脑。',
        '新手最容易犯的错有两个：一是前期乱升角色，二是资源全砸抽卡。避开这俩，前期能舒服一大截。',
        '__这个 Boss 看着吓人，其实就一个机制要注意：它读条时躲到掩体后。摸清了之后，单人也能稳定过。',
        '零氪怎么玩得不憋屈？核心是把性价比最高的日常做了，放弃长草期无效肝。我把每日必做列成清单，照着勾就行，省时间还出效率。',
        '配队别盲目抄排行榜。我的思路是主 C + 破盾 + 奶 + 副 C，保证循环不断。理解逻辑比背阵容更重要，换版本也能自己调。',
        '这关的隐藏机制官方没写清楚，我实战摸了几次才搞明白。知道之后难度直接降一档，建议先收藏。',
        '某个系统别忽略，它才是版本 / 长线的关键。很多新手栽在这，早看懂早省心。',
        '速通思路：把无关环节砍掉，只留核心环节，主线 15 分钟内就能完。适合想快点体验剧情 / 赶上活动的朋友。',
        '版本更新后某个改动影响最大，建议优先适应；其他都是小修小补，不用慌。'
      ],
      closings: [
        '建议先收藏，下个版本我实测后更新。有更好的解法，评论区教教我。',
        '以上就是我的实战心得，不保证全对，但亲测好用。有问题评论区见。',
        '攻略我会持续更，关注不迷路。你卡在哪个环节？说出来我看看能不能帮上。',
        '照着做基本能稳过，剩下看手法。祝大家早日通关 / 满配！',
        '觉得有用点个赞，让更多新手看到，少踩点坑。',
        '每个人的BOX不同，灵活调整最重要。欢迎带图来问，我尽量回。'
      ]
    },
    '测评向': {
      ref: '测评',
      hooks: [
        '「氪了648之后，我劝你先看完这篇再决定」',
        '「上线7天，这游戏到底值不值得玩？」',
        '「__玩了一周，说点大实话」',
        '「不吹不黑，__真实体验报告」',
        '「零氪玩了__天，给大家交个底」',
        '「__值不值得入坑？看完这篇再下载」',
        '「玩了一个月，说点你搜不到的大实话」',
        '「__到底是不是换皮？我扒给你看」',
        '「__和同类型比，强在哪弱在哪」',
        '「__官方没告诉你的5个坑」',
        '「__肝度实测：每天要花多久」',
        '「__氪金性价比排行榜，照着氪不亏」',
        '「__新手期体验报告：前10小时值不值」',
        '「__社交系统真实体验，社恐友好吗」',
        '「__画面表现拉满，但有个硬伤」',
        '「__玩了__小时，给想入坑的你一句忠告」',
        '「__和前作比，进步还是退步」',
        '「__值不值得现在入坑？时间点很关键」',
        '「__长草期怎么过，老玩家经验贴」',
        '「__这游戏最被低估的一个系统」',
        '「__真实氪金账单，给你参考」',
        '「__我弃坑又回坑的真实原因」'
      ],
      titles: [
        '__玩了一周，说点大实话',
        '氪了一些之后，我劝你先看完这篇再决定',
        '__到底值不值得入坑？',
        '__和同类型比，强在哪弱在哪',
        '不吹不黑，__真实体验报告',
        '__官方没告诉你的几个坑',
        '__：值得现在入坑吗？时间点很关键',
        '零氪玩了几天，给大家交个底'
      ],
      bodies: [
        '一句话结论：值不值得，理由就一句核心原因。不想看长文的记住这句就够了。',
        '画面和音乐先说：你的真实感受，不踩一捧一。这俩是第一时间能感受到的，决定你愿不愿意继续。',
        '核心玩法爽点：讲你最喜欢的那一口，比如战斗手感、建造自由。肝度也实话实说：玩了多久、每天大概多久。',
        '氪金深度：你实际氪了多少，零氪能玩到哪。我的建议是零氪也能完整体验，重氪主要买皮肤 / 效率。',
        '说几个官方没明说的坑：坑一、坑二、坑三。提前知道能少走弯路，不至于玩两天想退坑。',
        '和同类型比，__强在社交压力小、弱在内容更新慢。按需选择，别被营销带节奏。',
        '长草期怎么过：做成就、囤资源、玩小号。这游戏长草期长短提前有心理准备，别到时候懵。',
        '适合谁、不适合谁：对号入座最准。比如喜欢慢节奏的放心冲，追求快节奏竞技的先观望。',
        '我弃坑又回坑的真实原因讲一下，说明它某个特质确实抓人，但某个问题也真劝退。',
        '真实氪金账单我列一下几个档位加实际花费，给你个参考，别盲目跟风氪。'
      ],
      closings: [
        '以上就是我的真实测评，不恰饭。值不值得，你按自己情况判断。',
        '入坑时间点我标了，建议前后再看一眼。祝玩得开心。',
        '有不同体验的欢迎评论区聊聊，测评最怕一家之言。',
        '氪不氪都行，关键是玩得舒服。理性消费，快乐游戏。',
        '觉得中肯点个赞，更多测评持续更新。',
        '你也在玩__吗？说说你的真实感受，我先来。'
      ]
    },
    '剧情/整活向': {
      ref: '剧情',
      hooks: [
        '「这游戏的剧情，编剧是懂刀人的」',
        '「当我把NPC的话当真了……」',
        '「__这段剧情，我直接破防了」',
        '「玩到这儿我笑不活了，官方太会整活」',
        '「__的隐藏结局，我愿称之为神来之笔」',
        '「这游戏二创素材也太多了吧」',
        '「这游戏的NPC，比主角还让人上头」',
        '「当我把游戏台词发到群里……」',
        '「__这个名场面，我截图当壁纸了」',
        '「官方在剧情里藏的彩蛋，第3个绝了」',
        '「玩到这段，我直接笑出鹅叫」',
        '「__的结局，我愿称之为神」',
        '「这游戏的二创，比游戏本身还上头」',
        '「当我用游戏逻辑理解现实生活」',
        '「__里最刀人的一句话，至今难忘」',
        '「官方太会玩梗了，笑不活」',
        '「这段剧情，建议所有人无剧透体验」',
        '「__名场面二创大赛，看看谁更会整活」',
        '「玩着玩着，我竟开始共情反派」',
        '「__的隐藏剧情，触发条件太刁钻」',
        '「游戏里的神回复NPC，承包我笑点」',
        '「这段过场动画，电影级」'
      ],
      titles: [
        '这游戏的剧情，编剧是懂刀人的',
        '当我把 NPC 的话当真了……',
        '__这段剧情，我直接破防了',
        '玩到这儿我笑不活了，官方太会整活',
        '__的隐藏结局，我愿称之为神来之笔',
        '这游戏的二创，比游戏本身还上头',
        '当我用游戏逻辑理解现实生活',
        '__里最刀人的一句话，至今难忘'
      ],
      bodies: [
        '先说那个瞬间：描述你玩到的场景，带画面感。当时你的真实反应，这个设计真的夸一句。',
        '剧情 / 梗还原（剧透预警）：你印象最深的情节。我是怎么被击中的，二刷才发现细节，编剧是真的用心。',
        '个人共鸣点：它戳中你的哪根神经。可能因为我某段经历 / 性格，这段让我情绪上头。真实一点，读者才共情。',
        '官方太会玩梗了，举一个具体梗 / 名场面。评论区都在某个反应，我也笑不活了。这种轻松整活，比硬煽情讨喜多了。',
        '隐藏结局触发条件讲一下，我是怎么误打误撞发现的。揭开那一刻感受，我愿称之为神来之笔。',
        '这游戏的二创素材也太多了吧：名场面截图、角色梗、剧情二创。随便截一张都能当表情包，难怪二创比本体还火。',
        '当我把游戏台词发到群里：描述反应。大家某个反应，瞬间共鸣拉满。好游戏就是这样，出圈靠的是这些瞬间。',
        '最刀人的一句话：引用那句话，至今难忘。当时场景，我情绪。文案里写这种细节，比喊口号动人一百倍。',
        '玩着玩着，我竟开始共情反派：讲为什么。好的叙事让你理解每个角色的选择，而不是非黑即白。这点值得写进你的二创。',
        '这段过场动画，电影级：讲哪里好，比如运镜 / 配乐 / 表演。我截图当壁纸了，建议无剧透体验，别错过。'
      ],
      closings: [
        '你玩到这段了吗？评论区聊聊你的破防瞬间，我去考古。',
        '无剧透安利就到这，剩下的自己体验最香。',
        '二创素材已就位，评论区交出你的神作。',
        '好剧情值得被更多人看到，转发给还在观望的朋友。',
        '官方要是看到这条，记得加鸡腿。编剧辛苦了。',
        '你也被哪段刀到了？说出来，咱互相疗伤。'
      ]
    }
  },
  render_copy(box, root) {
    const game = (this._copyGame || '').trim();
    const type = this._copyType || '安利向';
    this._copyType = type;
    const T = this.copyTypes[type];
    const camp = (window.MUMU_INCENTIVES && window.MUMU_INCENTIVES.campaigns || []).find(c => game && (c.game === game || c.game === '通用'));
    if (!this._curHooks || this._curHookType !== type) { this._curHooks = this._pickHooks(T.hooks, 3); this._curHookType = type; }
    if (!this._copyGen || this._copyGenType !== type) { this._copyGen = this.genCopy(); this._copyGenType = type; }
    if (this._recOpen === undefined) this._recOpen = true;
    box.innerHTML = `
      <div class="card">
        <h3>${icon('edit',16)} 文案类型</h3>
        <div class="form-row"><label>游戏名（可选，用于真实参考）</label><input id="cpGame" value="${esc(game)}" placeholder="如：造梦西游4"></div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px">${Object.keys(this.copyTypes).map(k => `<button class="chip ${k === type ? 'active' : ''}" data-ctype="${k}">${k}</button>`).join('')}</div>
      </div>

      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <h3 style="margin:0;font-size:15px">爆款开头钩子</h3>
          <button class="btn sm ghost" id="hookRefresh" style="font-size:12px">${icon('refresh',12)} 换一批</button>
        </div>
        ${this._curHooks.map((h, i) => `<div class="cp-feature" data-copyhook="${esc(h)}" style="${i ? 'margin-top:8px' : ''}">${esc(h)}</div>`).join('')}
      </div>

      <div class="card">
        <h3>${icon('search',16)} 找同类爆款参考</h3>
        <div id="refLinks" style="display:flex;gap:6px;flex-wrap:wrap">${this.refLinksHTML(game, type)}</div>
      </div>

      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <span style="font-weight:600;font-size:15px">文案推荐</span>
          <button class="btn sm ghost" id="recGen" style="font-size:12px;background:transparent;border:none">${icon('refresh',12)} 换一批</button>
        </div>
        ${camp ? `<div class="banner info" style="margin-bottom:8px;font-size:12px">📌 真实激励参考：<b>${esc(camp.title)}</b>${(camp.platforms && camp.platforms.length) ? (' · ' + esc(camp.platforms.join('/'))) : ''}${camp.reward ? (' · ' + esc(camp.reward)) : ''}${camp.deadline ? (' · 截止 ' + esc(camp.deadline)) : ''}（发文前请进游戏复核）</div>` : ''}
        <div class="muted" style="font-size:12px;margin-bottom:6px">下面是 3 篇可直接套用的成稿，点任意一篇即可复制全文，换一批会重新随机组合。</div>
        <div id="recBody">
          <div id="recList">${this.recHTML()}</div>
        </div>
      </div>`;

    box.querySelectorAll('[data-ctype]').forEach(b => b.onclick = () => { this._copyType = b.dataset.ctype; this._copyGame = box.querySelector('#cpGame').value.trim(); this._curHooks = null; this._copyGen = null; this.render_copy(box, root); });
    box.querySelector('#cpGame').onchange = () => { this._copyGame = box.querySelector('#cpGame').value.trim(); this._copyGen = null; this.render_copy(box, root); };
    box.querySelector('#hookRefresh').onclick = () => {
      this._curHooks = this._pickHooks(this.copyTypes[this._copyType].hooks, 3, this._curHooks);
      this.render_copy(box, root);
    };
    box.querySelectorAll('[data-copyhook]').forEach(el => el.onclick = () => copyText(el.dataset.copyhook));
    box.querySelectorAll('[data-quote]').forEach(el => el.onclick = () => copyText(el.dataset.quote));
    box.querySelector('#recGen').onclick = () => {
      this._curHooks = this._pickHooks(this.copyTypes[this._copyType].hooks, 3, this._curHooks);
      this._copyGen = this.genCopy();
      this.render_copy(box, root); toast('换了一批');
    };
    box.querySelectorAll('[data-copypara]').forEach(el => el.onclick = () => copyText(el.dataset.copypara));
  },
  recHTML() {
    const list = this._copyGen || [];
    if (!list.length) return '<div class="empty">点「换一批」生成文案</div>';
    return list.map((b, i) => `<div class="rec-para" data-copypara="${esc(b)}"><div class="rp-num">${i + 1}</div><div class="rp-text" style="white-space:pre-wrap;line-height:1.7">${esc(b)}</div><div class="rp-copy">复制</div></div>`).join('');
  },
  refLinksHTML(game, type) {
    const kwMap = { '安利向': '安利', '攻略向': '攻略', '测评向': '测评', '剧情/整活向': '剧情' };
    const q = encodeURIComponent((game ? game + ' ' : '') + kwMap[type]);
    return [
      ['小红书', 'https://www.xiaohongshu.com/search_result?keyword=' + q],
      ['B站', 'https://search.bilibili.com/all?keyword=' + q],
      ['TapTap', 'https://www.taptap.cn/search/' + q],
      ['好游快爆', 'https://www.3839.com/so/' + encodeURIComponent(game) + '.html']
    ].map(([n, u]) => `<a class="plat-badge" target="_blank" href="${u}">${n} ↗</a>`).join('');
  },
  // 从钩子库抽取 n 条不重复；exclude 里已有的尽量避开，保证「换一批」不重复且不死循环
  _pickHooks(arr, n, exclude) {
    const ex = exclude || [];
    const pool = arr.slice();
    n = Math.min(n, pool.length);
    // 未排除的排前面，优先取不一样的
    const ranked = pool.sort((a, b) => (ex.includes(a) ? 1 : 0) - (ex.includes(b) ? 1 : 0));
    const out = [];
    const used = new Set();
    for (const v of ranked) { if (!used.has(v)) { out.push(v); used.add(v); if (out.length === n) break; } }
    if (out.length < n) {
      const rest = pool.filter(v => !out.includes(v));
      while (out.length < n && rest.length) { const i = Math.floor(Math.random() * rest.length); out.push(rest.splice(i, 1)[0]); }
    }
    return out;
  },
  genCopy() {
    const type = this._copyType || '安利向';
    const T = this.copyTypes[type];
    const game = (this._copyGame || '').trim();
    const fill = s => game ? s.replace(/__+/g, game) : s.replace(/__+/g, '这款游戏');
    const pickDistinct = (arr, n) => {
      const pool = arr.slice(); const out = [];
      while (out.length < n && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
      return out;
    };
    const titles = pickDistinct(T.titles, 3);
    const hooks = pickDistinct(T.hooks, 3);
    const closings = pickDistinct(T.closings, 3);
    const drafts = [];
    for (let i = 0; i < 3; i++) {
      const bodies = pickDistinct(T.bodies, 2);
      const lines = [
        fill(titles[i]),
        '',
        fill(hooks[i]),
        '',
        bodies.map(fill).join('\n\n'),
        '',
        fill(closings[i])
      ];
      drafts.push(lines.join('\n'));
    }
    return drafts;
  },

  /* ---------- 剪辑灵感 ---------- */
  render_clip(box) {
    const lessons = [
      { name: '剪映官方教程（新手第一课）', kw: '剪映官方教程 新手入门', why: '免费、系统，跟着做完就能剪出第一条片子' },
      { name: '影视飓风', kw: '影视飓风 剪辑教程', why: '节奏、运镜、审美天花板，学「为什么这么剪」' },
      { name: 'doyoudo', kw: 'doyoudo 剪辑 入门', why: '轻松有趣的剪辑/特效入门，PR/达芬奇都有' },
      { name: '游戏区爆款拆解', kw: '游戏视频 剪辑技巧 节奏感', why: '专门看游戏视频怎么留住观众' }
    ];
    // 每日灵感参考（来自外部视频/图文，14:00自动更新）
    const insp = window.MUMU_CLIP_INSP || { items: [], updated: '-' };
    // B站搜索链接最稳，不会 404，且游戏剪辑爆款/教学都在 B站能搜到
    const bili = kw => 'https://search.bilibili.com/all?keyword=' + encodeURIComponent(kw);
    const inspItems = (insp.items && insp.items.length) ? insp.items : [
      { title: '游戏剪辑爆款案例', desc: 'B站搜「游戏剪辑 卡点 爆款」，看别人怎么留观众', link: bili('游戏剪辑 卡点 爆款') },
      { title: '游戏高燃混剪参考', desc: 'B站搜「游戏 高燃混剪」，学节奏和转场怎么燃起来', link: bili('游戏 高燃混剪') },
      { title: '游戏实况名场面', desc: 'B站搜「游戏实况 名场面 剪辑」，看高光怎么剪', link: bili('游戏实况 名场面 剪辑') },
      { title: '卡点转场技巧', desc: 'B站搜「游戏剪辑 卡点转场 技巧」，练手感', link: bili('游戏剪辑 卡点转场 技巧') },
      { title: '游戏解说爆款套路', desc: 'B站搜「游戏解说 爆款 套路」，学怎么开口留人', link: bili('游戏解说 爆款 套路') }
    ];
    // 剪辑小课堂（每日14:00自动更新；无数据时用内置基础课，均以剪映/B剪为例）
    const dismissed = S.get('clipLessonDismiss', []);
    const clipLessons = ((window.MUMU_CLIP_LESSONS && window.MUMU_CLIP_LESSONS.items) || [
      { t: '关键帧怎么用（剪映/B剪）', d: '关键帧=记录画面在某一刻的状态，让参数随时间变化。用法：选中素材 → 点「关键帧」菱形图标 → 开头打一帧（如缩放100%），移到结尾打一帧（缩放120%），画面就自动放大。常用于图片推拉、文字淡入、颜色渐变。' },
      { t: '高燃卡点怎么剪', d: '①选鼓点强的BGM；②在重音/Drop处切镜头；③高光画面放卡点瞬间，普通片段0.8~1.2倍速交替；④别让同一画面超过3秒。' },
      { t: '怎么做 vlog 开头', d: '前3秒决定完播：用「提问 / 反差 / 高能画面」抛钩子，配环境原声+大字幕，节奏轻快不拖沓。' },
      { t: '转场怎么选', d: '硬切：快节奏、动作衔接；叠化：时间流逝/回忆/情绪过渡；推拉/缩放转场：空间移动感。别滥用，一个视频2~3种足够。' },
      { t: '音效 & 音乐什么时候用', d: '打击音效配卡点重音；whoosh（嗖）配转场；叮咚/弹出音效配文字或元素出现；燃向用电子/摇滚，治愈用钢琴/轻音乐，悬疑用低频铺底。' }
    ]).filter(l => !dismissed.includes(l.t));
    // 热梗速览（每日更新；无数据时用内置示例）
    const trends = (window.MUMU_CLIP_TREND && window.MUMU_CLIP_TREND.items) || [
      { t: '反差萌', d: '正经解说突然接搞笑画面/音效，制造笑点' },
      { t: '沉浸式 ASMR', d: '放大环境原声（翻书/拆包装/键盘声），治愈解压' },
      { t: '一镜到底挑战', d: '不剪辑连贯拍完一个过程，显技术也显真实' },
      { t: '神评论/弹幕梗', d: '把热门评论做成字幕飘过，借热度涨互动' },
      { t: '前后对比', d: '「之前 vs 现在」同机位同角度，变化一眼可见' }
    ];
    box.innerHTML = `
      <div class="grid2">
        <div class="card"><h3>跟着学：优质剪辑课</h3>
          ${lessons.map(l => `<div class="list-row"><div style="flex:1"><b>${esc(l.name)}</b><div class="muted">${esc(l.why)}</div></div>
            <a class="btn sm" target="_blank" href="https://search.bilibili.com/all?keyword=${encodeURIComponent(l.kw)}">B站直达</a></div>`).join('')}
        </div>
        <div class="card"><h3>灵感锦囊</h3>
          <div class="muted" style="margin-bottom:8px">每日 14:00 更新，参考别人怎么拍</div>
          ${inspItems.map(i => `<a class="list-row" target="_blank" href="${i.link}" style="text-decoration:none;color:var(--ink);display:flex">
            <span>·</span><div style="flex:1"><b>${esc(i.title)}</b><div class="muted">${esc(i.desc)}</div></div><span>查看</span>
          </a>`).join('')}
        </div>
      </div>
      <div class="card" style="margin-top:14px"><h3>剪辑小课堂 <span class="muted" style="font-weight:400">（点右边去 B站看教学视频 · 长按条目可删）</span></h3>
        ${clipLessons.length ? clipLessons.map(l => { const kw = (l.kw || l.t.replace(/[（(].*?[)）]/g, '')) + ' 教程'; return `<div class="list-row"><div class="clesson-t" data-clesson="${esc(l.t)}" style="flex:1"><b>${esc(l.t)}</b><div class="muted" style="font-size:12px;margin-top:2px">去 B站看「${esc(kw)}」完整视频教学</div></div><a class="btn sm" target="_blank" href="https://search.bilibili.com/all?keyword=${encodeURIComponent(kw)}">B站教学 ↗</a></div>`; }).join('') : '<div class="empty">小课堂都学完删光啦，去 B站搜「剪映教程」继续进阶</div>'}
      </div>
      <div class="card" style="margin-top:14px"><h3>🔥 热梗速览 <span class="muted" style="font-weight:400">（点「看案例」跳视频看怎么用）</span></h3>
        ${trends.map(t => `<div class="list-row" style="align-items:flex-start"><div style="flex:1"><b>${esc(t.t)}</b><div class="muted" style="font-size:13px;margin-top:2px;line-height:1.5">${esc(t.d)}</div></div><a class="btn sm" target="_blank" href="https://search.bilibili.com/all?keyword=${encodeURIComponent(t.t + ' 游戏剪辑 案例')}">看案例 ↗</a></div>`).join('')}
      </div>`;
    // 剪辑小课堂：长按条目删除（学会了就长按删掉），持久化已删标题
    box.querySelectorAll('[data-clesson]').forEach(el => {
      this._longPress(el, () => {
        const t = el.dataset.clesson;
        if (!confirm('学会这条啦？删掉「' + t + '」小课堂？')) return;
        const dismissed = S.get('clipLessonDismiss', []);
        if (!dismissed.includes(t)) { dismissed.push(t); S.set('clipLessonDismiss', dismissed); }
        this.render_clip(box); toast('已删除这条小课堂');
      });
    });
  },

  /* ---------- 创作日历 & 活动规划 ---------- */
  logs() { return S.get('workLogs', {}); },
  normTarget(t) {
    const r = { app: t.app, video: Number(t.video) || 0, article: Number(t.article) || 0, total: Number(t.total) || 0, req: t.req || '', type: t.type || '' };
    if (r.total === 0) r.total = r.video + r.article;
    return r;
  },
  /* 活动目标行（永远带 req，缺字段时补空）——取目标的唯一入口，保证 req 不被丢 */
  targetsOf(a) {
    const ts = (a && a.targets && a.targets.length) ? a.targets : null;
    if (ts) return ts.map(t => this.normTarget(t));
    if (!a) return [{ app: '通用', video: 0, article: 0, total: 1, req: '' }];
    return [{ app: '通用', video: Number(a.targetVideo) || 0, article: Number(a.targetArticle) || 0, total: (Number(a.targetVideo) || 0) + (Number(a.targetArticle) || 0), req: '' }];
  },
  /* ===== 活动结算归一化（v283）=====
     新结构：review = { miss:{app:未达标篇数}, earn:{app:元}, reviewDate }
     旧结构：review = { reached:{app:bool}, reasons:{app:string}, earn:{app:number}, reviewDate }
     旧数据没有 miss：达标 → 未达标 0 篇；未达标 → 全部未达标（= total）
     所有读取结算的地方都走这里，保证旧数据不会显示成 0。 */
  reviewOf(a) {
    const rv = (a && a.review) || {};
    const ts = this.targetsOf(a);
    const miss = {}, earn = {};
    const earnSrc = (rv.earn && typeof rv.earn === 'object') ? rv.earn : {};
    Object.keys(earnSrc).forEach(k => { earn[k] = Number(earnSrc[k]) || 0; });
    if (rv.miss && typeof rv.miss === 'object') {
      ts.forEach(t => { const v = Number(rv.miss[t.app]); miss[t.app] = isNaN(v) ? 0 : Math.max(0, v); });
      // 结算过但后来改了目标的平台：保留原值，避免金额/篇数凭空消失
      Object.keys(rv.miss).forEach(k => { if (miss[k] == null) miss[k] = Math.max(0, Number(rv.miss[k]) || 0); });
    } else if (rv.reached && typeof rv.reached === 'object') {
      ts.forEach(t => { miss[t.app] = rv.reached[t.app] ? 0 : (Number(t.total) || 0); });
    } else {
      ts.forEach(t => { miss[t.app] = 0; });
    }
    // v310：分平台结算优先——platformSettle 覆盖聚合 review
    if (a && a.platformSettle && Object.keys(a.platformSettle).length) {
      const ps = a.platformSettle; const m2 = {}, e2 = {}; let rd = '';
      Object.keys(ps).forEach(p => { const s = ps[p]; m2[p] = Number(s.miss) || 0; e2[p] = Number(s.earn) || 0; if (s.reviewDate > rd) rd = s.reviewDate; });
      return { miss: m2, earn: e2, reviewDate: rd, reasons: (rv.reasons && typeof rv.reasons === 'object') ? rv.reasons : {} };
    }
    return { miss, earn, reviewDate: rv.reviewDate || '', reasons: (rv.reasons && typeof rv.reasons === 'object') ? rv.reasons : {} };
  },
  /* 结算篇数汇总：达标 ok 篇 / 要求 req 篇 / zero = 完全没达标的平台 */
  reviewStats(a) {
    const rv = this.reviewOf(a);
    const ts = this.targetsOf(a);
    let ok = 0, req = 0, earn = 0;
    const zero = [];
    ts.forEach(t => {
      const total = Number(t.total) || 0;
      const m = Math.min(total, Number(rv.miss[t.app]) || 0);
      const o = Math.max(0, total - m);
      req += total; ok += o;
      earn += Number(rv.earn[t.app]) || 0;
      if (total > 0 && o <= 0) zero.push(t.app);
    });
    Object.keys(rv.earn).forEach(k => { if (ts.every(t => t.app !== k)) earn += Number(rv.earn[k]) || 0; });
    return { ok, req, zero, earn, miss: rv.miss, earnMap: rv.earn, reviewDate: rv.reviewDate, reasons: rv.reasons };
  },
  /* 平台字段归一化：历史数据是字符串，新数据是数组 —— 统一读成数组 */
  appArr(v) {
    if (v == null || v === '') return [];
    if (Array.isArray(v)) return v.filter(Boolean);
    return [String(v)];
  },
  acts() {
    const arr = S.get('workActs', []);
    // 统一走 targetsOf：无论新旧结构，取到的目标都带 req 字段
    return arr.map(a => ({ ...a, targets: this.targetsOf(a) }));
  },
  /* ---------- 列表数据 ---------- */
  allLogs() { const logs = this.logs(); return Object.entries(logs).flatMap(([d, arr]) => arr.map(l => ({ ...l, date: d }))); },

  /* ---------- 今日打卡 ---------- */
  render_chk(box, root) {
    const logs = this.logs(); const today = todayStr();
    const todayIsRest = (S.get('workRest', []) || []).indexOf(today) >= 0;
    box.innerHTML = `
      <div class="card">
        <h3>今日打卡 <span style="margin-left:auto;display:flex;align-items:center;gap:6px"><button class="icon-btn" id="workRestBtn" title="${todayIsRest ? '取消今日休息' : '今日休息'}（长按创作日历里那一天可补记 / 设月经假）" style="${todayIsRest ? 'color:#e74c3c' : ''}">${icon(todayIsRest ? 'sun' : 'moon',16)}</button><button class="btn sm" id="logAdd">＋ 记录一条产出</button></span></h3>
        <div id="dayLogs">${(logs[today] || []).map(l => this.logRow(l, today)).join('') || '<div class="empty">今天还没有产出记录，剪完/写完就来打个卡！</div>'}</div>
      </div>`;
    box.querySelector('#logAdd').onclick = () => this.logDialog(root, today);
    const restBtn = box.querySelector('#workRestBtn');
    if (restBtn) restBtn.onclick = () => this.toggleRest(root);
    this.bindLogRows(box, root);
  },

  // 创作打卡页「今日休息」：直接写 workRest 数组，不计入连续创作中断（一周最多 1 天，一月最多 4 天）
  // ds 缺省为今天；传入过去日期即可「补记」休息（连续创作天数自动续上）
  toggleRest(root, ds) {
    ds = ds || todayStr();
    if (ds > todayStr()) { toast('不能给未来的日期设休息'); return; }
    const set = _restSet('work');
    const D = window.Daily;
    if (set.has(ds)) {
      restRemove('work', ds);
      if (D) { const arr = D.list(ds); arr.forEach(t => { if (t.cat === 'work') t.restDay = false; }); D.setList(ds, arr); }
      toast('已取消 ' + fmtCN(ds) + ' 的休息 · 连续创作重新计算');
    } else {
      if (menstrualSet().has(ds)) { toast(fmtCN(ds) + ' 已是月经假，不再叠加其他休息'); return; }
      const lg = S.get('workLogs', {});
      if (lg[ds] && lg[ds].length) { toast(fmtCN(ds) + ' 已经有创作打卡，不能设为休息'); return; }
      const chk = restCanAdd('work', ds);
      if (!chk.ok) { toast(chk.msg); return; }
      restAdd('work', ds);
      if (D) { const arr = D.list(ds); arr.forEach(t => { if (t.cat === 'work') t.restDay = true; }); D.setList(ds, arr); }
      toast('已将 ' + fmtCN(ds) + ' 设为休息日 · 连续创作不受影响');
    }
    this.render(root);
  },

  /* ---------- 活动规划 ---------- */
  render_act(box, root) {
    const acts = this.acts().filter(a => !a.settled);
    const all = this.allLogs();
    // 进行中：未完成 且 未截止；其余（已完成/已截止）归为隐藏组
    const doneAct = a => this.finOf(a, all) || (a.deadline && daysBetween(todayStr(), a.deadline) < 0);
    const active = acts.filter(a => !doneAct(a));
    const hidden = acts.filter(a => doneAct(a));
    if (!this._actOpen) this._actOpen = new Set();
    // 默认只显示进行中的前2个，其余（含全部已完成/已截止）折叠
    if (this._actExpanded == null) this._actExpanded = false;
    const SHOW_MAX = 2;
    // 按「离截止日期越近越靠前」排序（无截止日的排最后）——默认展示的就是最该抓紧的活动
    const byDeadline = arr => arr.slice().sort((a, b) => {
      const la = a.deadline ? daysBetween(todayStr(), a.deadline) : Infinity;
      const lb = b.deadline ? daysBetween(todayStr(), b.deadline) : Infinity;
      return la - lb;
    });
    const activeSorted = byDeadline(active);
    // 展开时：未完成（按截止日排序）在上，已完结/已截止放下面
    const actList = this._actExpanded ? [...activeSorted, ...hidden] : activeSorted.slice(0, SHOW_MAX);
    box.innerHTML = `
      <div class="card">
        <h3>活动规划 <span style="margin-left:auto;display:flex;gap:6px;align-items:center">
          <button class="icon-btn" id="actColl" title="活动收集箱" style="font-size:18px">${icon('inbox',18)}</button>
          <button class="icon-btn" id="actHistory" title="历史活动" style="font-size:18px">${icon('clock',18)}</button>
          <button class="btn sm" id="actAdd" title="新活动计划">＋</button>
        </span></h3>
        ${!this._actExpanded && (active.length > SHOW_MAX || hidden.length) ? `<button class="link sm" id="actToggleAll" style="margin-bottom:10px">${hidden.length ? `展开全部（${active.length} 进行中 · ${hidden.length} 已完成/已截止） ▾` : `展开全部（${active.length} 个） ▾`}</button>` : (this._actExpanded && acts.length > SHOW_MAX ? `<button class="link sm" id="actToggleAll" style="margin-bottom:10px">收起 ▴</button>` : '')}
        ${actList.map(a => {
          const fin = this.finOf(a, all);
          const collapsed = fin && !this._actOpen.has(a.id);
          const targets = a.targets && a.targets.length ? a.targets : [{ app: '通用', video: a.targetVideo || 0, article: a.targetArticle || 0 }];
          const left = a.deadline ? daysBetween(todayStr(), a.deadline) : null;
          const psCount = (a.platformSettle && targets.length) ? targets.filter(t => a.platformSettle[t.app]).length : 0;
          const settledTag = (fin && psCount > 0 && psCount < targets.length) ? `<span class="tag" style="background:#e0a458;color:#fff;border:none">结算中 ${psCount}/${targets.length}</span>` : '';
          return `<div class="card act-card" data-actid="${a.id}" style="margin-bottom:10px;position:relative">
            <button class="del act-del-btn" data-delact="${a.id}" title="长按此卡片显示删除">✕</button>
            <div class="act-head">
              ${fin ? `<button class="chev" data-toggleact="${a.id}" title="展开/收起">${collapsed ? '▸' : '▾'}</button>` : ''}
              <div class="act-info">
                <b class="act-name">${fin ? icon('check',14) + ' ' : ''}${esc(a.name)}</b>
                <div class="act-meta">
                  ${left === null ? '' : left < 0 ? '<span class="tag">已截止</span>' : `<span class="tag">${a.deadline} 截止 · 剩 ${left} 天</span>`}
                  ${settledTag}
                  <button class="act-edit-inline" data-editact="${a.id}" title="编辑">${icon('edit',12)}</button>
                </div>
              </div>
            </div>
            ${collapsed ? '' : `<div class="act-body">${this.tplTargets(a, targets)}</div>`}
          </div>`;
        }).join('') || '<div class="empty">还没有进行中的活动计划。从「激励雷达」选个活动，点「规划成创作任务」试试！</div>'}
      </div>`;
    box.querySelector('#actAdd').onclick = () => this.activityDialog(root, {});
    const histBtn = box.querySelector('#actHistory');
    if (histBtn) histBtn.onclick = () => { this._actHistory = true; this.render(root); };
    const collBtn = box.querySelector('#actColl');
    if (collBtn) collBtn.onclick = () => { this._workView = 'collection'; this.render(root); };
    const toggleAllBtn = box.querySelector('#actToggleAll');
    if (toggleAllBtn) toggleAllBtn.onclick = () => { this._actExpanded = !this._actExpanded; this.render(root); };
    // 活动删除：长按卡片显示右上角 ✕，点击 ✕ 删除（含未结算活动）
    box.querySelectorAll('.act-card').forEach(card => {
      const btn = card.querySelector('.act-del-btn'); if (!btn) return;
      let timer = null, revealed = false;
      const start = () => { if (timer) return; timer = setTimeout(() => { revealed = true; card.classList.add('act-del-show'); }, 450); };
      const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };
      card.addEventListener('pointerdown', start);
      card.addEventListener('pointerup', cancel);
      card.addEventListener('pointercancel', cancel);
      card.addEventListener('pointerleave', cancel);
      card.addEventListener('contextmenu', e => e.preventDefault());
      btn.addEventListener('click', e => {
        e.stopPropagation();
        if (!revealed) return; // 须先长按揭示
        if (!confirm('确定删除这个活动？已关联的每日计划打卡不受影响，但活动计划本身会被移除。')) return;
        S.set('workActs', S.get('workActs', []).filter(x => x.id !== btn.dataset.delact));
        this.render(root);
      });
    });
    box.querySelectorAll('[data-editact]').forEach(b => b.onclick = () => { const a = this.acts().find(x => x.id === b.dataset.editact); if (a) this.activityDialog(root, a); });
    box.querySelectorAll('[data-toggleact]').forEach(b => b.onclick = () => { const id = b.dataset.toggleact; if (this._actOpen.has(id)) this._actOpen.delete(id); else this._actOpen.add(id); this.render(root); });
  },

  render_act_history(box, root) {
    const settled = this.acts().filter(a => a.settled);
    const matchFilter = a => {
      const f = this._histFilter; if (!f) return true;
      const st = this.reviewStats(a);
      const okAll = st.req === 0 ? true : st.ok >= st.req;
      if (f === 'ok') return okAll;
      if (f === 'miss') return !okAll;
      return true;
    };
    const settledSorted = settled.filter(matchFilter).slice().sort((a, b) => {
      const da = (a.review && a.review.reviewDate) || a.deadline || '';
      const db = (b.review && b.review.reviewDate) || b.deadline || '';
      return db.localeCompare(da);
    });
    box.innerHTML = `<div class="card">
      <div class="coll-tabs" style="margin:0 0 12px">
        <button class="${!this._histFilter || this._histFilter === 'all' ? 'on' : ''}" data-hf="all">全部 ${settled.length}</button>
        <button class="${this._histFilter === 'ok' ? 'on' : ''}" data-hf="ok">达标</button>
        <button class="${this._histFilter === 'miss' ? 'on' : ''}" data-hf="miss">没达标</button>
      </div>
      ${settledSorted.length ? settledSorted.map(a => {
        const st = this.reviewStats(a);
        const targets = this.targetsOf(a);
        const totalEarn = st.earn;
        const reasonTxt = Object.entries(st.reasons || {}).filter(([, v]) => v).map(([k, v]) => k + '：' + v).join('；');
        const platTags = targets.map(t => { const total = Number(t.total) || 0; const miss = Number((st.miss && st.miss[t.app]) || 0); const okN = Math.max(0, total - miss); const cls = total === 0 ? '#9aa' : (okN >= total ? '#7CB390' : (okN === 0 ? '#c0392b' : '#e0a458')); return `<span class="tag" style="background:${cls};color:#fff;border:none">${esc(t.app)} ${okN}/${total}</span>`; }).join('');
      return `<div class="card act-card act-card-hist" data-actid="${a.id}" style="margin-bottom:10px;position:relative">
        <button class="del act-edit-btn" data-editact-hist="${a.id}" title="编辑结算（改未达标篇数/收益）">✎</button>
        <button class="del act-del-btn" data-delact="${a.id}" title="长按此卡片显示编辑/删除">✕</button>
        <div style="display:flex;align-items:center;gap:8px;padding-right:70px"><b>${esc(a.name)}</b>${a.deadline ? `<span class="tag">${a.deadline} 截止</span>` : ''}</div>
          <div style="display:flex;gap:6px;margin-top:6px;align-items:center;flex-wrap:wrap">${platTags}</div>
          <div style="display:flex;gap:8px;margin-top:6px;align-items:center;flex-wrap:wrap">
            <span class="tag" style="background:#111;color:#fff;border:none">达标 ${st.ok}/${st.req} 篇</span>
            ${totalEarn > 0 ? `<span class="tag" style="background:#F6C56E;color:#fff;border:none">收入 ¥${fmtYuan(totalEarn)}</span>` : ''}
          </div>
          ${reasonTxt ? `<div class="muted" style="font-size:12px;margin-top:6px">${esc(reasonTxt)}</div>` : ''}
        </div>`;
      }).join('') : '<div class="empty">这个筛选下还没有活动。在活动规划里给已完成/已截止的活动结算后，会归集到这里。</div>'}
  </div>`;
    box.querySelectorAll('[data-hf]').forEach(b => b.onclick = () => { this._histFilter = b.dataset.hf === 'all' ? null : b.dataset.hf; this.render(root); });
  box.querySelectorAll('.act-card').forEach(card => {
    const btn = card.querySelector('.act-del-btn'); if (!btn) return;
    let timer = null, revealed = false;
    const start = () => { if (timer) return; timer = setTimeout(() => { revealed = true; card.classList.add('act-del-show'); }, 450); };
    const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };
    card.addEventListener('pointerdown', start);
    card.addEventListener('pointerup', cancel);
    card.addEventListener('pointercancel', cancel);
    card.addEventListener('pointerleave', cancel);
    card.addEventListener('contextmenu', e => e.preventDefault());
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (!revealed) return; // 须先长按揭示
      if (!confirm('确定删除这个已归档活动？它的结算与收入记录也会一并移除，且无法恢复。')) return;
      S.set('workActs', S.get('workActs', []).filter(x => x.id !== btn.dataset.delact));
      this.render(root);
    });
  });
  box.querySelectorAll('[data-editact-hist]').forEach(b => b.onclick = () => { const a = this.acts().find(x => x.id === b.dataset.editactHist); if (a) this.activityDialog(root, a); });
},

  /* ---------- 活动收集箱（原激励雷达重设计 · v310） ---------- */
  render_collection(box, root) {
    const D = window.MUMU_INCENTIVES || { updated: '-', campaigns: [], platforms: [], note: '' };
    const kw = this._collKw || '';
    const auto = (D.campaigns || [])
      .filter(c => c.deadline !== '长期')
      .filter(c => { if (!/^\d{4}-\d{2}-\d{2}/.test(c.deadline)) return true; return daysBetween(todayStr(), c.deadline) >= 0; })
      .map(c => ({ ...c, src: 'auto' }));
    let mine = S.get('actCollection', []) || [];
    const before = mine.length;
    mine = mine.filter(c => { if (!c.deadline || !/^\d{4}-\d{2}-\d{2}/.test(c.deadline)) return true; return daysBetween(todayStr(), c.deadline) >= 0; });
    if (mine.length !== before) S.set('actCollection', mine);
    const all = [...auto, ...mine];
    const list = kw ? all.filter(c => (c.game || '').includes(kw) || (c.title || '').includes(kw)) : all;
    const platInfo = k => (D.platforms || []).find(x => x.name === k) || null;
    box.innerHTML = `
      <div class="card">
        <h3>${icon('search',16)} 搜已收集的活动</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <input id="collKw" class="search" placeholder="输入游戏名，如：遗忘之海" style="flex:1;min-width:170px" value="${esc(kw)}">
          <button class="btn" id="collSearch">搜索</button>
          <button class="btn ghost" id="collAdd">＋ 添加</button>
        </div>
        <div class="muted" style="margin-top:8px;font-size:12px">${esc(D.note) || '以下活动均来自公开可验证的官方渠道，投稿前请点开来源链接二次确认。'}</div>
        ${mine.length && !kw ? '<div class="muted" style="margin-top:6px;font-size:12px">📥 你手动收集的活动 ' + mine.length + ' 个（链接粘贴添加，真实有效）</div>' : ''}
        ${list.length ? list.map(c => {
          const left = /^\d{4}/.test(c.deadline) ? daysBetween(todayStr(), c.deadline) : null;
          const plats = (c.platforms || []).map(p => `<button class="plat-pill" data-plat="${esc(p)}" data-ckey="${esc(c.title)}">${esc(p)}</button>`).join('');
          return `<div class="coll-card" data-ckey="${esc(c.title)}">
            <div class="cc-top">
              <div><div class="cc-title">${esc(c.title)}</div>${c.game ? '<div class="cc-game">' + esc(c.game) + '</div>' : ''}</div>
            </div>
            <div class="coll-plats">${plats || '<span class="muted">未标注平台</span>'}</div>
            <div class="coll-info">${icon('money',14)} ${esc(c.reward || '奖励未注明')}</div>
            <div class="coll-info">${icon('calendar',14)} ${esc(c.period || '周期未注明')}</div>
            <div class="coll-info">${icon('tag',14)} ${esc(c.require || '达标要求未注明')}</div>
            <div class="coll-acts" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:6px">
              <a class="btn sm" href="${c.source || '#'}" target="_blank" ${c.source ? '' : 'style="pointer-events:none;opacity:.5"'}>官方原文 ↗</a>
              ${left === null ? '<span class="tag">长期</span>' : '<span class="tag">剩 ' + left + ' 天</span>'}
              <button class="btn sm ghost" data-plan="${esc(c.title)}">添加进活动规划</button>
            </div>
          </div>`;
        }).join('') : '<div class="coll-empty">还没有匹配的活动。换个关键词，或点「＋ 添加」把平台活动链接贴进来。</div>'}
      </div>`;
    const doS = () => { this._collKw = box.querySelector('#collKw').value.trim(); this.render_collection(box, root); };
    box.querySelector('#collSearch').onclick = doS;
    box.querySelector('#collKw').onkeydown = e => { if (e.key === 'Enter') doS(); };
    const addBtn = box.querySelector('#collAdd'); if (addBtn) addBtn.onclick = () => this.addToCollection(root);
    box.querySelectorAll('[data-plat]').forEach(b => b.onclick = () => {
      const pname = b.dataset.plat; const p = platInfo(pname);
      const c = all.find(x => x.title === b.dataset.ckey);
      openModal(`<button class="close-x" onclick="closeModal()">×</button><h3>${esc(pname)} · 活动要求</h3>
        <div class="card" style="box-shadow:none">
          <div style="font-weight:600;margin-bottom:6px">${esc(c ? c.title : '')}</div>
          <div class="coll-info">${icon('tag',14)} 达标要求：${esc(c ? (c.require || '未注明') : '未注明')}</div>
          <div class="coll-info">${icon('money',14)} 奖励：${esc(c ? (c.reward || '未注明') : '未注明')}</div>
          <div class="coll-info">${icon('calendar',14)} 周期：${esc(c ? (c.period || '未注明') : '未注明')}</div>
          ${p ? '<div class="coll-info">📌 平台入口：<a href="' + p.entry + '" target="_blank">' + esc(p.entry) + ' ↗</a></div><div class="coll-info">' + esc(p.tip || '') + '</div>' : ''}
        </div>
        ${c && c.source ? '<a class="btn" href="' + c.source + '" target="_blank" style="width:100%;margin-top:10px">查看官方原文 ↗</a>' : ''}`);
    });
    box.querySelectorAll('[data-plan]').forEach(b => b.onclick = () => {
      const c = all.find(x => x.title === b.dataset.plan);
      if (!c) return;
      this._workView = null; this.render(root);
      setTimeout(() => { const el = root.querySelector('#sec-act'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); this.activityDialog(root, { name: (c.game ? c.game + ' · ' : '') + c.title, deadline: /^\d{4}/.test(c.deadline) ? c.deadline : '', platforms: (c.platforms || []).slice(), req: c.require || '' }); }, 60);
    });
  },
  addToCollection(root) {
    const hostMap = [['xiaohongshu.com', '小红书'], ['bilibili.com', 'B站'], ['b23.tv', 'B站'], ['douyin.com', '抖音'], ['game.douyin.com', '抖音'], ['taptap.cn', 'TapTap'], ['taptap.com', 'TapTap'], ['3839.com', '好游快爆'], ['kuaibao', '好游快爆'], ['weibo.com', '微博']];
    openModal(`<button class="close-x" onclick="closeModal()">×</button><h3>添加活动到收集箱</h3>
      <div class="muted" style="margin-bottom:8px">粘贴平台活动链接，枝枝按域名识别平台；活动名/要求/奖励请填真实信息（不编造）。也可不贴链接，直接手动填。</div>
      <div class="form-row"><label>活动链接（选填）</label><input id="colUrl" placeholder="https://..."></div>
      <div class="form-row"><label>游戏 / 作品名</label><input id="colGame" placeholder="如：遗忘之海"></div>
      <div class="form-row"><label>活动名称</label><input id="colTitle" placeholder="如：XX 创作激励"></div>
      <div class="form-row"><label>参与平台</label><select id="colPlat">${this.PLATS.map(p => '<option value="' + p + '">' + p + '</option>').join('')}</select></div>
      <div class="form-row"><label>截止日期</label><input type="date" id="colDl"></div>
      <div class="form-row"><label>达标要求</label><input id="colReq" placeholder="如：播放1000+ / 上首页 / 10赞以上"></div>
      <div class="form-row"><label>奖励</label><input id="colReward" placeholder="如：现金 / 流量扶持"></div>
      <div class="form-row"><label>官方原文链接</label><input id="colSrc" placeholder="来源链接（选填）"></div>
      <button class="btn" id="colOk">加入收集箱</button>`);
    setTimeout(() => {
      const urlEl = document.getElementById('colUrl');
      if (urlEl) urlEl.oninput = () => { const u = (urlEl.value || '').toLowerCase(); const hit = hostMap.find(([h]) => u.indexOf(h) >= 0); if (hit) { const sel = document.getElementById('colPlat'); if (sel) sel.value = hit[1]; } };
      const ok = document.getElementById('colOk');
      if (ok) ok.onclick = () => {
        const title = document.getElementById('colTitle').value.trim();
        const game = document.getElementById('colGame').value.trim();
        if (!title && !game) return toast('至少填活动名或游戏名');
        const arr = S.get('actCollection', []);
        arr.unshift({ id: uid(), game, title: title || game, platforms: [document.getElementById('colPlat').value], deadline: document.getElementById('colDl').value, require: document.getElementById('colReq').value.trim(), reward: document.getElementById('colReward').value.trim(), source: document.getElementById('colSrc').value.trim(), addedAt: todayStr(), userAdded: true });
        S.set('actCollection', arr); closeModal(); this._workView = 'collection'; this.render(root); toast('已加入活动收集箱');
      };
    }, 0);
  },

  /* ---------- 周 / 月 / 年 产出（方块） ---------- */
  render_wk(box, root) {
    this.prodTile(box, root, this.periodItems('wk'), '本周产出');
  },
  render_mo(box, root) {
    this.prodTile(box, root, this.periodItems('mo'), '本月产出');
  },
  render_yr(box, root) {
    this.prodTile(box, root, this.periodItems('yr'), '本年产出');
  },
  periodCard(box, root, items, title, ic) {
    box.innerHTML = `
      <div class="card" style="text-align:center;margin-bottom:14px">
        <div class="stat-num" style="font-size:36px">${items.length}</div>
        <div class="stat-lab">${title}</div>
      </div>
      ${items.length ? `<div class="card"><h3>${icon('clipboard',16)} ${title}明细</h3>${items.slice().reverse().map(l => this.logRow(l, l.date)).join('')}</div>` : '<div class="empty">这段时间还没有产出记录，去打第一个卡吧</div>'}`;
    this.bindLogRows(box, root);
  },

  /* ---------- 创作日历 / 热力图 ---------- */
  render_cal(box, root) {
    const logs = this.logs();
    const marks = {}; Object.keys(logs).forEach(d => { marks[d] = logs[d].map(l => l.type === 'video' ? '#7CB390' : '#F6C56E'); });
    const restSet = new Set((S.get('workRest', []) || []));
    const mensSet = menstrualSet();
    const todayIsRest = restSet.has(todayStr());
    box.innerHTML = `<div class="card"><h3 style="font-size:14px;color:var(--sub);font-weight:600">创作日历 <span style="margin-left:auto"><button class="icon-btn" id="workCalRest" title="${todayIsRest ? '取消今日休息' : '今日休息'}（长按日历里那一天可补记 / 设月经假）" style="${todayIsRest ? 'color:#e74c3c' : ''}">${icon(todayIsRest ? 'sun' : 'moon',16)}</button></span></h3><div id="workCal"></div>
      <div class="sp-rest-note"><span class="sp-rest-sq"></span>休息<span class="muted" style="font-size:11px;margin-left:6px">· 长按日历某天可补记</span></div>
      <div class="sp-mens-note"><span class="sp-mens-sq"></span>月经假<span class="muted" style="font-size:11px;margin-left:6px">· 连续两天 · 与其他假不重叠</span></div>
      <div class="muted" style="margin-top:8px;display:flex;gap:14px">
        <span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#7CB390;margin-right:4px"></span>视频</span>
        <span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#F6C56E;margin-right:4px"></span>图文</span>
      </div></div>`;
    renderMonthCal(box.querySelector('#workCal'), { ym: this.ym, marks, restSet, menstrualSet: mensSet, onClick: ds => this.dayDialog(root, ds), onLongPress: ds => openRestMenu(ds, 'work', () => this.render(root), d => this.toggleRest(root, d)) });
    const restBtn = box.querySelector('#workCalRest');
    if (restBtn) restBtn.onclick = () => this.toggleRest(root);
  },
  render_hm(box, root) {
    const logs = this.logs();
    const countMap = {}; Object.keys(logs).forEach(d => countMap[d] = logs[d].length);
    box.innerHTML = `<div class="card"><h3 style="font-size:14px;color:var(--sub);font-weight:600">创作热力图</h3><div id="workHm"></div></div>`;
    const hmEl = box.querySelector('#workHm');
    hmEl._hm = { months: 3 };
    renderHeatmap(hmEl, countMap);
  },
  /* ---------- 创作收入（各平台累计 · 周/月/年） ---------- */
  render_earn(box, root) {
    const acts = this.acts();
    const now = todayStr();
    const entries = [];
    acts.forEach(a => {
      if (!a.review) return;
      const rv = this.reviewOf(a);               // 归一化：新旧结算结构都能取到 earn
      Object.keys(rv.earn).forEach(p => {
        const amt = rv.earn[p] || 0;
        if (amt > 0) entries.push({ platform: p, amount: amt, actName: a.name, actId: a.id, date: rv.reviewDate || a.deadline || '' });
      });
    });
    const mode = this._earnMode || 'week';
    const inPeriod = d => {
      if (!d) return true; // 未记录日期的收入默认计入各周期（导入历史数据兜底，避免月/年看不到）
      if (mode === 'week') return d >= weekStart(now) && d <= now;
      if (mode === 'month') return d.slice(0, 7) === now.slice(0, 7);
      return d.slice(0, 4) === now.slice(0, 4);
    };
    const filtered = entries.filter(e => inPeriod(e.date));
    const byPlat = {};
    filtered.forEach(e => { byPlat[e.platform] = (byPlat[e.platform] || 0) + e.amount; });
    const total = filtered.reduce((s, e) => s + e.amount, 0);
    const plats = Object.keys(byPlat).sort((a, b) => byPlat[b] - byPlat[a]);
    const modeLabel = mode === 'week' ? '本周' : mode === 'month' ? '本月' : '今年';
    box.innerHTML = `<div class="card">
      <h3>${icon('money',16)} 创作收入</h3>
      <div style="display:flex;gap:6px;margin:6px 0 10px">
        ${['week', 'month', 'year'].map(m => `<button class="btn sm ${this._earnMode === m ? '' : 'ghost'}" data-emode="${m}">${m === 'week' ? '周' : m === 'month' ? '月' : '年'}</button>`).join('')}
      </div>
      <div class="stat-num" style="font-size:30px">¥${fmtYuan(total)}</div>
      <div class="muted" style="margin-bottom:8px">${modeLabel}累计收入</div>
      ${plats.length ? plats.map(p => `<div class="earn-plat" data-plat="${esc(p)}" style="display:flex;justify-content:space-between;align-items:center;padding:9px 10px;border:1px solid var(--line);border-radius:10px;margin:6px 0;cursor:pointer">
        <span>${esc(p)}</span><b>¥${fmtYuan(byPlat[p])}</b></div>`).join('') : '<div class="empty">还没有记录收入，去已完成活动的「编辑」里填各平台赚了多少</div>'}
    </div>`;
    box.querySelectorAll('[data-emode]').forEach(b => b.onclick = () => { this._earnMode = b.dataset.emode; this.render_earn(box, root); });
    box.querySelectorAll('.earn-plat').forEach(el => el.onclick = () => {
      const p = el.dataset.plat;
      const list = filtered.filter(e => e.platform === p);
      openModal(`<button class="close-x" onclick="closeModal()">×</button><h3>${esc(p)} · 收入明细</h3>
        <div style="max-height:60vh;overflow:auto">${list.length ? list.map(e => `<div class="list-row"><span style="flex:1">${esc(e.actName)}<div class="muted" style="font-size:11px">${e.date || '未记录日期'}</div></span><b>¥${fmtYuan(e.amount)}</b></div>`).join('') : '<div class="empty">暂无记录</div>'}</div>
        <div style="margin-top:8px;display:flex;justify-content:space-between"><span class="muted">合计</span><b>¥${fmtYuan(byPlat[p])}</b></div>`);
    });
  },
  /* 创作收入合计（供财务快照「内容变现」单向同步，避免记两遍）
     传 ym='YYYY-MM' 只统计该月结算的；不传则为累计。
     口径与 render_earn 一致：按 reviewDate 归月，无日期的旧数据兜底计入每个周期。 */
  creationTotal(ym) {
    let t = 0;
    this.acts().forEach(a => {
      if (!a.review) return;
      const rv = this.reviewOf(a);               // 归一化：新旧结算结构都能取到 earn
      const d = rv.reviewDate || a.deadline || '';
      if (ym && d && d.slice(0, 7) !== ym) return; // 无日期的兜底计入（导入历史数据，避免某月看不到）
      Object.keys(rv.earn).forEach(p => { t += Number(rv.earn[p]) || 0; });
    });
    return Math.round(t * 100) / 100;
  },

  /* ---------- 活动进度计算（供活动规划复用） ---------- */
  finOf(a, all) {
    all = all || this.allLogs();
    const ts = a.targets && a.targets.length ? a.targets : [{ app: '通用', video: a.targetVideo || 0, article: a.targetArticle || 0, total: (Number(a.targetVideo) || 0) + (Number(a.targetArticle) || 0) }];
    return ts.every(t => {
      const wantV = !t.type || t.type === '视频';
      const wantA = !t.type || t.type === '图文';
      const vD = wantV ? all.filter(l => l.actId === a.id && (l.app || []).includes(t.app) && l.type === 'video').length : 0;
      const aD = wantA ? all.filter(l => l.actId === a.id && (l.app || []).includes(t.app) && l.type === 'article').length : 0;
      const done = vD + aD;
      return t.total > 0 && done >= t.total;
    });
  },
  tplTargets(a, targets) {
    const all = this.allLogs();
    return targets.map(t => {
      const wantV = !t.type || t.type === '视频';
      const wantA = !t.type || t.type === '图文';
      const vDone = wantV ? all.filter(l => l.actId === a.id && (l.app || []).includes(t.app) && l.type === 'video').length : 0;
      const aDone = wantA ? all.filter(l => l.actId === a.id && (l.app || []).includes(t.app) && l.type === 'article').length : 0;
      const done = vDone + aDone;
      return `<div style="margin-top:8px">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px"><b>${esc(t.app)}</b>${t.type ? ` <span class="tag">${esc(t.type)}</span>` : ''}${t.req ? ` <span class="tag">达标：${esc(t.req)}</span>` : ''}<span style="flex:1"></span>${t.total > 0 ? (done >= t.total ? ` <span class="tag">已完成</span>` : ` <span class="tag">还差 ${t.total - done}</span>`) : ''}</div>
        ${t.total > 0 ? `<div class="progress-bar"><i style="width:${Math.min(100, done / t.total * 100)}%"></i></div>` : ''}
      </div>`;
    }).join('');
  },
  // 今日计划是否关联了该活动（用于活动卡互通可视化）
  planLinkedToday(a) {
    const d = todayStr();
    const plans = S.get('plans', {})[d] || [];
    const t = plans.find(x => x.link === 'work:act:' + a.id || x.link === 'work:today');
    if (!t) return null;
    const all = this.allLogs();
    const ts = a.targets && a.targets.length ? a.targets : [{ app: '通用', video: a.targetVideo || 0, article: a.targetArticle || 0, total: (Number(a.targetVideo) || 0) + (Number(a.targetArticle) || 0) }];
    const done = ts.every(tg => {
      if (!tg.total) return true;
      const wantV = !tg.type || tg.type === '视频';
      const wantA = !tg.type || tg.type === '图文';
      const v = wantV ? all.filter(l => l.actId === a.id && (l.app || []).includes(tg.app) && l.type === 'video').length : 0;
      const ar = wantA ? all.filter(l => l.actId === a.id && (l.app || []).includes(tg.app) && l.type === 'article').length : 0;
      return (v + ar) >= tg.total;
    });
    return { task: t, done };
  },
  /* 单条产出记录（v283：长按整行揭示 ✎编辑 / ✕删除，短按不做任何事） */
  logRow(l, d) {
    const act = this.acts().find(a => a.id === l.actId);
    const apps = (l.app || []).map(p => `<span class="tag" style="margin-right:3px">${esc(p)}</span>`).join('');
    const reqs = l.req && Object.keys(l.req).length ? ' ' + Object.entries(l.req).filter(([, v]) => v).map(([k, v]) => `<span class="tag" style="margin-right:3px">${esc(k)}：${esc(v)}</span>`).join('') : '';
    return `<div class="list-row log-row" data-logid="${d}|${l.id}"><span>${l.type === 'video' ? icon('play',16) : icon('edit',16)}</span>
      <div style="flex:1"><b>${esc(l.topic || '')}</b> ${esc(l.note || '')}
        <div style="margin-top:3px;display:flex;gap:4px;flex-wrap:wrap">${apps}${reqs}${act ? `<span class="tag">${esc(act.name)}</span>` : ''}</div>
      </div>
      <button class="del log-edit-btn" data-editlog="${d}|${l.id}" title="长按本行后显示">✎</button>
      <button class="del log-del-btn" data-dellog="${d}|${l.id}" title="长按本行后显示">✕</button></div>`;
  },
  bindDelLog(b, root) {
    b.onclick = () => { const [d, id] = b.dataset.dellog.split('|'); const logs = this.logs(); logs[d] = (logs[d] || []).filter(x => x.id !== id); S.set('workLogs', logs); this.render(root); };
  },
  bindEditLog(b, root) {
    b.onclick = () => {
      const [d, id] = b.dataset.editlog.split('|');
      const l = (this.logs()[d] || []).find(x => x.id === id);
      if (l) this.logEditDialog(root, d, l);
    };
  },
  /* 给一组记录行挂：长按揭示图标 + ✎/✕ 的点击（日历弹窗 / 概览 / 周期明细共用） */
  bindLogRows(scope, root) {
    const host = scope || document;
    host.querySelectorAll('.log-row').forEach(row => {
      const del = row.querySelector('[data-dellog]'); if (del) this.bindDelLog(del, root);
      const ed = row.querySelector('[data-editlog]'); if (ed) this.bindEditLog(ed, root);
      if (row._logLp) return;                       // DOM 复用时防重复挂长按
      row._logLp = true;
      this._longPress(row, () => row.classList.toggle('log-del-show'));
    });
  },
  dayDialog(root, ds) {
    const logs = this.logs()[ds] || [];
    openModal(`<button class="close-x" onclick="closeModal()">×</button><h3>${icon('calendar',18)} ${fmtCN(ds)} 的产出</h3>
      ${logs.length ? `<div class="muted" style="font-size:12px;margin:-4px 0 6px">长按某条记录 → 出现 ✎编辑 / ✕删除</div>` : ''}
      ${logs.length ? logs.map(l => this.logRow(l, ds)).join('') : '<div class="empty">这天没有记录</div>'}
      <button class="btn" id="dlAdd" style="width:100%;margin-top:10px">＋ 给这天补记一条</button>`);
    this.bindLogRows(document, root);
    document.getElementById('dlAdd').onclick = () => this.logDialog(root, ds);
  },
  logDialog(root, ds) {
    const all = this.allLogs();
    const acts = this.acts().filter(a => {
      const fin = this.finOf(a, all);
      const left = a.deadline ? daysBetween(todayStr(), a.deadline) : null;
      return !fin && !(left !== null && left < 0);
    });
    openModal(`<button class="close-x" onclick="closeModal()">×</button><h3>${icon('check',18)} 产出打卡 · ${fmtCN(ds)}</h3>
      <div class="form-row"><label>类型</label><select id="lgType"><option value="video">${icon('play',14)} 视频</option><option value="article">${icon('edit',14)} 图文</option></select></div>
      <div class="form-row"><label>主题</label><input id="lgGame" placeholder="主题/游戏？如：造梦西游4 / 好物分享"></div>
      <div class="form-row"><label>发布平台（可多选，区分哪个平台发的）</label>
        <div id="lgApps" style="display:flex;gap:6px;flex-wrap:wrap">${this.PLATS.map(p => `<label class="chip" style="cursor:pointer"><input type="checkbox" value="${p}" class="lg-app" style="margin-right:4px;accent-color:#111"> ${p}</label>`).join('')}</div></div>
      <div id="lgReqs"></div>
      <div class="form-row"><label>关联活动（算进活动进度）</label><select id="lgAct"><option value="">不关联</option>${acts.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select></div>
      <div class="form-row"><label>备注/链接</label><input id="lgNote" placeholder="视频标题、链接…"></div>
      <button class="btn" id="lgOk" style="width:100%">打卡</button>`);
    const reqBox = document.getElementById('lgReqs');
    const paintReqs = () => {
      const sel = [...document.querySelectorAll('.lg-app:checked')].map(c => c.value);
      reqBox.innerHTML = sel.length ? sel.map(app => `<div class="form-row"><label>${app} 的达标要求（可选）</label><input class="lg-req" data-app="${app}" placeholder="如：上首页 / 10赞以上 / 播放1000+"></div>`).join('') : '';
    };
    document.querySelectorAll('.lg-app').forEach(c => c.onchange = paintReqs);
    document.getElementById('lgOk').onclick = () => {
      const app = [...document.querySelectorAll('.lg-app:checked')].map(c => c.value);
      const req = {}; document.querySelectorAll('.lg-req').forEach(i => { if (i.value.trim()) req[i.dataset.app] = i.value.trim(); });
      const logs = this.logs(); logs[ds] = logs[ds] || [];
      const actId = document.getElementById('lgAct').value;
      const topic = document.getElementById('lgGame').value.trim();
      const note = document.getElementById('lgNote').value.trim();
      const type = document.getElementById('lgType').value || 'video';
      const rec = { id: uid(), type, topic, app, actId, note, req, time: new Date().toTimeString().slice(0, 5) };
      logs[ds].push(rec);
      S.set('workLogs', logs); closeModal();
      // 第 6 参数带上本条记录 id：每日计划镜像任务的 srcId 指向它，编辑/删除才能双向联动
      if (window.Daily) window.Daily.autoFromColumn(actId ? 'work:act:' + actId : 'work:today', ds, topic || '创作打卡', app, {
        '类型': type === 'video' ? '视频' : '图文',
        '平台': (Array.isArray(app) ? app : [app]).filter(Boolean).join('、'),
        '选题': topic,
        '备注': note
      }, rec.id);
      this.render(root); toast('打卡成功，又肝了一条');
    };
  },
  /* 编辑已有打卡记录（v283）：复用 logDialog 的字段并预填，原地更新（id 不变） */
  logEditDialog(root, ds, log) {
    const all = this.allLogs();
    const acts = this.acts().filter(a => {
      if (a.id === log.actId) return true;          // 已关联的活动始终可选，避免编辑时被过滤掉
      const fin = this.finOf(a, all);
      const left = a.deadline ? daysBetween(todayStr(), a.deadline) : null;
      return !fin && !(left !== null && left < 0);
    });
    const curApps = this.appArr(log.app);
    const curReq = (log.req && typeof log.req === 'object') ? log.req : {};
    const typeEl0 = log.type === 'video' ? 'video' : 'article';
    openModal(`<button class="close-x" onclick="closeModal()">×</button><h3>${icon('edit',18)} 编辑产出 · ${fmtCN(ds)}</h3>
      <div class="form-row"><label>类型</label><select id="lgType"><option value="video"${typeEl0 === 'video' ? ' selected' : ''}>视频</option><option value="article"${typeEl0 === 'article' ? ' selected' : ''}>图文</option></select></div>
      <div class="form-row"><label>主题</label><input id="lgGame" value="${esc(log.topic || '')}" placeholder="主题/游戏？如：造梦西游4 / 好物分享"></div>
      <div class="form-row"><label>发布平台（可多选）</label>
        <div id="lgApps" style="display:flex;gap:6px;flex-wrap:wrap">${this.PLATS.map(p => `<label class="chip" style="cursor:pointer"><input type="checkbox" value="${esc(p)}" class="lg-app"${curApps.indexOf(p) >= 0 ? ' checked' : ''} style="margin-right:4px;accent-color:#111"> ${esc(p)}</label>`).join('')}</div></div>
      <div id="lgReqs"></div>
      <div class="form-row"><label>关联活动（算进活动进度）</label><select id="lgAct"><option value="">不关联</option>${acts.map(a => `<option value="${esc(a.id)}"${a.id === log.actId ? ' selected' : ''}>${esc(a.name)}</option>`).join('')}</select></div>
      <div class="form-row"><label>备注/链接</label><input id="lgNote" value="${esc(log.note || '')}" placeholder="视频标题、链接…"></div>
      <button class="btn" id="lgOk" style="width:100%">保存修改</button>`);
    const reqBox = document.getElementById('lgReqs');
    const actEl = document.getElementById('lgAct');
    // 达标要求：优先用记录里已存的，其次继承所选活动里该平台设的要求（仍可编辑）
    const paintReqs = () => {
      const sel = [...document.querySelectorAll('.lg-app:checked')].map(c => c.value);
      const act = actEl && actEl.value ? this.acts().find(a => a.id === actEl.value) : null;
      reqBox.innerHTML = sel.length ? sel.map(app => {
        const t = act ? (this.targetsOf(act) || []).find(x => x.app === app) : null;
        const own = (curReq[app] != null && String(curReq[app]).trim()) ? String(curReq[app]) : '';
        const v = own || (t && t.req ? String(t.req) : '');
        return `<div class="form-row"><label>${esc(app)} 的达标要求（可选）</label><input class="lg-req" data-app="${esc(app)}" value="${esc(v)}" placeholder="如：上首页 / 10赞以上 / 播放1000+"></div>`;
      }).join('') : '';
    };
    document.querySelectorAll('.lg-app').forEach(c => c.onchange = paintReqs);
    if (actEl) actEl.onchange = paintReqs;
    paintReqs();
    document.getElementById('lgOk').onclick = () => {
      const app = [...document.querySelectorAll('.lg-app:checked')].map(c => c.value);
      const req = {}; document.querySelectorAll('.lg-req').forEach(i => { if (i.value.trim()) req[i.dataset.app] = i.value.trim(); });
      const tEl = document.getElementById('lgType');
      const type = tEl ? (tEl.value || 'video') : 'video';   // 无 select 时兜底为 video，绝不静默记成图文
      const logs = this.logs(); logs[ds] = logs[ds] || [];
      const idx = logs[ds].findIndex(x => x.id === log.id);
      if (idx < 0) { closeModal(); return toast('这条记录已经不在了'); }
      const topic = (document.getElementById('lgGame').value || '').trim();
      const note = (document.getElementById('lgNote').value || '').trim();
      const actId = actEl ? actEl.value : '';
      Object.assign(logs[ds][idx], { type, topic, app, actId, note, req });
      S.set('workLogs', logs); closeModal();
      this.syncPlanFromLog(ds, logs[ds][idx]);               // 同步每日计划镜像任务的「类型/平台」
      this.render(root); toast('记录已更新');
    };
  },
  /* 编辑产出后，同步每日计划里由该记录自动生成的任务（类型/平台/标题跟着变），再重绘每日计划 */
  syncPlanFromLog(ds, log) {
    const D = window.Daily;
    if (!D) return;
    try {
      const all = S.get('plans', {});
      const arr = all[ds] || [];
      const apps = this.appArr(log.app);
      let touched = false;
      arr.forEach(t => {
        if (!t.autoGen || !(t.link || '').startsWith('work:')) return;
        // 双向匹配：任务的 srcId 指向这条记录（创作板块打卡）／或记录的 srcId 指向该任务（每日计划打卡）
        if (!(t.srcId === log.id || (log.srcId && t.id === log.srcId))) return;
        if (log.topic) t.title = log.topic;
        t.extra = Object.assign({}, t.extra || {}, { type: log.type, app: apps });
        t.colExtra = Object.assign({}, t.colExtra || {}, { '类型': log.type === 'video' ? '视频' : '图文', '平台': apps.join('、'), '选题': log.topic || '' });
        touched = true;
      });
      if (touched) S.set('plans', all);
    } catch (e) { console.warn('syncPlanFromLog failed', e); }
    if (D._root && D.render) D.render(D._root);
  },
  // 长按 500ms 触发（移动端 touch + 桌面 mouse）
  _longPress(el, cb) {
    let t = null;
    const start = () => { clearTimeout(t); t = setTimeout(() => { t = null; cb(); }, 500); };
    const cancel = () => { clearTimeout(t); t = null; };
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchend', cancel);
    el.addEventListener('touchmove', cancel, { passive: true });
    el.addEventListener('mousedown', start);
    el.addEventListener('mouseup', cancel);
    el.addEventListener('mouseleave', cancel);
  },
  activityDialog(root, pre) {
    const raw = S.get('workActs', []);
    const existing = pre.id ? raw.find(x => x.id === pre.id) : null;
    const all = this.allLogs();
    const isDone = existing && (this.finOf(existing, all) || (existing.deadline && daysBetween(todayStr(), existing.deadline) < 0) || existing.settled);
    const isExpired = !!(existing && existing.deadline && daysBetween(todayStr(), existing.deadline) < 0);
    // 已完成 / 已截止 → 结算弹窗（记录复审结果与收入）
    if (isDone) {
      // v310：分平台结算——每个平台单独保存，活动在所有平台结算后才归档到历史
      const targets = this.targetsOf(existing);
      const ps = existing.platformSettle || {};
      const settledApps = targets.filter(t => ps[t.app]).map(t => t.app);
      const allSettled = targets.length > 0 && settledApps.length === targets.length;
      openModal(`<button class="close-x" onclick="closeModal()">×</button>
        <h3>${icon('target',16)} 活动结算 · ${esc(existing.name)}</h3>
        <div class="muted" style="margin:0 0 6px">活动已${isExpired ? '截止' : '完成'}。每个平台单独结算：填「未达标几篇」与「达标收益」，点「结算此平台」即保存；全部平台结算后自动归档到历史。</div>
        <div id="rvRows">${targets.map((t) => {
          const s = ps[t.app];
          const total = Number(t.total) || 0;
          const mv = s ? Math.min(total, Number(s.miss) || 0) : 0;
          const okN = Math.max(0, total - mv);
          const earnV = s ? (s.earn != null ? s.earn : '') : '';
          const done = !!s;
          return `<div class="rv-card" data-app="${esc(t.app)}" style="border:1px solid var(--line);border-radius:10px;padding:10px;margin:8px 0">
            <div style="display:flex;align-items:center;gap:6px;font-weight:600;flex-wrap:wrap">
              <span>${esc(t.app)}</span>
              <span class="muted" style="font-weight:400">（要求 ${total} 篇）</span>
              ${t.type ? `<span class="tag">${esc(t.type)}</span>` : ''}${t.req ? `<span class="tag">达标要求：${esc(t.req)}</span>` : ''}
              ${done ? '<span class="tag" style="background:#7CB390;color:#fff;border:none">已结算</span>' : ''}
            </div>
            <div style="display:flex;align-items:center;gap:10px;margin-top:8px;flex-wrap:wrap">
              <label style="display:flex;align-items:center;gap:6px;font-size:13px">未达标
                <input type="number" class="rv-miss" data-app="${esc(t.app)}" data-total="${total}" value="${mv}" min="0" step="1" style="width:64px"> 篇
              </label>
              <span class="muted rv-ok" data-app="${esc(t.app)}" style="font-size:13px">→ 达标 ${okN} 篇</span>
            </div>
            <div style="display:flex;align-items:center;gap:6px;margin-top:8px">
              <label style="display:flex;align-items:center;gap:6px;font-size:13px">达标收益
                <input type="number" class="rv-earn" data-app="${esc(t.app)}" value="${earnV}" step="0.01" style="width:90px"> 元
              </label>
              <button class="btn sm rv-save" data-app="${esc(t.app)}" style="margin-left:auto">${done ? '改' : '结算此平台'}</button>
            </div>
          </div>`;
        }).join('')}</div>
        ${allSettled ? '<div class="banner info" style="margin-top:8px">全部平台已结算，已归集到历史活动 ✓</div>' : ''}
        <button class="btn ghost" id="rvClose" style="width:100%;margin-top:8px">关闭</button>`);
      const paintOk = () => {
        document.querySelectorAll('.rv-miss').forEach(inp => {
          const total = Number(inp.dataset.total) || 0;
          let v = Number(inp.value); if (isNaN(v) || v < 0) v = 0; if (v > total) v = total;
          const span = document.querySelector('.rv-ok[data-app="' + inp.dataset.app.replace(/"/g, '\\"') + '"]');
          if (span) span.textContent = '→ 达标 ' + Math.max(0, total - v) + ' 篇';
        });
      };
      document.querySelectorAll('.rv-miss').forEach(inp => {
        inp.oninput = paintOk;
        inp.onblur = () => { const total = Number(inp.dataset.total) || 0; let v = Number(inp.value); if (isNaN(v) || v < 0) v = 0; if (v > total) { v = total; toast('未达标篇数不能多于要求篇数（' + total + ' 篇），已帮你改回上限'); } inp.value = v; paintOk(); };
      });
      paintOk();
      document.querySelectorAll('.rv-save').forEach(btn => btn.onclick = () => {
        const app = btn.dataset.app;
        const missInp = document.querySelector('.rv-miss[data-app="' + app.replace(/"/g, '\\"') + '"]');
        const earnInp = document.querySelector('.rv-earn[data-app="' + app.replace(/"/g, '\\"') + '"]');
        if (!missInp || !earnInp) return;
        const total = Number(missInp.dataset.total) || 0;
        let v = Number(missInp.value); if (isNaN(v) || missInp.value === '' || v < 0) v = 0;
        if (v > total) { v = total; toast('未达标篇数不能多于要求的 ' + total + ' 篇'); missInp.value = v; paintOk(); }
        const earn = earnInp.value ? (Number(earnInp.value) || 0) : 0;
        if (!existing.platformSettle) existing.platformSettle = {};
        existing.platformSettle[app] = { miss: v, earn, reviewDate: todayStr(), settled: true };
        const agg = { miss: {}, earn: {}, reviewDate: '' };
        targets.forEach(tg => { const s2 = existing.platformSettle[tg.app]; if (s2) { agg.miss[tg.app] = s2.miss || 0; agg.earn[tg.app] = s2.earn || 0; if (s2.reviewDate > agg.reviewDate) agg.reviewDate = s2.reviewDate; } });
        existing.review = agg;
        existing.settled = targets.every(tg => existing.platformSettle[tg.app]);
        S.set('workActs', raw);
        toast(app + ' 已结算' + (existing.settled ? '，全部完成 ✓' : ''));
        this.render(root);
      });
      const closeBtn = document.getElementById('rvClose');
      if (closeBtn) closeBtn.onclick = () => closeModal();
      return;
    }
    // 未完成 / 未截止 → 编辑弹窗（4 行：名称 / 截止日期 / 发布平台 / 达标要求；平台目标按所选平台自动生成，含视频/图文）
    const src = existing || pre;
    const initReq = src.req || (src.targets && src.targets[0] && src.targets[0].req) || '';
    const initPlats = (src.platforms && src.platforms.length) ? src.platforms.slice() : ((src.targets && src.targets.length) ? src.targets.map(t => t.app) : ['小红书']);
    let selPlats = initPlats.slice();
    let rows = selPlats.map(p => { const ex = (src.targets || []).find(t => t.app === p); return ex ? this.normTarget(ex) : { app: p, total: 1, type: '', req: initReq }; });
    const acReqVal = () => (document.getElementById('acReq') ? document.getElementById('acReq').value.trim() : initReq);
    openModal(`<button class="close-x" onclick="closeModal()">×</button><h3>${icon('target',18)} 新活动创作计划</h3>
      <div class="form-row"><label>活动名称</label><input id="acName" value="${esc(pre.name || '')}" placeholder="例如：造梦西游4十周年激励"></div>
      <div class="form-row"><label>截止日期</label><input type="date" id="acDl" value="${esc(pre.deadline || '')}"></div>
      <div class="form-row"><label>发布平台</label><div id="acPlats" style="display:flex;flex-wrap:wrap;gap:2px">${this.PLATS.map(p => `<button type="button" class="chip" data-p="${esc(p)}" style="border:1px solid var(--line);background:${selPlats.includes(p) ? 'var(--accent)' : 'transparent'};color:${selPlats.includes(p) ? '#fff' : 'inherit'};border-radius:999px;padding:4px 12px;font-size:13px;cursor:pointer;margin:3px">${esc(p)}</button>`).join('')}</div></div>
      <div class="form-row"><label>达标要求</label><input id="acReq" value="${esc(initReq)}" placeholder="如：播放1000+ / 上首页 / 10赞以上"></div>
      <div class="muted" style="margin:6px 0 4px">各平台目标（按所选平台自动生成）：选「视频」或「图文」决定该平台交哪种产出、填几篇；打卡与结算都按这里来。</div>
      <div id="acRows"></div>
      <button class="btn" id="acOk" style="width:100%;margin-top:6px">创建计划</button>`);
    const rowsBox = document.getElementById('acRows');
    const syncRows = () => {
      const seen = new Set(selPlats);
      rows = rows.filter(r => seen.has(r.app));
      const reqV = acReqVal();
      selPlats.forEach(p => { if (!rows.find(r => r.app === p)) rows.push({ app: p, total: 1, type: '', req: reqV }); });
      paint();
    };
    const paint = () => {
      rowsBox.innerHTML = rows.map((r, i) => `
        <div class="ac-row" data-i="${i}" style="display:flex;gap:6px;align-items:center;margin:6px 0">
          <b style="min-width:60px">${esc(r.app)}</b>
          <select class="ac-type" data-i="${i}" style="min-width:72px">
            <option value="" ${!r.type ? 'selected' : ''}>不限</option>
            <option value="视频" ${r.type === '视频' ? 'selected' : ''}>视频</option>
            <option value="图文" ${r.type === '图文' ? 'selected' : ''}>图文</option>
          </select>
          <label style="font-size:13px;white-space:nowrap">几篇<input type="number" class="ac-t" data-i="${i}" value="${r.total || 0}" min="0" style="width:52px;margin:0 3px">篇</label>
          <button class="del ac-del" data-i="${i}" title="移除该平台">✕</button>
        </div>`).join('');
      rowsBox.querySelectorAll('.ac-type').forEach(s => s.onchange = e => { rows[+e.target.dataset.i].type = e.target.value; });
      rowsBox.querySelectorAll('.ac-t').forEach(s => s.oninput = e => rows[+e.target.dataset.i].total = Number(e.target.value) || 0);
      rowsBox.querySelectorAll('.ac-del').forEach(b => b.onclick = () => {
        const p = rows[+b.dataset.i].app;
        selPlats = selPlats.filter(x => x !== p);
        const chip = document.querySelector('#acPlats .chip[data-p="' + p.replace(/"/g, '\\"') + '"]');
        if (chip) { chip.classList.remove('on'); chip.style.background = 'transparent'; chip.style.color = 'inherit'; }
        syncRows();
      });
      rowsBox.querySelectorAll('.ac-row').forEach(row => this._longPress(row, () => {
        rowsBox.querySelectorAll('.ac-row').forEach(o => o.classList.remove('lp-revealed'));
        row.classList.add('lp-revealed');
        setTimeout(() => row.classList.remove('lp-revealed'), 4000);
      }));
    };
    document.querySelectorAll('#acPlats .chip').forEach(c => c.onclick = () => {
      const p = c.dataset.p;
      if (selPlats.includes(p)) { selPlats = selPlats.filter(x => x !== p); c.classList.remove('on'); c.style.background = 'transparent'; c.style.color = 'inherit'; }
      else { selPlats.push(p); c.classList.add('on'); c.style.background = 'var(--accent)'; c.style.color = '#fff'; }
      syncRows();
    });
    const reqInp = document.getElementById('acReq');
    if (reqInp) reqInp.oninput = () => { const v = reqInp.value.trim(); rows.forEach(r => r.req = v); };
    paint();
    document.getElementById('acOk').onclick = () => {
      const name = document.getElementById('acName').value.trim(); if (!name) return toast('给计划起个名字');
      if (!selPlats.length) return toast('至少选一个发布平台');
      const req = document.getElementById('acReq').value.trim();
      const targets = rows.map(r => ({ app: r.app, total: Number(r.total) || 0, video: 0, article: 0, type: r.type || '', req }));
      if (existing) { existing.name = name; existing.deadline = document.getElementById('acDl').value; existing.targets = targets; S.set('workActs', raw); }
      else { raw.unshift({ id: uid(), name, deadline: document.getElementById('acDl').value, targets }); S.set('workActs', raw); }
      closeModal(); this.tool = null; this.render(root); toast(existing ? '计划已更新' : '计划已创建，打卡时记得选对平台');
    };
  },

  /* ---------- 写小说 ---------- */
  novel() { return S.get('novel', { bookName: '', goalWords: 0, totalWords: 0, daily: {}, clips: [], materials: [], sites: [] }); },
  render_novel(box, root) {
    const N = this.novel();
    const today = todayStr();
    const todayWords = N.daily[today] || 0;
    const goal = N.goalWords || 0;
    const left = goal ? Math.max(0, goal - N.totalWords) : 0;
    const pct = goal ? Math.min(100, Math.round(N.totalWords / goal * 100)) : 0;
    const kw = this._novelKw || '尴尬 场景 描写';
    const q = encodeURIComponent(kw + ' 写作 描写 素材');
    const links = [
      ['小红书', 'https://www.xiaohongshu.com/search_result?keyword=' + q],
      ['知乎', 'https://www.zhihu.com/search?type=content&q=' + q],
      ['百度', 'https://www.baidu.com/s?wd=' + q],
      ['豆瓣', 'https://search.douban.com/book/subject_search?search_text=' + q]
    ];
    box.innerHTML = `
      <div class="grid2">
        <div class="card">
          <h3>${icon('book',16)} 我的书 & 码字打卡</h3>
          <div class="form-row"><label>书名</label><input id="nvName" value="${esc(N.bookName)}" placeholder="在写哪本书？"></div>
          <div class="form-row"><label>目标字数</label><input type="number" id="nvGoal" value="${N.goalWords || ''}" placeholder="如：200000（20万字）"></div>
          <div style="margin:6px 0"><button class="btn sm" id="nvSaveMeta">保存书信息</button></div>
          <div class="banner info" style="margin:8px 0">今日码字：<b>${todayWords}</b> 字 · 累计：<b>${N.totalWords}</b> 字${goal ? ` · 还差 <b>${left}</b> 字` : ''}</div>
          <div class="progress-bar" style="height:14px;margin:8px 0"><i style="width:${pct}%"></i></div>
          <div class="muted" style="margin-bottom:8px">${goal ? '完结进度 ' + pct + '%' : '设个目标字数就有进度条啦'}</div>
          <div class="form-row"><label>今天码了多少字？</label><input type="number" id="nvToday" value="${todayWords || ''}" placeholder="如：800"></div>
          <button class="btn" id="nvLog" style="width:100%">记录今日码字</button>
        </div>
        <div class="card">
          <h3>${icon('book',16)} 描写素材库</h3>
          <div class="muted" style="margin-bottom:6px">遇到好的描写就抄下来学，跟着大师练笔力。</div>
          <button class="btn sm" id="nvAddClip" style="margin-bottom:8px">＋ 抄一段</button>
          <div id="nvClips">${N.clips.map((c, i) => `<div class="list-row" style="align-items:flex-start"><div style="flex:1"><div class="muted">${esc(c.source || '未知出处')}</div><div style="white-space:pre-wrap">${esc(c.text)}</div></div><button class="del" data-delclip="${i}">✕</button></div>`).join('') || '<div class="empty">还没有抄录，看到喜欢的描写就收进来</div>'}</div>
        </div>
      </div>
      <div class="card" style="margin-top:14px">
        <h3>${icon('search',16)} 描写搜索引擎</h3>
        <div class="muted" style="margin-bottom:6px">卡在「尴尬场景怎么写」？搜别人的描写找感觉（学习不抄袭）。</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <input id="nvKw" class="search" value="${esc(this._novelKw || '')}" placeholder="想描写什么？如：尴尬 / 心动 / 离别" style="flex:1;min-width:200px">
          <button class="btn" id="nvSearch">搜一搜</button>
        </div>
        <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
          ${this._novelKw ? links.map(([n, u]) => `<a class="plat-badge" target="_blank" href="${u}">${n} ↗</a>`).join('') : '<span class="muted">输入关键词后出现检索入口</span>'}
        </div>
      </div>`;

    box.querySelector('#nvSaveMeta').onclick = () => {
      const N2 = this.novel(); N2.bookName = box.querySelector('#nvName').value.trim(); N2.goalWords = Number(box.querySelector('#nvGoal').value) || 0; S.set('novel', N2); this.render(root); toast('书信息已保存');
    };
    box.querySelector('#nvLog').onclick = () => {
      const v = Number(box.querySelector('#nvToday').value) || 0; if (!v) return toast('填一下今天码了多少字');
      const N2 = this.novel();
      N2.totalWords = (N2.totalWords || 0) - (N2.daily[today] || 0) + v;
      N2.daily[today] = v;
      S.set('novel', N2); this.render(root); toast('已记录，笔耕不辍');
    };
    box.querySelector('#nvAddClip').onclick = () => {
      openModal(`<button class="close-x" onclick="closeModal()">×</button><h3>${icon('book',18)} 抄一段描写</h3>
        <div class="form-row"><label>出处（书名/作者/平台）</label><input id="clSrc" placeholder="如：《xxx》第三章 / 某红书笔记"></div>
        <div class="form-row"><label>原文片段</label><textarea id="clText" rows="5" placeholder="把打动你的描写贴进来…"></textarea></div>
        <button class="btn" id="clOk" style="width:100%">收进素材库</button>`);
      document.getElementById('clOk').onclick = () => {
        const src = document.getElementById('clSrc').value.trim(); const txt = document.getElementById('clText').value.trim();
        if (!txt) return toast('贴点内容呀');
        const N2 = this.novel(); N2.clips = N2.clips || []; N2.clips.unshift({ source: src, text: txt }); S.set('novel', N2); closeModal(); this.render(root); toast('已收藏，慢慢学');
      };
    };
    box.querySelectorAll('[data-delclip]').forEach(b => b.onclick = () => { const N2 = this.novel(); N2.clips.splice(Number(b.dataset.delclip), 1); S.set('novel', N2); this.render(root); });
    box.querySelector('#nvSearch').onclick = () => { this._novelKw = box.querySelector('#nvKw').value.trim(); this.render_novel(box, root); };
  },

  /* ============ 写作（创作 · 写作 分支，从成长迁移而来） ============ */
  wym: null,
  render_writing(body, root) {
    if (this._matLib) { this.materialLibPage(root); return; }
    if (this._transcribe) { this.render_transcribe(root); return; }
    body.innerHTML = this.writingPage(root);
    this.bindWritingEvents(root);
  },

  /* 码字日历：日期居中；打卡日格子用颜色填满并显示当天字数；可切换月份（需求15） */
  renderWriteCal(el, root) {
    const wLogs = S.get('writeLogs', {});
    if (!this.wym) this.wym = todayStr().slice(0, 7);
    const [y, m] = this.wym.split('-').map(Number);
    const first = new Date(y, m - 1, 1); const startW = first.getDay();
    const daysIn = new Date(y, m, 0).getDate();
    const today = todayStr();
    let html = '<div class="cal-head"><button class="btn ghost sm" id="wrPrev">‹</button><b>' + y + '年' + m + '月</b><button class="btn ghost sm" id="wrNext">›</button></div>';
    html += '<div class="cal-grid">' + ['日', '一', '二', '三', '四', '五', '六'].map(w => '<div class="wd">' + w + '</div>').join('');
    for (let i = 0; i < startW; i++) html += '<div></div>';
    for (let d = 1; d <= daysIn; d++) {
      const ds = y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      const arr = wLogs[ds] || [];
      const wsum = arr.reduce((s, l) => s + (l.words || 0), 0);
      if (wsum > 0) {
        html += '<div class="cal-cell wr-fill" data-date="' + ds + '"><span class="wr-words">' + wsum + '</span></div>';
      } else {
        html += '<div class="cal-cell' + (ds === today ? ' today' : '') + '" data-date="' + ds + '"><div class="d">' + d + '</div></div>';
      }
    }
    html += '</div>';
    el.innerHTML = html;
    el.querySelector('#wrPrev').onclick = () => { const nd = new Date(y, m - 2, 1); this.wym = nd.getFullYear() + '-' + String(nd.getMonth() + 1).padStart(2, '0'); this.renderWriteCal(el, root); };
    el.querySelector('#wrNext').onclick = () => { const nd = new Date(y, m, 1); this.wym = nd.getFullYear() + '-' + String(nd.getMonth() + 1).padStart(2, '0'); this.renderWriteCal(el, root); };
  },

  writingPage(root) {
    const wLogs = S.get('writeLogs', {});
    const N = this.novel();
    N.materials = N.materials || []; N.sites = N.sites || []; N.clips = N.clips || [];
    const todayMats = (N.materials || []).map((m, i) => ({ m, i })).filter(x => x.m.date === todayStr());
    const todayLogs = wLogs[todayStr()] || [];
    const todayWords = todayLogs.reduce((s, l) => s + (l.words || 0), 0);
    const totalWords = N.totalWords || 0;
    // 今日码字记录（可单独删除）——需求14：试验时填的数字要能删
    const todayListHTML = todayLogs.length
      ? todayLogs.map(l => `<div class="list-row" style="align-items:flex-start">
          <div style="flex:1"><b>${esc(l.title)}</b> <span class="muted">${(l.words || 0)} 字</span></div>
          <button class="del" data-delwrlog="${l.id}">✕</button></div>`).join('')
      : '<div class="empty">今天还没记录码字</div>';
    return `<div style="display:flex;flex-direction:column;gap:12px">
      <div class="card">
        <h3>今日码字 <button class="btn sm" id="writeLogBtn" style="margin-left:auto">＋ 记录</button></h3>
        <div class="stat-combined">
          <div class="sc-half"><b>${todayWords}</b><span class="muted">今日字数</span></div>
          <div class="sc-half"><b>${totalWords}</b><span class="muted">累计字数</span></div>
        </div>
        <div id="wrTodayList" style="margin-top:10px;display:flex;flex-direction:column;gap:8px">${todayListHTML}</div>
      </div>
      <div class="card">
        <h3>我的书</h3>
        <div class="form-row"><label>小说名字</label><input id="wvName" value="${esc(N.bookName)}" placeholder="在写哪本书？"></div>
        <div class="form-row"><label>发布网站</label><div id="wvSites" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px">${(N.sites || []).map((s, i) => `<span class="tag blue">${esc(s)} <a style="cursor:pointer" data-delsite="${i}">✕</a></span>`).join('')}</div>
          <div style="display:flex;gap:6px;margin-top:4px"><input id="wvNewSite" placeholder="如：番茄小说" style="flex:1"><button class="btn sm ghost" id="wvAddSite">＋</button></div></div>
        <button class="btn sm" id="wvSaveMeta" style="margin-top:8px">保存书信息</button>
      </div>
      <div class="grid2">
        <div class="card"><h3>抄书库 <button class="btn sm ghost" id="wvTrans" style="margin-left:auto">进入</button></h3>
          <div class="muted" style="margin-bottom:6px">手抄后拍照存档，随时翻看。</div>
          ${S.get('transcribe', []).length ? `<div style="display:flex;flex-wrap:wrap;gap:4px">${S.get('transcribe', []).slice(0, 6).map(t => `<span class="tag" style="font-size:12px">${esc(t.source || '未填出处')}</span>`).join('')}</div><div class="muted" style="font-size:11px;margin-top:4px">共 ${S.get('transcribe', []).length} 条</div>` : '<div class="empty">还没有抄书，进入后拍照存档</div>'}
        </div>
        <div class="card" style="position:relative;padding-bottom:48px"><h3>积累素材 <button class="btn sm ghost" id="wvAddMat" style="margin-left:auto">＋</button></h3>
          ${todayMats.length ? todayMats.map(({ m, i }) => `<div class="list-row" style="align-items:flex-start">
            <div style="flex:1"><b>${esc(m.title)}</b><div class="muted" style="white-space:pre-wrap;font-size:13px">${esc(m.content)}</div></div>
            <button class="del" data-delmat="${i}">✕</button></div>`).join('') : '<div class="empty">今天还没积累素材</div>'}
          <button class="btn sm ghost" id="wvLib" style="position:absolute;right:16px;bottom:14px">素材库（${N.materials.length}）</button>
        </div>
      </div>
      <div class="card"><h3>码字日历</h3>
        <div id="wrCal"></div>
      </div>
    </div>`;
  },

  bindWritingEvents(root) {
    const wrCal = root.querySelector('#wrCal');
    if (wrCal) this.renderWriteCal(wrCal, root);
    root.querySelector('#writeLogBtn').onclick = () => this.writeDialog(root);
    const todayList = root.querySelector('#wrTodayList');
    if (todayList) todayList.querySelectorAll('[data-delwrlog]').forEach(b => b.onclick = () => {
      const logs = S.get('writeLogs', {}); const td = todayStr();
      const rec = (logs[td] || []).find(l => l.id === b.dataset.delwrlog);
      logs[td] = (logs[td] || []).filter(l => l.id !== b.dataset.delwrlog);
      if (!logs[td].length) delete logs[td];
      S.set('writeLogs', logs);
      const N = this.novel(); N.totalWords = Math.max(0, (N.totalWords || 0) - (rec ? (rec.words || 0) : 0)); S.set('novel', N);
      this.render(root); toast('已删除该记录');
    });
    root.querySelector('#wvSaveMeta').onclick = () => {
      const N = this.novel(); N.bookName = root.querySelector('#wvName').value.trim();
      S.set('novel', N); this.render(root); toast('书信息已保存');
    };
    root.querySelector('#wvAddSite').onclick = () => {
      const v = root.querySelector('#wvNewSite').value.trim(); if (!v) return;
      const N = this.novel(); N.sites = N.sites || [];
      if (!N.sites.includes(v)) { N.sites.push(v); S.set('novel', N); this.render(root); }
    };
    root.querySelectorAll('[data-delsite]').forEach(b => b.onclick = () => {
      const N = this.novel(); N.sites.splice(Number(b.dataset.delsite), 1); S.set('novel', N); this.render(root);
    });
    const transBtn = root.querySelector('#wvTrans');
    if (transBtn) transBtn.onclick = () => { this._transcribe = true; this.render(root); };
    root.querySelector('#wvAddMat').onclick = () => {
      openModal(`<button class="close-x" onclick="closeModal()">×</button><h3>积累素材</h3>
        <div class="form-row"><label>标题</label><input id="mtTitle" placeholder="素材名/灵感标题"></div>
        <div class="form-row"><label>内容</label><textarea id="mtContent" rows="4" placeholder="写下来…"></textarea></div>
        <button class="btn" id="mtOk" style="width:100%">保存</button>`);
      document.getElementById('mtOk').onclick = () => {
        const t = document.getElementById('mtTitle').value.trim(); const c = document.getElementById('mtContent').value.trim();
        if (!t) return toast('起个标题');
        const N = this.novel(); N.materials = N.materials || [];
        N.materials.unshift({ title: t, content: c, date: todayStr() }); S.set('novel', N); closeModal(); this.render(root); toast('素材已保存');
      };
    };
    const libBtn = root.querySelector('#wvLib');
    if (libBtn) libBtn.onclick = () => { this._matLib = true; this.render(root); };
    root.querySelectorAll('[data-delclip]').forEach(b => b.onclick = () => {
      const N = this.novel(); N.clips.splice(Number(b.dataset.delclip), 1); S.set('novel', N); this.render(root);
    });
    root.querySelectorAll('[data-delmat]').forEach(b => b.onclick = () => {
      const N = this.novel(); N.materials.splice(Number(b.dataset.delmat), 1); S.set('novel', N); this.render(root);
    });
  },

  materialLibPage(root) {
    const N = this.novel();
    const all = (N.materials || []).slice().reverse();
    root.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <span class="branch-title" style="margin:0;padding:0;border:none;font-size:20px">素材库</span>
        <button class="icon-btn" id="mlBack" title="返回写作">${icon('chevronLeft',18)}</button>
      </div>
      <div style="margin-bottom:10px"><input id="mlSearch" placeholder="搜索素材标题或内容…" style="width:100%;padding:9px 12px;border:1px solid var(--line);border-radius:10px;font-size:14px"></div>
      <div id="mlList" style="display:flex;flex-direction:column;gap:10px"></div>`;
    const listEl = root.querySelector('#mlList');
    const renderList = (filter) => {
      const f = (filter || '').trim().toLowerCase();
      const items = f ? all.filter(n => (n.title || '').toLowerCase().includes(f) || (n.content || '').toLowerCase().includes(f)) : all;
      if (!items.length) { listEl.innerHTML = '<div class="empty">还没有素材</div>'; return; }
      listEl.innerHTML = items.map((m) => `<div class="card" style="margin:0">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><b>${esc(m.title)}</b><span class="muted" style="font-size:11px;flex-shrink:0">${m.date || ''}</span></div>
        ${m.content ? `<div style="margin-top:6px;white-space:pre-wrap;font-size:13px">${esc(m.content)}</div>` : ''}
        <button class="del" data-mlmat="${N.materials.indexOf(m)}" style="margin-top:6px">✕ 删除</button>
      </div>`).join('');
      listEl.querySelectorAll('[data-mlmat]').forEach(b => b.onclick = () => {
        const N2 = this.novel(); N2.materials = N2.materials || [];
        N2.materials.splice(Number(b.dataset.mlmat), 1); S.set('novel', N2); this.materialLibPage(root); toast('已删除');
      });
    };
    renderList('');
    root.querySelector('#mlSearch').oninput = e => renderList(e.target.value);
    const back = root.querySelector('#mlBack');
    if (back) back.onclick = () => { this._matLib = false; this.render(root); };
  },

  /* ============ 抄书库（手写拍照存档，独立库随时查阅） ============ */
  render_transcribe(root) {
    const list = S.get('transcribe', []).slice().reverse();
    root.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <span class="branch-title" style="margin:0;padding:0;border:none;font-size:20px">抄书库</span>
        <div style="display:flex;gap:8px">
          <button class="btn sm" id="trAdd">＋ 新增抄书</button>
          <button class="icon-btn" id="trBack" title="返回写作">${icon('chevronLeft',18)}</button>
        </div>
      </div>
      <div class="tr-grid">${list.length ? list.map(t => `<div class="tr-item">
          ${t.photo ? `<img class="tr-photo" data-trview="${t.id}" src="${esc(t.photo)}">` : '<div class="tr-photo" style="display:flex;align-items:center;justify-content:center;color:var(--sub);font-size:12px">无图</div>'}
          <div class="tr-meta"><div class="tr-src">${esc(t.source || '未填出处')}</div><div class="tr-date">${t.createdAt || ''}${t.note ? ' · ' + esc(t.note) : ''}</div>
          <button class="del" data-trdel="${t.id}" style="margin-top:6px">✕ 删除</button></div>
        </div>`).join('') : '<div class="empty">还没有抄书，点右上「＋ 新增抄书」用手抄拍照存档吧</div>'}</div>`;
    root.querySelector('#trBack').onclick = () => { this._transcribe = false; this.render(root); };
    root.querySelector('#trAdd').onclick = () => this.transcribeAdd(root);
    root.querySelectorAll('[data-trview]').forEach(im => im.onclick = () => {
      const t = S.get('transcribe', []).find(x => x.id === im.dataset.trview);
      if (t && t.photo) openModal(`<button class="close-x" onclick="closeModal()">×</button><img src="${esc(t.photo)}" style="width:100%;border-radius:8px">`);
    });
    root.querySelectorAll('[data-trdel]').forEach(b => b.onclick = () => {
      if (!confirm('删除这条抄书？')) return;
      S.set('transcribe', S.get('transcribe', []).filter(x => x.id !== b.dataset.trdel));
      this.render_transcribe(root); toast('已删除');
    });
  },
  transcribeAdd(root) {
    openModal(`<button class="close-x" onclick="closeModal()">×</button><h3>新增抄书</h3>
      <div class="tr-add">
        <label>出处（书名 / 章节 / 作者）</label><input id="trSrc" placeholder="如：《xxx》第3章 / 鲁迅">
        <label>拍照上传手抄页</label><input id="trFile" type="file" accept="image/*" capture="environment">
        <div class="tr-prev" id="trPrev"></div>
        <label>备注（可选）</label><input id="trNote" placeholder="如：这段好在哪">
        <button class="btn" id="trOk" style="width:100%">保存抄书</button>
      </div>`);
    let photo = null;
    const fileEl = document.getElementById('trFile');
    if (fileEl) fileEl.onchange = () => {
      const f = fileEl.files[0]; if (!f) return;
      readImageFile(f, 1200, 0.82).then(d => {
        if (d) { photo = d; const pv = document.getElementById('trPrev'); if (pv) pv.innerHTML = '<img src="' + d + '">'; }
        else toast('图片读取失败，重试');
      });
    };
    const ok = document.getElementById('trOk');
    if (ok) ok.onclick = () => {
      const src = document.getElementById('trSrc').value.trim();
      if (!src) return toast('先填一下出处');
      if (!photo) return toast('拍张照上传呀');
      const arr = S.get('transcribe', []); arr.unshift({ id: uid(), source: src, photo, note: document.getElementById('trNote').value.trim(), createdAt: todayStr() });
      S.set('transcribe', arr); closeModal(); this.render_transcribe(root); toast('抄书已存档');
    };
  },

  writeDialog(root) {
    const N = this.novel();
    openModal(`<button class="close-x" onclick="closeModal()">×</button><h3>${icon('edit',18)} 记录今日码字</h3>
      <div class="form-row"><label>写了什么</label><input id="wrTitle" placeholder="例如：小说章节 / 小红书文案"></div>
      <div class="form-row"><label>字数</label><input type="number" id="wrWords" value="500" placeholder="今天写了多少字"></div>
      <div class="form-row"><label>小说名字</label><input id="wrBook" value="${esc(N.bookName)}" placeholder="在写哪本书？"></div>
      <div class="form-row"><label>发布网站</label><input id="wrSite" value="${(N.sites || []).join('、')}" placeholder="番茄、起点…"></div>
      <button class="btn" id="wrOk" style="width:100%">记录</button>`);
    document.getElementById('wrOk').onclick = () => {
      const t = document.getElementById('wrTitle').value.trim(); if (!t) return toast('记一下写了什么');
      const words = Number(document.getElementById('wrWords').value) || 0;
      const logs = S.get('writeLogs', {}); logs[todayStr()] = logs[todayStr()] || [];
      logs[todayStr()].push({ id: uid(), title: t, words });
      S.set('writeLogs', logs);
      const novel = this.novel();
      novel.bookName = document.getElementById('wrBook').value.trim() || novel.bookName;
      novel.totalWords = (novel.totalWords || 0) + words;
      const sites = document.getElementById('wrSite').value.split(/[,，、\s]+/).filter(Boolean);
      if (sites.length) novel.sites = sites;
      S.set('novel', novel); closeModal(); this.render(root); toast('码字记录已保存');
    };
  },
};
window.Modules.work = { render: r => Work.render(r) };
window.Work = Work;

/* 收入统一格式化：保留2位小数，避免浮点累加后位数过长 */
function fmtYuan(x) { return (Number(x) || 0).toFixed(2); }
