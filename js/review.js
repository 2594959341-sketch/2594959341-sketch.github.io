/* ============ 复盘 · 日记 + 自动复盘 + 周月总结 + 成长可视化 ============ */
const CHAT_SYS = '你是「枝枝」，木木的专属智能助理与生活教练，相当于一个随时在线的豆包式智能体。你温柔、鼓励、务实，回答要具体可操作。木木在做内容创作（游戏激励/小红书等）、考公考编、个人成长、体态改善、三餐记录，也在进行「365天自救计划」。你可以解答她任何问题——学习、情绪、计划、知识、工具、闲聊都行。用简体中文，像朋友一样聊天，不要长篇大论，必要时拆成小步骤。 she asks for facts, be accurate and cite when unsure.';
const Review = {
  tab: 'day', cur: todayStr(), sub: null,
  moods: ['很好', '还行', '平淡', '低落', '很糟'],
  data() { return S.get('reviews', {}); }, // {date:{energy,mood,text}}

  // 汇总某日全工作台数据
  dayFacts(d) {
    const plan = window.Daily ? Daily.statsOf(d) : { total: 0, done: 0, abandoned: [] };
    const work = (S.get('workLogs', {})[d] || []);
    const study = (S.get('kgLogs', {})[d] || []);
    const growth = (S.get('growthLogs', {})[d] || []);
    const sport = (S.get('sportLogs', {})[d] || []);
    const mealScore = window.Meals ? Meals.dayScore(S.get('meals', {})[d]) : null;
    return { plan, work, study, growth, sport, mealScore };
  },
  // 五维成长分（0-100）：自律/学习/创作/健康/心态
  dimScores(days) {
    const dates = [];
    for (let i = 0; i < days; i++) dates.push(addDays(todayStr(), -i));
    return this.dimScoresDates(dates);
  },
  dimScoresDates(dates) {
    const R = this.data();
    let disc = 0, learn = 0, create = 0, health = 0, n = 0;
    let mindSum = 0, mindN = 0; // 心态：仅统计有心情记录的天（缺失不计入分子/分母）
    dates.forEach(d => {
      const f = this.dayFacts(d); n++;
      if (f.plan.total) disc += Math.min(1, f.plan.done / f.plan.total);
      learn += Math.min(1, (f.study.reduce((s, l) => s + l.minutes, 0) + f.growth.reduce((s, l) => s + l.minutes, 0)) / 120);
      // 创作：按量加权，每天 ≥2 条记满（1条=0.5，2条+=1.0），不再"有1条就满分"
      create += Math.min(1, f.work.length / 2);
      // 健康：运动按量（满60分钟拿满0.5，即每分钟 1/120）+ 饮食按营养均衡度
      const sportMin = f.sport.reduce((s, l) => s + (l.minutes || 0), 0);
      health += Math.min(0.5, sportMin / 120) + (f.mealScore != null ? Math.min(0.5, f.mealScore / 200) : 0);
      // 心态：仅当当天有心情记录才计入（没记/没选心情都不算，也不拉低）
      const r = R[d];
      if (r && r.mood != null) { mindSum += ({ 0: 1, 1: 0.8, 2: 0.6, 3: 0.35, 4: 0.15 })[r.mood]; mindN++; }
    });
    const pct = x => Math.round(x / Math.max(1, n) * 100);
    const mindPct = mindN ? Math.round(mindSum / Math.max(1, n) * 100) : 0;
    return { dims: ['自律', '学习', '创作', '健康', '心态'], values: [pct(disc), pct(learn), pct(create), pct(health), mindPct] };
  },
  // 精力分布：按「已完成任务」的精力消耗（taskLoad 1–5）按分类聚合。三餐与娱乐阅读不计入。
  // 让用户看清这段时间精力都花在了哪类事情上。
  energyDistHTML(days) {
    if (!window.Daily) return '';
    const labels = { meals: '三餐', sport: '跟练', work: '赚钱', kaogong: '学习', growth: '成长', travel: '出行', improve: '改善', daily: '日常' };
    const colors = { meals: '#F6C56E', sport: '#7CB390', work: '#F4A6B8', kaogong: '#8FB8E0', growth: '#B8A4D4', travel: '#4FB0AE', improve: '#F5B971', daily: '#A8B5C4' };
    const cats = {};
    let total = 0;
    days.forEach(d => {
      (Daily.list(d) || []).forEach(t => {
        if (t.abandoned || t.moved || t.restDay) return;
        if (Daily.isMealTask(t) || Daily.isLoadFree(t)) return;
        if (!Daily.effDone(t, d)) return;
        const base = ((t.link || '').split(':')[0]) || 'daily';
        if (!cats[base]) cats[base] = { load: 0 };
        const l = Daily.taskLoad(t);
        cats[base].load += l; total += l;
      });
    });
    // 充电（娱乐恢复）也计入精力分布：按电量聚合（不再按地点），展示用圆圈；含预估时长（分钟）
    let rechPowerTotal = 0, rechMinTotal = 0;
    const _allRech = [];
    days.forEach(d => (S.get('recharge', {})[d] || []).forEach(r => { _allRech.push(r); rechMinTotal += (Number(r.mins) || 0); }));
    rechPowerTotal = window.rechPowerOf ? rechPowerOf(_allRech) : _allRech.reduce((s, r) => s + (window.rechPower ? rechPower(r) : (Number(r.val) || 0)), 0);
    if (!total && !rechPowerTotal) return `<div class="card" style="margin-top:12px"><h3>${icon('fire', 16)} 精力分布</h3><div class="empty">这段时间还没有可统计的精力消耗（完成的任务都还没记录，或只有三餐 / 娱乐阅读），也没有充电记录。</div></div>`;
    const view = this._energyView || 'load';
    const toggleBtn = `<button class="icon-btn en-toggle" data-energytoggle="1" title="切换查看${view === 'load' ? '充电分布' : '精力消耗'}">${icon('swap', 16)}</button>`;
    if (view === 'rech') {
      // 规范化名字：已知活动(key 或 名字)都归并到标准中文名；自定义活动直接用真实名字（彻底消灭「自定义」笼统分类）。
      const RECH_NORM = {
        douyin:'刷抖音', '抖音':'刷抖音', 'Douyin':'刷抖音', '看抖音':'刷抖音', '抖音短视频':'刷抖音',
        drama:'看剧', '看剧':'看剧', '追剧':'看剧', '电视剧':'看剧', '剧':'看剧',
        novel:'看小说', '看小说':'看小说', '小说':'看小说', '网文':'看小说', '看网文':'看小说',
        comic:'看漫画', '看漫画':'看漫画', '漫画':'看漫画',
        game:'玩游戏', '玩游戏':'玩游戏', '游戏':'玩游戏', '打游戏':'玩游戏',
        music:'听歌放松', '听歌':'听歌放松', '听歌放松':'听歌放松', '听音乐':'听歌放松',
        sleep:'睡个好觉', '睡觉':'睡个好觉', '睡个好觉':'睡个好觉', '睡眠':'睡个好觉',
        nap:'小睡片刻', '小睡':'小睡片刻', '午睡':'小睡片刻', '小睡片刻':'小睡片刻',
        walk:'散个步', '散步':'散个步', '散个步':'散个步', '遛弯':'散个步',
        tea:'喝杯茶发呆', '喝茶':'喝杯茶发呆', '喝杯茶发呆':'喝杯茶发呆', '泡茶':'喝杯茶发呆',
        bath:'泡个澡', '泡澡':'泡个澡', '泡个澡':'泡个澡', '洗澡放松':'泡个澡'
      };
      const RECH_COLOR = { '看剧':'#F4A6B8', '看小说':'#C58AB0', '看漫画':'#F2A65A', '玩游戏':'#E08BA0', '刷抖音':'#F4A38C', '听歌放松':'#B8A4D4', '睡个好觉':'#8FB8E0', '小睡片刻':'#C9B6E4', '散个步':'#7CB390', '喝杯茶发呆':'#9BD0C9', '泡个澡':'#4FB0AE' };
      const palette = ['#8FB8E0', '#B8A4D4', '#F4A6B8', '#C58AB0', '#7CB390', '#4FB0AE', '#9BD0C9', '#F2A65A', '#E08BA0', '#F4A38C', '#C9B6E4', '#A8B5C4'];
      const groups = {};
      days.forEach(d => (S.get('recharge', {})[d] || []).forEach(r => {
        const n = (r.name || '').trim();
        const kRaw = (r.key || '').trim();
        // 规范化名字：已知(key 或 名字) → 标准中文名；否则用真实名字（杜绝「自定义」笼统分类）
        let canon;
        if (RECH_NORM[kRaw]) canon = RECH_NORM[kRaw];
        else if (RECH_NORM[n]) canon = RECH_NORM[n];
        else canon = n || (kRaw && kRaw !== 'custom' ? kRaw : '其他');
        if (!groups[canon]) groups[canon] = { name: canon, mins: 0, cnt: 0 };
        groups[canon].mins += Number(r.mins) || 0; groups[canon].cnt++;
      }));
      const keys = Object.keys(groups);
      if (!keys.length) return `<div class="card" style="margin-top:12px"><div style="display:flex;align-items:center;justify-content:space-between"><h3>${icon('leaf', 16)} 充电分布</h3>${toggleBtn}</div><div class="empty">这段时间还没有充电记录。累了就充充电 🌱</div></div>`;
      const size = 168, r0 = size / 2 - 18, cx = size / 2, cy = size / 2, circ = 2 * Math.PI * r0;
      const totalMin = keys.reduce((s, k) => s + groups[k].mins, 0) || 1;
      const fmtH = m => m >= 60 ? (m / 60).toFixed(1).replace(/\.0$/, '') + 'h' : (m || 0) + '′';
      let off = 0;
      // 环形按「时长」占比（次数不重要，时长才重要）
      const arcs = keys.map((k, i) => {
        const g = groups[k]; const col = RECH_COLOR[k] || palette[i % palette.length];
        const len = Math.max(0.5, g.mins / totalMin * circ);
        const el = `<circle class="rech-arc" data-rechcat="${esc(k)}" data-days='${JSON.stringify(days)}' cx="${cx}" cy="${cy}" r="${r0}" fill="none" stroke="${col}" stroke-width="22" stroke-linecap="butt" stroke-dasharray="${(len + 0.8).toFixed(2)} ${(circ - len - 0.8).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})" style="cursor:pointer"></circle>`;
        off += len; return el;
      }).join('');
      const center = `<text x="${cx}" y="${cy - 2}" text-anchor="middle" font-size="22" font-weight="800" fill="#222">${fmtH(totalMin)}</text><text x="${cx}" y="${cy + 15}" text-anchor="middle" font-size="10" fill="#999">总充电时长</text>`;
      // 图例按时长降序：一眼看出哪个分类占得最多
      const legend = keys.slice().sort((a, b) => groups[b].mins - groups[a].mins).map((k, i) => { const g = groups[k]; const col = RECH_COLOR[k] || palette[i % palette.length]; const pct = Math.round(g.mins / totalMin * 100); return `<div class="rech-leg-item" data-rechcat="${esc(k)}" data-days='${JSON.stringify(days)}' style="cursor:pointer"><span class="en-dot" style="background:${col}"></span>${esc(g.name)} · ${fmtH(g.mins)} · ${pct}%</div>`; }).join('');
      return `<div class="card" style="margin-top:12px"><div style="display:flex;align-items:center;justify-content:space-between"><h3>${icon('leaf', 16)} 充电分布</h3><span class="bd-act"><button class="icon-btn" data-energyview="main" title="返回总览">‹</button>${toggleBtn}</span></div>
        <div style="display:flex;justify-content:center;padding:6px 0">${`<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${arcs}${center}</svg>`}</div>
        <div class="rech-legend">${legend}</div>
        <div class="muted" style="text-align:center;margin-top:6px">按时长占比 · 点任意分类看明细</div>
      </div>`;
    }
    // v269：精力分布改回圆环（与充电分布同一视觉语言）
    const arr = Object.keys(cats).map(b => ({ base: b, label: labels[b] || b, color: colors[b] || '#A8B5C4', load: cats[b].load, pct: cats[b].load / total * 100 })).sort((a, b) => b.load - a.load);
    const lsize = 168, lr = lsize / 2 - 18, lcx = lsize / 2, lcy = lsize / 2, lcirc = 2 * Math.PI * lr;
    let loff = 0;
    const larcs = arr.map(a => {
      const len = Math.max(0.5, a.load / total * lcirc);
      const el = `<circle cx="${lcx}" cy="${lcy}" r="${lr}" fill="none" stroke="${a.color}" stroke-width="22" stroke-linecap="butt" stroke-dasharray="${(len + 0.8).toFixed(2)} ${(lcirc - len - 0.8).toFixed(2)}" stroke-dashoffset="${(-loff).toFixed(2)}" transform="rotate(-90 ${lcx} ${lcy})" data-loadcat="${esc(a.base)}" style="cursor:pointer"><title>${esc(a.label)} · ${a.load} 点（点击看明细）</title></circle>`;
      loff += len; return el;
    }).join('');
    const lcenter = `<text x="${lcx}" y="${lcy - 2}" text-anchor="middle" font-size="22" font-weight="800" fill="#222">${total}</text><text x="${lcx}" y="${lcy + 15}" text-anchor="middle" font-size="10" fill="#999">精力点数</text>`;
    const llegend = arr.map(a => `<div class="rech-leg-item" data-loadcat="${esc(a.base)}" style="cursor:pointer"><span class="en-dot" style="background:${a.color}"></span>${esc(a.label)} · ${a.load} 点 · ${Math.round(a.pct)}%</div>`).join('');
    return `<div class="card" style="margin-top:12px"><div style="display:flex;align-items:center;justify-content:space-between"><h3>${icon('fire', 16)} 精力分布</h3><span class="bd-act"><button class="icon-btn" data-energyview="main" title="返回总览">‹</button>${toggleBtn}</span></div>
      <div style="display:flex;justify-content:center;padding:6px 0"><svg width="${lsize}" height="${lsize}" viewBox="0 0 ${lsize} ${lsize}">${larcs}${lcenter}</svg></div>
      <div class="rech-legend">${llegend}</div>
      <div class="muted" style="text-align:center;margin-top:6px">${arr.length ? `最多花在「${esc(arr[0].label)}」` : ''}${rechPowerTotal ? ` · 充电 ${rechPowerTotal} 电` : ''}</div>
    </div>`;
  },
  // 充电明细弹窗：列出这段时间的每一次充电、预估时长，并显示总次数与总分钟
  rechDetailModal(days) {
    const recs = [];
    (days || []).forEach(d => (S.get('recharge', {})[d] || []).forEach(r => recs.push(Object.assign({ date: d }, r))));
    const cnt = recs.length;
    const totalMin = recs.reduce((s, r) => s + (Number(r.mins) || 0), 0);
    const power = window.rechPowerOf ? rechPowerOf(recs) : recs.reduce((s, r) => s + (window.rechPower ? rechPower(r) : (Number(r.val) || 0)), 0);
    const rows = recs.slice().reverse().map(r => `<div class="rech-row">
      <span class="rech-name">${esc(r.name || r.key || '充电')}</span>
      <span class="rech-min">${r.mins ? (Number(r.mins) + ' 分钟') : '未记时长'}</span>
      <span class="rech-date">${fmtCN(r.date)}</span>
    </div>`).join('');
    openModal(`<button class="close-x" onclick="closeModal()">×</button>
      <h3>${icon('leaf', 18)} 充电明细</h3>
      <div style="display:flex;gap:18px;align-items:center;margin:6px 0 14px">
        <div style="text-align:center"><div style="font-size:26px;font-weight:700">${power}</div><div class="muted" style="font-size:12px">个电（每 30 分钟=1）</div></div>
        <div style="text-align:center"><div style="font-size:26px;font-weight:700">${totalMin || 0}</div><div class="muted" style="font-size:12px">分钟（含预估）</div></div>
        <div style="text-align:center"><div style="font-size:26px;font-weight:700">${cnt}</div><div class="muted" style="font-size:12px">次记录</div></div>
      </div>
      <div class="rech-list">${rows || '<div class="empty">暂无记录</div>'}</div>`);
  },
  /* 日记高频词：直接对日记正文做 1–4 字 n-gram 统计（不依赖词典，避免"世界"从"全世界"被误切出），
     硬过滤无意义功能字（的得地了着过等），并去除被更长词包含的短片段。返回空串表示无日记。 */
  hotWordsHTML(days, maxWords) {
    // 轻量常用词词典（情绪/生活/学习/健康/时间/关系等主题），仅作基础分词
    const DICT = ('开心 快乐 难过 委屈 孤独 焦虑 压力 放松 平静 满足 幸福 期待 失望 生气 害怕 担心 羡慕 感动 疲惫 充实 迷茫 崩溃 治愈 温暖 孤单 自由 安心 难受 纠结 犹豫 决定 选择 放弃 开始 结束 继续 完成 实现 希望 梦想 现实 未来 过去 现在 努力 认真 仔细 温柔 勇敢 坚强 乐观 积极 重要 美丽 漂亮 可爱 简单 容易 困难 麻烦 顺利 糟糕 不错 喜欢 想念 矛盾 吵架 和解 陪伴 理解 支持 鼓励 信任 周末 朋友 家人 同事 老板 工作 加班 休息 睡眠 起床 洗澡 吃饭 做饭 咖啡 奶茶 电影 电视剧 综艺 旅行 逛街 运动 健身 瑜伽 跑步 读书 写作 计划 目标 习惯 坚持 努力 改变 成长 学习 考试 备考 复习 作业 课程 老师 同学 学校 图书馆 笔记 身体 健康 生病 感冒 医院 体重 减肥 饮食 喝水 早睡 今天 明天 昨天 晚上 早上 中午 上午 下午 月底 年初 年底 春天 夏天 秋天 冬天 生日 节日 自己 别人 大家 我们 你们 他们 她们 它们 心情 状态 感觉 想法 事情 问题 时间 生活 世界 城市 家乡 孩子 父母 朋友 男朋友 女朋友 电话 微信 消息 红包 礼物 惊喜 仪式 计划 目标 动力 信心 勇气 机会 挑战 困难 压力 责任 自由 平静 安全 希望 幸福 快乐 痛苦 悲伤 愤怒 恐惧 焦虑 嫉妒 羞耻 内疚 骄傲 满足 期待 失望 感动 温暖 孤独 空虚 充实 疲惫 清醒 混乱 秩序 规律 节奏 平衡 边界 关系 沟通 表达 倾听 包容 尊重 信任 诚实 善良 自私 勇敢 软弱 独立 依赖 控制 放手 接受 改变 成长 突破 限制 潜能 价值 意义 目的 方向 路途 终点 起点 过程 结果 成功 失败 尝试 错误 经验 教训 智慧 知识 能力 技能 才华 天赋 热情 兴趣 爱好 理想 现实 梦想 幻想 回忆 记忆 遗忘 思念 告别 重逢 相遇 错过 珍惜 浪费 后悔 释怀 放下 原谅 感恩 知足 贪婪 欲望 满足 平静 焦虑 自由 束缚 限制 开放 封闭 勇敢 恐惧 累 烦 滚 痛 苦 爽 饿 困 撑 崩 茫 慌 怒 怕 醉 瘦 胖 懒 悔 怯 尬 飒 燃 空 虚 丧 卷 躺 熬 裂 堵 闷 好累 想哭 想睡').split(' ');
    const set = new Set(DICT);
    // 1 字情绪/状态词白名单：永远保留（如 累/烦/滚），不被「好累」等长词吞掉，提取更精准
    const KEEP1 = new Set('累 烦 滚 痛 苦 爽 饿 困 撑 崩 茫 慌 怒 怕 醉 瘦 胖 懒 悔 怯 尬 飒 燃 空 虚 丧 卷 躺 熬 裂 堵 闷 哭 笑 爱 恨 忧 愁 疼 痒 晕 馋 软 硬 冷 热 湿 干 咸 甜 酸 辣 腥 腻'.split(' '));
    // 过滤太泛的功能/时间词（几乎每篇都出现，无信息量）
    const stop = new Set(['我们', '你们', '他们', '她们', '它们', '自己', '别人', '大家', '今天', '明天', '昨天', '早上', '中午', '下午', '上午', '晚上', '现在', '过去', '未来', '事情', '问题', '时间', '感觉', '想法', '状态', '心情']);
    // 填充词 / 连接词黑名单：即便命中词典也视为无意义，不予展示（根治「是/想/看/依旧」类及 因为/所以/觉得 等 filler）
    const STOP2 = new Set(['因为', '所以', '但是', '然后', '其实', '已经', '还是', '就是', '觉得', '知道', '一直', '总是', '真的', '有点', '比较', '可能', '希望', '我们', '你们', '他们', '她们', '它们', '别人', '大家', '时候', '这个', '那个', '什么', '怎么', '可以', '应该', '如果', '虽然', '而且', '并且', '或者', '进行', '通过', '对于', '关于', '以及', '一些', '这样', '那样', '这种', '那种', '没有', '不会', '不能', '不想', '不要', '非常', '十分', '特别', '更加', '经常', '偶尔', '突然', '渐渐', '终于', '或许', '大概', '也许', '似乎', '显然', '自然', '当然', '于是', '然而', '否则', '反而', '只是', '不过', '那么', '这么', '多么', '一直', '仍旧', '依旧', '仍旧', '还是', '是否', '为何', '如何', '想要', '需要', '开始', '继续', '一下', '起来', '出来', '过来', '回去', '起来']);
    // 三餐相关词（v266）：人每天都要吃饭，这类词出现在关键词里没有信息量，一律排除
    const MEALW = new Set(['吃饭', '做饭', '早餐', '午餐', '晚餐', '早饭', '午饭', '晚饭', '三餐', '饮食', '外卖', '夜宵', '加餐', '吃饱', '饿了', '饿', '零食', '水果', '喝水', '咖啡', '奶茶', '火锅', '烧烤', '点外卖', '煮饭', '下厨', '饭菜', '食堂', '辣', '咸', '腻', '馋']);
    // 功能性字（助词/代词/介词/连词/量词/副词/时间方位/疑问等）——作为分词边界，且本身无意义不计入
    const FN = new Set('的得地了着过呢吗吧啊呀哦呃哼啦咯嘛哇哪啥呗喽咧喔嘞哟把被让给对在于到从向往与跟和或同及因故由趁将我你他她它们咱自己人谁这那该某个个些只条件位本张次回遍顿场名种类点块片双对副头匹不没别无未勿非很太更最极较又也还都仅才就再却但虽然若如即亦并且则能会要应肯须必可上下里后前内外旁间边头面处时候日月年天今明昨早晚午左右等各每全整半多少几第诸众余其此彼何怎咋'.split(''));
    const isCJK = ch => /[\u4e00-\u9fff]/.test(ch);
    const cnt = {};
    const feed = (tok) => {
      for (let i = 0; i < tok.length; i++)
        for (let n = 1; n <= 4 && i + n <= tok.length; n++) {
          const g = tok.slice(i, i + n);
          cnt[g] = (cnt[g] || 0) + 1;
        }
    };
    (days || []).forEach(d => {
      const t = ((S.get('reviews', {}) || {})[d] || {}).text || '';
      let buf = '';
      const flush = () => { if (buf) { feed(buf); buf = ''; } };
      for (const ch of t) {
        if (isCJK(ch) && !FN.has(ch)) buf += ch;
        else flush();
      }
      flush();
    });
    // 长词优先：被更长且频次不低于它的词包含的短片段予以剔除（如"全世界"命中则不留"世界"）
    const grams = Object.keys(cnt);
    const sorted = grams.slice().sort((x, y) => (y.length - x.length) || (cnt[y] - cnt[x]) || (x < y ? -1 : 1));
    const kept = [];
    for (const g of sorted) {
      if (MEALW.has(g)) continue;                                      // 三餐词排除（每天都吃，无信息量）
      if (!set.has(g) || STOP2.has(g)) continue;            // 仅保留白名单里有独立意思的词，过滤 想/看/是/依旧/常想看小 等无意义碎片
      if (g.length === 1 && KEEP1.has(g)) { kept.push(g); continue; }  // 1字情绪词永远保留，不被更长词吞掉
      let sub = false;
      for (const k of kept) { if (k.length > g.length && k.includes(g) && cnt[k] >= cnt[g]) { sub = true; break; } }
      if (sub) continue;
      kept.push(g);
    }
    const cap = maxWords || 18;
    // 频次门槛：1 字≥3、2 字≥2、3–4 字≥1（过滤偶发无意义碎片）
    const arr = kept.filter(g => {
      if (g.length === 1) return cnt[g] >= 2;
      if (g.length === 2) return cnt[g] >= 2;
      return cnt[g] >= 1;
    }).map(g => ({ c: g, n: cnt[g] })).sort((a, b) => b.n - a.n).slice(0, cap);
    if (!arr.length) return '';
    const palette = ['#F4A6B8', '#F6C56E', '#8FB8E0', '#B8A4D4', '#7CB390', '#F5B971', '#E08BA0', '#9BD0C9', '#C9B6E4', '#F2C14E'];
    const n = arr.length;
    // 词云：高频词越大越居中（idx0=最高频、最大、放正中），向外字号递减——看似错落实则有规律。
    // 在像素坐标系内做碰撞避让（位置与尺寸同一单位）；画布高度按词量自适应，放不下就加高重排，保证绝不重叠。
    const W = 300;
    const maxN = Math.max(1, arr[0].n);
    const maxSize = n > 30 ? 18 : (n > 16 ? 24 : 30);
    const minSize = n > 30 ? 11 : (n > 16 ? 12 : 14);
    const sizeOf = (x) => Math.round(minSize + (maxSize - minSize) * Math.sqrt(x.n / maxN));
    // 宽度系数用 ~0.95：CJK 字形实际字宽≈字号，0.62 会严重低估宽度，碰撞检测按小宽度算→实际大宽度重叠
    const boxOf = (x, sz) => ({ w: Math.max(18, x.c.length * sz * 0.95), h: sz * 1.2 });
    // 位置与尺寸同为像素单位（画布宽=W）；容差加大到 6px，彻底杜绝重叠
    const overlap = (a, b) => Math.abs(a.x - b.x) < (a.w + b.w) / 2 + 6 && Math.abs(a.y - b.y) < (a.h + b.h) / 2 + 6;
    const layout = (H) => {
      const cx = W / 2, cy = H / 2, rMax = Math.ceil(Math.max(W, H) * 0.8);
      const placed = [], blocks = [];
      for (let idx = 0; idx < arr.length; idx++) {
        const x = arr[idx];
        const sz = sizeOf(x);
        const b = boxOf(x, sz), w = b.w, h = b.h;
        let pos = null;
        if (idx === 0) pos = { x: cx, y: cy };
        else {
          for (let r = 6; r <= rMax && !pos; r += 3) {
            for (let a = 0; a < 360; a += 12) {
              const rad = a * Math.PI / 180;
              const px = cx + r * Math.cos(rad);
              const py = cy + r * Math.sin(rad);
              if (px - w / 2 < 4 || px + w / 2 > W - 4 || py - h / 2 < 4 || py + h / 2 > H - 4) continue;
              const box = { x: px, y: py, w, h };
              if (!placed.some(p => overlap(p, box))) { pos = { x: px, y: py }; break; }
            }
          }
        }
        if (!pos) return null;   // 这个高度放不下 → 换更高的画布重排
        placed.push({ x: pos.x, y: pos.y, w, h });
        const col = palette[idx % palette.length];
        blocks.push(`<span class="hw-cloud-word" style="left:${pos.x}px;top:${pos.y}px;font-size:${sz}px;color:${col}">${esc(x.c)}</span>`);
      }
      return { H, html: blocks.join('') };
    };
    // 初始高度按词块总面积估算；放不下就 1.25 倍加高重试（最多 8 次，必然成功）
    let area = 0;
    arr.forEach(x => { const b = boxOf(x, sizeOf(x)); area += (b.w + 5) * (b.h + 5); });
    let H = Math.max(220, Math.ceil(area / (W * 0.42)));
    let res = null;
    for (let k = 0; k < 8 && !res; k++) { res = layout(H); if (!res) H = Math.ceil(H * 1.25); }
    if (!res) res = { H, html: '' };
    return `<div class="card hw-block" style="margin-top:12px"><h3>${icon('tag', 16)} 日记高频词</h3><div class="hw-cloud" style="position:relative;width:${W}px;max-width:100%;margin:0 auto;min-height:${res.H}px">${res.html}</div></div>`;
  },
  // 充电分类明细弹窗：列出某分类下的每一次充电、累计时长
  rechCatModal(cat, days) {
    const recs = [];
    (days || []).forEach(d => (S.get('recharge', {})[d] || []).forEach(r => { if ((r.name || '') === cat || (r.key || '') === cat) recs.push(Object.assign({ date: d }, r)); }));
    const totalMin = recs.reduce((s, r) => s + (Number(r.mins) || 0), 0);
    const rows = recs.slice().reverse().map(r => `<div class="rech-row">
      <span class="rech-emoji">${r.emoji || '✨'}</span>
      <span class="rech-name">${esc(r.name || cat)}</span>
      <span class="rech-min">${r.mins ? (Number(r.mins) + ' 分钟') : '未记时长'}</span>
      <span class="rech-date">${fmtCN(r.date)}</span>
    </div>`).join('');
    openModal(`<button class="close-x" onclick="closeModal()">×</button>
      <h3>${icon('leaf', 18)} ${esc(cat)} · 充电明细</h3>
      <div style="display:flex;gap:18px;align-items:center;margin:6px 0 14px">
        <div style="text-align:center"><div style="font-size:26px;font-weight:700">${recs.length}</div><div class="muted" style="font-size:12px">次</div></div>
        <div style="text-align:center"><div style="font-size:26px;font-weight:700">${totalMin || 0}</div><div class="muted" style="font-size:12px">分钟（累计）</div></div>
      </div>
      <div class="rech-list">${rows || '<div class="empty">暂无记录</div>'}</div>`);
  },
  // 生成报告悬浮按钮（右下角固定，独立不占日期切换）
  genFabHTML(tab) {
    const lab = tab === 'week' ? '周' : tab === 'month' ? '月' : '年';
    return `<button class="rv-fab" data-genfab="${tab}" title="生成${lab}总结报告">${icon('trending', 20)}</button>`;
  },
  /* 取「off 个月前的那个月」的所有日期（不超过今天） */
  _monthDaysAt(off) {
    off = off || 0;
    const cur = new Date(todayStr() + 'T00:00:00');
    cur.setMonth(cur.getMonth() - off);
    const y = cur.getFullYear(), m = cur.getMonth() + 1;
    const dim = new Date(y, m, 0).getDate();
    const out = [];
    for (let dd = 1; dd <= dim; dd++) {
      const ds = y + '-' + String(m).padStart(2, '0') + '-' + String(dd).padStart(2, '0');
      if (ds <= todayStr()) out.push(ds);
    }
    return out;
  },
  /* 由一组日期汇总月总结所需的全部派生数据（雷达 / 趋势 / 日记数 / 强弱项） */
  _monthStats(monthDays) {
    const ym = (monthDays[0] || todayStr()).slice(0, 7);
    // 已结束的月份雷达定格封存：首次查看即快照，之后不再随录入变化（满足"当月结束就封存"）
    const dim = ym < todayStr().slice(0, 7) ? this.sealedMonthDim(ym) : this.dimScoresDates(monthDays);
    const R = this.data();
    const weekly = [[], [], [], []];
    monthDays.forEach((d, i) => weekly[Math.min(3, Math.floor(i / 7.5))].push(d));
    const wkStudy = weekly.map(ws => Math.round(ws.reduce((s, d) => s + (S.get('kgLogs', {})[d] || []).reduce((a, l) => a + l.minutes, 0), 0) / 60 * 10) / 10);
    const wkWork = weekly.map(ws => ws.reduce((s, d) => s + (S.get('workLogs', {})[d] || []).length, 0));
    const wkSport = weekly.map(ws => ws.filter(d => (S.get('sportLogs', {})[d] || []).length).length);
    const diaryN = monthDays.filter(d => R[d] && R[d].text).length;
    const weakest = dim.dims[dim.values.indexOf(Math.min(...dim.values))];
    const strongest = dim.dims[dim.values.indexOf(Math.max(...dim.values))];
    return { dim, wkStudy, wkWork, wkSport, diaryN, weakest, strongest };
  },
  // 已结束月份的五维雷达快照：按 YYYY-MM 封存，定格后永不变动
  sealedMonthDim(ym) {
    const store = S.get('radarMonthSeal', {}) || {};
    if (store[ym]) return store[ym];
    const [y, m] = ym.split('-').map(Number);
    const days = [];
    for (let dd = 1, dim0 = new Date(y, m, 0).getDate(); dd <= dim0; dd++) days.push(ym + '-' + String(dd).padStart(2, '0'));
    const dim = this.dimScoresDates(days);
    store[ym] = dim; S.set('radarMonthSeal', store);
    return dim;
  },

  genDaily(d) {
    const f = this.dayFacts(d); const r = this.data()[d];
    const good = [], improve = [], sugg = [];
    if (f.plan.total && f.plan.done === f.plan.total) good.push(`计划全部完成（${f.plan.done}/${f.plan.total}），执行力满分！`);
    else if (f.plan.done > 0) { good.push(`完成了 ${f.plan.done}/${f.plan.total} 个计划。`); if (f.plan.total - f.plan.done > 0) improve.push(`还有 ${f.plan.total - f.plan.done} 个计划未完成，记得移到明日或果断放弃。`); }
    else if (f.plan.total) improve.push('今天的计划都还没动——是不是任务拆得不够小？试试拆到10分钟一步。');
    if (f.plan.abandoned.length) improve.push(`放弃了 ${f.plan.abandoned.length} 个任务（${f.plan.abandoned.map(t => t.abandonReason || '').filter(Boolean).join('；')}）——放弃有理由就不是失败，是聚焦。`);
    if (f.work.length) good.push(`产出了 ${f.work.length} 条内容（${f.work.map(w => w.type === 'video' ? '视频' : '图文').join('、')}），创作者的肌肉在生长。`);
    const studyMin = f.study.reduce((s, l) => s + l.minutes, 0);
    if (studyMin >= 60) good.push(`备考学习 ${Math.round(studyMin / 60 * 10) / 10} 小时，离上岸又近了一步。`);
    else if (studyMin > 0) good.push(`学了 ${studyMin} 分钟，有总比没有强。`);
    if (f.growth.length) good.push(`个人成长打卡 ${f.growth.length} 次（${[...new Set(f.growth.map(g => g.area))].join('、')}）。`);
    if (f.sport.length) good.push(`运动 ${f.sport.reduce((s, l) => s + l.minutes, 0)} 分钟，身体谢谢你。`);
    else sugg.push('明天给身体10分钟：随便挑一个体态跟练。');
    if (f.mealScore != null) { if (f.mealScore >= 75) good.push(`三餐营养分 ${f.mealScore}，吃得不错。`); else improve.push(`三餐营养分 ${f.mealScore}，看看营养师点评补补短板。`); }
    if (!good.length) good.push('今天可能过得比较随意——没关系，记录下来本身就是改变的开始。');
    if (r && r.mood >= 3) sugg.push('心情不太好的日子，允许自己慢一点。写下让你难受的事，或者直接来对话里跟枝枝聊聊。');
    if (!sugg.length) sugg.push('保持这个节奏，明天挑最重要的一件事先做。');
    return { good, improve, sugg };
  },

  // 枝枝自动复盘文案（本地规则，实时生成，无需 AI 调用）
  genZhiReview(d) {
    const f = this.dayFacts(d);
    const mealsData = S.get('meals', {})[d] || {};
    const mealsN = ['breakfast', 'lunch', 'dinner'].filter(k => mealsData[k] && !mealsData[k].skipped).length;
    const sportN = f.sport.length;
    const sportMin = f.sport.reduce((s, l) => s + l.minutes, 0);
    const taskDone = f.plan.done, taskTotal = f.plan.total;
    const workN = f.work.length;
    const studyMin = f.study.reduce((s, l) => s + l.minutes, 0);
    const growthN = f.growth.length;
    const hasData = taskTotal || workN || studyMin || growthN || sportN || mealsN;
    if (!hasData) return '今天还没记录什么，睡前花两分钟写写吧，枝枝陪着你~';
    const lines = [];
    lines.push(`今天完成了 ${taskDone} 项任务，${mealsN} 餐规律打卡，${sportN} 次运动跟练。`);
    const good = [];
    if (taskTotal && taskDone === taskTotal) good.push('计划全部完成，执行力满分');
    else if (taskDone > 0) good.push(`完成了 ${taskDone}/${taskTotal} 个计划`);
    if (workN) good.push(`产出 ${workN} 条内容`);
    if (studyMin >= 60) good.push(`备考学习 ${Math.round(studyMin / 60 * 10) / 10} 小时`);
    else if (studyMin > 0) good.push(`学了 ${studyMin} 分钟`);
    if (growthN) good.push(`成长打卡 ${growthN} 次`);
    if (mealsN === 3) good.push('三餐都好好吃了');
    if (sportN) good.push(`运动 ${sportMin} 分钟`);
    const improve = [];
    if (taskTotal && taskDone < taskTotal) improve.push(`还有 ${taskTotal - taskDone} 个计划未完成，明天继续`);
    if (!sportN) improve.push('明天给身体10分钟动一动');
    if (good.length) lines.push('亮点：' + good.join('，') + '。');
    if (improve.length) lines.push('可以更好：' + improve.join('；') + '。');
    lines.push('不管今天怎样，你已经在路上了，枝枝陪着你，晚安~');
    return lines.join('\n');
  },

  render(root) {
    if (!this._rtab) this._rtab = 'daily';
    this._root = root;
    root.innerHTML = `<div class="fun-archive" id="rvBody"></div>${this.rvNavHTML()}`;
    const box = root.querySelector('#rvBody');
    if (this._rtab === 'daily') this.render_daily_page(box, root);
    else this.render_stat_page(box, root);   // 统计：周/月/年/全部
    this.bindRvNav(root);
  },
  rvNavHTML() {
    const items = [['daily', '日记'], ['stat', '统计']];
    return `<div class="fun-nav rv-nav">${items.map(([k, l]) => `<button class="fun-nav-item ${this._rtab === k ? 'on' : ''}" data-rtab="${k}">${l}</button>`).join('')}</div>`;
  },
  bindRvNav(root) {
    root.querySelectorAll('[data-rtab]').forEach(b => b.onclick = () => { this._rtab = b.dataset.rtab; this.render(root); });
  },

  // ===== 每日复盘页：日期 + 精力/心情 + 日记 + 枝枝自动复盘 =====
  render_daily_page(box, root) {
    const R = this.data(); const r = R[this.cur] || {};
    const zhi = this.genZhiReview(this.cur);
    // === 往年今日（从首页迁移而来；只读已有日记，无历史则整块不渲染）===
    const _md = this.cur.slice(5);
    const _yrs = Object.keys(R).filter(k => k < this.cur && k.slice(5) === _md).sort().reverse();
    const _moodEmoji = ['😊', '🙂', '😐', '😟', '😢'];
    const pastYearsHTML = (() => {
      if (!_yrs.length) return '';
      const rows = _yrs.slice(0, 3).map(k => {
        const _r = R[k]; const _txt = (_r.text || '').trim();
        const em = _moodEmoji[_r.mood != null ? _r.mood : 2];
        const txt = _txt ? (_txt.length > 80 ? _txt.slice(0, 80) + '…' : _txt) : '（那天没有写日记）';
        return '<div style="border-top:1px dashed var(--line);padding:8px 0;display:flex;gap:8px;align-items:baseline">'
          + '<div style="font-size:12px;color:var(--muted);min-width:42px;flex-shrink:0">' + k.slice(0, 4) + '年</div>'
          + '<div style="flex:1;font-size:13px;line-height:1.5">' + em + ' ' + esc(txt) + '</div></div>';
      }).join('');
      return '<div class="card" style="margin-top:14px"><h3>' + icon('calendar', 18) + ' 往年今日</h3>' + rows
        + '<div class="muted" style="margin-top:6px">翻到 ' + _md.replace('-', '月') + '日 这天的你 ✨</div></div>';
    })();
    box.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding-right:12px">
        <span class="branch-title" style="margin:0;padding:0;border:none">日记</span>
        <button class="icon-btn" id="rDateClick" title="选择日期">${icon('calendar', 18)}</button>
      </div>
      <input type="date" id="rDate" value="${this.cur}" style="position:absolute;opacity:0;pointer-events:none">
      <div class="card">
        <div class="form-row"><label>今日精力</label>
          <div style="display:flex;gap:6px">${[1, 2, 3, 4, 5].map(v => `<button class="chip" data-energy="${v}" style="${r.energy === v ? 'background:#111;color:#fff;border-color:#111' : ''}">⚡${v}</button>`).join('')}</div></div>
        <div class="form-row"><label>今日心情</label>
          <div style="display:flex;gap:6px;flex-wrap:wrap">${this.moods.map((m, i) => `<button class="chip" data-mood="${i}" style="${r.mood === i ? 'background:#111;color:#fff;border-color:#111' : ''}">${m}</button>`).join('')}</div></div>
        <div class="form-row"><label>今天的状态、心情、所作所为…想写什么写什么</label>
          <textarea id="rText" rows="8" placeholder="今天…">${esc(r.text || '')}</textarea></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn" id="rSave">${icon('save',16)} 保存日记</button>
        </div>
          <div class="mumu-note" style="margin-top:14px">
          <span class="m-ic">${icon('leaf',20)}</span>
          <div><b>枝枝的自动复盘</b><div style="white-space:pre-wrap;margin-top:4px;font-size:13px;color:var(--ink)">${esc(zhi)}</div></div>
        </div>
      </div>
      ${pastYearsHTML}${this.genFabHTML('day')}`;
    const saveR = patch => { const R2 = this.data(); R2[this.cur] = { ...(R2[this.cur] || {}), ...patch }; S.set('reviews', R2); };
    // 点击日期切换
    const dateClick = box.querySelector('#rDateClick');
    const dateInput = box.querySelector('#rDate');
    if (dateClick) dateClick.onclick = () => dateInput.showPicker ? dateInput.showPicker() : dateInput.click();
    dateInput.onchange = e => { this.cur = e.target.value; this.render(root); };
    box.querySelectorAll('[data-energy]').forEach(b => b.onclick = () => { saveR({ energy: Number(b.dataset.energy) }); this.render(root); });
    box.querySelectorAll('[data-mood]').forEach(b => b.onclick = () => { saveR({ mood: Number(b.dataset.mood) }); this.render(root); });
    box.querySelector('#rSave').onclick = () => { saveR({ text: box.querySelector('#rText').value }); toast('日记已保存'); this.render(root); };
    const gf = box.querySelector('[data-genfab]');
    if (gf) gf.onclick = () => this.generateReport('day', root);
  },

  // ===== 总结复盘页：总览标题 + 周/月/年 三个子标签 =====
  render_summary_page(box, root) {
    if (!this._summaryTab) this._summaryTab = 'week';
    box.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <span class="branch-title" style="margin:0;padding:0;border:none">总览</span>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:14px;align-items:center">
        <button class="btn sm ${this._summaryTab === 'week' ? '' : 'ghost'}" data-stab="week">周总结</button>
        <button class="btn sm ${this._summaryTab === 'month' ? '' : 'ghost'}" data-stab="month">月总结</button>
        <button class="btn sm ${this._summaryTab === 'year' ? '' : 'ghost'}" data-stab="year">年总结</button>
        <button class="btn sm ghost" id="genReport" style="margin-left:auto">${icon('trending', 16)} 生成报告</button>
      </div>
      <div id="summaryContent"></div>`;
    box.querySelectorAll('[data-stab]').forEach(b => b.onclick = () => {
      this._summaryTab = b.dataset.stab; this.render_summary_page(box, root);
    });
    const gr = box.querySelector('#genReport');
    if (gr) gr.onclick = () => this.generateReport(this._summaryTab, root);
    const content = box.querySelector('#summaryContent');
    if (this._summaryTab === 'week') this.render_week_visual(content);
    else if (this._summaryTab === 'month') this.render_month_visual(content);
    else this.render_year_visual(content);
  },
  /* 一键报告：本期 vs 上期对比 + 趋势 + 枝枝的有用建议（本地规则，无需 AI key）。
     v199 重写：基于真实数据生成 grounded 文案（跳过 0 变化），月/年做上升/回落分析，年报无去年数据时安全兜底。 */
  generateReport(tab, root) {
    try {
      const now = todayStr();
      // 时区安全的日期加减（避免 new Date().toISOString() 在 UTC+8 把日期回滚导致 range 死循环）
      const shift = (d, n) => { const p = d.split('-'); const dt = new Date(+p[0], +p[1] - 1, +p[2]); dt.setDate(dt.getDate() + n); const y = dt.getFullYear(), m = String(dt.getMonth() + 1).padStart(2, '0'), dd = String(dt.getDate()).padStart(2, '0'); return y + '-' + m + '-' + dd; };
      const range = (a, b) => { const out = []; if (a > b) return out; let d = a; while (d <= b) { out.push(d); const nx = shift(d, 1); if (nx === d) break; d = nx; } return out; };
      let curDays, prevDays, label;
      if (tab === 'day') { const d0 = (this.cur || todayStr()); curDays = [d0]; prevDays = [shift(d0, -1)]; label = '今日'; }
      else if (tab === 'week') { curDays = weekDates(now); prevDays = curDays.map(d => shift(d, -7)); label = '本周'; }
      else if (tab === 'month') { curDays = this._monthDaysAt(0); prevDays = this._monthDaysAt(1); label = '本月'; }
      else {
        const y = +now.slice(0, 4);
        curDays = range(y + '-01-01', now);
        const ly = y - 1;
        const tryEnd = ly + now.slice(4);
        // 去年同月同日若不合法（例如去年非闰年的 02-29），回退到去年 12-31
        const probe = new Date(tryEnd + 'T00:00:00');
        const endPrev = isNaN(probe.getTime()) ? (ly + '-12-31') : tryEnd;
        prevDays = range(ly + '-01-01', Math.min(endPrev, ly + '-12-31'));
        label = '今年';
      }
      const agg = (ds) => {
        let planT = 0, planD = 0, study = 0, sport = 0, work = 0, fun = 0, rech = 0, diary = 0;
        const _rechArr = [];
        (ds || []).forEach(d => {
          const ps = Daily.statsOf(d); planT += ps.total || 0; planD += ps.done || 0;
          study += (S.get('kgLogs', {})[d] || []).reduce((a, l) => a + (l.minutes || 0), 0);
          sport += (S.get('sportLogs', {})[d] || []).reduce((a, l) => a + (l.minutes || 0), 0);
          work += (S.get('workLogs', {})[d] || []).length;
          fun += (S.get('funLogs', {})[d] || []).reduce((a, r) => a + (Number(r.minutes) || 0), 0);
          (S.get('recharge', {})[d] || []).forEach(r => _rechArr.push(r));
          const rv = S.get('reviews', {})[d]; if (rv && rv.text) diary++;
        });
        rech = window.rechPowerOf ? rechPowerOf(_rechArr) : _rechArr.reduce((s, r) => s + (window.rechPower ? rechPower(r) : (Number(r.val) || 0)), 0);
        return { planT, planD, study, sport, work, fun, rech, diary };
      };
      const a = agg(curDays), b = agg(prevDays);
      const h = m => Math.round(m / 60 * 10) / 10;
      const rows = [
        ['计划完成', a.planD, b.planD, '项'],
        ['学习时长', h(a.study), h(b.study), 'h'],
        ['运动时长', h(a.sport), h(b.sport), 'h'],
        ['创作条数', a.work, b.work, '条'],
        ['充电', a.rech, b.rech, '电'],
        ['写日记', a.diary, b.diary, '篇']
      ];
      const rowHTML = rows.map(([n, c, p, u]) => {
        const d = Math.round((c - p) * 10) / 10;
        const arrow = d > 0 ? '<span style="color:#2e7d57">▲' + d + '</span>' : d < 0 ? '<span style="color:#c0392b">▼' + Math.abs(d) + '</span>' : '<span class="muted">—</span>';
        return `<div class="list-row"><span style="flex:1">${n}</span><b style="margin:0 8px">${c}${u}</b><span style="width:64px;text-align:right;font-size:12px">${arrow}</span><span class="muted" style="width:56px;text-align:right;font-size:12px">${p}${u}</span></div>`;
      }).join('');
      // 基于真实差值生成 grounded 建议（跳过 0；月/年做上升/回落分析）
      const items = [];
      const addItem = (name, c, p, unit) => {
        if (c === 0 && p === 0) return;
        const d = Math.round((c - p) * 10) / 10;
        if (d === 0) return;
        items.push({ name, c, p, d: Math.abs(d), unit, up: d > 0 });
      };
      addItem('计划完成', a.planD, b.planD, '项');
      addItem('学习', h(a.study), h(b.study), 'h');
      addItem('运动', h(a.sport), h(b.sport), 'h');
      addItem('创作', a.work, b.work, '条');
      addItem('充电', a.rech, b.rech, '电');
      addItem('写日记', a.diary, b.diary, '篇');
      const itemsX = items.filter(i => i.name !== '充电');
      const pw = tab === 'day' ? '昨天' : (tab === 'week' ? '上周' : (tab === 'month' ? '上个月' : '去年'));
      const lines = [];
      const synth = () => {
        const ups = items.filter(i => i.up).sort((x, y) => y.d - x.d);
        const downs = items.filter(i => !i.up).sort((x, y) => y.d - x.d);
        const period = tab === 'week' ? '这周' : (tab === 'month' ? '这个月' : '今年');
        if (ups[0] && downs[0]) lines.push(`一句话：${period}在「${ups[0].name}」上攒了劲，但「${downs[0].name}」松动了——下阶段把后者提一提最划算`);
        else if (ups[0]) lines.push(`一句话：${period}整体在往上走，尤其「${ups[0].name}」，势头不错，别松`);
        else if (downs[0]) lines.push(`一句话：${period}有几项回落，别焦虑，先把「${downs[0].name}」稳住就好`);
      };
      if (tab === 'day') {
        itemsX.slice(0, 2).forEach(it => lines.push(`和${pw}比，${it.name}${it.up ? '多' : '少'}做了 ${it.d}${it.unit}${it.up ? '，状态在线' : '，正常波动'}`));
        if (a.planT > 0 && a.planD < a.planT) lines.push(`还有 ${a.planT - a.planD} 个计划没动，明天拆小接着来`);
        else if (a.planD >= a.planT && a.planT > 0) lines.push(`今天计划全清，执行力拉满`);
        if (a.diary === 0) lines.push(`睡前写两句日记，明天复盘更准`);
      } else if (tab === 'week') {
        const ups = itemsX.filter(i => i.up).sort((x, y) => y.d - x.d);
        const downs = itemsX.filter(i => !i.up).sort((x, y) => y.d - x.d);
        if (ups[0]) lines.push(`这周最亮的是「${ups[0].name}」，比${pw}多 ${ups[0].d}${ups[0].unit}，势头留住`);
        if (downs[0]) lines.push(`「${downs[0].name}」比${pw}少 ${downs[0].d}${downs[0].unit}，先找回节奏，别硬补`);
        if (a.planD > 0 && a.planT > 0) { const pct = Math.round(a.planD / a.planT * 100); const left = a.planT - a.planD; if (pct >= 80) lines.push(`周计划完成率 ${pct}%，稳`); else lines.push(`周计划只完成 ${pct}%（还差 ${left} 个没动），得抓紧把任务多做掉，别堆到下周`); }
      } else if (tab === 'month') {
        const ups = itemsX.filter(i => i.up).sort((x, y) => y.d - x.d);
        const downs = itemsX.filter(i => !i.up).sort((x, y) => y.d - x.d);
        if (ups[0]) lines.push(`这个月「${ups[0].name}」涨得最明显，多 ${ups[0].d}${ups[0].unit}，保持`);
        if (downs[0]) lines.push(`「${downs[0].name}」回落了 ${downs[0].d}${downs[0].unit}，下月列进主线`);
        if (a.planD > 0 && a.planT > 0) { const pct = Math.round(a.planD / a.planT * 100); const left = a.planT - a.planD; if (pct >= 80) lines.push(`月计划完成率 ${pct}%`); else lines.push(`月计划只完成 ${pct}%（剩 ${left} 个），得加把劲把任务清一清`); }
      } else {
        const hasPrev = itemsX.some(i => i.p > 0);
        if (!hasPrev) {
          lines.push('去年还没记录，今年的积累就是你的新起点');
          itemsX.slice(0, 2).forEach(it => lines.push(`今年${it.name}累计 ${it.c}${it.unit}，已经很棒`));
        } else {
          const ups = itemsX.filter(i => i.up).sort((x, y) => y.d - x.d);
          const downs = itemsX.filter(i => !i.up).sort((x, y) => y.d - x.d);
          if (ups[0]) lines.push(`今年「${ups[0].name}」比去年多 ${ups[0].d}${ups[0].unit}，是最大亮点`);
          if (downs[0]) lines.push(`「${downs[0].name}」比去年少 ${downs[0].d}${ups[0].unit}，明年重点发力`);
        }
      }
      // 充电 vs 精力消耗：充电盖过出力 = 摆烂（批评，不鼓励）；适当充电有必要；并据二者推荐应应用的精力上限
      const consScore = a.planD + Math.round(h(a.study)) + Math.round(h(a.sport)) + a.work;
      const rechScore = Math.round(a.rech);
      if (rechScore > 0) {
        if (rechScore > consScore) lines.push(`${label}你充了 ${rechScore} 电，却只消耗了约 ${consScore} 份正事精力——充电比出力还多，这就是摆烂虚度。把充电收一收，把多出来的精力拿去做正事（学习/创作/运动），别光回血不出力`);
        else if (rechScore <= consScore * 0.3) lines.push(`${label}你充了 ${rechScore} 电，刚好垫在正事之间——适当充电有必要，保持这种张弛有度的节奏`);
        else lines.push(`${label}你充了 ${rechScore} 电，占正事消耗的 ${Math.round(rechScore / Math.max(1, consScore) * 100)}%——充电还行，但别再涨了，正事才是主线`);
      }
      if (!lines.length) lines.push(`${label}各项都稳着来，保持节奏就好`);
      const textHTML = esc(lines.join('。')) + '。';
      openModal(`<button class="close-x" onclick="closeModal()">×</button>
        <div class="rp-head">
          <div>
            <h3 style="margin:0">${icon('trending', 18)} ${label}报告</h3>
            <div class="muted" style="font-size:12px">${MUMU_ASSISTANT()}陪你看看</div>
          </div>
        </div>
        <div class="muted" style="margin:10px 0 4px;font-size:12px">${label} vs 上期 (箭头是变化量，最右为上次)</div>
        ${rowHTML}
        <div class="fin-advice" style="margin-top:12px;flex-direction:column;align-items:stretch;gap:8px">
          <span class="fa-tag" style="background:#8FB8E0;align-self:flex-start">${MUMU_ASSISTANT()}说</span>
          <p class="fa-text" style="margin:0;line-height:1.75">${textHTML}</p>
        </div>
        <div class="muted" style="margin-top:8px;font-size:11px">报告基于你自己的记录本地生成，不上传。想看更细的趋势图，回到上方总结卡片即可。</div>`);
    } catch (e) {
      console.error('[generateReport]', e);
      toast('生成报告出错了：' + (e && e.message ? e.message : e));
    }
  },

  // 推断任务分类（优先 cat 字段，其次 link 前缀）
  taskCat(t) {
    const lk = (t && t.link) || '';
    // 成长类：细分到领域（阅读/英语/理财…），不笼统归为「成长」
    if (lk.startsWith('growth:') && window.Daily && Daily.catFine) return Daily.catFine(lk);
    if (t && t.cat === 'growth' && window.Daily && Daily.catFine && lk) return Daily.catFine(lk);
    if (t && t.cat) return t.cat;
    if (window.Daily && Daily.catFromLink) return Daily.catFromLink(lk);
    const link = lk;
    if (link.startsWith('meals:')) return 'meals';
    if (link.startsWith('sport:')) return 'sport';
    if (link.startsWith('work:')) return 'work';
    if (link.startsWith('kaogong:')) return 'kaogong';
    if (link.startsWith('growth:')) return 'growth';
    if (link.startsWith('travel:')) return 'travel';
    return '';
  },
  catNameEmoji(cat) {
    if (window.Daily && Daily.catEmoji && Daily.catName) {
      const emojiVal = Daily.catEmoji(cat);
      const name = Daily.catName(cat);
      // If emojiVal is an icon name, use icon(); otherwise treat as raw
      const iconHTML = (typeof icons !== 'undefined' && icons[emojiVal]) ? icon(emojiVal, 16) : emojiVal;
      return { emoji: iconHTML, name: name || '未分类' };
    }
    if (cat && cat.indexOf('g:') === 0) return { emoji: icon(cat === 'g:阅读' ? 'book' : 'sprout', 16), name: cat.slice(2) };
    const map = { meals: 'meal', sport: 'running', work: 'money', kaogong: 'book', growth: 'sprout', improve: 'heart', daily: 'check', travel: 'map' };
    const names = { meals: '三餐', sport: '跟练', work: '赚钱', kaogong: '学习', growth: '成长', improve: '改善', daily: '日常', travel: '出行' };
    const ic = map[cat] || 'tag';
    return { emoji: icon(ic, 16), name: names[cat] || '未分类' };
  },

  // ===== 精力概览卡（周/月/年总结通用）=====
  loadSummaryHTML(days) {
    if (!window.Daily || !Daily.dayLoadInfo) return '';
    const cap = Daily.loadCap();
    let sumPlanned = 0, sumDone = 0, overDays = 0, rechDays = 0, rechTotal = 0, incompleteSum = 0;
    days.forEach(d => {
      const info = Daily.dayLoadInfo(d);
      sumPlanned += info.plannedLoad;
      sumDone += info.doneLoad;
      if (info.plannedLoad >= cap) overDays++;
      if (info.recharge > 0) { rechDays++; rechTotal += info.recharge; }
      if (info.plannedLoad > 0) incompleteSum += (info.pendingLoad / info.plannedLoad);
    });
    const n = days.length || 1;
    const avgPlanned = Math.round(sumPlanned / n);
    const avgDone = Math.round(sumDone / n);
    const avgPct = cap ? Math.round(avgPlanned / cap * 100) : 0;
    const incompleteRate = sumPlanned > 0 ? (incompleteSum / n) : 0;
    // 自适应建议：改为「稳定建议」——基于过去 14 天滚动窗口、每天只算一次并缓存，
    // 既避免一天内随录入乱跳（20→24→29），又让周/月/年三处给出一致的建议。
    let suggest = this._rtab === 'week' ? this._stableLoadSuggest() : '';
    return `<div class="card" style="margin-top:12px"><h3>${icon('sun', 16)} 精力概览</h3>
      <div class="load-summary">
        <div style="text-align:center"><div class="stat-num">${avgPct}%</div><div class="stat-lab">平均排程</div></div>
        <div style="text-align:center"><div class="stat-num">${overDays}</div><div class="stat-lab">排满天数</div></div>
        <div style="text-align:center"><div class="stat-num">${rechDays}</div><div class="stat-lab">充电天数</div></div>
        <div style="text-align:center"><div class="stat-num">${avgDone}</div><div class="stat-lab">日均已消耗</div></div>
      </div>
      <div class="muted" style="margin-top:6px">区间 ${days[0].slice(5)} ~ ${days[days.length - 1].slice(5)} · 精力上限 ${cap}（设置里可改）</div>
      ${suggest}
    </div>`;
  },

  /* 稳定的精力建议：过去 14 天滚动窗口 + 每日缓存，周/月/年三处共用，避免一天内乱跳 */
  _stableLoadSuggest() {
    const today = todayStr();
    const cache = S.get('loadSuggestCache', {});
    if (cache.date === today && cache.suggest != null) return cache.suggest;
    const win = [];
    for (let i = 13; i >= 0; i--) win.push(addDays(today, -i));
    const cap = Daily.loadCap();
    let sumPlanned = 0, sumDone = 0, rechDays = 0, rechTotal = 0, incompleteSum = 0, overDays = 0;
    win.forEach(d => {
      const info = Daily.dayLoadInfo(d);
      sumPlanned += info.plannedLoad; sumDone += info.doneLoad;
      if (info.plannedLoad >= cap) overDays++;
      if (info.recharge > 0) { rechDays++; rechTotal += info.recharge; }
      if (info.plannedLoad > 0) incompleteSum += (info.pendingLoad / info.plannedLoad);
    });
    const n = win.length;
    const avgPlanned = Math.round(sumPlanned / n), avgDone = Math.round(sumDone / n);
    const incompleteRate = sumPlanned > 0 ? incompleteSum / n : 0;
    const prof = S.get('loadProfile', {}) || {};
    let suggest = '';
    if (prof.adjustMode !== 'manual') {
      let rec = null;
      if (rechDays >= Math.ceil(n / 2) && avgDone < cap * 0.5) rec = { dir: 'up', to: Math.round(cap * 1.2), msg: '最近两周你充电的天数过半，可日均消耗的精力却很少——光回血不出力，就是摆烂虚度。把精力上限调高一点，多把精力用在正事上。' };
      else if (incompleteRate > 0.35 && avgPlanned > 0) rec = { dir: 'down', to: Math.max(4, Math.round(avgPlanned * 0.85)), msg: '最近两周你常做不完（约 ' + Math.round(incompleteRate * 100) + '% 的精力没消耗掉）。建议把上限调低一点，先建立成就感。' };
      else if (avgPlanned < cap * 0.6 && avgDone >= avgPlanned * 0.9 && avgPlanned > 0) rec = { dir: 'up', to: Math.round(cap * 1.2), msg: '你常有余力（近两周平均才排 ' + avgPlanned + '/' + cap + '，且基本都做完了）。可以试着把上限调高一点，多承载一些。' };
      if (rec) {
        suggest = `<div class="banner info lb-suggest" style="margin-top:8px">
          <div class="lb-suggest-head"><span class="lb-suggest-ic">${icon('leaf',14)}</span><span class="lb-suggest-title">${MUMU_ASSISTANT()}建议</span><span class="lb-suggest-fold">▾</span></div>
          <div class="lb-suggest-body"><div class="lb-suggest-msg">${rec.msg}</div><div class="lb-apply-row"><button class="btn sm" id="applyCap" data-cap="${rec.to}">应用 ${rec.to}</button></div></div>
        </div>`;
      }
    }
    if (!suggest) {
      if (overDays >= 2) suggest = `<div class="banner info" style="margin-top:8px">${icon('leaf', 14)} 最近两周你有 <b>${overDays}</b> 天排得太满啦。${MUMU_ASSISTANT()}建议你：奖励自己一顿好的、出门走走、或好好睡一觉，把电充回来 💤</div>`;
      else if (rechDays) suggest = `<div class="banner info" style="margin-top:8px">${icon('moon', 14)} 你已经在 <b>${rechDays}</b> 天里充了电（共 ${rechTotal} 电），保持这种张弛有度的节奏 🌱</div>`;
    }
    cache.date = today; cache.suggest = suggest; S.set('loadSuggestCache', cache);
    return suggest;
  },

  // ===== 周总结可视化：每个分类一行 + 7天圆圈 =====
  // ===== 数据看板（v262）：8 个可视化组件集中呈现，本年度口径 =====
  dayCheckins(d) {
    let n = 0;
    n += (S.get('sportLogs', {})[d] || []).length;
    n += (S.get('kgLogs', {})[d] || []).length;
    n += (S.get('workLogs', {})[d] || []).length;
    n += (S.get('growthLogs', {})[d] || []).length;
    n += (S.get('readLogs', {})[d] || []).length;
    n += (S.get('funLogs', {})[d] || []).length;
    n += (S.get('travelOut', {})[d] || []).length;
    const mv = S.get('meals', {})[d]; if (mv) n += ['breakfast', 'lunch', 'dinner'].filter(k => mv[k] && !mv[k].skipped).length;
    return n;
  },
  // ===== v270 新增：统计聚合 + 板块日历/打卡密度/分类卡 =====
  dayPlanDone(d) {
    const ps = S.get('plans', {})[d] || [];
    let n = 0;
    ps.forEach(t => { if (t.abandoned || t.moved) return; const done = (window.Daily && typeof Daily.effDone === 'function') ? Daily.effDone(t, d) : !!t.done; if (done) n++; });
    return n;
  },
  // 分类聚合：与周总结同口径，返回 {key:{label,colorCat,unit,days:[每日次数]}}
  aggregateRows(days) {
    const sportLogs = S.get('sportLogs', {}), growthLogs = S.get('growthLogs', {}), workLogs = S.get('workLogs', {}),
      kgLogs = S.get('kgLogs', {}), readLogs = S.get('readLogs', {}), funLogs = S.get('funLogs', {}),
      mealsStore = S.get('meals', {}), travelStore = S.get('travelOut', {});
    const rows = {};
    const add = (key, label, colorCat, di, n, unit) => { if (!rows[key]) rows[key] = { label, colorCat, unit: unit || '次', days: days.map(() => 0) }; rows[key].days[di] += (n || 1); };
    const planStore = S.get('plans', {});
    const effDoneOf = (t, d) => (window.Daily && typeof Daily.effDone === 'function') ? Daily.effDone(t, d) : false;
    const planHasUndone = (d, match) => { const hit = (planStore[d] || []).filter(t => !t.abandoned && match(t)); if (!hit.length) return false; return !hit.some(t => effDoneOf(t, d)); };
    const normFunType = (r) => (window.Entertainment && window.Entertainment.funNormType) ? window.Entertainment.funNormType(r.type) : r.type;
    days.forEach((d, di) => {
      const mv = mealsStore[d]; const mealN = mv ? ['breakfast', 'lunch', 'dinner'].filter(k => mv[k] && !mv[k].skipped).length : 0; if (mealN) add('meals', '三餐', 'meals', di, mealN);
      const wn = (workLogs[d] || []).length; if (wn) add('work', '创作', 'work', di, wn);
      const outN = ((travelStore[d] || []).some(e => e.kind === 'ootd') ? 1 : 0); if (outN) add('travel', '出行', 'travel', di, outN);
      (kgLogs[d] || []).forEach(l => { const sub = (l.subject || '').trim(); const lab = sub ? sub.replace(/^(行测|申论|面试)-/, '') : '学习'; if (planHasUndone(d, t => t.link === 'kaogong:study' && ((t.extra && t.extra.subject) || '') === sub)) return; add('kaogong:' + (sub || '学习'), lab, 'kaogong', di, 1); });
      (sportLogs[d] || []).forEach(l => { const p = (l.project || '运动').trim(); if (!p) return; if (planHasUndone(d, t => t.link === 'sport:' + p)) return; add('sport:' + p, p, 'sport', di, 1); });
      (growthLogs[d] || []).forEach(l => { const a = (l.area || '成长').trim(); if (a) add('growth:' + a, a, 'growth', di, 1); });
      (readLogs[d] || []).forEach(l => { const isFun = (window.Growth && window.Growth.readCat) ? window.Growth.readCat(l).key === 'fun' : (l && (l.cat === 'fun' || l.cat === '娱乐')); if (!isFun) add('growth:阅读', '阅读', 'growth', di, 1); });
      const funWorks = (t) => { const set = new Set(); (funLogs[d] || []).forEach(r => { if (normFunType(r) !== t) return; const key = (r.title || '').trim(); set.add(key || ('#' + r.id)); }); return set.size; };
      const novelN = funWorks('小说'); if (novelN) add('novel', '小说', 'novel', di, novelN, '本');
      const movieN = funWorks('影视'); if (movieN) add('movie', '影视', 'movie', di, movieN, '部');
      const comicN = funWorks('漫画'); if (comicN) add('comic', '漫画', 'comic', di, comicN, '部');
      const gameN = funWorks('游戏'); if (gameN) add('fun', '游戏', 'fun', di, gameN, '款');
    });
    return rows;
  },
  // 分类打卡卡：一分类一行 + 每日/每周圆点（与周总结同排序、同配色）
  catCardHTML(days, title) {
    const rows = this.aggregateRows(days);
    const baseEmoji = { meals: icon('meal', 16), sport: icon('running', 16), work: icon('creation', 16), kaogong: icon('book', 16), growth: icon('sprout', 16), travel: icon('map', 16), novel: icon('reading', 16), movie: icon('film', 16), comic: icon('comic', 16), fun: icon('game', 16) };
    const baseOrder = ['meals', 'sport', 'work', 'kaogong', 'growth', 'travel', 'novel', 'movie', 'comic', 'fun'];
    const ordered = [];
    baseOrder.forEach(base => {
      const keys = Object.keys(rows).filter(k => k === base || k.startsWith(base + ':'));
      if (base === 'sport' || base === 'growth' || base === 'kaogong') {
        keys.sort((a, b) => { if (a === base + ':阅读') return -1; if (b === base + ':阅读') return 1; return 0; });
        keys.forEach(k => ordered.push(k));
      } else if (keys.length) ordered.push(keys[0]);
    });
    Object.keys(rows).forEach(k => { if (!ordered.includes(k)) ordered.push(k); });
    let buckets;
    if (days.length <= 31) buckets = days.map((d, i) => ({ label: d, idxs: [i] }));
    else { buckets = []; let cur = null; days.forEach((d, i) => { const wd = (new Date(d + 'T12:00:00').getDay() + 6) % 7; if (!cur || wd === 0) { cur = { label: d, idxs: [] }; buckets.push(cur); } cur.idxs.push(i); }); }
    const nCols = buckets.length, small = nCols > 10, wdNames = ['日', '一', '二', '三', '四', '五', '六'];
    const head = buckets.map(b => { let t; if (nCols <= 7) t = wdNames[new Date(b.label + 'T12:00:00').getDay()]; else if (nCols <= 31) t = Number(b.label.slice(8)); else t = b.label.slice(5); return '<span class="wk-dot wd">' + t + '</span>'; }).join('');
    const rowsHTML = ordered.map(key => {
      const r = rows[key]; const emoji = baseEmoji[r.colorCat] || icon('tag', 16);
      const cells = buckets.map(b => { const c = b.idxs.reduce((s, idx) => s + r.days[idx], 0); return c > 1 ? `<span class="wk-dot cat-${r.colorCat} num" title="${esc(b.label)} · ${c} ${r.unit}">${c}</span>` : c === 1 ? `<span class="wk-dot cat-${r.colorCat}" title="${esc(b.label)} · 1 ${r.unit}"></span>` : '<span class="wk-dot blank"></span>'; }).join('');
      return `<div class="wk-row"><span class="wk-task"><span class="wk-group-emoji">${emoji}</span>${esc(r.label)}</span><div class="wk-dots ${small ? 'wk-dots-sm' : ''}" style="grid-template-columns:repeat(${nCols},1fr)">${cells}</div></div>`;
    }).join('');
    return `<div class="card" style="margin-top:12px"><h3>${icon('sparkles', 16)} ${esc(title)}</h3>`
      + `<div class="wk-row wk-head" style="font-size:12px;color:var(--muted)"><span class="wk-task">分类</span><div class="wk-dots wk-dots-hd ${small ? 'wk-dots-sm' : ''}" style="grid-template-columns:repeat(${nCols},1fr)">${head}</div></div>`
      + (rowsHTML || '<div class="empty" style="padding:18px;text-align:center">这段时间还没有打卡记录</div>') + '</div>';
  },
  // 板块月历：彩色圆点打卡（与各板块日历同风格）
  // 单日各「项目」列表（每个圆点 = 一个不同项目），用于日历格子内的彩色圆点
  boardDayProjects(d, key) {
    const out = [];
    const seen = new Set();
    const add = (v) => { if (v && !seen.has(v)) { seen.add(v); out.push(v); } };
    if (key === 'sport' || key === 'all') (S.get('sportLogs', {})[d] || []).forEach(l => add((l.project || '运动').trim()));
    if (key === 'kaogong' || key === 'all') (S.get('kgLogs', {})[d] || []).forEach(l => { const s = (l.subject || '').trim().replace(/^(行测|申论|面试)-/, ''); if (s) add(s); });
    if (key === 'work' || key === 'all') (S.get('workLogs', {})[d] || []).forEach(l => add('创作'));
    if (key === 'growth' || key === 'all') (S.get('growthLogs', {})[d] || []).forEach(l => add((l.area || '成长').trim()));
    if (key === 'read' || key === 'all') { if ((S.get('readLogs', {})[d] || []).some(l => !(window.Growth && window.Growth.readCat) || window.Growth.readCat(l).key !== 'fun')) add('阅读'); }
    if (key === 'fun' || key === 'all') { const seen = new Set(); (S.get('funLogs', {})[d] || []).forEach(r => seen.add((window.Entertainment && window.Entertainment.funNormType) ? window.Entertainment.funNormType(r.type) : r.type)); seen.forEach(t => add(t)); }
    return out;
  },
  // 项目 → 稳定颜色（小说固定为蓝色，符合用户指定）
  _projColor(pr, key) {
    const FIX = { '小说': '#8FB8E0', '影视': '#F4A6B8', '漫画': '#F2A65A', '游戏': '#E08BA0', '创作': '#F6AFC4', '阅读': '#C2A8E0', '成长': '#C2A8E0' };
    if (FIX[pr]) return FIX[pr];
    const PAL = ['#8FB8E0', '#7CB390', '#F6C56E', '#F4A6B8', '#B8A4D4', '#4FB0AE', '#F2A65A', '#9BD0C9', '#C58AB0', '#A8B5C4'];
    let h = 0; for (let i = 0; i < pr.length; i++) h = (h * 31 + pr.charCodeAt(i)) >>> 0;
    return PAL[h % PAL.length];
  },
  boardCalDotsHTML(key, ym) {
    const p = (ym || todayStr().slice(0, 7)).split('-'); const Y = Number(p[0]), M = Number(p[1]), mm = String(M).padStart(2, '0');
    const lastDay = new Date(Y, M, 0).getDate();
    const lead = (new Date(Y + '-' + mm + '-01T12:00:00').getDay() + 6) % 7;
    const wd = ['一', '二', '三', '四', '五', '六', '日'];
    let html = '<div class="bd-cal-head">' + wd.map(w => '<span>' + w + '</span>').join('') + '</div><div class="bd-cal-grid bd-cal-dots">';
    for (let i = 0; i < lead; i++) html += '<span class="bd-cal-cell empty"></span>';
    const today = todayStr();
    for (let i = 1; i <= lastDay; i++) {
      const d = Y + '-' + mm + '-' + String(i).padStart(2, '0');
      const projs = this.boardDayProjects(d, key);
      const dots = projs.length ? '<span class="bd-dots">' + projs.slice(0, 5).map(pr => '<i class="bd-dot" style="background:' + this._projColor(pr, key) + '" title="' + esc(pr) + '"></i>').join('') + (projs.length > 5 ? '<i class="bd-dot-more">+' + (projs.length - 5) + '</i>' : '') + '</span>' : '';
      html += '<span class="bd-cal-cell' + (d === today ? ' today' : '') + (projs.length ? ' has-dot' : '') + '" title="' + d + (projs.length ? ' · ' + projs.length + ' 项打卡' : '') + '"><span class="bd-num">' + i + '</span>' + dots + '</span>';
    }
    return html + '</div>';
  },
  // 当月各板块打卡的「项目名称」（圆点对应的项目），只显 4 个、点击展开
  boardMonthNames(key, ym) {
    const p = (ym || todayStr().slice(0, 7)).split('-'); const Y = Number(p[0]), M = Number(p[1]), mm = String(M).padStart(2, '0');
    const lastDay = new Date(Y, M, 0).getDate(); const days = []; for (let i = 1; i <= lastDay; i++) days.push(Y + '-' + mm + '-' + String(i).padStart(2, '0'));
    const set = new Set();
    days.forEach(d => {
      if (key === 'all' || key === 'sport') (S.get('sportLogs', {})[d] || []).forEach(l => { const pr = (l.project || '运动').trim(); if (pr) set.add(pr); });
      if (key === 'all' || key === 'kaogong') (S.get('kgLogs', {})[d] || []).forEach(l => { const s = (l.subject || '').trim(); if (s) set.add(s.replace(/^(行测|申论|面试)-/, '')); });
      if (key === 'all' || key === 'work') { if ((S.get('workLogs', {})[d] || []).length) set.add('创作'); }
      if (key === 'all' || key === 'growth' || key === 'read') (S.get('growthLogs', {})[d] || []).forEach(l => { const a = (l.area || '成长').trim(); if (a) set.add(a); });
      if (key === 'all' || key === 'read') { if ((S.get('readLogs', {})[d] || []).some(l => !(window.Growth && window.Growth.readCat) || window.Growth.readCat(l).key !== 'fun')) set.add('阅读'); }
      if (key === 'all' || key === 'meals') { const mv = S.get('meals', {})[d]; if (mv && ['breakfast', 'lunch', 'dinner'].some(k => mv[k] && !mv[k].skipped)) set.add('三餐'); }
      if (key === 'all' || key === 'fun') { const seen = new Set(); (S.get('funLogs', {})[d] || []).forEach(r => seen.add((window.Entertainment && window.Entertainment.funNormType) ? window.Entertainment.funNormType(r.type) : r.type)); seen.forEach(t => set.add(t)); }
      if (key === 'all' || key === 'travel') { if ((S.get('travelOut', {})[d] || []).length) set.add('出行'); }
    });
    return [...set];
  },
  // 热力图方块
  heatCells(cnt, days) {
    const max = Math.max(1, ...days.map(d => cnt[d]));
    const weeks = [[]]; let cur = weeks[0];
    days.forEach((d, i) => { const wd = (new Date(d + 'T12:00:00').getDay() + 6) % 7; if (i > 0 && wd === 0) { cur = []; weeks.push(cur); } cur.push(d); });
    const cs = [];
    weeks.forEach(w => { for (let i = 0; i < 7; i++) { const d = w[i]; if (!d) { cs.push('<span class="bd-hm-cell empty"></span>'); continue; } const lvl = cnt[d] ? Math.min(4, Math.ceil(cnt[d] / max * 4)) : 0; cs.push('<span class="bd-hm-cell l' + lvl + '" title="' + d + ' · ' + cnt[d] + ' 项完成"></span>'); } });
    return '<div class="bd-heat-wrap"><div class="bd-heat-grid" style="grid-template-columns:repeat(' + weeks.length + ',13px)">' + cs.join('') + '</div></div>';
  },
  // 打卡密度（数据=每日计划完成）：月=当月 / 年=当年 / 全部=从记录开始
  planDensityHTML(scope) {
    let days;
    if (scope === 'month') days = this._monthDaysAt(this._monthOff || 0);
    else if (scope === 'year') { const y = todayStr().slice(0, 4); days = []; for (let d = y + '-01-01'; d <= todayStr(); d = addDays(d, 1)) days.push(d); }
    else days = this._allDays();
    const cnt = {}; days.forEach(d => cnt[d] = this.dayPlanDone(d));
    const rangeLabel = scope === 'month' ? '当月' : scope === 'year' ? '当年' : '从记录开始';
    return '<div class="card bd-card"><div class="bd-head"><h3>打卡密度</h3><span class="bd-act muted">' + rangeLabel + '</span></div>' + this.heatCells(cnt, days) + '<div class="muted" style="text-align:center;margin-top:6px">颜色越深 = 当天完成的计划越多</div></div>';
  },
  // 精力消耗分类明细弹窗（点分布色块查看）
  loadCatModal(base, days) {
    const ds = days || this._distDays || [];
    const labels = { meals: '三餐', sport: '跟练', work: '赚钱', kaogong: '学习', growth: '成长', travel: '出行', improve: '改善', daily: '日常' };
    const name = labels[base] || base;
    const recs = [];
    (ds).forEach(d => (Daily.list(d) || []).forEach(t => { if (t.abandoned || t.moved || t.restDay) return; if (Daily.isMealTask(t) || Daily.isLoadFree(t)) return; if (!Daily.effDone(t, d)) return; const b = ((t.link || '').split(':')[0]) || 'daily'; if (b !== base) return; recs.push({ date: d, title: (t.title || t.text || '任务') }); }));
    const rows = recs.slice().reverse().map(r => '<div class="rech-row"><span class="rech-name">' + esc(r.title) + '</span><span class="rech-date">' + fmtCN(r.date) + '</span></div>').join('');
    openModal('<button class="close-x" onclick="closeModal()">×</button><h3>' + icon('fire', 18) + ' ' + esc(name) + ' · 精力消耗</h3><div class="rech-list">' + (rows || '<div class="empty">暂无记录</div>') + '</div>');
  },
  boardHeatmap(yearDays) {
    const cnt = {}; yearDays.forEach(d => cnt[d] = this.dayCheckins(d));
    const max = Math.max(1, ...yearDays.map(d => cnt[d]));
    const weeks = [[]]; let cur = weeks[0];
    yearDays.forEach((d, i) => {
      const wd = (new Date(d + 'T12:00:00').getDay() + 6) % 7; // 周一=0
      if (i > 0 && wd === 0) { cur = []; weeks.push(cur); } // 新一周从周一开始；首周（可能不满）直接并入第一个数组，避免 1/1 非周一时 cur 为 null 报错
      cur.push(d);
    });
    const cols = weeks.map(w => {
      const cells = [];
      for (let i = 0; i < 7; i++) {
        const d = w[i];
        if (!d) { cells.push('<span class="bd-hm-cell empty"></span>'); continue; }
        const lvl = Math.min(4, Math.ceil(cnt[d] / max * 4));
        cells.push('<span class="bd-hm-cell l' + lvl + '" title="' + d + ' · ' + cnt[d] + ' 次打卡"></span>');
      }
      return '<div class="bd-hm-col">' + cells.join('') + '</div>';
    }).join('');
    return '<div class="bd-heat">' + cols + '</div><div class="muted" style="margin-top:6px">颜色越深 = 当天打卡越多（本年度窗口）</div>';
  },
  streakInfo(item, y) {
    let cur = 0, run = 0, best = 0, total = 0;
    if (!window.Streak) return { cur, best, total };
    for (let d = y + '-01-01'; d <= todayStr(); d = addDays(d, 1)) {
      if (Streak.covered(item, d)) { run++; best = Math.max(best, run); total++; } else run = 0;
    }
    for (let d = todayStr(); d >= y + '-01-01'; d = addDays(d, -1)) { if (Streak.covered(item, d)) cur++; else break; }
    return { cur, best, total };
  },
  // ===== 统计页（v263）：周/月/年/全部 下拉切换，8 个可视化组件并入 =====
  render_stat_page(box, root) {
    if (!this._statScope) this._statScope = 'week';
    this._statRerender = null;
    box.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding-right:12px">
        <span class="branch-title" style="margin:0;padding:0;border:none">统计</span>
        <select id="statScope" class="select" title="切换统计范围">
          <option value="week"${this._statScope === 'week' ? ' selected' : ''}>周总结</option>
          <option value="month"${this._statScope === 'month' ? ' selected' : ''}>月总结</option>
          <option value="year"${this._statScope === 'year' ? ' selected' : ''}>年总结</option>
          <option value="all"${this._statScope === 'all' ? ' selected' : ''}>全部</option>
        </select>
      </div>
      <div id="statBody"></div>`;
    const sel = box.querySelector('#statScope');
    if (sel) sel.onclick = () => {};
    if (sel) sel.onchange = () => { this._statScope = sel.value; this.renderStatBody(box.querySelector('#statBody'), root); };
    this.renderStatBody(box.querySelector('#statBody'), root);
  },
  renderStatBody(body, root) {
    const scope = this._statScope || 'week';
    this._statRerender = () => this.renderStatBody(body, root);
    if (scope === 'week') this.render_week_visual(body, root);
    else if (scope === 'month') this.render_month_visual(body, root);
    else if (scope === 'year') this.render_year_visual(body, root);
    else this.render_all_visual(body, root);
    body.insertAdjacentHTML('beforeend', this.vizBlocksHTML(scope, { skipDimMood: scope === 'week' }));
    body.insertAdjacentHTML('beforeend', this.summaryCardHTML(scope));
    this.bindStatBlocks(body, root);
  },
  // 全部：跨年累计复盘
  render_all_visual(box, root) {
    const days = this._allDays();
    const dim = this.dimScoresDates(days);
    const R = this.data();
    const wroteDays = days.filter(d => R[d] && R[d].text).length;
    const moodCounts = [0, 0, 0, 0, 0];
    days.forEach(d => { const m = (R[d] || {}).mood; if (m != null) moodCounts[m]++; });
    const weakest = dim.dims[dim.values.indexOf(Math.min(...dim.values))];
    const strongest = dim.dims[dim.values.indexOf(Math.max(...dim.values))];
    box.innerHTML = `
      ${this.genFabHTML('year')}
      <div class="grid3" style="margin-bottom:14px">
        <div class="card" style="text-align:center;margin:0"><div class="stat-num">${wroteDays}</div><div class="stat-lab">复盘天数</div></div>
        <div class="card" style="text-align:center;margin:0"><div class="stat-num">${moodCounts[0] + moodCounts[1]}</div><div class="stat-lab">开心天数</div></div>
        <div class="card" style="text-align:center;margin:0"><div class="stat-num">${moodCounts[3] + moodCounts[4]}</div><div class="stat-lab">低落天数</div></div>
      </div>
      <div class="card"><h3>${icon('stats', 16)} 累计关键数字</h3>
        <div class="grid3" style="gap:8px">
          <div style="text-align:center"><div class="stat-num" style="font-size:15px">${strongest}</div><div class="stat-lab">最强项</div></div>
          <div style="text-align:center"><div class="stat-num" style="font-size:15px">${weakest}</div><div class="stat-lab">待补强</div></div>
          <div style="text-align:center"><div class="stat-num">${days.length}</div><div class="stat-lab">记录天数</div></div>
        </div>
      </div>`;
    const gf = box.querySelector('[data-genfab]'); if (gf) gf.onclick = () => this.generateReport(gf.dataset.genfab, root);
    const et = box.querySelector('[data-energytoggle]'); if (et) et.onclick = () => { this._energyView = this._energyView === 'rech' ? 'load' : 'rech'; this.render(root); };
    const ro = box.querySelectorAll('[data-rechcat]'); if (ro) ro.forEach(el => el.onclick = () => this.rechCatModal(el.dataset.rechcat, JSON.parse(el.dataset.days)));
  },
  // 累计天数（从最早记录到今天）
  _allDays() {
    const keys = new Set();
    ['reviews', 'workLogs', 'kgLogs', 'sportLogs', 'growthLogs', 'readLogs', 'funLogs', 'meals', 'travelOut'].forEach(k => { const o = S.get(k, {}); Object.keys(o).forEach(d => { if (/^\d{4}-\d{2}-\d{2}$/.test(d)) keys.add(d); }); });
    (S.get('mumu_goals', []) || []).forEach(g => { if (g.period && /^\d{4}-\d{2}-\d{2}$/.test(g.period)) keys.add(g.period); });
    const arr = [...keys].sort();
    if (!arr.length) return [todayStr()];
    const out = []; for (let d = arr[0]; d <= todayStr(); d = addDays(d, 1)) out.push(d);
    return out;
  },
  // 目标完成度（按范围）
  goalCompletionHTML(scope) {
    const goals = S.get('mumu_goals', []);
    let label, cur;
    if (scope === 'week') { cur = addDays(weekStart(todayStr()), (this._weekOff || 0) * 7); label = '本周'; }
    else if (scope === 'month') { const md = this._monthDaysAt(this._monthOff || 0); cur = (md[0] || todayStr()).slice(0, 7); label = '本月'; }
    else if (scope === 'year') { cur = todayStr().slice(0, 4); label = '今年'; }
    else { label = '累计'; }
    const gs = scope === 'all' ? goals : goals.filter(g => g.scope === scope && g.period === cur);
    const total = gs.length, done = gs.filter(g => g.done).length;
    const pct = total ? Math.round(done / total * 100) : 0;
    const undone = total - done;
    if (!total) return '<div class="card" style="margin-top:12px"><h3>' + icon('target', 16) + ' 目标</h3><div class="muted">还没有' + label + '目标，去每日计划底部「今日目标」添加吧。</div></div>';
    return '<div class="card" style="margin-top:12px"><h3>' + icon('target', 16) + ' 目标</h3>'
      + '<div class="gp-wrap">'
      + '<div class="gp-bar-box"><div class="gp-bar"><i style="width:' + pct + '%"></i></div>'
      + '<div class="muted" style="margin-top:6px">已完成 ' + done + '/' + total + ' · 未完成 ' + undone + ' 个</div></div>'
      + '<div class="gp-pct">' + pct + '<span>%</span></div></div></div>';
  },
  // ===== 板块日历 / 热力图（v266）：统计页共用，右上角可切换板块 =====
  BOARDS() {
    return [
      { key: 'sport', name: '运动' }, { key: 'kaogong', name: '学习' },
      { key: 'work', name: '创作' }, { key: 'growth', name: '成长' }, { key: 'fun', name: '娱乐' }
    ];
  },
  boardCount(d, key) {
    const g = (k) => S.get(k, {})[d];
    if (key === 'sport') return (g('sportLogs') || []).length;
    if (key === 'kaogong') return (g('kgLogs') || []).length;
    if (key === 'work') return (g('workLogs') || []).length;
    if (key === 'growth') return (g('growthLogs') || []).length + (g('readLogs') || []).length;
    if (key === 'read') return (g('readLogs') || []).length;
    if (key === 'meals') { const mv = g('meals'); return mv ? ['breakfast', 'lunch', 'dinner'].filter(k => mv[k] && !mv[k].skipped).length : 0; }
    if (key === 'fun') return (g('funLogs') || []).length;
    if (key === 'travel') return (g('travelOut') || []).length;
    return this.dayCheckins(d);
  },
  _bdOpts(cur) {
    return this.BOARDS().map(b => '<option value="' + b.key + '"' + (b.key === cur ? ' selected' : '') + '>' + b.name + '</option>').join('');
  },
  // 热力图：方块尺寸随容器自适应（grid 1fr + 正方形），不再固定 11px，底部大片空白消失
  boardHeatHTML(key, yearDays) {
    const cnt = {}; yearDays.forEach(d => cnt[d] = this.boardCount(d, key));
    const max = Math.max(1, ...yearDays.map(d => cnt[d]));
    const weeks = [[]]; let cur = weeks[0];
    yearDays.forEach((d, i) => {
      const wd = (new Date(d + 'T12:00:00').getDay() + 6) % 7; // 周一=0
      if (i > 0 && wd === 0) { cur = []; weeks.push(cur); }
      cur.push(d);
    });
    const cells = [];
    weeks.forEach(w => {
      for (let i = 0; i < 7; i++) {
        const d = w[i];
        if (!d) { cells.push('<span class="bd-hm-cell empty"></span>'); continue; }
        const lvl = cnt[d] ? Math.min(4, Math.ceil(cnt[d] / max * 4)) : 0;
        cells.push('<span class="bd-hm-cell l' + lvl + '" title="' + d + ' · ' + cnt[d] + ' 次"></span>');
      }
    });
    return '<div class="bd-heat-wrap"><div class="bd-heat-grid" style="grid-template-columns:repeat(' + weeks.length + ',13px)">' + cells.join('') + '</div></div>';
  },
  boardCalHTML(key, ym) {
    const p = (ym || todayStr().slice(0, 7)).split('-');
    const Y = Number(p[0]), M = Number(p[1]), mm = String(M).padStart(2, '0');
    const lastDay = new Date(Y, M, 0).getDate();
    const lead = (new Date(Y + '-' + mm + '-01T12:00:00').getDay() + 6) % 7;
    const cnt = {}; let max = 1;
    for (let i = 1; i <= lastDay; i++) {
      const d = Y + '-' + mm + '-' + String(i).padStart(2, '0');
      cnt[d] = this.boardCount(d, key); if (cnt[d] > max) max = cnt[d];
    }
    const wd = ['一', '二', '三', '四', '五', '六', '日'];
    let html = '<div class="bd-cal-head">' + wd.map(w => '<span>' + w + '</span>').join('') + '</div><div class="bd-cal-grid">';
    for (let i = 0; i < lead; i++) html += '<span class="bd-cal-cell empty"></span>';
    const today = todayStr();
    for (let i = 1; i <= lastDay; i++) {
      const d = Y + '-' + mm + '-' + String(i).padStart(2, '0');
      const c = cnt[d]; const lvl = c ? Math.min(4, Math.ceil(c / max * 4)) : 0;
      html += '<span class="bd-cal-cell l' + lvl + (d === today ? ' today' : '') + '" title="' + d + (c ? ' · ' + c + ' 次' : '') + '">' + i + '</span>';
    }
    return html + '</div>';
  },
  // 月历切换 YYYY-MM
  _shiftYm(ym, delta) {
    const p = (ym || todayStr().slice(0, 7)).split('-');
    let Y = Number(p[0]), M = Number(p[1]) + delta;
    while (M < 1) { M += 12; Y--; }
    while (M > 12) { M -= 12; Y++; }
    return Y + '-' + String(M).padStart(2, '0');
  },
  // 统计页组件交互绑定（板块切换 + 月历翻页）
  bindStatBlocks(body, root) {
    body.querySelectorAll('[data-bdswitch]').forEach(sel => {
      sel.onchange = () => { this[sel.dataset.bdswitch] = sel.value; if (this._statRerender) this._statRerender(); };
    });
    body.querySelectorAll('[data-calnav]').forEach(b => {
      b.onclick = () => { this._calYm = this._shiftYm(this._calYm, Number(b.dataset.calnav)); if (this._statRerender) this._statRerender(); };
    });
    // 热力图默认滚到最右（最近的日期）
    body.querySelectorAll('.bd-heat-wrap').forEach(w => { w.scrollLeft = w.scrollWidth; });
    // 精力分布 ↔ 充电分布 切换 + 图例点开明细
    body.querySelectorAll('[data-energytoggle]').forEach(b => {
      b.onclick = () => { this._energyView = this._energyView === 'rech' ? 'load' : 'rech'; if (this._statRerender) this._statRerender(); };
    });
    body.querySelectorAll('[data-rechcat]').forEach(el => {
      el.onclick = () => { try { this.rechCatModal(el.dataset.rechcat, JSON.parse(el.dataset.days)); } catch (e) {} };
    });
    // 精力卡：右上角图标 / 点色块 → 切到分布（消耗/充电）；返回总览
    body.querySelectorAll('[data-energyview]').forEach(b => {
      b.onclick = () => { this._energyView = b.dataset.energyview; if (this._statRerender) this._statRerender(); };
    });
    // 精力分布色块 → 看该分类消耗明细
    body.querySelectorAll('[data-loadcat]').forEach(el => {
      el.onclick = () => { try { this.loadCatModal(el.dataset.loadcat); } catch (e) {} };
    });
    // 日历卡：当月项目名「展开 / 收起」
    body.querySelectorAll('[data-bdexpand]').forEach(b => {
      b.onclick = () => { const box = b.closest('[data-bdnames]'); if (!box) return; const all = box.querySelector('.bd-names-all'); if (!all) return; if (all.hasAttribute('hidden')) { all.removeAttribute('hidden'); b.textContent = '收起'; } else { all.setAttribute('hidden', ''); b.textContent = '展开 ' + b.dataset.bdexpand + ' 项'; } };
    });
    // 娱乐曲线：竖轴 时间 / 作品数 切换
    body.querySelectorAll('[data-funaxis]').forEach(b => { b.onclick = () => { this._funAxis = this._funAxis === 'time' ? 'count' : 'time'; if (this._statRerender) this._statRerender(); }; });
  },
  // 精力投资（v267）：主动投资 vs 系统消耗 占比 + 一句建议。数据来自 Daily.dayLoadInfo(d).investLoad / consumeLoad
  energyInvestHTML(days) {
    let inv = 0, con = 0;
    days.forEach(d => {
      const i = (window.Daily && Daily.dayLoadInfo) ? Daily.dayLoadInfo(d) : null;
      if (!i) return;
      inv += (i.investLoad || 0); con += (i.consumeLoad || 0);
    });
    const total = inv + con;
    const head = '<div class="card" style="margin-top:12px"><h3>' + icon('target', 16) + ' 投资</h3>';
    if (!total) return head + '<div class="empty">这段时间还没有精力记录</div></div>';
    const pct = Math.round(inv / total * 100);
    const segs = [{ label: '主动投资', value: inv, color: '#7CB390' }, { label: '系统消耗', value: con, color: '#F4A6B8' }];
    const tip = pct >= 40 ? '投资占比不错，能量在往长线的事上走。'
      : (pct >= 20 ? '投资偏少，试试每天留一件「为自己」的小事。'
        : '几乎都在应付消耗，挑一件小事每天投 15 分钟试试。');
    return head
      + '<div style="display:flex;align-items:center;gap:10px">' + svgDonut(segs, 118, '') + '<div class="muted">主动投资 <b>' + inv + '</b><br>系统消耗 <b>' + con + '</b><br>投资占比 <b>' + pct + '%</b></div></div>'
      + '<div class="muted" style="margin-top:6px">' + tip + '</div></div>';
  },
  // 统计范围内的天数（尊重周 / 月切换偏移）
  scopeDays(scope) {
    if (scope === 'week') { const s = addDays(weekStart(todayStr()), (this._weekOff || 0) * 7); const a = []; for (let i = 0; i < 7; i++) a.push(addDays(s, i)); return a; }
    if (scope === 'month') return this._monthDaysAt(this._monthOff || 0);
    if (scope === 'year') { const y = todayStr().slice(0, 4); const a = []; for (let d = y + '-01-01'; d <= todayStr(); d = addDays(d, 1)) a.push(d); return a; }
    return this._allDays();
  },
  // 五维雷达卡（周总结里紧跟「分类」，其他范围在总览中）
  dimCardHTML(days) {
    const dim = this.dimScoresDates(days);
    return '<div class="card" style="margin-top:12px"><h3>' + icon('stats', 16) + ' 五维</h3>' + svgRadar(dim.dims, dim.values)
      + '<div class="dim-tags">' + dim.dims.map((d, i) => '<span class="tag">' + d + ' ' + dim.values[i] + '</span>').join('') + '</div></div>';
  },
  // 心情分布卡
  moodCardHTML(days) {
    const R = this.data();
    const mc = [0, 0, 0, 0, 0];
    days.forEach(d => { const m = (R[d] || {}).mood; if (m != null) mc[m]++; });
    const total = mc.reduce((a, b) => a + b, 0);
    if (!total) return '<div class="card" style="margin-top:12px"><h3>' + icon('heart', 16) + ' 心情</h3><div class="empty">这段时间还没有心情记录</div></div>';
    const colors = ['#F4A6B8', '#F6C56E', '#C4CBD3', '#8FB8E0', '#B8A4D4'];
    const emo = ['😄', '🙂', '😐', '😟', '😢'];
    // v282：换成「占比条 + 表情卡片」，最多的那档高亮
    const max = Math.max.apply(null, mc);
    const dom = mc.indexOf(max);
    const seg = mc.map((c, i) => c ? '<span style="flex:' + c + ';background:' + colors[i] + '"></span>' : '').join('');
    const pills = this.moods.map((m, i) => {
      return '<div class="mood-pill' + (i === dom ? ' on' : '') + '">'
        + '<span class="mood-pe">' + emo[i] + '</span>'
        + '<span class="mood-pc">' + mc[i] + '</span>'
        + '<span class="mood-name">' + m + '</span></div>';
    }).join('');
    return '<div class="card mood-card" style="margin-top:12px"><h3>' + icon('heart', 16) + ' 心情</h3>'
      + '<div class="mood-spectrum">' + seg + '</div>'
      + '<div class="mood-pills">' + pills + '</div>'
      + '<div class="mood-note">这阵子大多时候 <b style="color:' + colors[dom] + '">' + emo[dom] + ' ' + this.moods[dom] + '</b></div>'
      + '</div>';
  },
  // ===== 分类虚线块（v276）：复盘统计页分区，用虚线分隔 =====
  block(title, iconName, inner) {
    if (!inner || !String(inner).trim()) return '';
    return '<div class="rv-block">' + this.blockHead(title, iconName) + '<div class="rv-block-body">' + inner + '</div></div>';
  },
  blockHead(title, iconName) {
    const ic = (typeof icons !== 'undefined' && iconName && icons[iconName]) ? icon(iconName, 15) : '';
    return '<div class="rv-block-head"><span class="rv-bh-title">' + ic + ' ' + esc(title) + '</span></div>';
  },
  // 目标完成度（按范围，复用 goalCompletionHTML 的口径）
  _goalScopeStats(scope) {
    const goals = S.get('mumu_goals', []);
    let cur, label;
    if (scope === 'week') { cur = addDays(weekStart(todayStr()), (this._weekOff || 0) * 7); label = '本周'; }
    else if (scope === 'month') { const md = this._monthDaysAt(this._monthOff || 0); cur = (md[0] || todayStr()).slice(0, 7); label = '本月'; }
    else if (scope === 'year') { cur = todayStr().slice(0, 4); label = '今年'; }
    else { label = '累计'; }
    const gs = scope === 'all' ? goals : goals.filter(g => g.scope === scope && g.period === cur);
    const total = gs.length, done = gs.filter(g => g.done).length;
    const pct = total ? Math.round(done / total * 100) : 0;
    return { total, done, pct, label };
  },
  // 计划块：本期部署 / 完成 / 完成度% / 目标完成度%
  planBlockHTML(days, scope) {
    if (!window.Daily) return '';
    let dep = 0, done = 0;
    days.forEach(d => { const ps = Daily.statsOf(d); dep += (ps.total || 0); done += (ps.done || 0); });
    const pct = dep ? Math.round(done / dep * 100) : 0;
    const g = this._goalScopeStats(scope);
    const goalLine = g.total ? (' · 目标完成度 ' + g.pct + '%（' + g.done + '/' + g.total + '）') : ' · 暂无' + g.label + '目标';
    return this.block('计划', 'clipboard', `
      <div class="grid4" style="gap:8px">
        <div class="st4"><div class="stat-num">${dep}</div><div class="stat-lab">部署</div></div>
        <div class="st4"><div class="stat-num">${done}</div><div class="stat-lab">完成</div></div>
        <div class="st4"><div class="stat-num">${pct}%</div><div class="stat-lab">完成度</div></div>
        <div class="st4"><div class="stat-num">${g.pct}%</div><div class="stat-lab">目标</div></div>
      </div>
      <div class="muted" style="margin-top:8px">本期共部署 ${dep} 个任务，完成 ${done} 个（放弃 / 请假计为未完成）${goalLine}</div>
    `);
  },
  // 成长块：阅读 + 成长(技能 / idea)
  growthBlockHTML(days) {
    let read = 0, grow = 0;
    days.forEach(d => {
      read += (S.get('readLogs', {})[d] || []).filter(l => !(window.Growth && window.Growth.readCat) || window.Growth.readCat(l).key !== 'fun').length;
      grow += (S.get('growthLogs', {})[d] || []).length;
    });
    if (!read && !grow) return this.block('成长', 'sprout', '<div class="empty">这段时间还没有成长记录</div>');
    return this.block('成长', 'sprout', `
      <div class="grid4" style="gap:8px">
        <div class="st4"><div class="stat-num">${read}</div><div class="stat-lab">阅读</div></div>
        <div class="st4"><div class="stat-num">${grow}</div><div class="stat-lab">成长</div></div>
      </div>`);
  },
  // 运动块：时长 + 打卡数 + 常练项目
  sportBlockHTML(days) {
    let min = 0, n = 0; const projs = {};
    days.forEach(d => (S.get('sportLogs', {})[d] || []).forEach(l => { min += (Number(l.minutes) || 0); n++; const p = (l.project || '运动').trim(); projs[p] = (projs[p] || 0) + 1; }));
    if (!n) return this.block('运动', 'running', '<div class="empty">这段时间还没有运动记录</div>');
    const top = Object.entries(projs).sort((a, b) => b[1] - a[1]).slice(0, 4);
    return this.block('运动', 'running', `
      <div class="grid4" style="gap:8px">
        <div class="st4"><div class="stat-num">${n}</div><div class="stat-lab">打卡</div></div>
        <div class="st4"><div class="stat-num">${Math.round(min / 60 * 10) / 10}</div><div class="stat-lab">小时</div></div>
      </div>
      ${top.length ? '<div class="muted" style="margin-top:8px">常练：' + top.map(x => esc(x[0]) + ' ' + x[1]).join('、') + '</div>' : ''}`);
  },

  // 数据总览（v269）：板块日历与密度合成一个方框可切换；精力用圆环；顺序按板块聚合
  vizBlocksHTML(scope, opts) {
    opts = opts || {};
    const y = todayStr().slice(0, 4);
    const yearDays = []; for (let d = y + '-01-01'; d <= todayStr(); d = addDays(d, 1)) yearDays.push(d);
    const days = this.scopeDays(scope);
    const safe = (label, fn) => { try { return fn(); } catch (e) { console.error('[viz]' + label, e); return '<div class="card" style="margin-top:12px"><div class="empty">该组件暂时无法显示</div></div>'; } };
    const workLogs = S.get('workLogs', {}), kgLogs = S.get('kgLogs', {}), travelOut = S.get('travelOut', {}), funLogsAll = S.get('funLogs', {});

    // 精力趋势（净消耗）
    const enVals = days.map(d => (window.Daily && Daily.dayLoadInfo) ? (Daily.dayLoadInfo(d).netConsumed || 0) : 0);
    const enLabels = days.map(d => d.slice(5));

    // 创作分布
    const wTypes = { video: 0, article: 0 };
    days.forEach(d => (workLogs[d] || []).forEach(l => { wTypes[l.type === 'video' ? 'video' : 'article']++; }));
    const wSegs = [{ label: '视频', value: wTypes.video, color: '#F4A6B8' }, { label: '图文', value: wTypes.article, color: '#8FB8E0' }];

    // 学习科目分布
    const kg = {};
    days.forEach(d => (kgLogs[d] || []).forEach(l => { const s = (l.subject || '学习').replace(/^(行测|申论|面试)-/, ''); kg[s] = (kg[s] || 0) + 1; }));
    const kgTop = Object.entries(kg).sort((a, b) => b[1] - a[1]).slice(0, 6);

    // 出行时间线
    const tripDates = Object.keys(travelOut).filter(d => d >= days[0] && d <= todayStr()).sort();
    const tripRows = tripDates.length ? tripDates.slice().reverse().map(d => { const ents = travelOut[d] || []; const note = (ents.map(e => e.note || e.place || e.kind).filter(Boolean)[0] || ''); return '<div class="bd-tl-item"><span class="bd-tl-dot"></span><div><b>' + d.slice(5) + '</b> <span class="muted">' + (note ? esc(note) : ents.length + ' 条记录') + '</span></div></div>'; }).join('') : '<div class="muted">这段时间还没有出行记录</div>';

    // 三餐规律
    const MealsMod = window.Meals;
    let mealOn = 0, mealOff = 0, mealMiss = 0;
    days.forEach(d => {
      if (MealsMod && MealsMod.mealState) {
        const sts = ['breakfast', 'lunch', 'dinner'].map(k => MealsMod.mealState(d, k));
        if (sts.every(s => s === 'ontime')) mealOn++;
        else if (sts.every(s => s === 'miss')) mealMiss++;
        else mealOff++;
      } else { const mv = S.get('meals', {})[d]; if (mv && ['breakfast', 'lunch', 'dinner'].some(k => mv[k] && !mv[k].skipped)) mealOff++; else mealMiss++; }
    });
    const mealTotal = days.length;
    const mealRate = mealTotal ? Math.round(mealOn / mealTotal * 100) : 0;

    // 娱乐概览（按作品去重）
    const funCount = { 小说: 0, 影视: 0, 漫画: 0, 游戏: 0 };
    days.forEach(d => {
      const seen = { 小说: new Set(), 影视: new Set(), 漫画: new Set(), 游戏: new Set() };
      (funLogsAll[d] || []).forEach(r => { const t = (window.Entertainment && window.Entertainment.funNormType) ? window.Entertainment.funNormType(r.type) : r.type; if (seen[t]) { const k = (r.title || '').trim(); if (k) seen[t].add(k); } });
      Object.keys(seen).forEach(k => funCount[k] += seen[k].size);
    });
    const funSegs = ['小说', '影视', '漫画', '游戏'].filter(k => funCount[k] > 0).map(k => ({ label: k, value: funCount[k], color: { 小说: '#C58AB0', 影视: '#F4A6B8', 漫画: '#F2A65A', 游戏: '#E08BA0' }[k] }));
    const funTotal = funSegs.reduce((s, x) => s + x.value, 0);

    const hwN = scope === 'week' ? 14 : (scope === 'month' ? 18 : 50);

    // 板块方框：一个卡里放「月历 + 打卡密度」，右上角切换板块
    const bk = this._board || 'all';
    if (!this._calYm) this._calYm = todayStr().slice(0, 7);
    const ymLabel = Number(this._calYm.slice(5)) + ' 月';
    const boardCard = () => {
      const names = this.boardMonthNames(bk, this._calYm);
      const nameHTML = names.length ? (
        '<div class="bd-names" data-bdnames>'
        + names.slice(0, 4).map(n => '<span class="bd-name-chip">' + esc(n) + '</span>').join('')
        + (names.length > 4 ? '<button class="bd-more" data-bdexpand="' + (names.length - 4) + '">展开 ' + (names.length - 4) + ' 项</button>' : '')
        + '<div class="bd-names-all" hidden>' + names.slice(4).map(n => '<span class="bd-name-chip">' + esc(n) + '</span>').join('') + '</div>'
        + '</div>'
      ) : '<div class="muted" style="text-align:center;margin-top:8px">本月还没有打卡记录</div>';
      return '<div class="card bd-card">'
        + '<div class="bd-head"><h3>日历</h3><span class="bd-act"><select class="bd-switch" data-bdswitch="_board">' + this._bdOpts(bk) + '</select></span></div>'
        + '<div class="bd-subhead"><button class="bd-nav" data-calnav="-1" title="上个月">‹</button>'
        + '<span class="bd-ym">' + this._calYm.slice(0, 4) + ' 年 ' + ymLabel + '</span>'
        + '<button class="bd-nav" data-calnav="1" title="下个月">›</button></div>'
        + this.boardCalDotsHTML(bk, this._calYm)
        + nameHTML
        + '</div>';
    };

    // 精力：占比圆环 + 净消耗趋势；点右上角图标/色块 → 看精力分布（消耗/充电）
    const energyCard = () => {
      const view = this._energyView || 'main';
      if (view !== 'main') { this._distDays = days; return this.energyDistHTML(days); }
      let inv = 0, con = 0, rech = 0;
      days.forEach(d => {
        const i = (window.Daily && Daily.dayLoadInfo) ? Daily.dayLoadInfo(d) : null;
        if (!i) return;
        inv += (i.investLoad || 0); con += (i.consumeLoad || 0); rech += (i.recharge || 0);
      });
      const total = inv + con;
      let h = '<div class="card" style="margin-top:12px"><div style="display:flex;align-items:center;justify-content:space-between"><h3>' + icon('fire', 16) + ' 精力</h3><button class="icon-btn" data-energyview="load" title="查看精力分布">' + icon('stats', 16) + '</button></div>';
      if (!total) return h + '<div class="empty">这段时间还没有精力记录</div></div>';
      const pct = Math.round(inv / total * 100);
      const segs = [{ label: '主动投资', value: inv, color: '#7CB390' }, { label: '系统消耗', value: con, color: '#F4A6B8' }];
      h += '<div class="en-ring-wrap">' + svgDonut(segs, 132, '') + '<div class="en-ring-side">'
        + '<div class="en-kv" data-energyview="load" style="cursor:pointer"><span class="en-dot" style="background:#7CB390"></span>主动投资 <b>' + inv + '</b></div>'
        + '<div class="en-kv" data-energyview="load" style="cursor:pointer"><span class="en-dot" style="background:#F4A6B8"></span>系统消耗 <b>' + con + '</b></div>'
        + '<div class="en-kv"><span class="en-dot" style="background:#8FB8E0"></span>充电回收 <b>' + rech + '</b></div>'
        + '<div class="en-pct">投资 ' + pct + '%</div></div></div>';
      h += '<div class="en-trend">' + svgLine(enVals, enLabels) + '</div>';
      return h + '</div>';
    };

    const overviewInner = ''
      + (scope === 'week' ? '' : safe('board', boardCard))
      + (scope === 'week' ? '' : safe('density', () => this.planDensityHTML(scope)))
      + safe('energy', energyCard)
      + (opts.skipDimMood ? '' : safe('radar', () => this.dimCardHTML(days)))
      + (opts.skipDimMood ? '' : safe('mood', () => this.moodCardHTML(days)))
      + safe('hot', () => this.hotWordsHTML(days, hwN));
    const createInner = safe('create', () => {
        const totalC = wTypes.video + wTypes.article;
        const vPct = totalC ? Math.round(wTypes.video / totalC * 100) : 0;
        const aPct = totalC ? Math.round(wTypes.article / totalC * 100) : 0;
        return '<div class="card" style="margin-top:12px"><h3>' + icon('creation', 16) + ' 创作</h3>'
          + '<div class="prg-row"><span class="prg-lab">视频</span><div class="prg-bar"><i style="width:' + vPct + '%;background:#F4A6B8"></i></div><span class="prg-val">' + wTypes.video + ' 条 · ' + vPct + '%</span></div>'
          + '<div class="prg-row"><span class="prg-lab">图文</span><div class="prg-bar"><i style="width:' + aPct + '%;background:#8FB8E0"></i></div><span class="prg-val">' + wTypes.article + ' 条 · ' + aPct + '%</span></div>'
          + (totalC ? '<div class="muted" style="margin-top:6px">共 ' + totalC + ' 条创作</div>' : '<div class="empty">暂无创作记录</div>')
          + '</div>';
      });
    const studyInner = safe('study', () => '<div class="card" style="margin-top:12px"><h3>' + icon('book', 16) + ' 学习</h3>' + (kgTop.length ? svgBars(kgTop.map(x => x[1]), kgTop.map(x => x[0])) : '<div class="empty">暂无学习记录</div>') + '</div>');
    const mealsInner = safe('meals', () => '<div class="card" style="margin-top:12px"><h3>' + icon('meal', 16) + ' 三餐</h3><div class="grid4"><div class="st4"><div class="stat-num" style="color:#3f7a55">' + mealOn + '</div><div class="stat-lab">准点</div></div><div class="st4"><div class="stat-num" style="color:#9a7b22">' + mealOff + '</div><div class="stat-lab">偏时</div></div><div class="st4"><div class="stat-num">' + mealMiss + '</div><div class="stat-lab">没记</div></div><div class="st4"><div class="stat-num">' + mealRate + '%</div><div class="stat-lab">准点率</div></div></div></div>');
    const funInner = safe('fun', () => '<div class="card" style="margin-top:12px"><h3>' + icon('film', 16) + ' 娱乐</h3>' + (funTotal ? '<div class="viz-row">' + svgDonut(funSegs, 120, '部') + '<div class="viz-side">' + funSegs.map(s => '<div><span class="en-dot" style="background:' + s.color + '"></span>' + s.label + ' <b>' + s.value + '</b></div>').join('') + '</div></div>' : '<div class="empty">暂无娱乐记录</div>') + '</div>')
      + safe('funcurve', () => this.funCurveHTML(scope, days));
    const travelInner = safe('travel', () => '<div class="card" style="margin-top:12px"><h3>' + icon('map', 16) + ' 出行</h3><div class="bd-tl">' + tripRows + '</div></div>');
    return ''
      + this.block('总览', 'stats', overviewInner)
      + safe('plan', () => this.planBlockHTML(days, scope))
      + this.block('创作', 'creation', createInner)
      + this.block('考公', 'book', studyInner)
      + safe('growth', () => this.growthBlockHTML(days))
      + safe('sport', () => this.sportBlockHTML(days))
      + this.block('三餐', 'meal', mealsInner)
      + this.block('出行', 'map', travelInner)
      + this.block('娱乐', 'film', funInner)
      + (scope === 'week' ? safe('wksum', () => this.weekSummaryCardHTML(days)) : '');
  },
  // 娱乐时间曲线（#681）：每条线一个项目，颜色区分；竖轴可在「时间(分钟) / 作品数」间切换
  funCurveHTML(scope, days) {
    const funLogsAll = S.get('funLogs', {});
    const norm = (r) => (window.Entertainment && window.Entertainment.funNormType) ? window.Entertainment.funNormType(r.type) : r.type;
    const byDay = {};
    days.forEach(d => {
      const cell = {};
      (funLogsAll[d] || []).forEach(r => {
        const t = norm(r.type);
        if (!cell[t]) cell[t] = { min: 0, works: new Set() };
        cell[t].min += Number(r.minutes) || 0;
        if (r.title) cell[t].works.add(r.title);
      });
      byDay[d] = cell;
    });
    const TYPES = [{ k: '小说', c: '#8FB8E0' }, { k: '影视', c: '#F4A6B8' }, { k: '漫画', c: '#F2A65A' }, { k: '游戏', c: '#E08BA0' }];
    const present = TYPES.filter(t => days.some(d => byDay[d] && byDay[d][t.k]));
    if (!present.length) return '<div class="card" style="margin-top:12px"><h3>' + icon('film', 16) + ' 娱乐时间曲线</h3><div class="empty">这段时间还没有娱乐记录</div></div>';
    const axis = this._funAxis || 'time';
    const labels = days.map(d => d.slice(5));
    const series = present.map(t => ({ name: t.k, color: t.c, values: days.map(d => axis === 'time' ? (byDay[d][t.k] ? byDay[d][t.k].min : 0) : (byDay[d][t.k] ? byDay[d][t.k].works.size : 0)) }));
    const W = 640, H = 168, P = { l: 28, r: 12, t: 12, b: 22 };
    const allMax = Math.max(1, ...series.flatMap(s => s.values));
    const x = i => P.l + i * (W - P.l - P.r) / Math.max(days.length - 1, 1);
    const y = v => H - P.b - v / allMax * (H - P.t - P.b);
    let svg = '<svg class="svg-chart" viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto">';
    series.forEach(s => {
      const pts = s.values.map((v, i) => x(i) + ',' + y(v)).join(' ');
      svg += '<polyline fill="none" stroke="' + s.color + '" stroke-width="2.5" stroke-linejoin="round" points="' + pts + '"/>';
      s.values.forEach((v, i) => { if (v > 0) svg += '<circle cx="' + x(i) + '" cy="' + y(v) + '" r="2.6" fill="' + s.color + '"/>'; });
    });
    svg += '<text x="' + (P.l - 4) + '" y="' + (P.t + 4) + '" font-size="9" fill="#999" text-anchor="end">' + (axis === 'time' ? '分' : '部') + '</text>';
    labels.forEach((l, i) => { if (labels.length <= 16 || i % Math.ceil(labels.length / 16) === 0) svg += '<text x="' + x(i) + '" y="' + (H - 6) + '" font-size="9" fill="#999" text-anchor="middle">' + l + '</text>'; });
    svg += '</svg>';
    const legend = present.map(t => '<span class="fun-leg"><i style="background:' + t.c + '"></i>' + t.k + '</span>').join('');
    const btn = '<button class="btn sm" data-funaxis>' + (axis === 'time' ? '看作品数' : '看时间') + '</button>';
    return '<div class="card" style="margin-top:12px"><div style="display:flex;align-items:center;justify-content:space-between"><h3>' + icon('film', 16) + ' 娱乐时间曲线</h3>' + btn + '</div>'
      + '<div class="muted" style="font-size:11px;margin:2px 0 6px">竖轴：' + (axis === 'time' ? '花在娱乐的分钟数' : '看 / 玩的作品数量') + ' · 每条线一个项目</div>'
      + svg + '<div class="fun-legend">' + legend + '</div></div>';
  },
  // 枝枝喵周总结（v269：移到统计页最下面）
  weekSummaryCardHTML(days) {
    const facts = days.map(d => ({ d, f: this.dayFacts(d), r: this.data()[d] }));
    const abandoned = facts.flatMap(x => x.f.plan.abandoned.map(t => t.abandonReason)).filter(Boolean);
    return '<div class="card" style="margin-top:12px"><h3>' + icon('leaf', 16) + ' ' + MUMU_ASSISTANT() + '周总结</h3>'
      + this.weekSummary(facts, abandoned).map(t => '<div class="step-row" style="align-items:flex-start"><span>' + t[0] + '</span><span class="stext">' + esc(t[1]) + '</span></div>').join('')
      + '</div>';
  },
  // 枝枝喵总结统一落到底部（周总结在 vizBlocks 内已置底；月/年/全部在此生成）
  summaryCardHTML(scope) {
    if (scope === 'week') return '';
    let days;
    if (scope === 'month') days = this._monthDaysAt(this._monthOff || 0);
    else if (scope === 'year') { const y = todayStr().slice(0, 4); days = []; for (let d = y + '-01-01'; d <= todayStr(); d = addDays(d, 1)) days.push(d); }
    else days = this._allDays();
    if (scope === 'month') return this.monthSummaryCardHTML(days);
    if (scope === 'year') return this.yearSummaryCardHTML(days);
    return this.allSummaryCardHTML(days);
  },
  monthSummaryCardHTML(days) {
    const st = this._monthStats(days);
    const diaryN = st.diaryN, weakest = st.weakest, strongest = st.strongest, wkStudy = st.wkStudy, wkWork = st.wkWork;
    return '<div class="card" style="margin-top:12px"><h3>' + icon('leaf',16) + ' ' + MUMU_ASSISTANT() + '月度总结</h3>'
      + '<div class="step-row" style="align-items:flex-start"><span>' + icon('sparkles',14) + '</span><span class="stext">本月你写了 ' + diaryN + ' 篇日记。' + (diaryN >= 15 ? '记录本身就是最了不起的自我观察。' : '日记越多，我给你的复盘越准，试试每天睡前3分钟。') + '</span></div>'
      + '<div class="step-row" style="align-items:flex-start"><span>' + icon('trending',14) + '</span><span class="stext">趋势解读：学习 ' + (wkStudy[3] >= wkStudy[0] ? '整体在上升，说明习惯正在长出来' : '后期有回落，看看是内容变难了还是被别的事挤占了') + '；创作 ' + (wkWork[3] >= wkWork[0] ? '保持/上升' : '有回落，从一条15秒的短视频重新启动') + '。</span></div>'
      + '<div class="step-row" style="align-items:flex-start"><span>' + icon('target',14) + '</span><span class="stext">下月主线建议：' + (weakest === '学习' ? '每天固定2小时备考' : weakest === '创作' ? '定「周产3条」目标并绑定激励活动DDL' : weakest === '健康' ? '每天10分钟体态跟练+三餐拍照，只求记录不求完美' : weakest === '心态' ? '把「和' + MUMU_ASSISTANT() + '聊天+写日记」变成睡前仪式' : '每天只定3个以内的计划，完成率比数量重要') + '。</span></div></div>';
  },
  yearSummaryCardHTML(days) {
    const y = days[0] ? days[0].slice(0, 4) : todayStr().slice(0, 4);
    const dim = this.dimScores(365);
    const weakest = dim.dims[dim.values.indexOf(Math.min(...dim.values))];
    const strongest = dim.dims[dim.values.indexOf(Math.max(...dim.values))];
    const wroteDays = days.filter(d => (this.data()[d] || {}).text).length;
    return '<div class="card" style="margin-top:12px"><h3>' + icon('leaf',16) + ' ' + MUMU_ASSISTANT() + y + ' 年度总结</h3>'
      + '<div class="step-row" style="align-items:flex-start"><span>' + icon('sparkles',14) + '</span><span class="stext">今年你写了 ' + wroteDays + ' 篇日记。' + (wroteDays >= 150 ? '一年下来，你对自己比谁都了解。' : '日记是给未来的自己写信，哪怕一周一篇也够厚了。') + '</span></div>'
      + '<div class="step-row" style="align-items:flex-start"><span>' + icon('stats',14) + '</span><span class="stext">今年最强项「' + strongest + '」、待补强「' + weakest + '」——明年把一点力气往弱的那个维度挪，就有大变化。</span></div>'
      + '<div class="step-row" style="align-items:flex-start"><span>' + icon('target',14) + '</span><span class="stext">明年主线建议：' + (weakest === '学习' ? '把备考切成「每天2小时」的固定块，别靠意志力' : weakest === '创作' ? '定「周产3条」并绑激励活动 DDL' : weakest === '健康' ? '每天10分钟体态跟练+三餐拍照，只求记录' : weakest === '心态' ? '把「和' + MUMU_ASSISTANT() + '聊天+写日记」当睡前仪式' : '每天只定3个以内的计划，完成率比数量重要') + '。</span></div></div>';
  },
  allSummaryCardHTML(days) {
    const dim = this.dimScoresDates(days);
    const weakest = dim.dims[dim.values.indexOf(Math.min(...dim.values))];
    const strongest = dim.dims[dim.values.indexOf(Math.max(...dim.values))];
    const wroteDays = days.filter(d => (this.data()[d] || {}).text).length;
    return '<div class="card" style="margin-top:12px"><h3>' + icon('leaf',16) + ' ' + MUMU_ASSISTANT() + '累计总结</h3>'
      + '<div class="step-row" style="align-items:flex-start"><span>' + icon('sparkles',14) + '</span><span class="stext">从记录开始你写了 ' + wroteDays + ' 篇日记，坚持本身就是一种作品。</span></div>'
      + '<div class="step-row" style="align-items:flex-start"><span>' + icon('stats',14) + '</span><span class="stext">最强项「' + strongest + '」、待补强「' + weakest + '」——接下来往弱的挪一点点就好。</span></div></div>';
  },
  render_week_visual(box, root) {
    if (!this._weekOff) this._weekOff = 0;
    const start = addDays(weekStart(todayStr()), this._weekOff * 7);
    const end = addDays(start, 6);
    const days = []; for (let i = 0; i < 7; i++) days.push(addDays(start, i));

    // 直接读各专栏真实打卡记录聚合（更准，且不依赖每日计划任务是否生成）
    const sportLogs = S.get('sportLogs', {});
    const growthLogs = S.get('growthLogs', {});
    const workLogs = S.get('workLogs', {});
    const kgLogs = S.get('kgLogs', {});
    const readLogs = S.get('readLogs', {});
    const funLogs = S.get('funLogs', {});
    const mealsStore = S.get('meals', {});
    const travelStore = S.get('travelOut', {});
    const travelPhotosAll = S.get('travelPhotos', []) || [];

    // key -> {label, colorCat, days:[次数 x7]}；同一天同一子部分累加打卡次数
    const rows = {};
    const add = (key, label, colorCat, di, n, unit) => {
      if (!rows[key]) rows[key] = { label, colorCat, unit: unit || '次', days: days.map(() => 0) };
      rows[key].days[di] += (n || 1);
    };
    /* 与每日计划交叉校验：当天计划里存在对应任务、但一个都没完成 → 不计入「已做」。
       修复「每日计划里还没做的项目（如天鹅颈），周总结却因专栏里有记录而显示已做」。 */
    const planStore = S.get('plans', {});
    const effDoneOf = (t, d) => (window.Daily && typeof Daily.effDone === 'function') ? Daily.effDone(t, d) : false;
    const planHasUndone = (d, match) => {
      const hit = (planStore[d] || []).filter(t => !t.abandoned && match(t));
      if (!hit.length) return false;               // 计划里没有对应任务 → 以专栏记录为准
      return !hit.some(t => effDoneOf(t, d));      // 有任务但一个都没做 → 不算已做
    };
    // 娱乐类型归一（与娱乐专栏同口径）：动漫/电影/电视剧/综艺 → 影视；漫话 → 漫画
    const normFunType = (r) => (window.Entertainment && window.Entertainment.funNormType)
      ? window.Entertainment.funNormType(r.type) : r.type;
    // 只统计有记录的分类；未关联专栏的「日常」任务不计入周总结
    days.forEach((d, di) => {
      const mv = mealsStore[d];
      const mealN = mv ? ['breakfast', 'lunch', 'dinner'].filter(k => mv[k] && !mv[k].skipped).length : 0;
      if (mealN) add('meals', '三餐', 'meals', di, mealN);
      const wn = (workLogs[d] || []).length; if (wn) add('work', '创作', 'work', di, wn);
      const outN = ((travelStore[d] || []).some(e => e.kind === 'ootd') ? 1 : 0);
      if (outN) add('travel', '出行', 'travel', di, outN);
      // 学习：按具体科目展开（言语/判断推理/资料分析/常识/申论…），不再笼统计成一行「学习」
      (kgLogs[d] || []).forEach(l => {
        const sub = (l.subject || '').trim();
        const lab = sub ? sub.replace(/^(行测|申论|面试)-/, '') : '学习';
        if (planHasUndone(d, t => t.link === 'kaogong:study' && ((t.extra && t.extra.subject) || '') === sub)) return;
        add('kaogong:' + (sub || '学习'), lab, 'kaogong', di, 1);
      });
      // 运动：按项目(子部分) 展开，如「大小脸改善」「天鹅颈」
      (sportLogs[d] || []).forEach(l => {
        const p = (l.project || '运动').trim(); if (!p) return;
        if (planHasUndone(d, t => t.link === 'sport:' + p)) return;
        add('sport:' + p, p, 'sport', di, 1);
      });
      // 成长：按领域(子部分) 展开，如「阅读」「英语」「理财」
      (growthLogs[d] || []).forEach(l => { const a = (l.area || '成长').trim(); if (a) add('growth:' + a, a, 'growth', di, 1); });
      // 阅读（readLogs 也并入成长·阅读，与成长领域阅读按天去重，不重复成两行）
      // ⚠️ 排除「娱乐」类阅读（放纵放松、非知识吸纳，不纳入习惯统计，避免虚高阅读天数）
      (readLogs[d] || []).forEach(l => {
        const isFun = (window.Growth && window.Growth.readCat) ? window.Growth.readCat(l).key === 'fun' : (l && (l.cat === 'fun' || l.cat === '娱乐'));
        if (!isFun) add('growth:阅读', '阅读', 'growth', di, 1);
      });
      // 娱乐：小说 / 影视 / 漫画 / 游戏 各占一行，数字 = 当天「作品数」（同一作品去重，一天更新多次也只算 1）
      // 必须走 normFunType，否则旧类型（动漫/电视剧/漫话）会漏统计
      const funWorks = (t) => {
        const set = new Set();
        (funLogs[d] || []).forEach(r => {
          if (normFunType(r) !== t) return;
          const key = (r.title || '').trim();
          set.add(key || ('#' + r.id));   // 无标题的按单条算，避免被误并成一部
        });
        return set.size;
      };
      const novelN = funWorks('小说'); if (novelN) add('novel', '小说', 'novel', di, novelN, '本');
      const movieN = funWorks('影视'); if (movieN) add('movie', '影视', 'movie', di, movieN, '部');
      const comicN = funWorks('漫画'); if (comicN) add('comic', '漫画', 'comic', di, comicN, '部');
      const gameN = funWorks('游戏'); if (gameN) add('fun', '游戏', 'fun', di, gameN, '款');
    });

    // 排序：三餐/运动/创作/学习/成长/出行/小说/影视/漫画/游戏；运动·成长·学习内部按子部分展开（阅读置顶）
    const baseEmoji = { meals: icon('meal', 16), sport: icon('running', 16), work: icon('creation', 16), kaogong: icon('book', 16), growth: icon('sprout', 16), travel: icon('map', 16), novel: icon('reading', 16), movie: icon('film', 16), comic: icon('comic', 16), fun: icon('game', 16) };
    const baseOrder = ['meals', 'sport', 'work', 'kaogong', 'growth', 'travel', 'novel', 'movie', 'comic', 'fun'];
    const ordered = [];
    baseOrder.forEach(base => {
      const keys = Object.keys(rows).filter(k => k === base || k.startsWith(base + ':'));
      if (base === 'sport' || base === 'growth' || base === 'kaogong') {
        keys.sort((a, b) => {
          if (a === base + ':阅读') return -1;
          if (b === base + ':阅读') return 1;
          return 0;
        });
        keys.forEach(k => ordered.push(k));
      } else if (keys.length) {
        ordered.push(keys[0]);
      }
    });
    Object.keys(rows).forEach(k => { if (!ordered.includes(k)) ordered.push(k); });
    const wkTotal = Object.values(rows).reduce((s, r) => s + r.days.reduce((a, b) => a + b, 0), 0);
    const wkActive = days.filter((d, di) => ordered.some(k => rows[k] && rows[k].days[di] > 0)).length;
    const wkTopArr = ordered.map(k => ({ label: rows[k].label, n: rows[k].days.reduce((a, b) => a + b, 0), unit: rows[k].unit || '次' })).filter(x => x.n > 0).sort((a, b) => b.n - a.n);
    const wkTop = wkTopArr[0];

    const wdNames = ['一', '二', '三', '四', '五', '六', '日'];
    // 有打卡=彩色方块(cat-X 背景)；单次日打卡只显方块无数字；一天多次打卡显数字；未打卡留透明占位(不显黑框)保持7列对齐
    const rowsHTML = ordered.map(key => {
      const r = rows[key];
      const emoji = baseEmoji[r.colorCat] || icon('tag', 16);
      const cells = r.days.map((c, ci) =>
        c > 1 ? `<span class="wk-dot cat-${r.colorCat} num" title="${days[ci]} · ${c} ${r.unit}">${c}</span>`
        : c === 1 ? `<span class="wk-dot cat-${r.colorCat}" title="${days[ci]} · 1 ${r.unit}"></span>`
        : '<span class="wk-dot blank"></span>'
      ).join('');
      return `<div class="wk-row">
        <span class="wk-task"><span class="wk-group-emoji">${emoji}</span>${esc(r.label)}</span>
        <div class="wk-dots">${cells}</div>
      </div>`;
    }).join('');

    box.innerHTML = `
      <div class="wk-nav">
        <button class="btn ghost sm" id="wkPrev" ${this._weekOff <= -104 ? 'disabled style="opacity:.2"' : ''} title="上一周">‹</button>
        <span class="wk-range">${start.slice(5)} ~ ${end.slice(5)}</span>
        <button class="btn ghost sm" id="wkNext" ${this._weekOff >= 0 ? 'disabled style="opacity:.2"' : ''} title="下一周">›</button>
      </div>
      ${this.genFabHTML('week')}
      <div class="card">
        <div class="wk-row wk-head" style="font-size:12px;color:var(--muted)">
          <span class="wk-task">分类</span>
          <div class="wk-dots wk-dots-hd">${wdNames.map(w => `<span class="wk-dot wd">${w}</span>`).join('')}</div>
        </div>
        ${rowsHTML || '<div class="empty" style="padding:20px;text-align:center">本周还没有打卡完成任务</div>'}
      </div>
      ${this.dimCardHTML(days)}
      ${this.moodCardHTML(days)}
      <div class="card" style="margin-top:12px"><h3>${icon('sparkles',16)} 本周关键数字</h3>
        <div class="grid3" style="gap:8px">
          <div style="text-align:center"><div class="stat-num">${wkTotal}</div><div class="stat-lab">打卡次数</div></div>
          <div style="text-align:center"><div class="stat-num">${wkActive}</div><div class="stat-lab">活跃天数</div></div>
          <div style="text-align:center"><div class="stat-num" style="font-size:15px">${wkTop ? esc(wkTop.label) : '—'}</div><div class="stat-lab">最专注</div></div>
        </div>
        ${wkTop ? `<div class="muted" style="margin-top:6px">本周你在「${esc(wkTop.label)}」上打卡最多（${wkTop.n} ${wkTop.unit}），这份坚持正在长成你的底色。</div>` : '<div class="muted" style="margin-top:6px">这周记录还不多，从今天一个小小的打卡开始就好。</div>'}
      </div>`;

    const pBtn = box.querySelector('#wkPrev');
    const nBtn = box.querySelector('#wkNext');
    if (pBtn) pBtn.onclick = () => { this._weekOff--; (this._statRerender ? this._statRerender() : this.render_week_visual(box)); };
    if (nBtn) nBtn.onclick = () => { this._weekOff++; (this._statRerender ? this._statRerender() : this.render_week_visual(box)); };
    const gf = box.querySelector('[data-genfab]');
    if (gf) gf.onclick = () => this.generateReport(gf.dataset.genfab, root);
    const et = box.querySelector('[data-energytoggle]');
    if (et) et.onclick = () => { this._energyView = this._energyView === 'rech' ? 'load' : 'rech'; this.render(root); };
    const ro = box.querySelectorAll('[data-rechcat]');
    if (ro) ro.forEach(el => el.onclick = () => this.rechCatModal(el.dataset.rechcat, JSON.parse(el.dataset.days)));
  },

  // ===== 月总结可视化（当月数据 + 月份切换）=====
  render_month_visual(box, root) {
    if (this._monthOff == null) this._monthOff = 0;
    const monthDays = this._monthDaysAt(this._monthOff);
    const st = this._monthStats(monthDays);
    const dim = st.dim;
    const R = this.data();
    const cur = new Date(todayStr() + 'T00:00:00');
    cur.setMonth(cur.getMonth() - this._monthOff);
    const label = cur.getFullYear() + '年' + (cur.getMonth() + 1) + '月';
    const wkStudy = st.wkStudy, wkWork = st.wkWork, wkSport = st.wkSport;
    const diaryN = st.diaryN;
    const weakest = st.weakest, strongest = st.strongest;
    box.innerHTML = `
      <div class="wk-nav">
        <button class="btn ghost sm" id="moPrev" ${this._monthOff >= 11 ? 'disabled style="opacity:.2"' : ''} title="上一月">‹</button>
        <span class="wk-range">${label}</span>
        <button class="btn ghost sm" id="moNext" ${this._monthOff <= 0 ? 'disabled style="opacity:.2"' : ''} title="下一月">›</button>
      </div>
      ${this.genFabHTML('month')}
      <div class="card"><h3>${icon('trending',16)} 月度趋势（按周）</h3>
        <div class="mt-trend">
          <div class="mt-row"><span class="mt-lab"><b class="mt-name">学习</b><i class="mt-unit">h/周</i></span>${svgBars(wkStudy, ['1', '2', '3', '4'])}</div>
          <div class="mt-row"><span class="mt-lab"><b class="mt-name">创作</b><i class="mt-unit">条/周</i></span>${svgBars(wkWork, ['1', '2', '3', '4'])}</div>
          <div class="mt-row"><span class="mt-lab"><b class="mt-name">运动</b><i class="mt-unit">天/周</i></span>${svgBars(wkSport, ['1', '2', '3', '4'])}</div>
        </div>
      </div>
      <div class="card" style="margin-top:12px"><h3>${icon('sparkles',16)} 本月关键数字</h3>
        <div class="grid3" style="gap:8px">
          <div style="text-align:center"><div class="stat-num">${Math.round(wkStudy.reduce((a, b) => a + b, 0) * 10) / 10}</div><div class="stat-lab">学习(小时)</div></div>
          <div style="text-align:center"><div class="stat-num">${wkWork.reduce((a, b) => a + b, 0)}</div><div class="stat-lab">创作(条)</div></div>
          <div style="text-align:center"><div class="stat-num">${wkSport.reduce((a, b) => a + b, 0)}</div><div class="stat-lab">运动(天)</div></div>
        </div>
        <div class="muted" style="margin-top:6px">本月最强项「${strongest}」、待补强「${weakest}」——把精力往弱的那一项挪一点点，就有大变化。</div>
      </div>`;
    const pBtn = box.querySelector('#moPrev');
    const nBtn = box.querySelector('#moNext');
    if (pBtn) pBtn.onclick = () => { this._monthOff++; (this._statRerender ? this._statRerender() : this.render_month_visual(box)); };
    if (nBtn) nBtn.onclick = () => { this._monthOff--; (this._statRerender ? this._statRerender() : this.render_month_visual(box)); };
    const gf = box.querySelector('[data-genfab]');
    if (gf) gf.onclick = () => this.generateReport(gf.dataset.genfab, root);
    const et = box.querySelector('[data-energytoggle]');
    if (et) et.onclick = () => { this._energyView = this._energyView === 'rech' ? 'load' : 'rech'; this.render(root); };
    const ro = box.querySelectorAll('[data-rechcat]');
    if (ro) ro.forEach(el => el.onclick = () => this.rechCatModal(el.dataset.rechcat, JSON.parse(el.dataset.days)));
  },

  // ===== 年总结可视化：雷达 + 心情分布 =====
  render_year_visual(box, root) {
    const y = todayStr().slice(0, 4);
    const yearDays = [];
    for (let d = y + '-01-01'; d <= todayStr(); d = addDays(d, 1)) yearDays.push(d);
    const MealsMod = window.Meals;
    // 年总结口径：一天三顿都准点才算「准点」；有记录但不全准点算「偏时」；完全没记为「没记」（单独统计，避免误导）
    const mealY = { ontime: 0, off: 0, miss: 0, total: 0 };
    yearDays.forEach(d => {
      if (d > todayStr()) return;
      mealY.total++;
      const sts = ['breakfast', 'lunch', 'dinner'].map(k => MealsMod.mealState(d, k));
      const allOn = sts.every(s => s === 'ontime');
      const allMiss = sts.every(s => s === 'miss');
      if (allOn) mealY.ontime++;
      else if (allMiss) mealY.miss++;
      else mealY.off++;
    });
    const dim = this.dimScores(365);
    const monthData = S.get('reviews', {});
    const allDates = Object.keys(monthData).filter(d => d.startsWith(y));
    const wroteDays = allDates.filter(d => monthData[d] && monthData[d].text).length;
    const moodCounts = [0, 0, 0, 0, 0];
    allDates.forEach(d => { const m = (monthData[d] || {}).mood; if (m != null) moodCounts[m]++; });
    const weakest = dim.dims[dim.values.indexOf(Math.min(...dim.values))];
    const strongest = dim.dims[dim.values.indexOf(Math.max(...dim.values))];

    box.innerHTML = `
      ${this.genFabHTML('year')}
      <div class="grid3" style="margin-bottom:14px">
        <div class="card" style="text-align:center;margin:0"><div class="stat-num">${wroteDays}</div><div class="stat-lab">复盘天数</div></div>
        <div class="card" style="text-align:center;margin:0"><div class="stat-num">${moodCounts[0] + moodCounts[1]}</div><div class="stat-lab">开心天数</div></div>
        <div class="card" style="text-align:center;margin:0"><div class="stat-num">${moodCounts[3] + moodCounts[4]}</div><div class="stat-lab">低落天数</div></div>
      </div>
      <div class="card"><h3>${icon('sparkles',16)} 年度关键数字</h3>
        <div class="grid3" style="gap:8px">
          <div style="text-align:center"><div class="stat-num" style="font-size:15px">${strongest}</div><div class="stat-lab">最强项</div></div>
          <div style="text-align:center"><div class="stat-num" style="font-size:15px">${weakest}</div><div class="stat-lab">待补强</div></div>
          <div style="text-align:center"><div class="stat-num">${wroteDays}</div><div class="stat-lab">日记天数</div></div>
        </div>
      </div>`;
    const gf = box.querySelector('[data-genfab]');
    if (gf) gf.onclick = () => this.generateReport(gf.dataset.genfab, root);
    const et = box.querySelector('[data-energytoggle]');
    if (et) et.onclick = () => { this._energyView = this._energyView === 'rech' ? 'load' : 'rech'; this.render(root); };
    const ro = box.querySelectorAll('[data-rechcat]');
    if (ro) ro.forEach(el => el.onclick = () => this.rechCatModal(el.dataset.rechcat, JSON.parse(el.dataset.days)));
  },

  render_overview(box, root) {
    const R = this.data();
    const allDates = Object.keys(R).sort();
    const totalDays = allDates.length;
    // 本周数据
    const weekStart_ = weekStart(todayStr());
    const weekDays = allDates.filter(d => d >= weekStart_);
    const weekMoods = weekDays.map(d => (R[d] || {}).mood).filter(m => m != null);
    const weekAvgMood = weekMoods.length ? Math.round(weekMoods.reduce((a, b) => a + b, 0) / weekMoods.length * 10) / 10 : 0;
    // 本月数据
    const ym = todayStr().slice(0, 7);
    const monthDays = allDates.filter(d => d.startsWith(ym));
    // 全部统计
    const moodCount = {}; allDates.forEach(d => { const m = (R[d] || {}).mood; if (m != null) moodCount[m] = (moodCount[m] || 0) + 1; });
    const goodDays = [0, 1].reduce((s, m) => s + (moodCount[m] || 0), 0);
    const badDays = [3, 4].reduce((s, m) => s + (moodCount[m] || 0), 0);
    // 写作量
    const writeLogs = S.get('writeLogs', {});
    const totalWords = Object.values(writeLogs).flat().reduce((s, l) => s + (l.words || 0), 0);
    // 本月维度分
    const dims = this._monthStats(this._monthDaysAt(0)).dim;
    // 自救365
    const sr = S.get('srItems', []);
    const srActive = sr.filter(i => !i.hidden);
    const srStreaks = srActive.map(i => {
      let s = 0, d = todayStr();
      const key = i.link || 'sport';
      const check = (day) => {
        if (key === 'sport') return !!(S.get('sportLogs', {})[day] || []).length;
        if (key.startsWith('growth:')) return !!(S.get('growthLogs', {})[day] || []).filter(l => l.area === key.split(':')[1]).length;
        if (key.startsWith('kaogong')) return !!(S.get('kgLogs', {})[day] || []).length;
        if (key.startsWith('meals')) return true;
        if (key.startsWith('work:')) return !!(S.get('workLogs', {})[day] || []).length;
        if (key === 'daily') { const p = (window.Daily && Daily.statsOf(day)) || {}; return p.done > 0; }
        return false;
      };
      while (check(d)) { s++; d = addDays(d, -1); }
      return { name: i.text, streak: s };
    }).filter(x => x.streak > 0).sort((a, b) => b.streak - a.streak);

    box.innerHTML = `
      <div class="grid3" style="margin-bottom:14px">
        <div class="card" style="text-align:center;margin:0"><div class="stat-num">${totalDays}</div><div class="stat-lab">复盘总天数</div></div>
        <div class="card" style="text-align:center;margin:0"><div class="stat-num">${weekDays.length}</div><div class="stat-lab">本周已复盘</div></div>
        <div class="card" style="text-align:center;margin:0"><div class="stat-num">${monthDays.length}</div><div class="stat-lab">本月已复盘</div></div>
        <div class="card" style="text-align:center;margin:0"><div class="stat-num">${goodDays}</div><div class="stat-lab">开心天数</div></div>
        <div class="card" style="text-align:center;margin:0"><div class="stat-num">${badDays}</div><div class="stat-lab">低落天数</div></div>
        <div class="card" style="text-align:center;margin:0"><div class="stat-num">${totalWords.toLocaleString()}</div><div class="stat-lab">写作总字数</div></div>
      </div>
      <div class="card"><h3>本月维度分</h3>
        ${dims.values.map((v, i) => `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><span style="width:48px;font-size:13px">${dims.dims[i]}</span><div class="progress-bar" style="flex:1"><i style="width:${v}%"></i></div><span style="width:36px;text-align:right;font-size:13px;color:var(--muted)">${v}%</span></div>`).join('')}
      </div>
      <div class="card"><h3>365自救·各专项连续天数</h3>
        ${srStreaks.length ? srStreaks.map(s => `<div class="list-row"><span style="flex:1">${esc(s.name)}</span><span class="tag">连续 ${s.streak} 天</span></div>`).join('') : '<div class="empty">还没有自救专项，去首页创建</div>'}
      </div>
      <div class="card"><h3>心情分布</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap">${this.moods.map((m, i) => {
          const c = moodCount[i] || 0; const max = Math.max(...Object.values(moodCount), 1);
          return `<div style="flex:1;min-width:60px;text-align:center"><div style="font-size:14px;font-weight:600;margin-bottom:4px">${m}</div><div style="border-radius:6px;overflow:hidden;height:${Math.max(12, c / max * 80)}px;background:${['#F4A6B8','#F6C56E','#C4CBD3','#8FB8E0','#B8A4D4'][i]};transition:height .3s"></div><div style="font-size:12px;margin-top:4px;color:var(--muted)">${c}天</div></div>`;
        }).join('')}</div>
      </div>`;
  },

  render_day(box, root) {
    const R = this.data(); const r = R[this.cur] || {};
    box.innerHTML = `
      <div class="card" style="display:flex;gap:10px;align-items:center">
        <button class="btn ghost sm" id="rPrev">‹</button>
        <input type="date" id="rDate" value="${this.cur}" style="font-weight:600">
        <button class="btn ghost sm" id="rNext">›</button>
        <span class="tag">${fmtCN(this.cur)}</span>
      </div>
      <div class="card">
        <div class="form-row"><label>今天的状态、心情、所作所为…想写什么写什么</label>
          <textarea id="rText" rows="10" placeholder="今天…">${esc(r.text || '')}</textarea></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn" id="rSave">${icon('save',16)} 保存日记</button>
        </div>
      </div>`;
    const saveR = patch => { const R2 = this.data(); R2[this.cur] = { ...(R2[this.cur] || {}), ...patch }; S.set('reviews', R2); };
    box.querySelector('#rDate').onchange = e => { this.cur = e.target.value; this.render(root); };
    box.querySelector('#rPrev').onclick = () => { this.cur = addDays(this.cur, -1); this.render(root); };
    box.querySelector('#rNext').onclick = () => { this.cur = addDays(this.cur, 1); this.render(root); };
    box.querySelector('#rSave').onclick = () => { saveR({ text: box.querySelector('#rText').value }); toast('日记已保存'); this.render(root); };
  },

  render_week(box) {
    if (!this._trendMode) this._trendMode = 'week';
    const mode = this._trendMode;
    // 趋势数据源：按维度聚合
    const trendItems = [
      { key: 'study', name: '备考学习', icon: icon('book',14), logsKey: 'kgLogs', unit: 'min', toNum: (arr) => arr.reduce((s, l) => s + (l.minutes || 0), 0) },
      { key: 'sport', name: '改善', icon: icon('running',14), logsKey: 'sportLogs', unit: 'min', toNum: (arr) => arr.reduce((s, l) => s + (l.minutes || 0), 0) },
      { key: 'work', name: '创作产出', icon: icon('creation',14), logsKey: 'workLogs', unit: 'count', toNum: (arr) => arr.length },
      { key: 'growth', name: '成长', icon: icon('leaf',14), logsKey: 'growthLogs', unit: 'count', toNum: (arr) => arr.length },
      { key: 'meals', name: '三餐', icon: icon('meal',14), logsKey: 'meals', unit: 'count', toNum: (v) => v ? ['breakfast','lunch','dinner'].filter(k => v[k]).length : 0 },
      { key: 'diary', name: '日记', icon: icon('edit',14), logsKey: 'reviews', unit: 'bool', toNum: (v) => v && v.text ? 1 : 0 },
    ];
    // 统计汇总
    let totalEvents = 0, totalRecords = 0, useDays = 0, recordDays = 0;
    trendItems.forEach(item => {
      const store = S.get(item.logsKey, {});
      Object.keys(store).forEach(d => {
        totalRecords += item.toNum(store[d]);
        recordDays++;
      });
    });
    useDays = new Set(Object.keys(S.get('reviews', {})).concat(
      Object.keys(S.get('sportLogs', {})), Object.keys(S.get('workLogs', {})),
      Object.keys(S.get('kgLogs', {})), Object.keys(S.get('growthLogs', {})),
      Object.keys(S.get('meals', {}))
    )).size;
    totalEvents = trendItems.filter(i => i.key !== 'diary').reduce((s, i) => {
      return s + Object.values(S.get(i.logsKey, {})).filter(v => Array.isArray(v) ? v.length : (v && typeof v === 'object' && Object.keys(v).some(k => v[k]))).length;
    }, 0);

    box.innerHTML = `
      <div class="trend-head">
        <h2 class="trend-title">趋势</h2>
        <div class="trend-actions">
          <button class="btn ghost sm trend-action" title="刷新">${icon('refresh',14)}</button>
          <button class="btn ghost sm trend-action" title="统计">${icon('stats',14)}</button>
          <button class="btn ghost sm trend-action" title="更多">⋯</button>
        </div>
      </div>
      <div class="trend-stats grid2">
        <div class="trend-stat"><b>${trendEvents || 0}</b><span>事件总数</span></div>
        <div class="trend-stat"><b>${totalRecords}</b><span>记录次数</span></div>
        <div class="trend-stat"><b>${useDays}</b><span>使用天数</span></div>
        <div class="trend-stat"><b>${recordDays}</b><span>记录天数</span></div>
      </div>
      <div class="trend-tabs">
        <button class="trend-tab ${mode === 'week' ? 'active' : ''}" data-tm="week">周</button>
        <button class="trend-tab ${mode === 'month' ? 'active' : ''}" data-tm="month">月</button>
        <button class="trend-tab ${mode === 'year' ? 'active' : ''}" data-tm="year">年</button>
      </div>
      <div id="trendBody"></div>
      <div id="trendExtra"></div>`;
    // tab 切换
    box.querySelectorAll('.trend-tab').forEach(b => b.onclick = () => { this._trendMode = b.dataset.tm; this.render_week(box); });
    this.renderTrendBody(box.querySelector('#trendBody'), trendItems, mode);
    this.renderTrendExtra(box.querySelector('#trendExtra'), trendItems, mode);
  },

  /* ---- 趋势图核心渲染（周/月/年共用）---- */
  renderTrendBody(el, items, mode) {
    const today = todayStr();
    let dateRanges, rangeLabel;
    if (mode === 'week') {
      const ws = weekStart(today);
      dateRanges = [{ start: ws, end: addDays(ws, 6) }];
      rangeLabel = ws.slice(5) + ' - ' + addDays(ws, 6).slice(5);
    } else if (mode === 'month') {
      const ym = today.slice(0, 7);
      const [yy, mm] = ym.split('-').map(Number);
      const dim = new Date(yy, mm, 0).getDate();
      dateRanges = [{ start: ym + '-01', end: ym + '-' + String(dim).padStart(2, '0') }];
      rangeLabel = yy + '年' + mm + '月';
    } else {
      const yy = Number(today.slice(0, 4));
      dateRanges = [{ start: yy + '-01-01', end: yy + '-12-31' }];
      rangeLabel = yy + '年';
    }
    const [rng] = dateRanges;

    // 翻页状态
    if (!this._trOffset) this._trOffset = {};
    if (this._trOffset[mode] == null) this._trOffset[mode] = 0;

    // 生成日期列表
    let allDates = [];
    for (let d = rng.start; d <= rng.end; d = addDays(d, 1)) allDates.push(d);
    const offset = Math.max(0, Math.min(this._trOffset[mode], Math.ceil(allDates.length / 7) - 1));
    const pageDates = allDates.slice(offset * 7, (offset + 1) * 7);
    const canPrev = offset > 0, canNext = (offset + 1) * 7 < allDates.length;

    // 星期标题行
    const wdNames = ['一', '二', '三', '四', '五', '六', '日'];

    // 每个维度的行
    let rowsHTML = items.map(item => {
      const store = S.get(item.logsKey, {});
      const cells = pageDates.map(d => {
        const v = store[d];
        const n = item.toNum(v);
        if (!n) return '<div class="trend-cell"></div>';
        return `<div class="trend-cell has" style="background:var(--ink);color:#fff;font-size:10px;font-weight:600;display:flex;align-items:center;justify-content:center;border-radius:50%;min-width:20px;height:20px"
          title="${d}：${n}${item.unit === 'min' ? '分钟' : '次'}">${n > 99 ? '∞' : n}</div>`;
      }).join('');
      // 统计该维度在全部日期范围内的总数
      const totalInRange = allDates.reduce((s, d) => s + item.toNum(store[d]), 0);
      const sunCount = allDates.filter(d => item.toNum(store[d])).length;
      return `<div class="trend-row">
        <div class="trend-item"><span class="trend-icon">${item.icon}</span><span class="trend-name">${item.name}</span></div>
        <div class="trend-grid">${cells}</div>
        <div class="trend-row-sum">
          <span>✓ ${sunCount}</span><span class="trend-sep">|</span><span>Σ ${item.unit === 'min' ? Math.round(totalInRange / 60 * 10) / 10 : totalInRange}</span>
        </div>
      </div>`;
    }).join('');

    el.innerHTML = `
      <div class="trend-nav">
        <button class="btn ghost sm trend-nav-btn${canPrev ? '' : ' disabled'}" data-tnav="prev">‹</button>
        <span class="trend-range">${rangeLabel}</span>
        <button class="btn ghost sm trend-nav-btn${canNext ? '' : ' disabled'}" data-tnav="next">›</button>
      </div>
      <div class="trend-body">
        <div class="trend-wd-head">${wdNames.map(w => '<span>' + w + '</span>').join('')}</div>
        ${rowsHTML}
      </div>`;

    // 翻页绑定
    const pBtn = el.querySelector('[data-tnav=prev]');
    const nBtn = el.querySelector('[data-tnav=next]');
    if (pBtn && canPrev) pBtn.onclick = () => { this._trOffset[mode]--; this.renderTrendBody(el, items, mode); };
    if (nBtn && canNext) nBtn.onclick = () => { this._trOffset[mode]++; this.renderTrendBody(el, items, mode); };

    // 原有周总结内容追加到下方
    if (mode === 'week') {
      const days = pageDates;
      const R = this.data();
      const facts = days.map(d => ({ d, f: this.dayFacts(d), r: R[d] }));
      const planPct = facts.map(x => x.f.plan.total ? Math.round(x.f.plan.done / x.f.plan.total * 100) : 0);
      const moodVals = facts.map(x => x.r && x.r.mood != null ? [95, 75, 55, 30, 12][x.r.mood] : 0);
      const studyH = facts.map(x => Math.round(x.f.study.reduce((s, l) => s + l.minutes, 0) / 6) / 10);
      const workN = facts.reduce((s, x) => s + x.f.work.length, 0);
      const studyTotal = facts.reduce((s, x) => s + x.f.study.reduce((a, l) => a + l.minutes, 0), 0);
      const sportN = facts.filter(x => x.f.sport.length).length;
      const wrote = facts.filter(x => x.r && x.r.text).length;
      const growthN = facts.reduce((s, x) => s + x.f.growth.length, 0);
      const mealDays = facts.filter(x => x.f.mealScore != null).length;
      const abandoned = facts.flatMap(x => x.f.plan.abandoned.map(t => t.abandonReason)).filter(Boolean);
      el.insertAdjacentHTML('beforeend', `
        <div class="grid4" style="margin-top:16px;margin-bottom:14px">
          <div class="card" style="text-align:center;margin:0"><div class="stat-num">${workN}</div><div class="stat-lab">本周创作产出</div></div>
          <div class="card" style="text-align:center;margin:0"><div class="stat-num">${Math.round(studyTotal / 60 * 10) / 10}h</div><div class="stat-lab">备考学习</div></div>
          <div class="card" style="text-align:center;margin:0"><div class="stat-num">${sportN}/7</div><div class="stat-lab">运动天数</div></div>
          <div class="card" style="text-align:center;margin:0"><div class="stat-num">${wrote}/7</div><div class="stat-lab">写日记天数</div></div>
          <div class="card" style="text-align:center;margin:0"><div class="stat-num">${growthN}</div><div class="stat-lab">成长打卡</div></div>
          <div class="card" style="text-align:center;margin:0"><div class="stat-num">${mealDays}/7</div><div class="stat-lab">三餐记录天</div></div>
        </div>
        <div class="grid2">
          <div class="card"><h3>${icon('trending',16)} 心情曲线</h3>${svgLine(moodVals, days.map(d => d.slice(8) + '日'))}
            <h3 class="section-gap">${icon('stats',16)} 计划完成率 %</h3>${svgBars(planPct, days.map(d => d.slice(8) + '日'))}</div>
          <div class="card"><h3>${icon('book',16)} 每日学习小时</h3>${svgBars(studyH, days.map(d => d.slice(8) + '日'))}
            <h3 class="section-gap">${icon('leaf',16)} ${MUMU_ASSISTANT()}周总结</h3>
            ${this.weekSummary(facts, abandoned).map(t => `<div class="step-row" style="align-items:flex-start"><span>${t[0]}</span><span class="stext">${esc(t[1])}</span></div>`).join('')}
          </div>
        </div>`);
    } else if (mode === 'month') {
      // 月模式也显示原有月总结内容（当月数据）
      const ms = this._monthStats(this._monthDaysAt(0));
      const dim = ms.dim, wkStudy = ms.wkStudy, wkWork = ms.wkWork, wkSport = ms.wkSport, diaryN = ms.diaryN;
      const weakest = ms.weakest, strongest = ms.strongest;
      el.insertAdjacentHTML('beforeend', `
        <div class="grid2" style="margin-top:16px">
          <div class="card"><h3>${icon('stats',16)} 成长五维雷达（本月）</h3>
            ${svgRadar(dim.dims, dim.values)}
            <div style="display:flex;gap:6px;overflow-x:auto;white-space:nowrap;margin-top:6px;padding-bottom:2px">${dim.dims.map((d, i) => `<span class="tag">${d} ${dim.values[i]}</span>`).join('')}</div>
            <div class="radar-tags" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px">
              <span class="tag">最强项：${strongest}</span>
              <span class="tag">待补强：${weakest}</span>
              <span class="tag">下个月多分点给「${weakest}」</span>
            </div>
          </div>
          <div class="card"><h3>${icon('trending',16)} 月度趋势（按周）</h3>
            <div class="muted">备考学习（小时/周）</div>${svgBars(wkStudy, ['第1周', '第2周', '第3周', '第4周'])}
            <div class="muted">创作产出（条/周）</div>${svgBars(wkWork, ['第1周', '第2周', '第3周', '第4周'])}
            <div class="muted">运动天数（天/周）</div>${svgBars(wkSport, ['第1周', '第2周', '第3周', '第4周'])}
          </div>
        </div>
        <div class="card" style="margin-top:12px"><h3>${icon('leaf',16)} ${MUMU_ASSISTANT()}月度总结</h3>
          <div class="step-row" style="align-items:flex-start"><span>${icon('sparkles',14)}</span><span class="stext">本月你写了 ${diaryN} 篇日记。${diaryN >= 15 ? '记录本身就是最了不起的自我观察。' : '日记越多，我给你的复盘越准，试试每天睡前3分钟。'}</span></div>
          <div class="step-row" style="align-items:flex-start"><span>${icon('trending',14)}</span><span class="stext">趋势解读：学习 ${wkStudy[3] >= wkStudy[0] ? '整体在上升，说明习惯正在长出来' : '后期有回落，看看是内容变难了还是被别的事挤占了'}；创作 ${wkWork[3] >= wkWork[0] ? '保持/上升' : '有回落，从一条15秒的短视频重新启动'}。</span></div>
          <div class="step-row" style="align-items:flex-start"><span>${icon('target',14)}</span><span class="stext">下月主线建议：${weakest === '学习' ? '每天固定2小时备考（内蒙古2027事业编预计9月报名，时间刚好）' : weakest === '创作' ? '定「周产3条」目标并绑定激励活动DDL' : weakest === '健康' ? '每天10分钟体态跟练+三餐拍照，只求记录不求完美' : weakest === '心态' ? '把「和' + MUMU_ASSISTANT() + '聊天+写日记」变成睡前仪式' : '每天只定3个以内的计划，完成率比数量重要'}。</span></div>
        </div>`);
    }
  },

  // 周/月总结卡片：趋势下方追加（独立容器，避免被趋势图滚动/翻页覆盖）
  renderTrendExtra(box, items, mode) {
    const today = todayStr();
    let dateRanges;
    if (mode === 'week') {
      const ws = weekStart(today);
      dateRanges = [{ start: ws, end: addDays(ws, 6) }];
    } else if (mode === 'month') {
      const ym = today.slice(0, 7);
      const [yy, mm] = ym.split('-').map(Number);
      const dim = new Date(yy, mm, 0).getDate();
      dateRanges = [{ start: ym + '-01', end: ym + '-' + String(dim).padStart(2, '0') }];
    } else {
      const yy = Number(today.slice(0, 4));
      dateRanges = [{ start: yy + '-01-01', end: yy + '-12-31' }];
    }
    const [rng] = dateRanges;
    let allDates = [];
    for (let d = rng.start; d <= rng.end; d = addDays(d, 1)) allDates.push(d);
    const days = allDates;

    if (mode === 'week') {
      const R = this.data();
      const facts = days.map(d => ({ d, f: this.dayFacts(d), r: R[d] }));
      const planPct = facts.map(x => x.f.plan.total ? Math.round(x.f.plan.done / x.f.plan.total * 100) : 0);
      const moodVals = facts.map(x => x.r && x.r.mood != null ? [95, 75, 55, 30, 12][x.r.mood] : 0);
      const studyH = facts.map(x => Math.round(x.f.study.reduce((s, l) => s + l.minutes, 0) / 6) / 10);
      const workN = facts.reduce((s, x) => s + x.f.work.length, 0);
      const studyTotal = facts.reduce((s, x) => s + x.f.study.reduce((a, l) => a + l.minutes, 0), 0);
      const sportN = facts.filter(x => x.f.sport.length).length;
      const wrote = facts.filter(x => x.r && x.r.text).length;
      const growthN = facts.reduce((s, x) => s + x.f.growth.length, 0);
      const mealDays = facts.filter(x => x.f.mealScore != null).length;
      const abandoned = facts.flatMap(x => x.f.plan.abandoned.map(t => t.abandonReason)).filter(Boolean);
      box.innerHTML = `
        <div class="grid4" style="margin-top:16px;margin-bottom:14px">
          <div class="card" style="text-align:center;margin:0"><div class="stat-num">${workN}</div><div class="stat-lab">本周创作产出</div></div>
          <div class="card" style="text-align:center;margin:0"><div class="stat-num">${Math.round(studyTotal / 60 * 10) / 10}h</div><div class="stat-lab">备考学习</div></div>
          <div class="card" style="text-align:center;margin:0"><div class="stat-num">${sportN}/7</div><div class="stat-lab">运动天数</div></div>
          <div class="card" style="text-align:center;margin:0"><div class="stat-num">${wrote}/7</div><div class="stat-lab">写日记天数</div></div>
          <div class="card" style="text-align:center;margin:0"><div class="stat-num">${growthN}</div><div class="stat-lab">成长打卡</div></div>
          <div class="card" style="text-align:center;margin:0"><div class="stat-num">${mealDays}/7</div><div class="stat-lab">三餐记录天</div></div>
        </div>
        <div class="grid2">
          <div class="card"><h3>${icon('trending',16)} 心情曲线</h3>${svgLine(moodVals, days.map(d => d.slice(8) + '日'))}
            <h3 class="section-gap">${icon('stats',16)} 计划完成率 %</h3>${svgBars(planPct, days.map(d => d.slice(8) + '日'))}</div>
          <div class="card"><h3>${icon('book',16)} 每日学习小时</h3>${svgBars(studyH, days.map(d => d.slice(8) + '日'))}
            <h3 class="section-gap">${icon('leaf',16)} ${MUMU_ASSISTANT()}周总结</h3>
            ${this.weekSummary(facts, abandoned).map(t => `<div class="step-row" style="align-items:flex-start"><span>${t[0]}</span><span class="stext">${esc(t[1])}</span></div>`).join('')}
          </div>
        </div>`;
    } else if (mode === 'month') {
      const ms = this._monthStats(this._monthDaysAt(0));
      const dim = ms.dim, wkStudy = ms.wkStudy, wkWork = ms.wkWork, wkSport = ms.wkSport, diaryN = ms.diaryN;
      const weakest = ms.weakest, strongest = ms.strongest;
      box.innerHTML = `
        <div class="grid2" style="margin-top:16px">
          <div class="card"><h3>${icon('stats',16)} 成长五维雷达（本月）</h3>
            ${svgRadar(dim.dims, dim.values)}
            <div style="display:flex;gap:6px;overflow-x:auto;white-space:nowrap;margin-top:6px;padding-bottom:2px">${dim.dims.map((d, i) => `<span class="tag">${d} ${dim.values[i]}</span>`).join('')}</div>
            <div class="radar-tags" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px">
              <span class="tag">最强项：${strongest}</span>
              <span class="tag">待补强：${weakest}</span>
              <span class="tag">下个月多分点给「${weakest}」</span>
            </div>
          </div>
          <div class="card"><h3>${icon('trending',16)} 月度趋势（按周）</h3>
            <div class="muted">备考学习（小时/周）</div>${svgBars(wkStudy, ['第1周', '第2周', '第3周', '第4周'])}
            <div class="muted">创作产出（条/周）</div>${svgBars(wkWork, ['第1周', '第2周', '第3周', '第4周'])}
            <div class="muted">运动天数（天/周）</div>${svgBars(wkSport, ['第1周', '第2周', '第3周', '第4周'])}
          </div>
        </div>
        <div class="card" style="margin-top:12px"><h3>${icon('leaf',16)} ${MUMU_ASSISTANT()}月度总结</h3>
          <div class="step-row" style="align-items:flex-start"><span>${icon('sparkles',14)}</span><span class="stext">本月你写了 ${diaryN} 篇日记。${diaryN >= 15 ? '记录本身就是最了不起的自我观察。' : '日记越多，我给你的复盘越准，试试每天睡前3分钟。'}</span></div>
          <div class="step-row" style="align-items:flex-start"><span>${icon('trending',14)}</span><span class="stext">趋势解读：学习 ${wkStudy[3] >= wkStudy[0] ? '整体在上升，说明习惯正在长出来' : '后期有回落，看看是内容变难了还是被别的事挤占了'}；创作 ${wkWork[3] >= wkWork[0] ? '保持/上升' : '有回落，从一条15秒的短视频重新启动'}。</span></div>
          <div class="step-row" style="align-items:flex-start"><span>${icon('target',14)}</span><span class="stext">下月主线建议：${weakest === '学习' ? '每天固定2小时备考（内蒙古2027事业编预计9月报名，时间刚好）' : weakest === '创作' ? '定「周产3条」目标并绑定激励活动DDL' : weakest === '健康' ? '每天10分钟体态跟练+三餐拍照，只求记录不求完美' : weakest === '心态' ? '把「和' + MUMU_ASSISTANT() + '聊天+写日记」变成睡前仪式' : '每天只定3个以内的计划，完成率比数量重要'}。</span></div>
        </div>`;
    } else {
      box.innerHTML = '';
    }
  },
  weekSummary(facts, abandoned) {
    const out = [];
    const workN = facts.reduce((s, x) => s + x.f.work.length, 0);
    const studyMin = facts.reduce((s, x) => s + x.f.study.reduce((a, l) => a + l.minutes, 0), 0);
    const active = facts.filter(x => x.d <= todayStr() && (x.f.plan.total || x.f.work.length || x.f.study.length || x.f.sport.length || x.f.growth.length)).length;
    // 严格按一周 7 天计分母（6/7 这样），分子只数到今天有记录的天
    const denom = 7;
    out.push([icon('calendar',14), `本周有 ${active}/${denom} 天在工作台留下了行动痕迹。${active >= Math.ceil(denom * 0.7) ? '节奏非常稳！' : active >= Math.ceil(denom * 0.4) ? '在建立习惯的路上，继续。' : '试试每天至少打开一次工作台，做一件小事。'}`]);
    if (workN) out.push([icon('play',14), `创作产出 ${workN} 条。${workN >= 3 ? '这个产量对自由职业者来说很能打！' : '可以定个「周产3条」的小目标。'}`]);
    else out.push([icon('play',14), '本周没有创作产出。去激励雷达看看有没有截止前的活动，用DDL推自己一把。']);
    if (studyMin >= 600) out.push([icon('book',14), `备考投入 ${Math.round(studyMin / 60)} 小时，量很足，注意配合真题检验效果。`]);
    else if (studyMin > 0) out.push([icon('book',14), `备考学习 ${Math.round(studyMin / 60 * 10) / 10} 小时。想想是时间问题还是启动难？试试固定「早9-11点学习」的仪式感。`]);
    if (abandoned.length) out.push([icon('trash',14), `本周放弃了 ${abandoned.length} 个任务，原因：${[...new Set(abandoned)].slice(0, 3).join('；')}。放弃的模式值得看看——是计划定大了，还是精力错配？`]);
    const moods = facts.filter(x => x.r && x.r.mood != null).map(x => x.r.mood);
    if (moods.length >= 3) {
      const avg = moods.reduce((a, b) => a + b, 0) / moods.length;
      out.push([icon('heart',14), avg <= 1.2 ? '这周心情整体不错，把让你开心的事记下来，多做。' : avg >= 2.5 ? '这周情绪偏低，对自己温柔一点。低谷期做小事，别做大决定。想聊随时找' + MUMU_ASSISTANT() + '。' : '心情有起伏很正常，注意观察低落的日子有没有共同原因。']);
    }
    out.push([icon('target',14), '下周一件最重要的事：从「月总结」的雷达图里挑最短的那根轴，重点补它。']);
    return out;
  },

  render_month(box) {
    const dim = this.dimScores(30);
    const R = this.data();
    // 近30天关键趋势
    const days30 = []; for (let i = 29; i >= 0; i--) days30.push(addDays(todayStr(), -i));
    const weekly = [[], [], [], []];
    days30.forEach((d, i) => weekly[Math.min(3, Math.floor(i / 7.5))].push(d));
    const wkStudy = weekly.map(ws => Math.round(ws.reduce((s, d) => s + (S.get('kgLogs', {})[d] || []).reduce((a, l) => a + l.minutes, 0), 0) / 60 * 10) / 10);
    const wkWork = weekly.map(ws => ws.reduce((s, d) => s + (S.get('workLogs', {})[d] || []).length, 0));
    const wkSport = weekly.map(ws => ws.filter(d => (S.get('sportLogs', {})[d] || []).length).length);
    const diaryN = days30.filter(d => R[d] && R[d].text).length;
    const weakest = dim.dims[dim.values.indexOf(Math.min(...dim.values))];
    const strongest = dim.dims[dim.values.indexOf(Math.max(...dim.values))];
    box.innerHTML = `
      <div class="grid2">
        <div class="card"><h3>${icon('stats',16)} 成长五维雷达（本月）</h3>
          ${svgRadar(dim.dims, dim.values)}
          <div style="display:flex;gap:6px;overflow-x:auto;white-space:nowrap;margin-top:6px;padding-bottom:2px">${dim.dims.map((d, i) => `<span class="tag">${d} ${dim.values[i]}</span>`).join('')}</div>
          <div class="radar-tags" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px">
            <span class="tag">最强项：${strongest}</span>
            <span class="tag">待补强：${weakest}</span>
            <span class="tag">下个月多分点给「${weakest}」</span>
          </div>
        </div>
        <div class="card"><h3>${icon('trending',16)} 月度趋势（按周）</h3>
          <div class="muted">备考学习（小时/周）</div>${svgBars(wkStudy, ['第1周', '第2周', '第3周', '第4周'])}
          <div class="muted">创作产出（条/周）</div>${svgBars(wkWork, ['第1周', '第2周', '第3周', '第4周'])}
          <div class="muted">运动天数（天/周）</div>${svgBars(wkSport, ['第1周', '第2周', '第3周', '第4周'])}
        </div>
      </div>
      <div class="card"><h3>${icon('leaf',16)} ${MUMU_ASSISTANT()}月度总结</h3>
        <div class="step-row" style="align-items:flex-start"><span>${icon('sparkles',14)}</span><span class="stext">本月你写了 ${diaryN} 篇日记。${diaryN >= 15 ? '记录本身就是最了不起的自我观察。' : '日记越多，我给你的复盘越准，试试每天睡前3分钟。'}</span></div>
        <div class="step-row" style="align-items:flex-start"><span>${icon('trending',14)}</span><span class="stext">趋势解读：学习 ${wkStudy[3] >= wkStudy[0] ? '整体在上升，说明习惯正在长出来' : '后期有回落，看看是内容变难了还是被别的事挤占了'}；创作 ${wkWork[3] >= wkWork[0] ? '保持/上升' : '有回落，从一条15秒的短视频重新启动'}。</span></div>
        <div class="step-row" style="align-items:flex-start"><span>${icon('target',14)}</span><span class="stext">下月主线建议：${weakest === '学习' ? '每天固定2小时备考（内蒙古2027事业编预计9月报名，时间刚好）' : weakest === '创作' ? '定「周产3条」目标并绑定激励活动DDL' : weakest === '健康' ? '每天10分钟体态跟练+三餐拍照，只求记录不求完美' : weakest === '心态' ? '把「和' + MUMU_ASSISTANT() + '聊天+写日记」变成睡前仪式' : '每天只定3个以内的计划，完成率比数量重要'}。</span></div>
      </div>`;
  },
};
window.Modules.review = { render: r => Review.render(r) };
window.Review = Review;

// 精力建议"应用"按钮（事件委托，避免在三处可视化里各自绑定）
if (!window.__reviewCapBound) {
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('#applyCap');
    if (b) { S.set('loadCap', Number(b.dataset.cap)); toast('精力上限已更新为 ' + b.dataset.cap); if (window.Review) Review.render(Review._root); }
  });
  window.__reviewCapBound = true;
}
// 精力建议横幅折叠/展开（点头部切换）
if (!window.__reviewFoldBound) {
  document.addEventListener('click', (e) => {
    const h = e.target.closest && e.target.closest('.lb-suggest-head');
    if (h) { const c = h.closest('.lb-suggest'); if (c) c.classList.toggle('collapsed'); }
  });
  window.__reviewFoldBound = true;
}
