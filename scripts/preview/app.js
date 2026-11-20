/* 摔友记 V0 · 开发预览（浏览器内交互，非小程序运行时） */
(function () {
  const P = window.__PREVIEW__;
  const RIG = P.rig;
  const ART = P.art;
  const DATA = P.data;
  const TABBAR = P.tabbar;
  const esc = (value) =>
    String(value == null ? '' : value).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const S = {
    screen: 'atlas',
    groupId: (DATA.groups[0] || {}).id || '',
    view: 'front',
    me: JSON.parse(JSON.stringify(DATA.me.avatar)),
    prefs: Object.assign({}, DATA.me.preferences),
    inventory: DATA.inventory.map((item) => Object.assign({}, item)),
    weeklyClaimed: DATA.weekly.claimed,
    unread: DATA.inbox.unreadCount,
    inbox: DATA.inbox.events.map((event) => Object.assign({}, event)),
    publishedDetails: {},
    published: [],
    sheetOpen: false,
    storyId: Object.keys(DATA.details)[0] || null,
    form: {
      sport: 'ski_double',
      scenario: [],
      cause: [],
      bodyParts: [],
      impactKind: 'near_miss',
      protectiveItems: [],
      tone: 'humorous',
      title: '',
      body: '',
      groups: [(DATA.groups[0] || {}).id].filter(Boolean),
      anonymous: false,
      selfOnly: false,
      funny: false,
      gifts: true,
    },
  };

  const toastEl = document.getElementById('toast');
  let toastTimer = 0;
  function toast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('on'), 1900);
  }

  function detailOf(storyId) {
    return S.publishedDetails[storyId] || DATA.details[storyId] || null;
  }

  function groupOf(groupId) {
    return DATA.groups.find((group) => group.id === groupId) || DATA.groups[0];
  }

  function atlasFor(groupId, view) {
    const base = DATA.atlases[groupId] && DATA.atlases[groupId][view];
    if (!base) return null;
    const clone = JSON.parse(JSON.stringify(base));
    const extras = S.published.filter((item) => item.groupIds.includes(groupId) && item.detail);
    if (!extras.length) return clone;
    for (const item of extras) {
      const card = item.card;
      clone.stories.push(card);
      clone.storyCount += 1;
      if (!clone.stories.some((story, index) => index < clone.stories.length - 1 && story.authorId === card.authorId)) {
        clone.participantCount += 1;
      }
      for (const part of card.bodyParts) {
        const spot = clone.hotspots.find((s) => s.id === part);
        if (!spot) continue;
        spot.count += 1;
        spot.storyIds.push(card.id);
        if (!spot.users.some((user) => user.userId === card.authorId)) {
          spot.users.push({
            userId: card.authorId,
            displayName: card.authorName,
            palette: card.palette,
            expression: card.expression,
            equipped: card.equipped,
            isAnonymous: card.isAnonymous,
          });
        }
      }
    }
    clone.stories.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    const counts = new Map();
    for (const story of clone.stories) {
      for (const part of story.bodyParts) {
        if (part === 'other') continue;
        counts.set(part, (counts.get(part) || 0) + 1);
      }
    }
    const max = Math.max(1, ...counts.values());
    clone.hottest = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([bodyPart, count]) => ({
        bodyPart,
        label: DATA.labels.bodyPart[bodyPart] || bodyPart,
        count,
        pct: Math.round((count / max) * 100),
      }));
    return clone;
  }

  function layered(avatar, view, mode) {
    const defs = (RIG.views[view] || RIG.views.front) || [];
    const active = [];
    for (const layer of defs) {
      let src = null;
      if (layer.slot === 'expression') src = layer.variants[avatar.expression] || layer.variants.happy;
      else if (layer.slot) {
        const value = avatar.equipped[layer.slot];
        if (!value) continue;
        src = layer.variants[value];
      } else {
        src = layer.src;
      }
      if (!src) continue;
      if (mode === 'chip' && ['head', 'headgear', 'goggles'].indexOf(layer.id) < 0) continue;
      active.push({ layer, src });
    }
    if (!active.length) return [];
    const boxes = active.map((item) => item.layer.bbox);
    let box = { x: 0, y: 0, w: RIG.canvas.width, h: RIG.canvas.height };
    if (mode === 'chip') {
      const raw = {
        x: Math.min(...boxes.map((b) => b.x)),
        y: Math.min(...boxes.map((b) => b.y)),
        w: Math.max(...boxes.map((b) => b.x + b.w)) - Math.min(...boxes.map((b) => b.x)),
        h: Math.max(...boxes.map((b) => b.y + b.h)) - Math.min(...boxes.map((b) => b.y)),
      };
      const side = Math.max(raw.w, raw.h);
      box = { x: raw.x - (side - raw.w) / 2, y: raw.y - (side - raw.h) / 2, w: side, h: side };
    }
    return active.map(({ layer, src }) => ({
      src,
      z: layer.z,
      left: ((layer.bbox.x - box.x) / box.w) * 100,
      top: ((layer.bbox.y - box.y) / box.h) * 100,
      width: (layer.bbox.w / box.w) * 100,
      height: (layer.bbox.h / box.h) * 100,
    }));
  }

  function rigHtml(avatar, view, mode, className) {
    const layers = layered(avatar, view || 'front', mode || 'full');
    const inner = layers
      .map(
        (layer) =>
          `<div class="rig-layer" style="left:${layer.left.toFixed(2)}%;top:${layer.top.toFixed(
            2,
          )}%;width:${layer.width.toFixed(2)}%;height:${layer.height.toFixed(2)}%;z-index:${layer.z}">${
            ART[layer.src] || ''
          }</div>`,
      )
      .join('');
    return `<div class="rig ${className || ''}">${inner}</div>`;
  }

  function chipHtml(chip, size) {
    const avatar = {
      palette: chip.palette,
      expression: chip.expression,
      equipped: chip.equipped,
    };
    return `<div class="avatar-chip" style="${size ? `width:${size}px;height:${size}px;` : ''}">${rigHtml(
      avatar,
      'front',
      'chip',
    )}</div>`;
  }

  function timeText(iso) {
    const now = Date.now();
    const ts = Date.parse(iso);
    const diff = now - ts;
    if (diff < 3600 * 1000) return Math.max(1, Math.round(diff / 60000)) + ' 分钟前';
    if (diff < 24 * 3600 * 1000) return Math.round(diff / 3600000) + ' 小时前';
    if (diff < 7 * 24 * 3600 * 1000) return Math.round(diff / 86400000) + ' 天前';
    const d = new Date(ts);
    return `${d.getMonth() + 1}-${d.getDate()}`;
  }

  function impactLabel(detail) {
    return DATA.labels.impact[detail.incident.impactKind] || '';
  }

  function storyCardHtml(card) {
    return `<div class="story-card" onclick="P.openStory('${card.id}')">
      <div class="story-card__head">
        <div class="story-card__avatar">${chipHtml(card)}</div>
        <div style="flex:1;min-width:0">
          <div class="story-card__name">${esc(card.authorName)}${
            card.isAnonymous ? '<span class="story-card__badge">匿名</span>' : ''
          }</div>
          <div class="story-card__meta">${timeText(card.createdAt)} · ${DATA.labels.sportEmoji[card.sport] || ''} ${
            DATA.labels.sport[card.sport] || ''
          }</div>
        </div>
      </div>
      <div class="story-card__title">${esc(card.title)}</div>
      <div class="story-card__tags">
        <span class="tag tag--blue">${DATA.labels.impact[card.impactKind] || ''}</span>
        ${card.bodyParts
          .filter((part) => part !== 'other')
          .map((part) => `<span class="tag">${DATA.labels.bodyPart[part] || part}</span>`)
          .join('')}
      </div>
    </div>`;
  }

  /* ------------------------------------------------------------------ atlas */

  function renderAtlas() {
    const group = groupOf(S.groupId);
    const atlas = atlasFor(S.groupId, S.view);
    if (!atlas) return '<div class="scroll"><div class="card" style="padding:40px">没有图鉴数据</div></div>';
    const hotspots = atlas.hotspots
      .map((spot) => {
        const def = (RIG.hotspots[S.view] || []).find((item) => item.id === spot.id);
        if (!def) return '';
        const chips = spot.users.slice(0, 2).map((user) => chipHtml(user)).join('');
        const more = spot.users.length > 2 ? `<div class="avatar-chip more">+${spot.users.length - 2}</div>` : '';
        return `<div class="hotspot" style="left:${(def.x / RIG.canvas.width) * 100}%;top:${
          (def.y / RIG.canvas.height) * 100
        }%" onclick="P.openHotspot('${spot.id}')" title="${esc(spot.label)}">
          ${spot.sticker ? `<span class="hotspot__sticker">${spot.sticker}</span>` : ''}
          ${spot.count ? `<div class="stack">${chips}${more}</div>` : '<div class="dot"></div>'}
        </div>`;
      })
      .join('');
    const bars = atlas.hottest
      .map((item) => `<span class="hotpill">${esc(item.label)} ${item.count}</span>`)
      .join('');
    const stories = atlas.stories.map((card) => storyCardHtml(card)).join('');
    return `<div class="scroll" id="atlas-scroll">
      <div class="hero">
        <div class="hero__top">
          <div style="min-width:0">
            <div class="hero__name" onclick="P.switchGroup()">${esc(group.name)} ▾</div>
            <div class="hero__meta">${group.memberCount} 位雪友 · ${
              group.role === 'owner' ? '圈主' : group.role === 'admin' ? '管理员' : '成员'
            }</div>
          </div>
          <div class="hero__actions">
            <button class="icon-btn" onclick="P.go('group')" title="圈子">圈</button>
            <button class="icon-btn" onclick="P.go('settings')" title="设置">⚙</button>
          </div>
        </div>
        <div class="stats">
          <div class="stat"><div class="stat__num">${atlas.storyCount}</div><div class="stat__label">故事总数</div></div>
          <div class="stat"><div class="stat__num">${atlas.participantCount}</div><div class="stat__label">参与者</div></div>
          <div class="stat stat--wide"><div class="stat__label">最热话题部位</div><div class="stat__value">${
            atlas.hottest.length ? esc(atlas.hottest[0].label) : '等第一个故事'
          }</div></div>
        </div>
      </div>

      <div class="card stage">
        <div class="between">
          <div class="seg">
            <button class="${S.view === 'front' ? 'on' : ''}" onclick="P.setView('front')">正面</button>
            <button class="${S.view === 'back' ? 'on' : ''}" onclick="P.setView('back')">背面</button>
          </div>
          <div class="seg"><button class="on">全部</button><button onclick="P.toast('预览里只展示全部时间范围')">本周</button></div>
        </div>
        <div class="stage__canvas">
          <div class="figure">${rigHtml(S.me, S.view, 'full')}${hotspots}</div>
        </div>
        <div class="stage__hint">点身体上的小骷髅头像，看 TA 的那次经历</div>
        ${bars ? `<div class="topicline"><span>话题部位</span>${bars}<span class="topicline__note">仅数量</span></div>` : ''}
      </div>

      <div class="recent">
        <div class="between"><div class="section-title">最近故事</div></div>
        <div class="recent__list">${stories}</div>
      </div>

      <div class="footnote">故事由本人自述与确认，仅作朋友间的轻松记录，不构成诊断、治疗、康复或理赔建议。</div>
    </div>
    <button class="fab" onclick="P.go('create')">＋ 记录一次</button>`;
  }

  /* ------------------------------------------------------------------ story */

  function renderStory() {
    const detail = detailOf(S.storyId);
    if (!detail) return '<div class="scroll"><div class="card" style="padding:40px">故事不存在</div></div>';
    const avatar = detail.avatar;
    const story = detail.story;
    const incident = detail.incident;
    const selfOnly = story.visibility === 'self';
    const group = selfOnly ? null : detail.group || groupOf(S.groupId);
    const tags = [
      `<span class="tag tag--blue">${DATA.labels.sport[incident.sport] || ''}</span>`,
      `<span class="tag">${DATA.labels.impact[incident.impactKind] || ''}</span>`,
      ...incident.scenario.map((id) => `<span class="tag">${DATA.labels.scenario[id] || id}</span>`),
      ...incident.selfReportedCause.map((id) => `<span class="tag tag--warm">自述：${DATA.labels.cause[id] || id}</span>`),
      ...incident.protectiveItems.map((id) => `<span class="tag tag--mint">${DATA.labels.protective[id] || id}</span>`),
    ].join('');
    const updates = (detail.updates || [])
      .map(
        (update) => `<div class="update">
          <div class="update__rail"><div class="update__dot"></div></div>
          <div style="flex:1">
            <div class="between"><div class="update__type">${DATA.labels.update[update.type] || '后续'}</div><div class="update__time">${timeText(
              update.createdAt,
            )}</div></div>
            <div class="update__text">${esc(update.body)}</div>
          </div>
        </div>`,
      )
      .join('');
    const usedTotal = (detail.myReactions || []).reduce((sum, item) => sum + (item.mine || 0), 0);
    const reactionButtons = DATA.actions
      .filter((action) => action.id !== 'receive_gift')
      .map((action) => {
        const total = (detail.reactions || []).find((item) => item.actionId === action.id) || { count: 0 };
        const blocked = action.requiresFunnyConsent && !detail.canSpin;
        const disabled = selfOnly || detail.viewerIsAuthor || blocked || usedTotal >= 3;
        return `<button class="reaction" ${disabled ? 'disabled' : ''} onclick="P.react('${action.id}')">
          <span class="reaction__emoji">${action.fallbackEmoji}</span>${action.name}
          ${total.count ? `<span class="reaction__count">${total.count}</span>` : ''}
        </button>`;
      })
      .join('');
    return `<div class="scroll" id="story-scroll">
      <div class="between">
        <div class="author">
          <div class="author__avatar">${chipHtml(avatar)}</div>
          <div>
            <div class="author__name">${esc(detail.author.displayName)}${
              story.isAnonymous ? '<span class="story-card__badge">匿名展示</span>' : ''
            }</div>
            <div class="author__meta">${esc(selfOnly ? '仅自己可见' : group.name)} · ${timeText(story.createdAt)} · ${
              DATA.labels.sportEmoji[incident.sport] || ''
            } ${DATA.labels.sport[incident.sport] || ''}</div>
          </div>
        </div>
        ${
          selfOnly
            ? ''
            : `<button class="icon-btn" onclick="P.toast('分享卡片会带 storyId，但不授予查看权限')">↗</button>`
        }
      </div>

      <div class="story-stage" id="story-stage">
        <div class="story-stage__badge">${DATA.labels.sportEmoji[incident.sport] || ''} ${
          DATA.labels.sport[incident.sport] || ''
        }</div>
        <div class="story-stage__impact">${DATA.labels.impact[incident.impactKind] || ''}</div>
        <div class="story-stage__rig">${rigHtml(avatar, 'front', 'full', 'story-rig')}</div>
        <div class="story-stage__me">${rigHtml(S.me, 'front', 'full')}</div>
      </div>

      <div class="card story-body">
        <div class="story-body__title">${esc(story.title)}</div>
        <div class="story-body__text">${esc(story.body)}</div>
        <div class="chips" style="margin-top:10px">${tags}</div>
        <div class="story-body__note">「原因」是本人自述，不是责任认定，也不构成医疗或理赔判断。</div>
        ${selfOnly ? '<div class="story-body__note">这条故事仅自己可见，不会出现在圈子图鉴。</div>' : ''}
      </div>

      ${updates ? `<div class="card timeline"><div class="section-title">后续</div>${updates}</div>` : ''}

      <div class="card reactions">
        <div class="reactions__grid">${reactionButtons}
          <button class="reaction reaction--gift" onclick="P.openGift()">
            <span class="reaction__emoji">🎁</span>送装备
          </button>
        </div>
        <div class="reactions__note">每人每天对同一条故事最多互动 3 次（抱抱/转圈/鼓掌合计）；装备免费、无现金价值。作者关闭搞笑动作后，「转圈」会自动禁用。</div>
      </div>

      <div class="links">
        <div class="link" onclick="P.toast('V0 本地原型没有平台审核后台，举报不会真的提交')">举报这条内容</div>
        ${
          detail.viewerIsAuthor || detail.author.isMe
            ? `<div class="link" onclick="P.toast('撤回后统计会同步更新（演示）')">撤回我的故事</div>`
            : ''
        }
      </div>
    </div>`;
  }

  /* ----------------------------------------------------------------- avatar */

  function renderAvatar() {
    const avatar = S.me;
    const expressions = DATA.labels.expressions
      .map(
        (item) => `<button class="expression ${avatar.expression === item.id ? 'on' : ''}" onclick="P.setExpression('${item.id}')">
          <span class="expression__emoji">${item.emoji}</span>${item.label}
        </button>`,
      )
      .join('');
    const palettes = DATA.labels.palettes
      .map(
        (item) =>
          `<div class="swatch ${avatar.palette === item.id ? 'on' : ''}" style="background:${item.color}" onclick="P.setPalette('${
            item.id
          }')"></div>`,
      )
      .join('');
    const outfits = DATA.items
      .filter((item) => item.slot === 'outfit')
      .map(
        (item) => `<button class="gear ${avatar.equipped.outfit === item.id ? 'on' : ''}" onclick="P.equip('outfit','${item.id}')">
          <span>${item.name}</span><span class="gear__check">${avatar.equipped.outfit === item.id ? '已穿' : '换上'}</span>
        </button>`,
      )
      .join('');
    const headgears = DATA.items
      .filter((item) => item.slot === 'headgear')
      .map(
        (item) => `<button class="chip ${avatar.equipped.headgear === item.id ? 'on' : ''}" onclick="P.equip('headgear','${
          item.id
        }')">${item.name}</button>`,
      )
      .join('');
    const inventory = S.inventory
      .filter((item) => item.category !== 'cosmetic')
      .map(
        (item) => `<div class="item">
          <div class="item__icon">${item.category === 'cosmetic' ? `<span style="font-size:19px">${item.icon}</span>` : ART.items[item.itemDefId] || ''}</div>
          <div class="item__main"><div class="item__name">${esc(item.name)}</div><div class="item__meta">${item.expiresText}</div></div>
          <div class="item__qty">×${item.quantity}</div>
        </div>`,
      )
      .join('');
    return `<div class="scroll">
      <div class="form-intro"><div class="form-intro__title">我的角色</div><div class="form-intro__sub">换装、表情和配色都会同步到图鉴小头像</div></div>
      <div class="avatar-stage"><div class="avatar-stage__rig">${rigHtml(avatar, 'front', 'full')}</div></div>

      <div class="card panel">
        <div class="panel__head"><div class="section-title">表情</div><div class="tiny">会显示在故事图鉴上</div></div>
        <div class="expressions">${expressions}</div>
      </div>

      <div class="card panel">
        <div class="panel__head"><div class="section-title">配色</div><div class="tiny">小头像的底色标签</div></div>
        <div class="palettes">${palettes}</div>
      </div>

      <div class="card panel">
        <div class="panel__head"><div class="section-title">雪服</div><div class="tiny">已拥有</div></div>
        <div class="gear-list">${outfits}</div>
      </div>

      <div class="card panel">
        <div class="panel__head"><div class="section-title">头部与护具</div><div class="tiny">原创通用造型</div></div>
        <div class="chips">
          <button class="chip ${!avatar.equipped.headgear ? 'on' : ''}" onclick="P.equip('headgear',null)">不戴</button>
          ${headgears}
        </div>
        <div class="toggle-row">
          <div><div class="toggle-row__name">雪镜</div><div class="tiny">半透明镜片，不挡表情</div></div>
          <button class="switch ${avatar.equipped.goggles ? 'on' : ''}" onclick="P.toggleGear('goggles','snow_goggles')"></button>
        </div>
        <div class="toggle-row">
          <div><div class="toggle-row__name">护臀</div><div class="tiny">尾椎的忠实伙伴</div></div>
          <button class="switch ${avatar.equipped.hip_protector ? 'on' : ''}" onclick="P.toggleGear('hip_protector','basic_hip_protector')"></button>
        </div>
      </div>

      <div class="card panel">
        <div class="panel__head"><div class="section-title">背包</div><div class="tiny">${
          S.weeklyClaimed ? '本周补给已领取' : '本周补给待领取'
        }</div></div>
        <div class="weekly">
          <div><div style="font-size:13px;font-weight:700">每周免费补给</div><div class="tiny">2 件随机互动道具 · 不需要分享</div></div>
          <button class="btn ${S.weeklyClaimed ? 'btn--ghost' : 'btn--primary'}" onclick="P.claimWeekly()">${
            S.weeklyClaimed ? '已领取' : '领取'
          }</button>
        </div>
        <div class="items">${inventory}</div>
      </div>

      <div class="footnote">角色资产为原创几何造型；不包含任何品牌 Logo 或官方联名暗示。</div>
    </div>`;
  }

  /* ------------------------------------------------------------------- form */

  const PRESETS = {
    tailbone: ['尾椎渡劫记', '雪地坐姿标准动作', '我的屁股先下班了'],
    head: ['差一点就飞升', '头盔替我挡了一劫'],
    back: ['后背和雪地的第一次接触'],
    waist: ['腰：我只是路过'],
    wrist_l: ['手腕说它今天不想上班'],
    wrist_r: ['手腕说它今天不想上班'],
    knee_l: ['膝盖的今日复盘'],
    knee_r: ['膝盖的今日复盘'],
    ankle_l: ['脚踝的意外假期'],
    ankle_r: ['脚踝的意外假期'],
    shoulder_l: ['肩膀说它有点懵'],
    shoulder_r: ['肩膀说它有点懵'],
  };
  const FALLBACK_PRESETS = ['今天在雪里打了个滚', '一次不太优雅的落地', '平安回家的乌龙'];

  function presets() {
    const first = S.form.bodyParts[0];
    return (first && PRESETS[first]) || FALLBACK_PRESETS;
  }

  function presetButtons() {
    return presets()
      .map((title) => `<button class="preset" onclick="P.usePreset('${esc(title)}')">${esc(title)}</button>`)
      .join('');
  }

  function refreshPresets() {
    const box = document.getElementById('preset-box');
    if (box) box.innerHTML = presetButtons();
  }

  function renderCreate() {
    const F = S.form;
    const chip = (kind, id, label, selected) =>
      `<button class="chip ${selected ? 'on' : ''}" data-chip-kind="${kind}" onclick="P.toggleForm('${kind}','${id}',this)">${label}</button>`;
    const sports = DATA.labels.sports
      .map((item) => chip('sport', item.id, `${item.emoji} ${item.label}`, F.sport === item.id))
      .join('');
    const scenarios = DATA.labels.scenarios
      .map((item) => chip('scenario', item.id, item.label, F.scenario.includes(item.id)))
      .join('');
    const causes = DATA.labels.causes.map((item) => chip('cause', item.id, item.label, F.cause.includes(item.id))).join('');
    const parts = DATA.labels.bodyParts
      .map((item) => chip('bodyParts', item.id, item.label, F.bodyParts.includes(item.id)))
      .join('');
    const impacts = DATA.labels.impacts
      .map((item) => chip('impactKind', item.id, item.label, F.impactKind === item.id))
      .join('');
    const protections = DATA.labels.protectives
      .map((item) => chip('protectiveItems', item.id, item.label, F.protectiveItems.includes(item.id)))
      .join('');
    const groups = DATA.groups
      .map(
        (group) => `<div class="group-row" onclick="P.toggleGroup('${group.id}')">
          <div class="checkbox ${F.groups.includes(group.id) ? 'on' : ''}">✓</div>
          <div style="flex:1"><div style="font-size:13px;font-weight:700">${esc(group.name)}</div><div class="tiny">${
            group.memberCount
          } 位雪友</div></div>
        </div>`,
      )
      .join('');
    return `<div class="scroll" style="padding-bottom:110px">
      <div class="form-intro"><div class="form-intro__title">记录一次经历</div><div class="form-intro__sub">标签 + 一句话，30 秒就能发；不用 AI 也完整可用。</div></div>

      <div class="card panel">
        <div class="panel__head"><div class="section-title">运动</div><div class="tiny">单选</div></div>
        <div class="chips">${sports}</div>
      </div>

      <div class="card panel">
        <div class="panel__head"><div class="section-title">发生背景</div><div class="tiny">最多 3 个</div></div>
        <div class="chips">${scenarios}</div>
      </div>

      <div class="card panel">
        <div class="panel__head"><div class="section-title">自述原因</div><div class="tiny">最多 3 个 · 不是责任认定</div></div>
        <div class="chips">${causes}</div>
      </div>

      <div class="card panel">
        <div class="panel__head"><div class="section-title">身体部位</div><div class="tiny">最多 3 个 · 用于热区统计</div></div>
        <div class="chips">${parts}</div>
      </div>

      <div class="card panel">
        <div class="panel__head"><div class="section-title">当时情况</div><div class="tiny">不构成伤情分级</div></div>
        <div class="chips">${impacts}</div>
      </div>

      <div class="card panel">
        <div class="panel__head"><div class="section-title">当时戴了</div><div class="tiny">可多选</div></div>
        <div class="chips">${protections}</div>
      </div>

      <div class="card panel">
        <div class="panel__head"><div class="section-title">标题</div><div class="tiny" id="title-count">${F.title.length}/24</div></div>
        <input class="input" maxlength="24" placeholder="比如：尾椎渡劫记" value="${esc(F.title)}" oninput="P.inputTitle(this.value)" />
        <div class="tiny" style="margin-top:7px">点一下直接套用</div>
        <div class="presets" id="preset-box">${presetButtons()}</div>
      </div>

      <div class="card panel">
        <div class="panel__head"><div class="section-title">一句话经过</div><div class="tiny" id="body-count">${F.body.length}/140</div></div>
        <textarea class="textarea" maxlength="140" placeholder="发生了什么？比如：转弯时卡刃，坐了个屁股墩，护臀救了我。" oninput="P.inputBody(this.value)">${esc(
          F.body,
        )}</textarea>
        <div class="tiny" style="margin-top:6px">请去掉姓名、电话、证件号、详细住址等可识别信息。</div>
      </div>

      <div class="card panel">
        <div class="panel__head"><div class="section-title">可见范围</div><div class="tiny">不会自动跨群</div></div>
        <div class="toggle-row">
          <div><div class="toggle-row__name">仅自己可见</div><div class="tiny">不会进圈子图鉴，别人打不开</div></div>
          <button class="switch switch--self ${F.selfOnly ? 'on' : ''}" onclick="P.toggleSelfOnly()"></button>
        </div>
        ${F.selfOnly ? '<div class="tiny" style="margin:6px 0 8px;color:#2f6fe0">已选择私密记录；下面的圈子不会生效。</div>' : ''}
        <div style="opacity:${F.selfOnly ? 0.42 : 1}">${groups}</div>
      </div>

      <div class="card panel">
        <div class="panel__head"><div class="section-title">互动设置</div><div class="tiny">随时可改</div></div>
        <div class="toggle-row">
          <div><div class="toggle-row__name">匿名展示</div><div class="tiny">只隐藏昵称</div></div>
          <button class="switch ${F.anonymous ? 'on' : ''}" onclick="P.toggleField('anonymous')"></button>
        </div>
        <div class="toggle-row">
          <div><div class="toggle-row__name">允许搞笑动作</div><div class="tiny">默认关闭；打开后才能「转圈」</div></div>
          <button class="switch ${F.funny ? 'on' : ''}" onclick="P.toggleField('funny')"></button>
        </div>
        <div class="toggle-row">
          <div><div class="toggle-row__name">允许收礼物</div><div class="tiny">免费互动道具</div></div>
          <button class="switch ${F.gifts ? 'on' : ''}" onclick="P.toggleField('gifts')"></button>
        </div>
      </div>

      <div class="footnote">发布即表示这是你本人的经历与描述。摔友记不提供诊断、治疗、康复或理赔结论。</div>
    </div>
    <div class="form-footer"><button class="btn btn--primary btn--block" onclick="P.publish()">发布到圈子</button></div>`;
  }

  /* ------------------------------------------------------------------- group */

  function renderGroup() {
    const group = groupOf(S.groupId);
    const members = (DATA.members[group.id] || [])
      .map(
        (member) => `<div class="item" style="background:transparent;padding:6px 4px">
          <div style="width:34px;height:34px;border-radius:50%;background:#f1f4fd;overflow:hidden;flex:none">${chipHtml(
            member,
            34,
          )}</div>
          <div class="item__main"><div class="item__name">${esc(member.displayName)}${
            member.isMe ? '<span class="story-card__badge" style="margin-left:4px">我</span>' : ''
          }</div><div class="item__meta">${member.storyCount} 条故事</div></div>
          <div style="font-size:10px;color:#c85f14">${member.role === 'owner' ? '圈主' : member.role === 'admin' ? '管理员' : ''}</div>
        </div>`,
      )
      .join('');
    return `<div class="scroll">
      <div class="card panel" style="margin-top:4px">
        <div class="between"><div style="font-size:22px;font-weight:800">${esc(group.name)}</div><span class="pill pill--blue">${
          group.role === 'owner' ? '圈主' : group.role === 'admin' ? '管理员' : '成员'
        }</span></div>
        <div class="tiny" style="margin-top:4px">${group.memberCount} 位雪友 · ${
          group.joinMode === 'open' ? '自由加入' : '需要圈主确认'
        }</div>
        <div class="stats"><div class="mini stat"><div class="stat__num">${(DATA.members[group.id] || []).length}</div><div class="stat__label">成员</div></div><div class="mini stat"><div class="stat__num">${
          (DATA.members[group.id] || []).length
        }</div><div class="stat__label">故事</div></div></div>
      </div>
      <div class="card panel">
        <div class="panel__head"><div class="section-title">圈子成员</div><div class="tiny">按加入顺序</div></div>
        ${members}
      </div>
      <div class="card panel">
        <div class="panel__head"><div class="section-title">邀请雪友</div><div class="tiny">48 小时有效</div></div>
        <button class="btn btn--primary" onclick="P.toast('邀请 token 由服务端生成，前端只拿到 sharePath')">生成邀请</button>
        <div class="tiny" style="margin-top:8px">「圈子」是应用内的受邀群体，不等于微信群全体成员。</div>
      </div>
    </div>`;
  }

  /* ------------------------------------------------------------------- inbox */

  function renderInbox() {
    const events = S.inbox
      .map(
        (event, index) => `<div class="card event ${event.read ? 'read' : ''}" onclick="P.openEvent(${index})">
          <div class="event__emoji">${actionEmoji(event.actionId)}</div>
          <div style="flex:1;min-width:0">
            <div class="event__text"><span class="event__actor">${esc(event.actorName)}</span>${eventText(event)}</div>
            <div class="event__time">${timeText(event.createdAt)} · 点一下回放动画</div>
          </div>
          ${!event.read ? '<div class="event__dot"></div>' : ''}
        </div>`,
      )
      .join('');
    return `<div class="scroll">
      <div class="between" style="padding:4px 2px 0">
        <div><div style="font-size:23px;font-weight:800">消息</div><div class="tiny">谁对你的故事抱了抱、转了圈、送了装备</div></div>
        ${
          S.unread
            ? `<button class="btn btn--ghost" style="height:28px;font-size:11px" onclick="P.markAllRead()">全部已读</button>`
            : ''
        }
      </div>
      <div style="margin-top:14px;display:flex;flex-direction:column;gap:7px">${
        events || '<div class="card panel tiny">还没有互动</div>'
      }</div>
      <div class="footnote">互动只是展示层效果，不会改变对方的角色配置；收到的装备需要本人确认才会穿上。</div>
    </div>`;
  }

  function actionEmoji(actionId) {
    const action = DATA.actions.find((item) => item.id === actionId);
    return action ? action.fallbackEmoji : '💬';
  }

  function eventText(event) {
    if (event.actionId === 'receive_gift') {
      const item = DATA.items.find((entry) => entry.id === event.itemDefId);
      return ` 送你一件「${item ? item.name : '装备'}」`;
    }
    const action = DATA.actions.find((entry) => entry.id === event.actionId);
    return ` ${action ? action.name : '互动'}了你的故事`;
  }

  /* ------------------------------------------------------------------- shell */

  const TITLES = { atlas: '摔友记', story: '故事', avatar: '我的角色', create: '记录一次经历', inbox: '消息', group: '圈子', settings: '设置' };
  const TAB_SCREENS = ['atlas', 'avatar', 'inbox'];

  function render() {
    const app = document.getElementById('app');
    const nav = TITLES[S.screen] || '';
    const back = TAB_SCREENS.indexOf(S.screen) < 0;
    let body = '';
    if (S.screen === 'atlas') body = renderAtlas();
    else if (S.screen === 'story') body = renderStory();
    else if (S.screen === 'avatar') body = renderAvatar();
    else if (S.screen === 'create') body = renderCreate();
    else if (S.screen === 'group') body = renderGroup();
    else if (S.screen === 'inbox') body = renderInbox();
    else body = '<div class="scroll"><div class="card panel">设置页在小程序里，预览暂略。</div></div>';
    app.innerHTML = `<div class="navbar">${back ? `<button class="navbar__back" onclick="P.back()">‹</button>` : ''}${nav}</div>${body}`;
    document.getElementById('tabbar').classList.toggle('hidden', !TAB_SCREENS.includes(S.screen));
    document.querySelectorAll('.tabbar button').forEach((button) => {
      button.classList.toggle('on', button.dataset.screen === S.screen);
    });
    document.querySelectorAll('.toolbar button[data-screen]').forEach((button) => {
      button.classList.toggle('on', button.dataset.screen === S.screen);
    });
  }

  function go(screen) {
    S.screen = screen;
    closeSheet();
    render();
  }

  function back() {
    go('atlas');
  }

  function openSheet(title, content, foot) {
    const mask = document.querySelector('.sheet-mask');
    const sheet = document.querySelector('.sheet');
    sheet.innerHTML = `<div class="sheet__handle"></div><div class="sheet__head"><div class="section-title">${esc(
      title,
    )}</div><div class="tiny">${''}</div></div><div class="sheet__body">${content}</div>${
      foot ? `<div class="sheet__foot">${foot}</div>` : ''
    }`;
    mask.classList.add('on');
    sheet.classList.add('on');
    S.sheetOpen = true;
  }

  function closeSheet() {
    document.querySelector('.sheet-mask').classList.remove('on');
    document.querySelector('.sheet').classList.remove('on');
    S.sheetOpen = false;
  }

  /* ------------------------------------------------------------------ actions */

  const api = {
    go,
    back,
    toast,
    switchGroup() {
      const index = DATA.groups.findIndex((group) => group.id === S.groupId);
      const next = DATA.groups[(index + 1) % DATA.groups.length];
      S.groupId = next.id;
      S.view = 'front';
      render();
    },
    setView(view) {
      S.view = view;
      render();
    },
    openHotspot(id) {
      const atlas = atlasFor(S.groupId, S.view);
      const spot = atlas.hotspots.find((item) => item.id === id);
      const stories = atlas.stories.filter((story) => story.bodyParts.includes(id));
      if (!spot || !stories.length) {
        toast(`${spot ? spot.label : '这个部位'}还没有故事`);
        return;
      }
      openSheet(
        `${spot.label}的故事`,
        stories.map((card) => storyCardHtml(card)).join(''),
      );
    },
    openStory(storyId) {
      S.storyId = storyId;
      closeSheet();
      go('story');
    },
    openEvent(index) {
      const event = S.inbox[index];
      if (!event) return;
      event.read = true;
      S.unread = Math.max(0, S.unread - 1);
      S.storyId = event.storyId;
      go('story');
      if (event.actionId && event.actionId !== 'receive_gift') setTimeout(() => animateStory(event.actionId), 320);
    },
    markAllRead() {
      S.inbox.forEach((event) => (event.read = true));
      S.unread = 0;
      render();
      toast('都看完啦');
    },
    react(actionId) {
      const detail = detailOf(S.storyId);
      if (!detail) return;
      if (detail.story && detail.story.visibility === 'self') return toast('仅自己可见的故事不能互动');
      if (detail.viewerIsAuthor) return toast('不能给自己的故事做互动');
      const action = DATA.actions.find((item) => item.id === actionId);
      if (!action) return;
      if (action.requiresFunnyConsent && !detail.canSpin) return toast('作者关闭了这个搞笑动作');
      const usedTotal = (detail.myReactions || []).reduce((sum, item) => sum + (item.mine || 0), 0);
      if (usedTotal >= 3) return toast('今天对这条故事的互动次数用完了');
      const mine = (detail.myReactions || []).find((item) => item.actionId === actionId);
      if (!mine) return;
      mine.mine += 1;
      const total = (detail.reactions || []).find((item) => item.actionId === actionId);
      if (total) total.count += 1;
      render();
      setTimeout(() => animateStory(actionId), 20);
    },
    openGift() {
      const detail = detailOf(S.storyId);
      if (!detail) return;
      if (detail.viewerIsAuthor) return toast('不能给自己送装备');
      if (!detail.giftable) return toast('作者暂时不收礼物');
      const items = S.inventory.filter((item) => item.category === 'consumable' && item.quantity > 0);
      if (!items.length) return toast('背包里还没有可以送出的道具');
      if (!S.selectedGift || !items.some((item) => item.itemDefId === S.selectedGift)) {
        S.selectedGift = items[0].itemDefId;
      }
      openSheet(
        '送一件装备',
        items
          .map(
            (item) => `<div class="item ${S.selectedGift === item.itemDefId ? 'on' : ''}" onclick="P.selectGift('${
              item.itemDefId
            }')">
              <div class="item__icon">${ART.items[item.itemDefId] || ''}</div>
              <div class="item__main"><div class="item__name">${esc(item.name)}</div><div class="item__meta">${item.expiresText}</div></div>
              <div class="item__qty">×${item.quantity}</div>
            </div>`,
          )
          .join(''),
        `<button class="btn btn--primary btn--block" onclick="P.sendGift()">送出去</button>`,
      );
    },
    selectGift(itemDefId) {
      S.selectedGift = itemDefId;
      api.openGift();
    },
    sendGift() {
      const item = S.inventory.find((entry) => entry.itemDefId === S.selectedGift);
      if (!item || item.quantity <= 0) return toast('这件道具没有库存了');
      item.quantity -= 1;
      closeSheet();
      render();
      setTimeout(() => animateStory('receive_gift'), 20);
      toast('送到啦');
    },
    setExpression(expression) {
      S.me.expression = expression;
      render();
    },
    setPalette(palette) {
      S.me.palette = palette;
      render();
    },
    equip(slot, value) {
      S.me.equipped = Object.assign({}, S.me.equipped, { [slot]: value || null });
      render();
    },
    toggleGear(slot, value) {
      S.me.equipped = Object.assign({}, S.me.equipped, { [slot]: S.me.equipped[slot] ? null : value });
      render();
    },
    claimWeekly() {
      if (S.weeklyClaimed) return toast('本周补给已经领过啦');
      S.weeklyClaimed = true;
      const cocoa = S.inventory.find((item) => item.itemDefId === 'hot_cocoa');
      if (cocoa) cocoa.quantity += 1;
      const patch = S.inventory.find((item) => item.itemDefId === 'comfort_patch');
      if (patch) patch.quantity += 1;
      render();
      toast('本周补给已到账');
    },
    toggleForm(kind, id, element) {
      const F = S.form;
      if (kind === 'sport' || kind === 'impactKind') {
        if (kind === 'sport') F.sport = id;
        else F.impactKind = id;
        document.querySelectorAll(`.chip[data-chip-kind="${kind}"]`).forEach((node) => node.classList.remove('on'));
        element.classList.add('on');
        return;
      }
      const list = F[kind];
      const index = list.indexOf(id);
      if (index >= 0) list.splice(index, 1);
      else {
        if (list.length >= 3 && ['scenario', 'cause', 'bodyParts'].includes(kind)) return toast('最多选 3 个');
        list.push(id);
      }
      element.classList.toggle('on');
      if (kind === 'bodyParts') refreshPresets();
    },
    toggleGroup(groupId) {
      if (S.form.selfOnly) return toast('已选择仅自己可见，圈子不会生效');
      const list = S.form.groups;
      const index = list.indexOf(groupId);
      if (index >= 0) list.splice(index, 1);
      else list.push(groupId);
      const rows = document.querySelectorAll('.group-row');
      for (const row of rows) {
        if (row.getAttribute('onclick') && row.getAttribute('onclick').indexOf(`'${groupId}'`) >= 0) {
          const box = row.querySelector('.checkbox');
          if (box) box.classList.toggle('on', list.indexOf(groupId) >= 0);
        }
      }
    },
    toggleField(field) {
      S.form[field] = !S.form[field];
      const rows = document.querySelectorAll('.toggle-row .switch:not(.switch--self)');
      // 三个开关按顺序：匿名 / 搞笑 / 礼物
      const order = ['anonymous', 'funny', 'gifts'];
      const index = order.indexOf(field);
      if (index >= 0 && rows[index]) rows[index].classList.toggle('on', S.form[field]);
    },
    toggleSelfOnly() {
      S.form.selfOnly = !S.form.selfOnly;
      render();
    },
    inputTitle(value) {
      S.form.title = value;
      const count = document.getElementById('title-count');
      if (count) count.textContent = `${value.length}/24`;
    },
    inputBody(value) {
      S.form.body = value;
      const count = document.getElementById('body-count');
      if (count) count.textContent = `${value.length}/140`;
    },
    usePreset(title) {
      S.form.title = title;
      const input = document.querySelector('input.input');
      if (input) input.value = title;
      const count = document.getElementById('title-count');
      if (count) count.textContent = `${title.length}/24`;
    },
    publish() {
      const F = S.form;
      if (!F.title.trim()) return toast('先起个标题吧');
      if (!F.body.trim()) return toast('写一句当时的经过');
      if (!F.bodyParts.length) return toast('选一下身体部位');
      if (!F.scenario.length) return toast('选一下发生背景');
      if (!F.cause.length) return toast('选一下原因，或选「原因未知」');
      if (!F.selfOnly && !F.groups.length) return toast('至少选择一个可见圈子，或选择「仅自己可见」');
      const storyId = `sty_preview_${Date.now()}`;
      const authorId = F.anonymous ? `anon_${storyId}` : 'usr_me';
      const now = new Date().toISOString();
      const incident = {
        id: `inc_${storyId}`,
        authorId,
        sport: F.sport,
        scenario: F.scenario.slice(),
        selfReportedCause: F.cause.slice(),
        bodyParts: F.bodyParts.slice(),
        impactKind: F.impactKind,
        protectiveItems: F.protectiveItems.slice(),
        source: 'manual',
      };
      const story = {
        id: storyId,
        authorId,
        title: F.title.trim(),
        body: F.body.trim(),
        isAnonymous: F.anonymous,
        visibility: F.selfOnly ? 'self' : 'groups',
        allowFunnyActions: F.funny,
        allowGifts: F.gifts,
        visibilityGroupIds: F.selfOnly ? [] : F.groups.slice(),
        createdAt: now,
      };
      const groupIds = F.selfOnly ? [] : F.groups.slice();
      const group = groupIds.length ? groupOf(groupIds[0]) : null;
      const avatar = JSON.parse(JSON.stringify(S.me));
      if (F.anonymous) {
        avatar.id = `avt_${authorId}`;
        avatar.ownerId = authorId;
      }
      const detail = {
        story,
        incident,
        author: { id: authorId, displayName: F.anonymous ? '匿名雪友' : '小北', palette: S.me.palette, isMe: true },
        avatar,
        updates: [],
        reactions: DATA.actions
          .filter((action) => action.id !== 'receive_gift')
          .map((action) => ({ actionId: action.id, count: 0, mine: 0 })),
        myReactions: DATA.actions
          .filter((action) => action.id !== 'receive_gift')
          .map((action) => ({ actionId: action.id, count: 0, mine: 0 })),
        giftable: false,
        canSpin: false,
        group,
        canInteract: !F.selfOnly,
        viewerIsAuthor: true,
      };
      const card = {
        id: storyId,
        title: story.title,
        authorId,
        authorName: F.anonymous ? '匿名雪友' : '小北',
        isAnonymous: F.anonymous,
        sport: F.sport,
        bodyParts: F.bodyParts,
        impactKind: F.impactKind,
        tone: F.tone,
        visibility: story.visibility,
        allowFunnyActions: F.funny,
        allowGifts: F.gifts,
        publishStatus: 'published',
        createdAt: now,
        palette: S.me.palette,
        expression: S.me.expression,
        equipped: JSON.parse(JSON.stringify(S.me.equipped)),
      };
      S.publishedDetails[storyId] = detail;
      S.published.push({ groupIds, detail, card });
      S.storyId = storyId;
      if (groupIds.length) S.groupId = groupIds[0];
      S.screen = 'story';
      render();
      toast('发布成功');
    },
  };

  function animateStory(actionId) {
    const stage = document.getElementById('story-stage');
    if (!stage) return;
    const rig = stage.querySelector('.story-stage__rig .rig');
    if (!rig) return;
    const classes = { spin: 'rig--spin', hug: 'rig--hug', cheer: 'rig--cheer', receive_gift: 'rig--gift' };
    const emojis = { spin: '😵‍💫', hug: '💗', cheer: '🎉', receive_gift: '🎁' };
    rig.classList.add(classes[actionId] || '');
    if (actionId === 'hug') stage.classList.add('hug');
    const fx = document.createElement('div');
    fx.className = 'fx';
    fx.textContent = emojis[actionId] || '';
    stage.appendChild(fx);
    setTimeout(() => {
      rig.classList.remove(classes[actionId] || '');
      stage.classList.remove('hug');
      if (fx.parentNode) fx.parentNode.removeChild(fx);
    }, 1600);
  }

  window.P = api;
  window.PREVIEW_STATE = S;

  document.querySelectorAll('.toolbar button[data-screen]').forEach((button) => {
    button.addEventListener('click', () => go(button.dataset.screen));
  });
  document.querySelectorAll('.tabbar button').forEach((button) => {
    button.addEventListener('click', () => go(button.dataset.screen));
  });
  document.querySelector('.sheet-mask').addEventListener('click', closeSheet);

  // 初始化 tabbar 图标
  document.querySelectorAll('.tabbar button').forEach((button) => {
    const screen = button.dataset.screen;
    const icon = button.querySelector('.icon');
    if (icon && TABBAR && TABBAR[screen]) {
      icon.innerHTML = `<span class="normal">${TABBAR[screen].normal}</span><span class="active">${TABBAR[screen].active}</span>`;
    }
  });

  const params = new URLSearchParams(location.search);
  const initial = params.get('screen') || (location.hash || '').replace('#', '');
  if (TITLES[initial]) S.screen = initial;
  if (params.get('full')) document.body.classList.add('full-mode');

  render();

  const scrollTop = Number(params.get('scroll') || 0);
  if (scrollTop > 0) {
    const scroller = document.querySelector('.scroll');
    if (scroller) scroller.scrollTop = scrollTop;
  }
})();
