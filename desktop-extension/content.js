(function () {
  'use strict';

  // 页面真实 window（油猴沙盒模式下用 unsafeWindow，扩展 MAIN 世界即 window 本身）
  const PW = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;

  const YK_BUILD = '1.24.1';
  if (PW.__YK_CRM_HELPER__) {
    // 插件版和油猴版都跑在页面 MAIN world，谁先加载谁干活，后到的必须退出——
    // 以前这里是静默 return，于是"我改了怎么没生效"根本查不出是被另一份（旧版本）占了坑。
    // 现在两边都报版本号：控制台一眼能看出当前在跑的是哪一份、哪一份没起来。
    console.warn('[云客助手] 已有一份在跑（版本 ' + (PW.__YK_HELPER_VERSION__ || '未知') + '），本份 v' + YK_BUILD + ' 不启动。'
      + '想让本份接管：停用扩展或删掉油猴里那份旧的，然后刷新页面。');
    return;
  }
  PW.__YK_CRM_HELPER__ = true;
  PW.__YK_HELPER_VERSION__ = YK_BUILD;

  const YK_STATUS_DEFAULT = {
    phoneCustomer: '等待手机通话', crmCustomer: '等待通话', match: '等待手机号码',
    event: '暂无新事件', eventAt: 0, progress: '待命', outcome: '',
    owner: '手机 APK 实际挂断；扩展只同步 CRM 和提交跟进，不向手机下挂断指令',
  };
  function ykStatusUpdate(patch) {
    try {
      const state = PW.__YK_STATUS_STATE__ || Object.assign({}, YK_STATUS_DEFAULT);
      Object.assign(state, patch || {});
      state.updatedAt = Date.now();
      PW.__YK_STATUS_STATE__ = state;
      if (typeof PW.__YK_STATUS_RENDER__ === 'function') PW.__YK_STATUS_RENDER__(state);
    } catch (e) {}
  }

  // 调试开关：控制台执行 __YK_DEBUG__ = true 可看详细定位日志
  let DEBUG = false;

  // ============================================================
  // 工具函数
  // ============================================================
  function $$(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

  // ============================================================
  // 后台标签页防降速：Chrome 会把隐藏标签页的 setTimeout/setInterval
  // 强制降频（隐藏超 5 分钟最狠降到 1 分钟一次），导致切走窗口后
  // 联动轮询、流程步骤全都变得巨慢。Web Worker 不受后台节流影响，
  // 所以把计时统一搬进 Worker；Worker 创建失败（如 CSP 拦截）则退回原生定时器。
  // ============================================================
  const tickSleeps = [];   // 等待中的 sleep {at, resolve}
  const wTasks = [];       // 周期任务 {every, last, fn}
  // [v1.18.7] 计时器到底跑在哪，要能被外面看见：云客页面的 CSP 经常禁 blob: 的 Worker，
  // 一旦创建失败就静默退回原生 setInterval，切到别的窗口后会被 Chrome 降频到 1 秒～1 分钟一次，
  // 表现就是"不在云客页面时它不干活"。workerMode 记下来，随挂断署名一起上报到中转。
  let workerMode = 'na';
  const workerTicks = (() => {
    const mk = (url) => {
      const w = new Worker(url);
      w.onmessage = () => {
        const now = performance.now();
        for (let i = tickSleeps.length - 1; i >= 0; i--) {
          if (tickSleeps[i].at <= now) {
            const r = tickSleeps[i].resolve;
            tickSleeps.splice(i, 1);
            r();
          }
        }
        for (let i = 0; i < wTasks.length; i++) {
          const t = wTasks[i];
          if (now - t.last >= t.every) { t.last = now; try { t.fn(); } catch (e) {} }
        }
      };
      w.onerror = () => { workerMode = 'na'; };
      return w;
    };
    try {
      const src = 'setInterval(function(){postMessage(0)},50);';
      const url = URL.createObjectURL(new Blob([src], { type: 'application/javascript' }));
      const w = mk(url);
      workerMode = 'blob';
      return w;
    } catch (e) { return null; }
  })();
  const sleep = (ms) => {
    // 一律走 Worker：隐藏标签页里原生 setTimeout 被 Chrome 降频到最低 1 秒一次，
    // 30/50ms 的轮询间隔会全部退化成 1 秒，流程在后台跑起来一卡一卡
    if (workerTicks) {
      return new Promise((resolve) => { tickSleeps.push({ at: performance.now() + ms, resolve }); });
    }
    return new Promise((r) => setTimeout(r, ms));
  };
  function workerEvery(every, fn) {
    if (workerTicks) { wTasks.push({ every, last: 0, fn }); return; }
    setInterval(fn, every);
  }

  // 同一 CRM 域名下的多个客户页签共用事件/待补录队列；用浏览器跨页签锁串行消费，避免两个页签抢同一通。
  function withEventLock(task) {
    try {
      if (navigator.locks && typeof navigator.locks.request === 'function') {
        return navigator.locks.request('yk-crm-hangup-event-v1', { mode: 'exclusive', ifAvailable: true }, (lock) =>
          lock ? task() : undefined
        );
      }
    } catch (e) {}
    return Promise.resolve().then(task);
  }

  // ============================================================
  // 防冻结保活：Chrome 会把隐藏超过 5 分钟的标签页整体冻结
  // （主线程和 Worker 全部暂停，轮询和联动流程彻底停摆）。
  // 正在「播放音频」或「使用 WebRTC」的标签页永远不会被冻结，
  // 所以起一个回环 RTCDataChannel + 静音音频循环，让 CRM 标签页
  // 即使永远藏在后台，脚本也能照常跑完整个跟进流程。
  // ============================================================
  (function keepAlive() {
    // 1) 回环 WebRTC：本页两个 PeerConnection 互连，DataChannel 保持打开
    try {
      const pc1 = new RTCPeerConnection();
      const pc2 = new RTCPeerConnection();
      pc1.onicecandidate = (e) => { if (e.candidate) pc2.addIceCandidate(e.candidate).catch(() => {}); };
      pc2.onicecandidate = (e) => { if (e.candidate) pc1.addIceCandidate(e.candidate).catch(() => {}); };
      pc1.createDataChannel('yk-keepalive');
      pc1.createOffer()
        .then((o) => pc1.setLocalDescription(o))
        .then(() => pc2.setRemoteDescription(pc1.localDescription))
        .then(() => pc2.createAnswer())
        .then((a) => pc2.setLocalDescription(a))
        .then(() => pc1.setRemoteDescription(pc2.localDescription))
        .catch(() => {});
    } catch (e) {}
    // 2) 静音音频循环（静音 autoplay 通常免手势允许；被拒就等首次点击再试）
    const tryAudio = () => {
      try {
        const au = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAIlYAAESsAAACABAAZGF0YQAAAAA=');
        au.loop = true;
        au.muted = true;
        au.volume = 0;
        const p = au.play();
        if (p && p.catch) p.catch(() => {});
      } catch (e) {}
    };
    tryAudio();
    window.addEventListener('pointerdown', tryAudio, { once: true });
  })();

  function normalizeText(text) { return (text || '').replace(/\s+/g, '').trim(); }

  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      parseFloat(style.opacity || '1') > 0 &&
      style.pointerEvents !== 'none' &&
      el.getClientRects().length > 0;
  }

  function isDisabled(el) {
    let cur = el;
    for (let i = 0; i < 4 && cur; i++) {
      if (cur.disabled || cur.getAttribute && cur.getAttribute('aria-disabled') === 'true') return true;
      if (cur.classList && /disabled|is-disabled/.test(cur.className.toString())) return true;
      cur = cur.parentElement;
    }
    return false;
  }

  // 两级文本匹配：先精确相等，找不到再退回"包含"匹配
  function findClickablesByText(text) {
    const wanted = normalizeText(text);
    if (!wanted) return [];
    const exact = [], partial = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    let node;
    while ((node = walker.nextNode())) {
      const el = node;
      // 先用 textContent 做便宜的候选筛选。旧逻辑对页面里的每个节点都读
      // innerText + getComputedStyle + getClientRects；在 CRM 大列表里反复全页扫描
      // 会触发大量布局计算，流程每找一个选项就可能白等近 1 秒。
      const raw = normalizeText(el.textContent);
      if (!raw || (raw !== wanted && !(raw.includes(wanted) && raw.length <= wanted.length + 6))) continue;
      if (!isVisible(el) || isDisabled(el)) continue;
      // 候选才读 innerText，确保最后仍按屏幕上实际显示的文字匹配。
      const own = normalizeText(el.innerText || raw);
      if (!own) continue;
      if (own === wanted) exact.push(el);
      else if (own.includes(wanted) && own.length <= wanted.length + 6) partial.push(el);
    }
    const clean = (list) => list.filter((el) => {
      if (el.tagName === 'INPUT' && /^(checkbox|radio)$/i.test(el.type)) return false;
      if (el.querySelector && el.querySelector('input[type="checkbox"],input[type="radio"]')) return false;
      if (el.querySelector && el.querySelector('button, [role="button"], .btn, .ant-btn')) return false;
      // 排除脚本自己的浮层面板，避免匹配到自己
      if (el.closest && el.closest('#yk_helper_panel, #yk_helper_fab, #yk_helper_toast')) return false;
      return true;
    });
    const ce = clean(exact), cp = clean(partial);
    if (DEBUG) console.log('[跟进助手] 找「' + text + '」精确', ce.length, '个 / 模糊', cp.length, '个');
    return ce.length ? ce : cp;
  }

  function hasVisibleText(text) { return findClickablesByText(text).length > 0; }

  // 普通点击
  function clickElement(el) {
    if (!el || !el.isConnected || !isVisible(el)) return false;
    try {
      // 先滚进可视区（含横向滚动容器里的溢出 tab，如"..."后面的"未接通"）
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      el.click();
      return true;
    } catch (e) {
      console.warn('[跟进助手] 点击失败', e);
      return false;
    }
  }

  // 强化点击：完整鼠标事件序列（pointerdown/mousedown/.../click），对付普通 click 无响应的组件
  function realClick(el) {
    if (!el || !el.isConnected) return false;
    try {
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      const r = el.getBoundingClientRect();
      const opts = { bubbles: true, cancelable: true, view: window, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
      const PD = window.PointerEvent || MouseEvent;
      el.dispatchEvent(new PD('pointerdown', opts));
      el.dispatchEvent(new MouseEvent('mousedown', opts));
      el.dispatchEvent(new PD('pointerup', opts));
      el.dispatchEvent(new MouseEvent('mouseup', opts));
      el.click();
      return true;
    } catch (e) {
      try { el.click(); return true; } catch (e2) { return false; }
    }
  }

  async function waitUntil(test, timeout = 5000, interval = 50) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try { if (test()) return true; } catch (e) {}
      await sleep(interval);
    }
    return false;
  }

  async function waitForText(text, timeout = 5000, interval = 50) {
    return waitUntil(() => hasVisibleText(text), timeout, interval);
  }

  // 就近等待：等到 text 元素与 parentText 元素出现在同一个小面板内（共同祖先面积小于视口的25%）。
  // 历史记录里的同名文字与父 tab 的共同祖先巨大，永远不满足 —— 避免被历史文字骗到提前点击。
  function waitForNearChild(text, parentText, timeout = 3000, interval = 50) {
    return waitUntil(() => {
      const parents = findClickablesByText(parentText);
      if (!parents.length) return false;
      const kids = findClickablesByText(text);
      for (const k of kids) {
        for (const p of parents) {
          const ca = commonAncestor(k, p);
          if (ca && elArea(ca) < window.innerWidth * window.innerHeight * 0.25) return true;
        }
      }
      return false;
    }, timeout, interval);
  }

  // [v1.17.3] 可见的"结果 tab"锚点。只认长得像 tab 的候选（有 pointer/role=tab），
  // 右栏跟进记录/通话列表里的同名静态文字不再进来污染共同祖先
  function tabAnchorEls() {
    const all = [], inter = [];
    for (const t of TOP_TABS) {
      const els = findClickablesByText(t);
      if (!els.length) continue;
      all.push(pickSmallest(els));
      const ie = els.filter(isInteractiveLike);
      if (ie.length) inter.push(pickSmallest(ie));
    }
    return inter.length >= 2 ? inter : all;
  }

  // 结果 tab 条的并集矩形面积：所有"就近"判定的基准尺度
  function tabStripArea(anchors) {
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    anchors.forEach((a) => {
      const r = a.getBoundingClientRect();
      if (r.left < x1) x1 = r.left;
      if (r.top < y1) y1 = r.top;
      if (r.right > x2) x2 = r.right;
      if (r.bottom > y2) y2 = r.bottom;
    });
    if (!(x2 > x1) || !(y2 > y1)) return 0;
    return (x2 - x1) * (y2 - y1);
  }

  // 元素是否和某个可见结果 tab"住在同一个窄容器里"。
  // [v1.17.3] 判据改成相对倍数（共同祖先面积 ≤ tab 条并集的 12 倍）：只看视口比例时，
  // 页面容器一矮，工具栏的「更多」、客户名后面的省略号就混进来了（实测会连点 4 个错按钮）。
  function sharesTabStrip(el, anchors, strip) {
    const cap = Math.max(strip * 12, 40000);
    const view = window.innerWidth * window.innerHeight * 0.4;
    return anchors.some((a) => {
      const ca = commonAncestor(el, a);
      if (!ca) return false;
      const area = elArea(ca);
      return area <= cap && (!view || area <= view);
    });
  }

  // [v9.9 保留] 圈面板：判定优先走 sharesTabStrip，这里只作为第二道兜底和诊断输出
  function findResultPanel() {
    try {
      const anchors = tabAnchorEls();
      if (anchors.length < 2) return null;
      let ca = anchors[0];
      for (let i = 1; i < anchors.length; i++) {
        ca = commonAncestor(ca, anchors[i]);
        if (!ca) return null;
      }
      if (ca === document.body || elArea(ca) > window.innerWidth * window.innerHeight * 0.9) return null;
      return ca;
    } catch (e) { return null; }
  }

  // 是否挂在浮层里（下拉/popover/menu portal 到 body 末尾那类）
  function inPopupLayer(el) {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const cls = String(n.className || '');
      const role = n.getAttribute && n.getAttribute('role');
      if (role === 'menu' || role === 'menuitem' || role === 'listbox' || role === 'option') return true;
      if (/dropdown|popup|popover|overlay/i.test(cls)) {
        const r = n.getBoundingClientRect();
        if (r.width > 0 && r.width * r.height < window.innerWidth * window.innerHeight * 0.35) return true;
      }
    }
    return false;
  }

  // [v1.9.9] 目标文字是否"真的在结果区里可见"——全页同名历史文字一律不算数
  // [v1.17.3] 认三种落点：tab 条同一窄容器内 / 结果面板内 / portal 出去的浮层菜单内
  function panelHasVisibleText(text) {
    const els = findClickablesByText(text);
    if (!els.length) return false;
    const anchors = tabAnchorEls();
    const strip = tabStripArea(anchors);
    if (anchors.length && els.some((el) => sharesTabStrip(el, anchors, strip))) return true;
    const panel = findResultPanel();
    if (panel && els.some((el) => panel.contains(el))) return true;
    if (els.some((el) => isInteractiveLike(el) && inPopupLayer(el))) return true;
    return anchors.length < 2; // 一条 tab 都圈不出来时退回全页判定（老行为）
  }

  // 文字是否出现在页面 DOM 里（含被隐藏/折叠的节点）——用来区分"页面真没这项"和"藏起来了没展开"
  // 跳过脚本自己的浮层（面板/快捷菜单上就写着「未接通」），也跳过 script/style 里的源码字符串
  // ——CRM 打包 JS 里常有这些文案，否则"页面根本没有"会被误判成"有但没展开出来"
  function textExistsAnywhere(text) {
    const wanted = normalizeText(text);
    if (!wanted) return false;
    try {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode(n) {
          const p = n.parentElement;
          if (!p) return NodeFilter.FILTER_REJECT;
          if (p.closest('script, style, template, noscript, #yk_helper_panel, #yk_helper_fab, #yk_helper_toast, #yk_helper_ring')) {
            return NodeFilter.FILTER_REJECT;
          }
          return normalizeText(n.data).includes(wanted) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
        },
      });
      return walker.nextNode() !== null;
    } catch (e) { return false; }
  }

  // ==== [v1.18.2] 联动前「手机↔电脑对齐」：把手机那通客户的页签切到前台 ====
  // 云客每个客户一个页签，连续拨打时页面早就翻到下一通了，联动却还在当前页点，
  // 于是"手机打的是 A、电脑标的是 B"。这里用手机上报的号码查到拨号那一刻抓到的
  // 客户身份（ykCallCtx：姓名 + 回拨线路换算出的真实号），按姓名优先、号码后四位兜底，
  // v1.20.1 起必须唯一匹配客户页签，或在当前详情中核对精确手机号；否则停止，防止写错客户。
  function callTabKeys(name, phone) {
    const keys = [];
    const nm = normalizeText(name || '');
    if (nm.length >= 2 && nm.length <= 12 && !/\d{4,}/.test(nm)) keys.push(nm);
    const ph = String(phone || '').replace(/[^\d]/g, '');
    if (ph.length >= 7) keys.push(ph.slice(-4));
    return keys;
  }

  function tabHeaderEls() {
    let list = [];
    try {
      // 溢出折叠时真正的页签被 antd 搬进下拉菜单，菜单项也要认
      list = [].slice.call(document.querySelectorAll(
        '.ant-tabs-tab, .ant-tabs-tab-btn, [role="tab"], .tabs-tab, .ant-tabs-dropdown-menu-item'
      ));
    } catch (e) { return []; }
    return list.filter((el) => el && isVisible(el));
  }

  function isTabActive(el) {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      if (n.getAttribute && n.getAttribute('aria-selected') === 'true') return true;
      if (/ant-tabs-tab-active|tab-active|active/.test(String(n.className || ''))) return true;
      if (n.classList && n.classList.contains('ant-tabs-tab')) break;
    }
    return false;
  }

  // 页签标题（antd 会把完整标题放在 title 属性里，文字被省略号截断时靠它）
  function matchCallTab(keys) {
    const tabs = tabHeaderEls();
    const unique = new Map();
    for (const el of tabs) {
      if (el.closest && el.closest('#yk_helper_panel, #yk_helper_fab, #yk_helper_toast, #yk_helper_ring, #yk_call_dot')) continue;
      const root = (el.closest && el.closest('.ant-tabs-tab, [role="tab"], .tabs-tab, .ant-tabs-dropdown-menu-item')) || el;
      if (unique.has(root)) continue;
      const title = root.getAttribute ? normalizeText(root.getAttribute('title') || '') : '';
      const txt = normalizeText(root.innerText || root.textContent || '');
      const hay = title + '|' + txt;
      if (!hay || hay.length > 80) continue;
      unique.set(root, { el: root, hay, label: (txt || title).slice(0, 24) });
    }
    // 姓名优先；号码只用末四位兜底。每个候选键必须只命中一个不同页签；
    // 若姓名与号码各自唯一命中不同页签，视为身份冲突，不猜测。
    const uniqueMatches = [];
    for (const k of keys) {
      if (!k) continue;
      const matches = Array.from(unique.values()).filter((x) => x.hay.indexOf(k) >= 0);
      if (matches.length === 1) uniqueMatches.push({ ...matches[0], key: k });
    }
    const distinct = Array.from(new Set(uniqueMatches.map((x) => x.el)));
    if (distinct.length !== 1) return null;
    const picked = uniqueMatches[0];
    return { el: picked.el, key: picked.key, label: picked.label };
  }

  // CRM 有时把客户放在右侧「客户详情」抽屉，而不是客户页签里。
  // 手机号在该详情区精确一致时，当前页本身就是已确认的客户上下文。
  // CRM 名称可能是别名/重复档案名，号码精确一致优先于姓名差异。
  function currentCustomerDetailMatches(name, phone) {
    const expected = String(phone || '').replace(/\D/g, '');
    if (expected.length < 7) return false;
    const variants = new Set([expected]);
    if (expected.startsWith('86') && expected.length === 13) variants.add(expected.slice(2));
    const areaLimit = window.innerWidth * window.innerHeight * 0.65;
    const anchors = findClickablesByText('客户详情').concat(findClickablesByText('手机号'));
    const seen = new Set();
    for (const anchor of anchors) {
      for (let cur = anchor, depth = 0; cur && depth < 8; cur = cur.parentElement, depth++) {
        if (seen.has(cur) || !isVisible(cur)) continue;
        seen.add(cur);
        const area = elArea(cur);
        if (!area || area > areaLimit) continue;
        const text = normalizeText(cur.innerText || cur.textContent || '');
        if (!text.includes('客户详情') && !text.includes('手机号')) continue;
        const shown = text.match(/\d{7,15}/g) || [];
        if (!shown.some((n) => variants.has(n))) continue;
        return true;
      }
    }
    return false;
  }

  // 页签太多时后面的被折进 "..." （ant-tabs-nav-more），展开一次再找
  // [v1.19.5] 只允许展开「客户页签条」的折叠按钮：结果区那条 tab 条也有一个 "..."（里面是
  // 有意向/无意向…），上一版不区分，联动时顺手把结果下拉菜单点开了，还白等一秒多。
  function expandCollapsedTabStrip() {
    const cands = [].slice.call(document.querySelectorAll('.ant-tabs-nav-more, .ant-tabs-extra-content'))
      .filter((el) => isVisible(el));
    for (const more of cands) {
      let strip = more;
      for (let up = 0; up < 5 && strip; up++) {
        strip = strip.parentElement;
        if (strip && strip.querySelector && strip.querySelector('.ant-tabs-tab, [role="tab"]')) break;
      }
      if (!strip) continue;
      const labels = [].slice.call(strip.querySelectorAll('.ant-tabs-tab, [role="tab"]'))
        .map((el) => normalizeText(el.innerText || el.textContent || ''));
      if (labels.some((t) => TOP_TABS.indexOf(t) >= 0)) continue; // 结果 tab 条，跳过
      try { return realClick(more); } catch (e) {}
    }
    return false;
  }

  async function switchToCallTab(name, phone) {
    try {
      if (currentCustomerDetailMatches(name, phone)) {
        ykStatusUpdate({ match: '✅ 右侧详情手机号一致', crmCustomer: name || String(phone || '') });
        try { if (typeof PW.__YK_STATUS_REFRESH_IDENTITY__ === 'function') PW.__YK_STATUS_REFRESH_IDENTITY__(true); } catch (e) {}
        return '当前客户详情';
      }
      const keys = callTabKeys(name, phone);
      if (!keys.length) {
        ykStatusUpdate({ match: '⚠ 手机状态缺少可核对的姓名或号码' });
        return null;
      }
      // [v1.19.5] 提速：上一版找不到人也要走满「300ms 扫描 + 展开折叠区 1200ms + 激活等待 1500ms」，
      // 而云客页签标题里通常只有姓名没有号码，等于每次联动都白等 ~1.5 秒（实测手机结束→CRM页面同步 2.3s）。
      // 现在：先立刻扫一次；只有拿到姓名（强身份）才值得去展开折叠区；激活等待压到 500ms。
      let found = matchCallTab(keys);
      if (!found) {
        await waitUntil(() => { found = matchCallTab(keys); return !!found; }, 150, 60);
      }
      if (!found && name && expandCollapsedTabStrip()) {
        await waitUntil(() => { found = matchCallTab(keys); return !!found; }, 800, 60);
      }
      if (!found) {
        ykStatusUpdate({ match: '⚠ 没找到唯一对应的 CRM 客户页签' });
        return null;
      }
      const evidence = found.key && String(phone || '').replace(/\D/g, '').slice(-4) === found.key
        ? '号码尾号匹配' : '姓名页签唯一匹配';
      if (isTabActive(found.el)) {
        ykStatusUpdate({ match: '✅ ' + evidence, crmCustomer: found.label || name || '' });
        try { if (typeof PW.__YK_STATUS_REFRESH_IDENTITY__ === 'function') PW.__YK_STATUS_REFRESH_IDENTITY__(true); } catch (e) {}
        return found.label;
      }
      const target = getClickableAncestor(found.el) || found.el;
      if (!realClick(target)) {
        ykStatusUpdate({ match: '⚠ 找到「' + (found.label || name || '客户') + '」页签，但切换失败' });
        return null;
      }
      const el = found.el;
      const activated = await waitUntil(() => isTabActive(el) || isTabActive(target), 500, 40);
      if (!activated) {
        ykStatusUpdate({ match: '⚠ 找到「' + (found.label || name || '客户') + '」页签，但尚未切换成功' });
        return null;
      }
      ykStatusUpdate({ match: '✅ 已切换到' + evidence + '的「' + (found.label || name || '客户') + '」', crmCustomer: found.label || name || '' });
      try { if (typeof PW.__YK_STATUS_REFRESH_IDENTITY__ === 'function') PW.__YK_STATUS_REFRESH_IDENTITY__(true); } catch (e) {}
      return found.label;
    } catch (e) { return null; }
  }

  function getClickableAncestor(el) {
    let cur = el;
    for (let i = 0; i < 4 && cur; i++) {
      if (cur.tagName === 'BUTTON' || cur.getAttribute && cur.getAttribute('role') === 'button') return cur;
      if (cur.classList && (cur.classList.contains('btn') || cur.classList.contains('ant-btn'))) return cur;
      const cs = window.getComputedStyle(cur);
      if (cs.cursor === 'pointer' && i > 0) return cur;
      cur = cur.parentElement;
    }
    return el;
  }

  function commonAncestor(a, b) {
    if (!a || !b) return null;
    const ancestors = new Set();
    for (let n = a; n; n = n.parentElement) ancestors.add(n);
    for (let n = b; n; n = n.parentElement) if (ancestors.has(n)) return n;
    return null;
  }

  function elArea(el) {
    const r = el.getBoundingClientRect();
    return r.width * r.height;
  }

  function pickSmallest(els) {
    if (!els || !els.length) return null;
    return els.slice().sort((a, b) => elArea(a) - elArea(b))[0];
  }

  function isElementSelected(el) {
    if (!el) return false;
    const cls = (el.className || '').toString();
    if (/active|selected|checked|is-active|is-selected|ant-btn-primary/i.test(cls)) return true;
    if (el.getAttribute('aria-selected') === 'true' || el.getAttribute('aria-pressed') === 'true' || el.getAttribute('aria-checked') === 'true') return true;
    return false;
  }

  // ============================================================
  // 定位：完全基于 DOM 结构，不依赖屏幕坐标
  // ============================================================
  // 顶层结果 tab：用"同栏兄弟 tab"锚定，避免点历史记录里的同名文字
  // [v1.9.9] 未明确 也按父 tab 定位：与有意向/无意向等互为兄弟打分，
  // 不再被左侧通话列表/跟进记录里的同名历史文字带偏
  const TOP_TABS = ['有意向', '无意向', '资料错误', '二次呼叫', '未明确', '未接通'];

  // 判断元素是否"长得像可交互控件"：本身或祖先是 role=tab/button、tab 类名、或 pointer 光标。
  // 客户详情"电话结果"里的历史文字是静态文本，不具备这些特征 —— 用来排除误点。
  function isInteractiveLike(el) {
    let cur = el;
    for (let i = 0; i < 5 && cur; i++) {
      if (cur.getAttribute) {
        const role = cur.getAttribute('role');
        if (role === 'tab' || role === 'button') return true;
      }
      const cls = String(cur.className || '');
      if (/ant-tabs-tab|tabs-tab|tab-item|tab-btn/i.test(cls)) return true;
      try {
        if (window.getComputedStyle(cur).cursor === 'pointer') return true;
      } catch (e) {}
      cur = cur.parentElement;
    }
    return false;
  }

  function locateTopTab(text, exclude) {
    let me = findClickablesByText(text);
    if (exclude) me = me.filter((el) => !exclude(el));
    if (!me.length) return null;
    if (me.length === 1) return getClickableAncestor(me[0]);

    // 第 1 步：优先"可交互"候选。真 tab 必有 pointer/role=tab 等特征；
    // 右栏"电话结果"历史列表里的同名文字是静态文本，直接淘汰
    // （该列表同时含"未接通"和"无意向"，互相共同祖先很小，单纯面积打分会被骗）
    const interactive = me.filter(isInteractiveLike);
    const pool = interactive.length ? interactive : me;

    // 第 2 步：再用"与兄弟 tab 候选的最小共同祖先面积"打分
    const anchorEls = [];
    for (const other of TOP_TABS) {
      if (other === text) continue;
      anchorEls.push(...findClickablesByText(other));
    }
    if (!anchorEls.length) return getClickableAncestor(pickSmallest(pool));

    let best = null, bestArea = Infinity;
    for (const el of pool) {
      for (const a of anchorEls) {
        const ca = commonAncestor(el, a);
        if (!ca) continue;
        const area = elArea(ca);
        if (area < bestArea) { bestArea = area; best = el; }
      }
    }
    return getClickableAncestor(best || pickSmallest(pool));
  }

  function locateTarget(step, tried) {
    const exclude = (el) => tried && tried.has(getClickableAncestor(el));
    // 顶层 tab 优先走兄弟 tab 打分定位
    if (TOP_TABS.includes(step.text)) {
      const t = locateTopTab(step.text, exclude);
      if (t) return t;
    }
    const els = findClickablesByText(step.text).filter((el) => !exclude(el));
    if (!els.length) return null;

    // 优先"可交互"候选（真按钮有 pointer/role 特征，历史文字没有）
    const interactive = els.filter(isInteractiveLike);
    const pool = interactive.length ? interactive : els;

    if (step.parentTab) {
      const tabEls = findClickablesByText(step.parentTab);
      if (tabEls.length) {
        let best = null, bestSize = Infinity;
        for (const el of pool) {
          for (const tab of tabEls) {
            const ca = commonAncestor(el, tab);
            if (!ca || ca === document.body) continue;
            const size = elArea(ca);
            if (size < bestSize) { bestSize = size; best = el; }
          }
        }
        if (best) {
          if (DEBUG) console.log('[跟进助手] 「' + step.text + '」通过共同祖先锁定');
          return getClickableAncestor(best);
        }
      }
    }
    return getClickableAncestor(pickSmallest(pool));
  }

  // ============================================================
  // 屏幕浮层提示
  // ============================================================
  let toastEl = null, toastMsgEl = null, toastTimer = null;

  function hideToast() {
    if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
    if (toastEl) toastEl.style.display = 'none';
  }

  // [v1.17.4] 提示条可手动关掉（右上角 ✕，或点它任意位置）——
  // 报错条要挂 10 秒、来电/录制这类常驻条不会自己消失，一直挡在右下角碍事
  function ensureToast() {
    if (toastEl && toastEl.isConnected) return true;
    toastEl = document.createElement('div');
    toastEl.id = 'yk_helper_toast';
    toastEl.style.cssText = [
      'position:fixed', 'z-index:2147483647', 'right:20px', 'bottom:20px',
      'max-width:340px', 'padding:10px 32px 10px 14px', 'border-radius:10px',
      'background:#1f2937', 'color:#fff', 'font-size:13px', 'line-height:1.5',
      'box-shadow:0 6px 24px rgba(0,0,0,.3)',
      'font-family:-apple-system,"Microsoft YaHei",sans-serif',
      'display:none', 'white-space:pre-wrap', 'cursor:pointer',
    ].join(';');
    toastMsgEl = document.createElement('span');
    const x = document.createElement('button');
    x.type = 'button';
    x.textContent = '✕';
    x.title = '关闭提示';
    x.style.cssText = [
      'position:absolute', 'top:6px', 'right:6px', 'width:20px', 'height:20px',
      'padding:0', 'border:0', 'border-radius:5px', 'background:rgba(255,255,255,.18)',
      'color:#fff', 'font-size:12px', 'line-height:20px', 'cursor:pointer',
    ].join(';');
    x.onmouseenter = () => { x.style.background = 'rgba(255,255,255,.34)'; };
    x.onmouseleave = () => { x.style.background = 'rgba(255,255,255,.18)'; };
    toastEl.appendChild(toastMsgEl);
    toastEl.appendChild(x);
    toastEl.onclick = hideToast;
    document.documentElement.appendChild(toastEl);
    return true;
  }

  function toast(msg, isError, sticky) {
    try {
      if (!ensureToast()) return;
      toastMsgEl.textContent = msg;
      toastEl.style.background = isError ? '#b91c1c' : '#1f2937';
      toastEl.style.display = 'block';
      if (toastTimer) clearTimeout(toastTimer);
      if (!sticky) toastTimer = setTimeout(hideToast, isError ? 10000 : 2500);
    } catch (e) {}
  }

  // ============================================================
  // 流程定义
  // ============================================================
  const RESULT_TEXTS = ['有意向', '无意向', '资料错误', '二次呼叫', '未明确'];
  const MORE_TEXTS = ['...', '···', '•••', '…', '更多'];
  // 挂断按钮的常见文案，逐个尝试
  const HANGUP_TEXTS = ['挂断', '挂机', '结束通话'];

  const FLOWS = [
    {
      name: '未接通·无人接听',
      hotkey: 'F',
      color: '#dc2626',
      steps: [
        { act: 'hangup' },
        { act: 'expandMore', ensureText: '未接通' },
        { act: 'click', text: '未接通', afterText: '无人接听', retryCount: 2 },
        { act: 'click', text: '无人接听', parentTab: '未接通', retryCount: 2 },
        { act: 'submit' },
      ],
    },
    {
      name: '无意向·拒绝',
      hotkey: 'D',
      color: '#ca8a04',
      steps: [
        { act: 'hangup' },
        // [v1.17.5] D 是挂断联动的默认流程，必须能处理「无意向」被折进"..."的情况
        // （之前只有 F/R 有这步，联动跑 D 时报"页面中没有出现「无意向」"）
        { act: 'expandMore', ensureText: '无意向' },
        { act: 'click', text: '无意向', afterText: '拒绝', retryCount: 2 },
        { act: 'click', text: '拒绝', parentTab: '无意向', retryCount: 2 },
        { act: 'submit' },
      ],
    },
    {
      name: '有意向·发资料+领客户',
      hotkey: 'S',
      color: '#16a34a',
      steps: [
        { act: 'hangup' },
        { act: 'click', text: '有意向', afterText: '发送资料', retryCount: 2 },
        { act: 'click', text: '发送资料', parentTab: '有意向', retryCount: 2 },
        { act: 'fillNote', text: '加微信' },
        { act: 'claimCustomer' },
        { act: 'submit' },
      ],
    },
    {
      name: '二次呼叫·稍后联系',
      hotkey: 'R',
      color: '#0891b2',
      steps: [
        { act: 'hangup' },
        { act: 'expandMore', ensureText: '二次呼叫' },
        { act: 'click', text: '二次呼叫', afterText: '稍后联系', retryCount: 2 },
        { act: 'click', text: '稍后联系', parentTab: '二次呼叫', retryCount: 2 },
        { act: 'submit' },
      ],
    },
    {
      name: '停机（备注停机）',
      hotkey: 'T',
      color: '#7c3aed',
      steps: [
        { act: 'hangup' },
        { act: 'expandMore', ensureText: '资料错误' }, // [v1.17.5] 停机由手机上报原因自动路由过来，同样要能展开
        { act: 'click', text: '资料错误', afterText: '停机', retryCount: 2 },
        { act: 'click', text: '停机', parentTab: '资料错误', retryCount: 3 },
        { act: 'fillNote', text: '停机' },
        { act: 'submit' },
      ],
    },
    {
      name: '空号（停机+备注）',
      hotkey: 'E',
      color: '#c2410c',
      steps: [
        { act: 'hangup' },
        { act: 'expandMore', ensureText: '资料错误' },
        { act: 'click', text: '资料错误', afterText: '停机', retryCount: 2 },
        { act: 'click', text: '停机', parentTab: '资料错误', retryCount: 3 },
        { act: 'fillNote', text: '空号' },
        { act: 'submit' },
      ],
    },
    {
      name: '退休（停机+备注）',
      hotkey: 'Z',
      color: '#0f766e',
      steps: [
        { act: 'hangup' },
        { act: 'click', text: '资料错误', afterText: '停机', retryCount: 2 },
        { act: 'click', text: '停机', parentTab: '资料错误', retryCount: 3 },
        { act: 'fillNote', text: '退休' },
        { act: 'submit' },
      ],
    },
    {
      name: '暂停/恢复拨号',
      hotkey: ' ',
      color: '#475569',
      steps: [
        { act: 'toggleDial' },
      ],
    },
  ];

  // ============================================================
  // 流程执行器
  // ============================================================
  let running = false;

  // 收集"展开更多"候选按钮
  // [v1.17.3] 老版全页取文案为 "..." 的最小元素，客户名截断的省略号、工具栏「更多」
  // 都会被当成展开按钮点掉；且新版 tab 条的 "..." 是纯图标（ant-tabs-nav-more，无文字），
  // 文本匹配认不出。现在：结构特征 + 文案两路收集，再用"与结果 tab 同窄容器"过滤。
  function collectMoreCandidates(anchors) {
    const out = [];
    const strip = tabStripArea(anchors);
    const add = (raw) => {
      const el = getClickableAncestor(raw);
      if (!el || !isVisible(el) || isDisabled(el)) return;
      if (el.closest && el.closest('#yk_helper_panel, #yk_helper_fab, #yk_helper_toast')) return;
      if (elArea(el) > 60000) return; // 200x300 以上的是容器，不是按钮
      // 圈得出结果 tab 就要求"和 tab 同一条窄容器"；圈不出时只点像控件的元素，静态省略号一律不点
      if (anchors.length ? !sharesTabStrip(el, anchors, strip) : !isInteractiveLike(el)) return;
      if (out.indexOf(el) < 0) out.push(el);
    };
    $$('[class*="more"],[class*="ellipsis"],[class*="expand"],[aria-label*="更多"],[title*="更多"]')
      .forEach((el) => {
        if (normalizeText(el.innerText || el.textContent).length > 6) return;
        add(el);
      });
    MORE_TEXTS.forEach((t) => findClickablesByText(t).forEach(add));
    return out.sort((a, b) => elArea(a) - elArea(b)).slice(0, 5);
  }

  function describeMoreBtn(el) {
    const t = normalizeText(el.innerText || el.textContent);
    if (t && t.length <= 6) return t;
    const cls = String(el.className || '').split(/\s+/).filter(Boolean).slice(0, 2).join('.');
    return cls || el.tagName.toLowerCase();
  }

  // 尝试展开"..."更多菜单
  // [v1.17.3] 带 ensureText 时逐个候选点、点完确认目标真露出来才算成功（老版只点一次就交给 4 秒死等）
  async function tryExpandMore(log, ensureText) {
    const anchors = tabAnchorEls();
    const cands = collectMoreCandidates(anchors);
    if (DEBUG) console.log('[跟进助手] 展开候选', cands.map(describeMoreBtn), 'tab锚点', anchors.length);
    for (let i = 0; i < cands.length; i++) {
      realClick(cands[i]);
      log.push('展开更多(' + describeMoreBtn(cands[i]) + (cands.length > 1 ? ' ' + (i + 1) + '/' + cands.length : '') + ')');
      if (!ensureText) { await sleep(200); return true; }
      if (await waitUntil(() => panelHasVisibleText(ensureText), 2000, 50)) return true;
      await sleep(120); // 可能把上一个菜单点关了，等 UI 落定再试下一个
    }
    return false;
  }

  // ============================================================
  // 公海一键筛选：搜索字段切"姓名" → 搜"医院" → 通话时长≥60秒 → 查询
  //               → 每页500条 → 最后一次跟进时间升序
  // ============================================================
  function rectDist(a, b) {
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    const dx = Math.max(0, Math.max(ra.left - rb.right, rb.left - ra.right));
    const dy = Math.max(0, Math.max(ra.top - rb.bottom, rb.top - ra.bottom));
    return Math.hypot(dx, dy);
  }
  // 按正则找可见短文本元素（normalizeText 已去掉所有空白）
  function findByPattern(re) {
    const out = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    let n;
    while ((n = walker.nextNode())) {
      if (!isVisible(n)) continue;
      if (n.closest && n.closest('#yk_helper_panel, #yk_helper_fab, #yk_helper_toast')) continue;
      const t = normalizeText(n.textContent || '');
      if (t && t.length <= 12 && re.test(t)) out.push(n);
    }
    return out;
  }

  // 读取"通话中"标记旁边正在走的通话计时（秒），找不到返回 null。
  // 用途：分辨页面上的"通话中"是卡死的旧状态，还是刚自动拨出的新电话。
  function readLiveCallTimer() {
    const marks = findClickablesByText('通话中');
    if (!marks.length) return null;
    const timers = findByPattern(/^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})$/);
    if (!timers.length) return null;
    let best = null, bestD = Infinity;
    for (const t of timers) {
      for (const mk of marks) {
        const d = rectDist(t, mk);
        if (d < bestD) { bestD = d; best = t; }
      }
    }
    if (best === null || bestD > 350) return null;
    const m = normalizeText(best.innerText || '').match(/^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const h = m[1] ? parseInt(m[1], 10) : 0;
    return h * 3600 + parseInt(m[2], 10) * 60 + parseInt(m[3], 10);
  }

  // 页面是否正在拨一通新电话（拨打中还没有计时器，要用文案识别）
  const DIALING_TEXTS = ['拨打中', '呼叫中', '正在呼叫', '正在拨打', '等待接听', '响铃中', '外呼中', '连接中'];
  // 纯文案检测：页面显示"拨打/等待接听"且还没有"通话中"（接通后计时器走起来就不算）
  function isDialingText() {
    for (const t of DIALING_TEXTS) {
      if (hasVisibleText(t)) return true;
    }
    return false;
  }
  function isDialingNow() {
    return isDialingText() && !hasVisibleText('通话中');
  }
  // 新电话保护（用于挂断步骤）：正在拨 或 刚接通计时还很短
  function newCallDialing() {
    if (isDialingNow()) return true;
    const sec = readLiveCallTimer();
    return sec !== null && sec < 20;
  }

  // ==== [v1.19.1] 接通提醒：客户真接起了要立刻能知道 ====
  // 手机的 answered 用来做最快的线路预提醒；回拨线路下它可能只代表平台腿接通。
  // 绿色「客户已接听」以云客页面通话计时推进为准，避免把平台接通误当成客户接听。
  // 坑：页面角落常挂着系统时钟（HH:MM 甚至 HH:MM:SS），会被当通话计时误报。
  // 办法：每通开始的瞬间把当时已存在的计时文本登记成"常驻钟"忽略掉，之后新出现且持续推进的才算通话计时。
  let connArmed = false;
  let connStatics = new Set();
  let connPrev = new Map();
  let connMoves = new Map();   // 每个计时元素最近一次推进的时间与次数
  let connAnnounced = false;
  let connTitleTimer = null;
  let connTitleBase = '';
  let connTitleLabel = '📞 客户已接通';
  let connObserver = null;
  let connLiveMarks = [];
  let connMarksAt = 0;

  function connClockSeconds(txt) {
    // 只认 mm:ss：页面角落的系统时钟是 HH:MM 或 HH:MM:SS，三位段的直接排除
    const m = normalizeText(txt).match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const mm = parseInt(m[1], 10);
    if (mm > 59) return null;
    return mm * 60 + parseInt(m[2], 10);
  }

  function connFmt(sec) {
    const s = Math.max(0, Math.floor(sec));
    const mm = Math.floor(s / 60), ss = s % 60;
    return mm + ':' + String(ss).padStart(2, '0');
  }

  function connTimerEls() {
    try {
      return findByPattern(/^\d{1,2}:\d{2}$/).filter((el) => {
        if (!isVisible(el)) return false;
        if (el.closest && el.closest('#yk_helper_panel, #yk_helper_fab, #yk_helper_toast, #yk_helper_ring, #yk_call_dot, #yk_call_status')) return false;
        return connClockSeconds(el.textContent || '') !== null;
      });
    } catch (e) { return []; }
  }

  function connRefreshLiveMarks(force) {
    const now = Date.now();
    if (!force && connLiveMarks.some((el) => el && el.isConnected) && now - connMarksAt < 1000) return;
    try { connLiveMarks = findClickablesByText('通话中').filter(isVisible); }
    catch (e) { connLiveMarks = []; }
    connMarksAt = now;
  }

  function connLiveDistance(el) {
    if (!el || !isVisible(el)) return Infinity;
    if (el.closest && el.closest('#yk_helper_panel, #yk_helper_fab, #yk_helper_toast, #yk_helper_ring, #yk_call_dot, #yk_call_status')) return Infinity;
    connRefreshLiveMarks(false);
    let best = Infinity;
    for (const mark of connLiveMarks) {
      if (!mark || !mark.isConnected) continue;
      try { best = Math.min(best, rectDist(el, mark)); } catch (e) {}
    }
    return best;
  }

  function connBestLiveTimer() {
    connRefreshLiveMarks(false);
    if (!connLiveMarks.length) return null;
    let best = null, bestD = Infinity;
    for (const el of connTimerEls()) {
      let d = Infinity;
      for (const mark of connLiveMarks) {
        if (!mark || !mark.isConnected) continue;
        try { d = Math.min(d, rectDist(el, mark)); } catch (e) {}
      }
      if (d < bestD) { best = el; bestD = d; }
    }
    return bestD <= 350 ? best : null;
  }


  function connStopTitleFlash() {
    if (connTitleTimer) { clearInterval(connTitleTimer); connTitleTimer = null; }
    if (connTitleBase && document.title.indexOf('📞') >= 0) document.title = connTitleBase;
  }

  // 标签页标题闪：页面在别的窗口/后台时也能看到（tab 条上就有）
  function connStartTitleFlash(label) {
    try {
      if (label) connTitleLabel = label;
      if (connTitleTimer) return;
      connTitleBase = document.title;
      let onFlag = false;
      connTitleTimer = setInterval(() => {
        onFlag = !onFlag;
        try { document.title = onFlag ? connTitleLabel + ' · ' + connTitleBase : connTitleBase; } catch (e) {}
      }, 900);
      setTimeout(connStopTitleFlash, 20000);
    } catch (e) {}
  }

  function connBeep() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      [0, 260, 520, 780].forEach((d) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'triangle'; o.frequency.value = d === 0 ? 880 : 1180;
        g.gain.value = 0.16;
        o.connect(g); g.connect(ctx.destination);
        o.start(ctx.currentTime + d / 1000);
        o.stop(ctx.currentTime + d / 1000 + 0.16);
      });
      setTimeout(() => { try { ctx.close(); } catch (e) {} }, 1600);
    } catch (e) {}
  }

  function connNotice(sec) {
    const label = connFmt(sec);
    const message = '✅ 客户已接听 · 可以开始说话（' + label + '）';
    const alert = PW.__YK_CUSTOMER_CONNECTED_ALERT__;
    if (typeof alert === 'function') alert(message);
    else { connBeep(); toast(message, false, true); }
    connStartTitleFlash('📞 客户已接听');
    console.log('[云客助手][接通提醒] 页面通话计时开始推进：' + label);
    try {
      const dot = document.getElementById('yk_call_dot');
      if (dot) { dot.textContent = '📞 已接通 ' + label; dot.style.color = '#16a34a'; }
    } catch (e) {}
    // [v1.19.6] 把这个"真接通"时刻发到中转：回拨线路下手机自己分不清平台腿和客户腿
    // （它上报的 answered 只代表平台接通，客户还在响铃），只有电脑看得到页面计时开始走。
    // 手机端下一版会轮询这条 pc_connected，收到就震动 + 弹通知，实现手机侧接通提醒。
    try {
      const r = PW.__ykPhRow || {};
      relayFetch(RELAY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-wb-webapp-access-key': RELAY_KEY },
        body: JSON.stringify({ event_type: 'pc_connected', source: 'pc:connected:' + (r.number || '') + ':' + label }),
      }).catch(() => {});
    } catch (e) {}
  }

  // 优先由 MutationObserver 监听 CRM 通话计时文本变化；每秒扫描只保留为漏事件兜底。
  // 非通话期间不观察 DOM。手机状态是快速预提醒，CRM 计时推进才确认客户本人已接听。
  let connTimerEl = null;
  // 只读诊断：排查"第二通不报"这类问题时用（控制台 __YK_CONN_STATE__()）
  PW.__YK_CONN_STATE__ = () => ({
    armed: connArmed, announced: connAnnounced,
    statics: connStatics.size, prev: connPrev.size, moves: connMoves.size,
    timerEl: !!(connTimerEl && connTimerEl.isConnected), observing: !!connObserver,
    ph: (PW.__ykPhRow || {}).state || '',
    off: loadAuto().connectNotice === false,
  });

  function connDisconnectObserver() {
    try { if (connObserver) connObserver.disconnect(); } catch (e) {}
    connObserver = null;
  }

  function connProcessTimer(el, inserted) {
    if (!connArmed || connAnnounced || !el || !el.isConnected) return;
    const sec = connClockSeconds(el.textContent || '');
    if (sec === null || connLiveDistance(el) > 350) return;
    if (connTimerEl && connTimerEl.isConnected && el !== connTimerEl) {
      const oldD = connLiveDistance(connTimerEl), newD = connLiveDistance(el);
      if (oldD <= newD) return;
    }
    const prevSec = connPrev.get(el);
    connTimerEl = el;
    connPrev.set(el, sec);
    if (prevSec === undefined) {
      if (inserted && !connStatics.has(el) && sec <= 1) { connAnnounced = true; connNotice(sec); }
      return;
    }
    if (sec > prevSec) { connAnnounced = true; connNotice(sec); }
  }

  function connInspectMutationNode(node, inserted) {
    if (!node || connAnnounced) return;
    let el = node.nodeType === 1 ? node : node.parentElement;
    let depth = 0;
    while (el && depth++ < 5) {
      if (connClockSeconds(el.textContent || '') !== null) connProcessTimer(el, inserted);
      if (connAnnounced) return;
      el = el.parentElement;
    }
    // 新增节点有时是整段计时器 DOM，一次只检查一个很小的子树，避免每次变更扫描整页。
    if (inserted && node.nodeType === 1 && node.childElementCount && node.textContent.length <= 16) {
      try {
        const walker = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT);
        let child, count = 0;
        while ((child = walker.nextNode()) && count++ < 24) {
          if (connClockSeconds(child.textContent || '') !== null) connProcessTimer(child, true);
          if (connAnnounced) return;
        }
      } catch (e) {}
    }
  }

  function connObserveCall() {
    connDisconnectObserver();
    try {
      connObserver = new MutationObserver((records) => {
        if (!connArmed || connAnnounced) return;
        for (const rec of records) {
          if (rec.type === 'characterData') connInspectMutationNode(rec.target, false);
          else {
            for (const n of rec.addedNodes || []) connInspectMutationNode(n, true);
            if (rec.target && rec.target.nodeType === 1 && connClockSeconds(rec.target.textContent || '') !== null)
              connInspectMutationNode(rec.target, false);
          }
          if (connAnnounced) break;
        }
      });
      if (document.body) connObserver.observe(document.body, { subtree: true, childList: true, characterData: true });
    } catch (e) { connDisconnectObserver(); }
  }

  function connTick() {
    try {
      if (loadAuto().connectNotice === false) {
        if (connArmed) { connArmed = false; connAnnounced = false; connDisconnectObserver(); connStopTitleFlash(); }
        return;
      }
      const r = PW.__ykPhRow;
      const ongoing = !!r && (r.state === 'dialing' || r.state === 'answered' || r.state === 'incoming');
      if (!ongoing) {
        if (connArmed) {
          connArmed = false; connAnnounced = false; connTimerEl = null; connPrev = new Map(); connMoves = new Map();
          connDisconnectObserver(); connLiveMarks = []; connMarksAt = 0; connStopTitleFlash();
        }
        return;
      }
      if (!connArmed) {
        connArmed = true; connAnnounced = false;
        connStatics = new Set(connTimerEls());
        connPrev = new Map(); connMoves = new Map(); connTimerEl = null;
        connRefreshLiveMarks(true);
        const existing = connBestLiveTimer();
        if (existing) { connTimerEl = existing; connPrev.set(existing, connClockSeconds(existing.textContent || '')); }
        connObserveCall();
        return;
      }
      if (connAnnounced) return;
      // 兜底轮询：MutationObserver 遇到框架整体替换节点或后台节流时仍能识别计时推进。
      const live = connBestLiveTimer();
      if (live) connProcessTimer(live, !connStatics.has(live));
    } catch (e) {}
  }

  // [v1.18.5] 判活优先看手机上报的状态，不再只靠页面计时。
  // 真机署名证明页面计时经常读不出来（pc_hangup 的 source 全是 t=无计时|通话中），
  // 于是"计时在走就不点页面挂断"这道闸在云客的布局上是瞎的——补点挂断会掐掉刚接通的真人在通话。
  // 手机每 15~30 秒发心跳，hb_at 由本机中转服务写入（和电脑同一把时钟，不受手机时钟偏差影响）；
  // 心跳一断（超过 20 秒）就不拦，免得把"页面卡在通话中、提交过不去"的兜底也一起废掉。
  function phoneCallLive(onlyConnected) {
    try {
      const r = PW.__ykPhRow;
      if (!r || !r.state) return false;
      if (!r.alive || !(r.hbAt > 0) || Date.now() - r.hbAt > 20000) return false;
      if (onlyConnected) return r.state === 'answered';
      return r.state === 'answered' || r.state === 'dialing' || r.state === 'incoming';
    } catch (e) { return false; }
  }

  function phoneCallEndedFresh() {
    try {
      const r = PW.__ykPhRow;
      if (!r || !r.state || !r.alive || !(r.hbAt > 0) || Date.now() - r.hbAt > 20000) return false;
      return /^(hangup|ended|idle|none|disconn|over|finish)$/i.test(String(r.state));
    } catch (e) { return false; }
  }

  // [v1.18.9] 手机已经拨出"比这条联动事件更新的"一通 → 这条事件过期了，绝不能再点页面挂断。
  // 连环误挂就是这么来的：手机上报上一通 hangup → 插件跑流程去点挂断 → CRM 在这两三秒里已经拨了
  // 下一通 → 那一点掐掉的正是新一通 → 新一通死 → 又上报 hangup → 又点……
  // 页面计时读不到（真机署名一片 t=无计时|通话中）、"拨打中"文案也没有，两道判活全瞎，
  // 唯一可信的是手机自己的状态时间线：state_at 明显晚于事件时间且当前是 dialing/answered/incoming。
  // state_at 来自手机、created_at 来自本机中转，两者有 ~1 秒偏差，所以留 1500ms 余量。
  function phoneMovedOn(evAtMs) {
    try {
      const r = PW.__ykPhRow;
      if (!evAtMs || !r || !(r.stateAt > 0)) return false;
      if (!r.alive || Date.now() - r.hbAt > 20000) return false;
      const newer = r.stateAt - evAtMs > 1500;
      return newer && (r.state === 'dialing' || r.state === 'ringing' || r.state === 'answered' || r.state === 'incoming');
    } catch (e) { return false; }
  }

  // 手机 APK 的 hangup 事件本身就是本通结束回执，不必再等 phone_status 状态表刷新。
  // 只接受新鲜事件，并沿用“手机已拨出下一通”保护，避免拿旧事件操作新通电话。
  function phoneHangupEventFresh(opts) {
    const evAt = Number(opts && opts.evAt);
    if (!Number.isFinite(evAt) || evAt <= 0) return false;
    const age = Date.now() - evAt;
    // CRM 页签对齐可能耗时数秒；上游只把 8 秒内的新事件交给流程，因此这里放宽处理窗口。
    return age >= -5000 && age <= 45000 && !phoneMovedOn(evAt);
  }

  // [v1.16.2]/[v1.18.2] 号码校正表 + 每通电话的客户身份快照（键：手机上报的原号 & 换算出的真实号各存一份）
  const ykNumMap = {};
  const ykCallCtx = {};

  // [v1.19.7] 手动按键也要先对齐客户：云客上一通刚挂就自动拨下一通，页面还停在上一通时，
  // 那一键挂掉的是手机正在讲的新一通、写的跟进却是旧客户 —— 真机 19:42:29 ph=dialing@18s、
  // 19:45:46 ph=answered@4s 就是这样"手机拨打的和电脑页面对不上"。
  // 只在手机自报"此刻正在这通里"（心跳新鲜）时做；若有活动通话但不能唯一匹配页签，就停手。
  async function alignToLivePhoneCall(log) {
    try {
      const r = PW.__ykPhRow;
      if (!r || !r.alive || !(r.hbAt > 0) || Date.now() - r.hbAt > 20000) return { active: false, aligned: false };
      if (!/dialing|answered|incoming|ringing/i.test(String(r.state || ''))) return { active: false, aligned: false };
      if (!r.number) {
        log.push('手机通话状态没有号码，无法确认 CRM 客户');
        return { active: true, aligned: false };
      }
      const real = ykNumMap[String(r.number)] || String(r.number);
      const ctx = ykCallCtx[String(r.number)] || ykCallCtx[String(real)] || null;
      // 姓名优先用拨号那一刻抓到的客户身份，其次用手机状态屏直接报的姓名
      const name = (ctx && ctx.name) || String(r.name || '');
      const num = (ctx && ctx.num) || real;
      if (!name && !num) {
        log.push('手机通话缺少客户身份，无法确认 CRM 客户');
        return { active: true, aligned: false };
      }
      const tab = await switchToCallTab(name, num);
      if (tab) { log.push('手机这通是「' + (name || tab) + '」→ 已确认/切到对应 CRM 客户页再操作'); return { active: true, aligned: true }; }
      log.push('手机这通（' + (name || num) + '）页面里没有唯一匹配的客户页签，停止操作');
      return { active: true, aligned: false };
    } catch (e) { return { active: true, aligned: false }; }
  }
  // 验证/排障用：手工记下「这个号 = 这个客户」，等同拨号那一刻抓到的客户身份
  PW.__ykSeedCtx = function (num, name) {
    const k = String(num || '').replace(/[^\d]/g, '');
    if (!k) return false;
    ykCallCtx[k] = { num: k, name: String(name || ''), at: Date.now() };
    return true;
  };

  // React 受控输入框赋值（原生 setter + input/change 事件），select 下拉同样适用
  function setInputValue(el, value) {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype
      : el.tagName === 'SELECT' ? HTMLSelectElement.prototype
      : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function visibleInputs() {
    return $$('input').filter((i) => isVisible(i) && i.type !== 'checkbox' && i.type !== 'radio');
  }

  // ============================================================
  // 通用「动作录制器」：把你的手动操作录成动作序列，随时一键复现。
  // 以后再遇到任何重复操作，不用等我写死 —— 自己录一遍就行。
  // ============================================================
  const MACRO_KEY = 'yk_macros_v1';
  function loadMacros() { try { return JSON.parse(localStorage.getItem(MACRO_KEY)) || []; } catch (e) { return []; } }
  function saveMacros(list) {
    try { localStorage.setItem(MACRO_KEY, JSON.stringify(list)); } catch (e) {}
    // [v1.14.1] 双写扩展存储：页面 localStorage 被 CRM 清掉时，扩展存储里还有一份
    try {
      if (__ykBridgeOk) {
        PW.postMessage({ __ykRelay: true, dir: 'toBridge', ch: 's' + (++__ykRelayCh) + '_' + Date.now(), __ykStore: 'set', key: MACRO_KEY, value: list }, '*');
      }
    } catch (e) {}
  }
  // [v1.14.1] 从扩展存储读取（异步）
  function bridgeStoreGet(key) {
    return new Promise((resolve) => {
      try {
        if (!__ykBridgeOk) return resolve(null);
        const ch = 's' + (++__ykRelayCh) + '_' + Date.now();
        const timer = setTimeout(() => { if (__ykRelayWaiters.delete(ch)) resolve(null); }, 3000);
        __ykRelayWaiters.set(ch, (resp) => {
          clearTimeout(timer);
          resolve(resp && resp.ok ? (resp.value == null ? null : resp.value) : null);
        });
        PW.postMessage({ __ykRelay: true, dir: 'toBridge', ch: ch, __ykStore: 'get', key: key }, '*');
      } catch (e) { resolve(null); }
    });
  }
  // 启动 2.5 秒后（桥已就绪）：扩展存储 ↔ 页面 localStorage 双向对齐，
  // 丢失的一侧自动补齐 —— 录制的动作再也不会因为清缓存/更新而丢
  setTimeout(async () => {
    try {
      if (!__ykBridgeOk) return;
      const cloud = await bridgeStoreGet(MACRO_KEY);
      const cur = loadMacros();
      if (Array.isArray(cloud) && cloud.length) {
        if (!cur.length) {
          saveMacros(cloud);
          console.log('[跟进助手] 已从扩展存储恢复 ' + cloud.length + ' 个录制动作');
          if (typeof renderMacros === 'function') renderMacros();
        } else {
          const names = new Set(cur.map((m) => m && m.name));
          const extra = cloud.filter((m) => m && m.name && !names.has(m.name));
          if (extra.length) {
            saveMacros(cur.concat(extra));
            console.log('[跟进助手] 从扩展存储合并回 ' + extra.length + ' 个录制动作');
            if (typeof renderMacros === 'function') renderMacros();
          }
        }
      } else if (Array.isArray(cur) && cur.length) {
        PW.postMessage({ __ykRelay: true, dir: 'toBridge', ch: 's' + (++__ykRelayCh) + '_' + Date.now(), __ykStore: 'set', key: MACRO_KEY, value: cur }, '*');
        console.log('[跟进助手] 已把 ' + cur.length + ' 个录制动作备份到扩展存储');
      }
    } catch (e) {}
  }, 2500);
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  let macroRec = null; // 录制中：{ actions: [] }；否则 null

  function cssEscape(s) { try { return (window.CSS && CSS.escape) ? CSS.escape(s) : s.replace(/(["\\\]])/g, '\\$1'); } catch (e) { return s; } }

  // 生成尽量稳定的 CSS 路径（最多 5 层，遇到 id 就停）
  function cssPathOf(el) {
    const parts = [];
    let cur = el;
    for (let i = 0; cur && cur !== document.body && i < 5; i++) {
      let s = cur.tagName.toLowerCase();
      if (cur.id) { parts.unshift(s + '#' + cssEscape(cur.id)); break; }
      const cls = ((cur.getAttribute && cur.getAttribute('class')) || '')
        .split(/\s+/).filter((c) => c && c.indexOf('yk_') !== 0).slice(0, 2);
      if (cls.length) s += '.' + cls.map(cssEscape).join('.');
      const parent = cur.parentElement;
      if (parent) {
        const sib = Array.from(parent.children).filter((c) => c.tagName === cur.tagName);
        if (sib.length > 1) s += ':nth-of-type(' + (sib.indexOf(cur) + 1) + ')';
      }
      parts.unshift(s);
      cur = parent;
    }
    return parts.join(' > ');
  }

  // 描述一个被点击/输入的元素：优先短文本（跨刷新最稳），否则 CSS 路径；坐标永远兜底
  function describeTarget(el) {
    const own = normalizeText(el.innerText || el.textContent || '');
    if (own && own.length <= 16) return { text: own, sel: cssPathOf(el) };
    // 点在容器上、文字在子元素里（如 li > span）
    const kids = el.querySelectorAll ? Array.from(el.querySelectorAll('*')) : [];
    for (const c of kids) {
      if (!isVisible(c)) continue;
      const t = normalizeText(c.innerText || '');
      if (t && t.length <= 16) return { text: t, sel: cssPathOf(el) };
      break;
    }
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      if (el.id) return { sel: '#' + cssEscape(el.id) };
      if (el.name) return { sel: el.tagName.toLowerCase() + '[name="' + el.name + '"]' };
      if (el.placeholder) return { sel: el.tagName.toLowerCase() + '[placeholder="' + el.placeholder + '"]' };
    }
    return { sel: cssPathOf(el) };
  }

  function rectCenterDist(el, x, y) {
    const r = el.getBoundingClientRect();
    return Math.hypot(r.left + r.width / 2 - x, r.top + r.height / 2 - y);
  }

  // 复现时定位元素：文本+坐标就近 → CSS 选择器 → 原坐标 elementFromPoint
  function locateAction(a) {
    if (a.text) {
      const cands = findClickablesByText(a.text);
      if (cands.length) {
        if (typeof a.x === 'number') cands.sort((p, q) => rectCenterDist(p, a.x, a.y) - rectCenterDist(q, a.x, a.y));
        return cands[0];
      }
    }
    if (a.sel) {
      try { const el = document.querySelector(a.sel); if (el && isVisible(el)) return el; } catch (e) {}
    }
    if (typeof a.x === 'number') {
      const el = document.elementFromPoint(a.x, a.y);
      if (el && !(el.closest && el.closest('#yk_helper_panel, #yk_helper_fab, #yk_helper_toast, #yk_auto_overlay'))) return el;
    }
    return null;
  }

  async function runMacro(m) {
    if (running) { toast('上一个流程还在跑，请稍候'); return; }
    if (macroRec) { toast('正在录制中，先点「停止录制」', true); return; }
    running = true;
    const log = [];
    toast('▶ 复现「' + m.name + '」（' + m.actions.length + ' 步）…', false, true);
    try {
      let prevInput = null;
      for (const a of m.actions) {
        if (a.t === 'click') {
          const el = locateAction(a);
          if (el) {
            realClick(getClickableAncestor(el) || el);
            log.push('点「' + (a.text || '元素') + '」');
          } else log.push('⚠ 没找到「' + (a.text || a.sel || '元素') + '」');
          await sleep(650);
        } else if (a.t === 'input') {
          const el = locateAction(a) || prevInput;
          if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) {
            el.focus();
            setInputValue(el, a.value);
            prevInput = el;
            log.push('输入 ' + a.value);
          } else log.push('⚠ 没找到输入框');
          await sleep(450);
        } else if (a.t === 'enter') {
          const el = prevInput || document.activeElement;
          if (el) {
            const keo = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
            el.dispatchEvent(new KeyboardEvent('keydown', keo));
            el.dispatchEvent(new KeyboardEvent('keyup', keo));
            log.push('回车');
          }
          await sleep(650);
        }
      }
      toast('✓ 「' + m.name + '」复现完成\n' + log.join(' | '));
      console.log('[跟进助手] 宏「' + m.name + '」→', log.join(' | '));
    } catch (err) {
      toast('✗ 复现出错：' + err.message, true);
      console.error('[跟进助手] 宏复现出错', err);
    } finally {
      running = false;
    }
  }

  async function runPublicFilter(log) {
    // ---- 1) 搜索字段：手机号 → 姓名
    const phoneTriggers = findClickablesByText('手机号').slice().sort((a, b) =>
      a.getBoundingClientRect().top - b.getBoundingClientRect().top); // 搜索栏在页面顶部，取最靠上的
    if (!phoneTriggers.length) throw new Error('没找到搜索字段下拉（手机号）——请在客户公海页使用');
    const trigger = phoneTriggers[0];
    // 验证方式：触发器位置上不再显示"手机号"（React 重渲染会换节点，不能盯着旧节点看）
    const trigRect = trigger.getBoundingClientRect();
    const trigX = trigRect.left + trigRect.width / 2, trigY = trigRect.top + trigRect.height / 2;
    const fieldSwitched = () => {
      const still = findClickablesByText('手机号');
      return !still.some((el) => {
        const r = el.getBoundingClientRect();
        return Math.hypot(r.left + r.width / 2 - trigX, r.top + r.height / 2 - trigY) < 80;
      });
    };
    let selOk = fieldSwitched(); // 重复执行时可能已经是姓名了
    for (let attempt = 0; attempt < 3 && !selOk; attempt++) {
      // 每轮重新定位触发器（切换后节点会被 React 换掉）
      const trig2 = findClickablesByText('手机号').slice().sort((a, b) =>
        a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0];
      if (!trig2) break;
      realClick(getClickableAncestor(trig2) || trig2);
      const opened = await waitForText('姓名', 2500);
      if (!opened) continue;
      // 表格里也有"姓名"表头，取离触发器最近的前 3 个候选挨个试
      const cands = findClickablesByText('姓名')
        .filter((el) => el !== trig2 && !(trig2.contains && trig2.contains(el)))
        .sort((a, b) => rectDist(a, trig2) - rectDist(b, trig2))
        .slice(0, 3);
      for (const opt of cands) {
        realClick(getClickableAncestor(opt) || opt);
        selOk = await waitUntil(fieldSwitched, 1800);
        if (selOk) break;
      }
    }
    log.push(selOk ? '搜索字段=姓名' : '⚠ 字段没切成姓名');
    await sleep(400);

    // ---- 2) 搜索词：医院
    const kwInput = visibleInputs()
      .filter((i) => /请输入/.test(i.placeholder || ''))
      .sort((a, b) => rectDist(a, trigger) - rectDist(b, trigger))[0];
    if (!kwInput) throw new Error('没找到搜索输入框');
    kwInput.focus();
    setInputValue(kwInput, '医院');
    log.push('输入"医院"');
    await sleep(300);
    // 回车 + 点旁边的放大镜按钮，双保险触发搜索
    const keo = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
    kwInput.dispatchEvent(new KeyboardEvent('keydown', keo));
    kwInput.dispatchEvent(new KeyboardEvent('keyup', keo));
    await sleep(400);
    const magBtn = $$('button').filter((b) => isVisible(b))
      .sort((a, b) => rectDist(a, kwInput) - rectDist(b, kwInput))[0];
    if (magBtn && rectDist(magBtn, kwInput) < 150) realClick(magBtn);
    await sleep(1500);

    // ---- 3) 通话时长 ≥ 60 秒
    const durLabels = findClickablesByText('通话时长');
    if (!durLabels.length) throw new Error('没找到「通话时长」筛选项——请先把筛选面板展开');
    const durLabel = pickSmallest(durLabels);
    const rowInput = visibleInputs().sort((a, b) => rectDist(a, durLabel) - rectDist(b, durLabel))[0];
    if (!rowInput) throw new Error('没找到通话时长输入框');
    realClick(rowInput);
    await sleep(600);
    // 弹层里出现两个"请输入秒数"输入框（排除行上那个），取最靠左的 = 最小值
    const popupInputs = visibleInputs()
      .filter((i) => i !== rowInput && /秒数/.test(i.placeholder || ''))
      .sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
    if (popupInputs.length) {
      const minInput = popupInputs[0];
      realClick(minInput);
      await sleep(150);
      setInputValue(minInput, '60');
      log.push('通话时长≥60秒');
      await sleep(400);
      const okBtn = findClickablesByText('确认').sort((a, b) => rectDist(a, minInput) - rectDist(b, minInput))[0];
      if (okBtn) { realClick(getClickableAncestor(okBtn)); log.push('确认'); await sleep(700); }
      else log.push('⚠ 没找到确认按钮');
    } else {
      log.push('⚠ 秒数弹层没弹出');
    }
    // 点「查询」应用筛选
    const qBtn = findClickablesByText('查询').sort((a, b) => rectDist(a, durLabel) - rectDist(b, durLabel))[0];
    if (qBtn) { realClick(getClickableAncestor(qBtn)); log.push('查询'); await sleep(2000); }
    else log.push('⚠ 没找到查询按钮');

    // ---- 4) 每页 500 条（带重试 + 结果验证）
    let sizeOk = false;
    for (let attempt = 0; attempt < 3 && !sizeOk; attempt++) {
      const sizeEl = pickSmallest(findByPattern(/条\/页/));
      if (!sizeEl) break;
      realClick(getClickableAncestor(sizeEl) || sizeEl);
      const opened = await waitUntil(() => findByPattern(/^500条\/页$/).length > 0, 2500);
      if (!opened) continue; // 下拉没弹出，重试
      const opt500 = pickSmallest(findByPattern(/^500条\/页$/));
      if (!opt500) break;
      realClick(getClickableAncestor(opt500) || opt500);
      sizeOk = await waitUntil(() => {
        const cur = pickSmallest(findByPattern(/条\/页/));
        return cur && normalizeText(cur.innerText || '').indexOf('500') === 0;
      }, 2500);
    }
    log.push(sizeOk ? '每页500条' : '⚠ 没切成 500条/页');
    if (sizeOk) await sleep(1500);

    // ---- 5) 最后一次跟进时间 升序（点上三角）
    const head = pickSmallest(findClickablesByText('最后一次跟进时间'));
    if (head) {
      // 向上收敛到一个不太大的容器（表头单元格），在里面找排序小三角
      let scope = head.parentElement;
      for (let i = 0; i < 4 && scope && scope !== document.body; i++) {
        if (scope.getBoundingClientRect().width <= 420) break;
        scope = scope.parentElement;
      }
      const root = scope || head.parentElement;
      const classOf = (e) => ((e.getAttribute && e.getAttribute('class')) || '');
      const icons = Array.from(root.querySelectorAll('*')).filter((e) => {
        if (!isVisible(e)) return false;
        const r = e.getBoundingClientRect();
        if (r.width === 0 || r.width > 26 || r.height > 22) return false;
        const c = classOf(e).toLowerCase();
        return /caret|sort|ascend|descend|arrow|triangle|icon/.test(c) || e.tagName === 'SVG' || !!e.querySelector('svg');
      });
      // 优先 class 明确是向上箭头的；否则取最靠上的那颗小三角（上=升序）
      let target = icons.find((e) => /caret[-_]?up|caretup|ascend|arrow[-_]?up|icon[-_]?up|sorter[-_]?up/.test(classOf(e).toLowerCase()));
      if (!target) target = icons.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0];
      if (target) {
        realClick(getClickableAncestor(target) || target);
        log.push('跟进时间升序');
      } else {
        // 兜底：点一下表头（多数表格第一次点 = 升序）
        realClick(getClickableAncestor(head));
        log.push('点了表头排序');
      }
      await sleep(1500);
    } else log.push('⚠ 没找到「最后一次跟进时间」表头（列表要加载出来）');
  }

  // 公海筛选记忆：记住用户最近一次点“查询”时的筛选控件状态，
  // 下次进入公海时恢复并自动查询，避免每次重新设置条件。
  const PUBLIC_FILTER_STORAGE_KEY = 'yk_public_pool_filter_v1';
  const PUBLIC_FILTER_LABELS = [
    '所在市级', '职位', '科室/部门', '所在省份', '电话备注',
    '通话时长', '客户备注', '跟进记录', '电话结果', '划入公海时间',
  ];
  const PUBLIC_DATE_PRESETS = ['昨天', '今天', '本周', '上周', '本月', '上月', '自定义时间段'];
  let publicPoolWasActive = false;
  let publicPoolRestoreBusy = false;
  let publicPoolEntryAt = 0;
  let publicFilterCaptureBound = false;
  let publicPoolDetectTimer = 0;
  let publicPoolMutationObserver = null;

  function publicPoolFilterActive() {
    try {
      return findClickablesByText('划入公海时间').some(isVisible);
    } catch (e) { return false; }
  }

  function schedulePublicPoolFilterCheck(delay) {
    if (publicPoolDetectTimer) clearTimeout(publicPoolDetectTimer);
    publicPoolDetectTimer = setTimeout(() => {
      publicPoolDetectTimer = 0;
      publicPoolFilterTick();
    }, delay == null ? 500 : delay);
  }

  function bindPublicPoolFilterCapture() {
    if (publicFilterCaptureBound) return;
    publicFilterCaptureBound = true;
    document.addEventListener('click', (event) => {
      const raw = event.target && event.target.closest
        ? event.target.closest('button,[role="button"],a,.ant-btn,.el-button')
        : null;
      if (raw && !raw.closest('#yk_helper_panel, #yk_helper_fab, #yk_helper_toast')) {
        schedulePublicPoolFilterCheck(650);
      }
      if (publicPoolRestoreBusy || !raw || normalizeText(raw.innerText || raw.textContent) !== '查询') return;
      if (publicPoolFilterActive()) {
        publicPoolWasActive = true; // 首次点击查询时就标记已在公海，避免重复自动查询
        savePublicFilterSnapshot();
      }
    }, true);
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' || publicPoolRestoreBusy || !publicPoolFilterActive()) return;
      const target = event.target;
      if (!target || !/^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) return;
      publicPoolWasActive = true;
      savePublicFilterSnapshot();
    }, true);
    window.addEventListener('popstate', () => schedulePublicPoolFilterCheck(650));
    window.addEventListener('hashchange', () => schedulePublicPoolFilterCheck(650));
    window.addEventListener('focus', () => schedulePublicPoolFilterCheck(250));
    if (document.body && !publicPoolMutationObserver) {
      publicPoolMutationObserver = new MutationObserver((records) => {
        const changed = records.some((record) => {
          const nodes = [...record.addedNodes, ...record.removedNodes];
          return nodes.some((node) => {
            if (node.nodeType === Node.TEXT_NODE) return String(node.nodeValue || '').includes('划入公海时间');
            if (node.nodeType !== Node.ELEMENT_NODE) return false;
            try { return (node.textContent || '').includes('划入公海时间'); } catch (e) { return false; }
          });
        });
        if (changed) schedulePublicPoolFilterCheck(500);
      });
      publicPoolMutationObserver.observe(document.body, { childList: true, characterData: true, subtree: true });
    }
    schedulePublicPoolFilterCheck(1000);
  }

  function publicFilterRow(label) {
    const candidates = findClickablesByText(label).filter((el) => isVisible(el))
      .sort((a, b) => elArea(a) - elArea(b));
    for (const candidate of candidates) {
      let cur = candidate;
      for (let i = 0; i < 9 && cur && cur !== document.body; i++, cur = cur.parentElement) {
        if (cur.closest && cur.closest('#yk_helper_panel, #yk_helper_fab, #yk_helper_toast')) break;
        const txt = normalizeText(cur.innerText || cur.textContent);
        if (!txt.includes(normalizeText(label)) || txt.length > 180) continue;
        const r = cur.getBoundingClientRect();
        if (r.width * r.height > window.innerWidth * window.innerHeight * 0.32) continue;
        if (cur.querySelector('input,select,textarea,button,[role="button"],[role="combobox"],.ant-select,.el-select')) return cur;
      }
    }
    return null;
  }

  function publicFilterOptionSelected(el) {
    if (!el) return false;
    const cls = String(el.className || '').toLowerCase();
    if (/active|checked|selected/.test(cls)) return true;
    if (el.getAttribute && (
      el.getAttribute('aria-checked') === 'true' ||
      el.getAttribute('aria-selected') === 'true' ||
      el.getAttribute('aria-pressed') === 'true'
    )) return true;
    // 云客的日期快捷项使用蓝字表示当前选择。
    try {
      const m = String(getComputedStyle(el).color || '').match(/[\d.]+/g);
      if (m && m.length >= 3) {
        const r = Number(m[0]), g = Number(m[1]), b = Number(m[2]);
        if (b > 90 && b > r + 22 && b >= g - 5) return true;
      }
    } catch (e) {}
    return false;
  }

  function publicFilterTextTargets(root, text) {
    if (!root) return [];
    const wanted = normalizeText(text);
    return Array.from(root.querySelectorAll('*')).filter((el) => {
      if (!isVisible(el) || normalizeText(el.innerText || el.textContent) !== wanted) return false;
      if (el.closest && el.closest('#yk_helper_panel, #yk_helper_fab, #yk_helper_toast')) return false;
      return true;
    }).sort((a, b) => elArea(a) - elArea(b));
  }

  function readPublicFilterSnapshot() {
    const entries = [];
    for (const label of PUBLIC_FILTER_LABELS) {
      const row = publicFilterRow(label);
      if (!row) continue;
      const controls = Array.from(row.querySelectorAll('input,select,textarea')).filter((el) => isVisible(el));
      const fields = controls.map((el, index) => ({
        tag: el.tagName.toLowerCase(),
        type: String(el.type || '').toLowerCase(),
        placeholder: String(el.placeholder || ''),
        index,
        value: (el.type === 'checkbox' || el.type === 'radio') ? '' : String(el.value || ''),
        checked: (el.type === 'checkbox' || el.type === 'radio') ? !!el.checked : null,
      }));
      const selected = [];
      const activeEls = Array.from(row.querySelectorAll(
        '[aria-checked="true"],[aria-selected="true"],[aria-pressed="true"],' +
        '.ant-radio-button-wrapper-checked,.ant-checkbox-checked,.is-checked,.is-active,.active,.selected'
      ));
      for (const el of activeEls) {
        const t = normalizeText(el.innerText || el.textContent);
        if (t && t.length <= 40 && !selected.includes(t)) selected.push(t);
      }
      if (label === '划入公海时间') {
        for (const preset of PUBLIC_DATE_PRESETS) {
          const targets = publicFilterTextTargets(row, preset);
          const active = targets.find(publicFilterOptionSelected);
          if (active && !selected.includes(preset)) selected.push(preset);
        }
      }
      const widgets = [];
      for (const el of Array.from(row.querySelectorAll('.ant-select,.el-select,[role="combobox"]'))) {
        if (!isVisible(el)) continue;
        const selectedEls = el.querySelectorAll('.ant-select-selection-item,.el-select__tags-text,.el-input__inner');
        const value = Array.from(selectedEls).map((x) => normalizeText(x.innerText || x.value || '')).filter((x) => x && !/^(请选择|输入|搜索)$/.test(x));
        if (value.length) widgets.push({ value });
      }
      entries.push({ label, fields, selected, widgets });
    }
    return { version: 1, savedAt: Date.now(), entries };
  }

  function savePublicFilterSnapshot() {
    if (!publicPoolFilterActive() || publicPoolRestoreBusy) return;
    try {
      const previous = localStorage.getItem(PUBLIC_FILTER_STORAGE_KEY);
      const snapshot = readPublicFilterSnapshot();
      if (!snapshot.entries.length) {
        console.warn('[云客助手] 没识别到公海筛选控件，本次不保存');
        return;
      }
      localStorage.setItem(PUBLIC_FILTER_STORAGE_KEY, JSON.stringify(snapshot));
      if (!previous) toast('已记住这次公海筛选，下次进入会自动恢复', false, true);
      console.log('[云客助手] 已保存公海筛选条件', snapshot.entries.map((x) => x.label));
    } catch (e) {
      console.warn('[云客助手] 保存公海筛选失败', e);
    }
  }

  function restorePublicInput(el, field) {
    if (field.type === 'checkbox' || field.type === 'radio') {
      if (!!el.checked !== !!field.checked) realClick(el);
      return;
    }
    if (String(el.value || '') === String(field.value || '')) return;
    try {
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype
        : el.tagName === 'SELECT' ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
      const desc = Object.getOwnPropertyDescriptor(proto, 'value');
      if (desc && desc.set) desc.set.call(el, field.value || '');
      else el.value = field.value || '';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (e) {}
  }

  async function restorePublicFilterSnapshot(snapshot) {
    if (!snapshot || snapshot.version !== 1 || !Array.isArray(snapshot.entries)) return false;
    for (const item of snapshot.entries) {
      let row = publicFilterRow(item.label);
      if (!row) continue;
      for (const field of (item.fields || [])) {
        row = publicFilterRow(item.label) || row;
        const controls = Array.from(row.querySelectorAll('input,select,textarea')).filter((el) => isVisible(el));
        const el = controls[field.index];
        if (!el || el.tagName.toLowerCase() !== field.tag || String(el.type || '').toLowerCase() !== field.type) continue;
        if (field.placeholder && String(el.placeholder || '') !== field.placeholder) continue;
        restorePublicInput(el, field);
      }
      for (const value of (item.selected || [])) {
        row = publicFilterRow(item.label) || row;
        const inRow = publicFilterTextTargets(row, value);
        const target = inRow.find((el) => !publicFilterOptionSelected(el)) || inRow[0];
        if (!target) continue;
        // 已选项无需重复点击；日期快捷项可能在多个嵌套节点出现，只点最小的可点击元素。
        const current = publicFilterTextTargets(row, value).some(publicFilterOptionSelected);
        if (!current) realClick(getClickableAncestor(target) || target);
        await sleep(120);
      }
      for (const widget of (item.widgets || [])) {
        for (const value of (widget.value || [])) {
          row = publicFilterRow(item.label) || row;
          const currentText = normalizeText(row.innerText || row.textContent);
          if (currentText.includes(normalizeText(value))) continue;
          const trigger = row.querySelector('.ant-select-selector,.el-input__wrapper,[role="combobox"]');
          if (trigger) realClick(trigger);
          await sleep(180);
          const options = findClickablesByText(value).filter((el) => isVisible(el));
          const option = options.sort((a, b) => {
            const popupDiff = Number(inPopupLayer(b)) - Number(inPopupLayer(a));
            return popupDiff || rectDist(a, row) - rectDist(b, row);
          })[0];
          if (option) realClick(getClickableAncestor(option) || option);
          await sleep(150);
        }
      }
    }
    await sleep(250);
    if (!publicPoolFilterActive()) return false;
    const anchor = findClickablesByText('划入公海时间')[0] || document.body;
    const query = findClickablesByText('查询')
      .filter((el) => isVisible(el) && !el.closest('#yk_helper_panel, #yk_helper_fab, #yk_helper_toast'))
      .sort((a, b) => rectDist(a, anchor) - rectDist(b, anchor))[0];
    if (!query) return false;
    realClick(getClickableAncestor(query) || query);
    await sleep(500);
    return true;
  }

  function publicPoolFilterTick() {
    const active = publicPoolFilterActive();
    if (!active) { publicPoolWasActive = false; return; }
    if (publicPoolWasActive) return;
    publicPoolWasActive = true;
    publicPoolEntryAt = Date.now();
    let snapshot = null;
    try { snapshot = JSON.parse(localStorage.getItem(PUBLIC_FILTER_STORAGE_KEY) || 'null'); } catch (e) {}
    if (!snapshot || !Array.isArray(snapshot.entries)) return; // 首次使用，先让用户照常筛选一次
    publicPoolRestoreBusy = true;
    (async () => {
      await sleep(1000); // 等公海页及筛选控件完成首轮渲染
      if (!publicPoolFilterActive() || Date.now() - publicPoolEntryAt > 15000) return;
      const ok = await restorePublicFilterSnapshot(snapshot);
      if (ok) toast('✓ 已恢复上次公海筛选并自动查询', false, true);
      else toast('公海筛选已记住，但本次页面控件未就绪；请手动点查询', true, true);
    })().catch((e) => {
      console.warn('[云客助手] 恢复公海筛选失败', e);
      toast('公海筛选恢复失败，请手动点查询', true, true);
    }).finally(() => { publicPoolRestoreBusy = false; });
  }

  // [v1.17.8] 提交被 CRM 的"请挂断电话"拦住时的兜底：手机端早挂了、页面没同步成结束态，
  // 于是提交永远过不去。这里补点一次页面挂断把状态推过去，再重提。
  // 判活闸门与挂断步骤共用：新一通在拨、或页面计时器还在往前走 = 有真人通话，绝不补点，
  // 宁可让这一通提交失败并提示，也不掐断别人的电话。
  async function staleHangupSync(log, opts) {
    // [v1.19.3] 只有自动流程才需要这几道闸。手动流程走到这里，说明 CRM 已经用「请挂断电话」
    // 把提交拦住了——那正是页面在要求挂断这一通；再拿手机 dialing 拒绝，就卡成
    // 「通话中 + 挂断按钮 + 请挂断电话 + 插件拒绝挂」的死局（2026-11-04 真机截图）。
    const autoFlow = !!(opts && (opts.gentleHangup || opts.pageSelfEnded || opts.matchPhone || opts.evAt));
    if (autoFlow) {
      if (!phoneCallEndedFresh()) { log.push('手机未新鲜上报通话结束，扩展不点 CRM 挂断控件'); return false; }
      if (newCallDialing()) { log.push('⚠ 想补挂同步，但检测到新通话在拨，放弃'); return false; }
      // [v1.18.9] 手机已拨出更新的电话时绝不补点（补点掐掉的会是新一通）
      if (opts.evAt && phoneMovedOn(opts.evAt)) {
        log.push('⚠ 想补挂同步，但手机已拨出更新的电话（' + ((PW.__ykPhRow || {}).state || '') + '），放弃');
        return false;
      }
      // [v1.18.5] 手机说这通还在进行，就不点页面挂断
      if (phoneCallLive(false)) {
        log.push('⚠ 想补挂同步，但手机上报这通还在进行（' + ((PW.__ykPhRow || {}).state || '') + '），放弃');
        return false;
      }
      // [v1.18.4] 计时在往前走 = 真人通话，不点；冻结不动（残影）才允许点
      const live1 = readLiveCallTimer();
      if (live1 !== null) {
        await sleep(1000);
        const live2 = readLiveCallTimer();
        if (live2 !== null && live2 > live1) {
          log.push('⚠ 想补挂同步，但计时在走(' + live1 + '→' + live2 + 's)判为真人通话，放弃');
          return false;
        }
      }
    }
    for (const label of HANGUP_TEXTS) {
      const all = findClickablesByText(label).filter((el) => !/请挂断|请先/.test(normalizeText(el.innerText || el.textContent)));
      const btn = all.find((el) => getClickableAncestor(el).tagName === 'BUTTON') || all[0] || null;
      if (!btn) continue;
      if (!realClick(getClickableAncestor(btn))) return false;
      lastCrmHangupSyncAt = Date.now();
      log.push('提交被"请挂断电话"拦住 → 已点 CRM「' + label + '」同步页面；不向手机下挂断指令');
      await waitUntil(() => !hasVisibleText('通话中') || hasVisibleText('通话结束') || hasVisibleText('已挂断') ||
        findClickablesByText('挂断').length === 0, 6000, 80);
      return true;
    }
    log.push('⚠ 提交被拦，但页面上找不到可点的挂断按钮');
    return false;
  }

  // CRM 页面同步按钮点击时间：用于识别同一次挂断回报，避免重复点击页面。
  let lastCrmHangupSyncAt = 0;

  // 手动结果流程先请求手机挂断。若手机随后回执了同一通已结束，趁结果表单提交前
  // 先把 CRM 页面状态同步好，避免先提交被“请挂断电话”拦截、再同步、再提交的往返。
  function manualHangupConfirmedFor(snapshot) {
    if (!snapshot || !phoneCallEndedFresh() || newCallDialing()) return false;
    const ph = PW.__ykPhRow || {};
    const currentNumber = String(ph.number || '').replace(/\D/g, '');
    const sameNumber = !snapshot.number || !currentNumber || currentNumber === snapshot.number;
    const transitioned = Number(ph.stateAt || 0) > Number(snapshot.stateAt || 0) ||
      String(ph.state || '').toLowerCase() !== String(snapshot.state || '').toLowerCase();
    return sameNumber && transitioned;
  }
  async function syncCrmHangupAfterManualConfirm(log, snapshot) {
    if (!manualHangupConfirmedFor(snapshot)) return false;
    if (hasVisibleText('通话结束') || hasVisibleText('已挂断') || hasVisibleText('已结束') || hasVisibleText('呼叫结束')) {
      return true;
    }
    for (const label of HANGUP_TEXTS) {
      const all = findClickablesByText(label).filter((el) => !/请挂断|请先/.test(normalizeText(el.innerText || el.textContent)));
      const btn = all.find((el) => getClickableAncestor(el).tagName === 'BUTTON') || all[0] || null;
      if (!btn) continue;
      if (!realClick(getClickableAncestor(btn))) return false;
      lastCrmHangupSyncAt = Date.now();
      log.push('手机已确认本通挂断，提前同步 CRM 页面状态');
      const ended = await waitUntil(() =>
        hasVisibleText('通话结束') || hasVisibleText('已挂断') || hasVisibleText('已结束') || hasVisibleText('呼叫结束') ||
        (findClickablesByText('挂断').length === 0 && !hasVisibleText('通话中')), 900, 60
      );
      if (ended) log.push('CRM 挂断状态已同步，直接提交一次');
      return ended;
    }
    return false;
  }

  async function runFlow(flow, opts) {
    if (running) {
      if (opts && opts.pendingEventId && typeof PW.__YK_PENDING_UPDATE__ === 'function') {
        PW.__YK_PENDING_UPDATE__(opts.pendingEventId, { state: 'queued', nextRetryAt: Date.now() + 1500, leaseUntil: 0, lastError: '上一个流程仍在处理' });
      }
      ykStatusUpdate({ progress: '上一个流程仍在处理', outcome: '本次触发未执行，请稍候' });
      toast('上一个流程还在跑，请稍候');
      return;
    }
    running = true;
    const log = [];
    // [v1.19.4] 每条日志都带上从流程开始算起的毫秒：「手机挂了、电脑半天才动」到底慢在哪一段
    // （等页面确认通话结束 / 展开结果 tab / 提交被拦再补挂），提示条和中转表里直接能看见。
    const tFlow0 = Date.now();
    const fastFlow = !!(opts && (opts.trigger === '联动' || opts.pendingEventId || opts.evAt || opts.trigger === '挂断事件自动补偿'));
    let submitOutcome = 'not-submitted';
    let submitClicked = false;
    let manualHangupCommandSent = false;
    let manualHangupSnapshot = null;
    let manualCrmFollowupBlocked = false;
    const slowPhases = [];
    const logPushRaw = log.push.bind(log);
    log.push = (m) => {
      const elapsed = Date.now() - tFlow0;
      logPushRaw('+' + elapsed + 'ms ' + m);
      ykStatusUpdate({ progress: String(m), outcome: '处理中 · ' + (elapsed / 1000).toFixed(1) + '秒' });
    };
    ykStatusUpdate({ flow: flow.name, progress: '开始执行「' + flow.name + '」', outcome: '处理中' });
    toast('▶ ' + flow.name, false, true);
    try {
      // [v1.9.7→v1.17.6 移除] 这里原来有"一对一核对"：手机上报的号码尾号不在当前页面就跳过提交。
      // 回拨线路拿不到平台号→客户号映射时必然对不上，误报太多，用户明确要求去掉，
      // 现在联动到谁就标谁。上报的号码仍打在 [联动计时] 日志里，事后要查得到。
      // opts.matchPhone 继续传给下面的 autoTrigger 当"自动触发"标记用。
      for (const step of flow.steps) {
        // 手动挂断先继续执行手机挂断请求；客户页匹配失败只暂停 CRM 跟进步骤，不能拦住挂断。
        if (manualCrmFollowupBlocked && step.act !== 'hangup') {
          const blockMessage = manualHangupCommandSent
            ? '手机挂断请求已交给中转并按同一通电话补发一次；手机是否已断开以手机状态为准。CRM 客户页无法唯一匹配，跟进录入已暂停，未写入错误客户。切到正确客户页后再选择跟进结果。'
            : 'CRM 客户页无法唯一匹配，跟进录入已暂停。手机挂断请求未送达，请直接在手机或云客通话页手动挂断，再切到正确客户页。';
          log.push(blockMessage);
          throw new Error(blockMessage);
        }
        const phaseStartedAt = Date.now();
        const phaseName = step.act === 'click' ? '选择「' + step.text + '」'
          : step.act === 'submit' ? 'CRM提交'
            : step.act === 'expandMore' ? '展开结果'
            : step.act === 'hangup' ? '挂断同步' : step.act;
        ykStatusUpdate({ progress: phaseName, outcome: '处理中' });
        try {
        if (step.act === 'hangup') {
          // 自动/联动触发的保护逻辑（连续拨打被打断的根因修复）：
          // 云客连续拨打在上一通结束后几秒内就自动拨下一通，此时页面上的"通话中"
          // 是新电话的——流程绝不能点挂断，否则每轮流程都会掐死下一通，队列被烧光。
          const autoTrigger = !!(opts && (opts.gentleHangup || opts.pageSelfEnded || opts.matchPhone));
          const crmAlreadyEnded = hasVisibleText('通话结束') || hasVisibleText('已挂断') || hasVisibleText('已结束') || hasVisibleText('呼叫结束');
          if (!autoTrigger && !phoneCallEndedFresh() && !crmAlreadyEnded) {
            if (typeof PW.__YK_MANUAL_PHONE_ACTIVE__ === 'function' && PW.__YK_MANUAL_PHONE_ACTIVE__()) {
              const commandAt = Date.now();
              const mobileBeforeHangup = PW.__ykPhRow || {};
              manualHangupSnapshot = {
                state: String(mobileBeforeHangup.state || '').toLowerCase(),
                stateAt: Number(mobileBeforeHangup.stateAt) || 0,
                number: String(mobileBeforeHangup.number || '').replace(/\D/g, ''),
              };
              const manualFlowMarker = { at: commandAt, number: String(mobileBeforeHangup.number || '') };
              PW.__YK_MANUAL_FLOW_HANGUP__ = manualFlowMarker;
              try { localStorage.setItem('yk_manual_flow_hangup_v1', JSON.stringify(manualFlowMarker)); } catch (e) {}
              ykStatusUpdate({ progress: '正在请求手机 APK 挂断', outcome: '不等待状态表刷新，继续填写跟进' });
              const sent = typeof PW.__YK_REQUEST_MANUAL_HANGUP__ === 'function'
                ? await PW.__YK_REQUEST_MANUAL_HANGUP__('flow') : false;
              if (!sent) {
                if (PW.__YK_MANUAL_FLOW_HANGUP__ === manualFlowMarker) PW.__YK_MANUAL_FLOW_HANGUP__ = null;
                try { localStorage.removeItem('yk_manual_flow_hangup_v1'); } catch (e) {}
                log.push('挂断指令未送达手机 APK；仍按你选定的结果继续填写');
                ykStatusUpdate({ progress: '继续填写已选跟进结果', outcome: '手机挂断请求未送达；已跳过状态确认' });
              } else {
                manualHangupCommandSent = true;
                log.push('挂断请求已交给手机中转；等待手机回报，继续跟进流程');
              }
            } else {
              ykStatusUpdate({ progress: '按手动选择继续填写跟进', outcome: '不等待手机状态表确认' });
              log.push('手机状态未连接或已过期；按你选定的结果继续填写，跳过 CRM 挂断控件');
            }
          }
          // [v1.19.7] 联动/自动触发的挂断点击只是"把页面推到结束态"，绝不回头给手机下指令：
          // 手机这通本来就是它自己挂的，指令 0.2 秒后被取到时 CRM 常常已拨出下一通，掐掉的正是新一通。
          // [v1.17.8] 未接通不再"一律不点页面挂断"：那样页面会一直卡在通话中，CRM 直接拦住不让提交
          // （用户实测：手机挂了、电脑没跟着挂，跟进提交不了）。现在照样补点同步，
          // 但必须过下面两道闸门；万一被闸门挡住，提交步骤还有一层"请挂断电话"兜底。
          // 手动按键是用户看着屏幕主动结束这通，不在此列。
          const needGuard = autoTrigger || !!(opts && opts.noAnswer);
          if (opts && opts.pageSelfEnded) {
            // 触发时页面已确认自行结束通话（自动模式的通话结束监听观察到的）
            log.push('页面已自行结束通话，跳过点挂断');
            continue;
          }
          if (needGuard) {
          // 手动结果流程由用户明确选择。若手机此时仍显示通话中/下一通，
            // 不点 CRM 挂断控件，避免误伤电话，直接继续提交用户刚选定的结果。
            if (manualHangupCommandSent && (phoneCallLive(false) || newCallDialing())) {
              log.push('挂断请求已发出，但手机状态仍显示通话中/下一通；跳过 CRM 挂断控件，继续提交当前手动选定结果');
              continue;
            }
            // [v1.18.9] 点下去之前再问一次：手机是不是已经拨出比这条事件更新的一通了
            if (opts && opts.evAt && phoneMovedOn(opts.evAt)) {
              log.push('手机已拨出更新的电话（' + ((PW.__ykPhRow || {}).state || '') + '），跳过点挂断');
              console.warn('[云客助手][防误挂] 联动事件已被更新的手机状态取代，跳过挂断');
              continue;
            }
            // 手机仍报告拨号/通话中，而且不是事件之后的新一通：暂停整个流程，等 APK 挂断。
            if (!crmAlreadyEnded && phoneCallLive(false) && !manualHangupCommandSent && !phoneHangupEventFresh(opts)) {
              log.push('手机仍报告通话中（' + ((PW.__ykPhRow || {}).state || '') + '），扩展暂停 CRM 同步/提交');
              console.warn('[云客助手][挂断职责] 手机 APK 尚未结束当前通话，扩展暂停操作');
              throw new Error('手机 APK 仍报告拨号/通话中；扩展已暂停 CRM 同步和提交，等手机挂断后再继续。');
            }
            // [v1.17.5] 两道闸门从"仅 gentleHangup"里提出来：之前用 { pageSelfEnded } 之外的
            // 自动路径（如自动模式倒计时）触发时完全不设防，照样能点掉正在拨的下一通。
            if (newCallDialing()) {
              log.push('检测到新通话在拨，跳过点挂断');
              continue;
            }
            // [v1.14.4] 计时器双采样判活（误挂根因修复）：
            // 老闸门只防"计时<20s 的新通话"，若 CRM 已切到下一通且老师已讲 20s+，
            // 计时器 ≥20s 会放行 → 点挂断掐断真人通话 = 误挂。
            // 现在读两次计时器（间隔 1 秒）：还在走 = 有真人正在通话，绝不点；
            // 冻结不动 = 已结束通话的残影，才允许点挂断做同步。
            const live1 = readLiveCallTimer();
            // [v1.18.4] 阈值从 20 秒降到「只要计时在走」：刚接通十几秒也是真人通话，
            // 老阈值让这段时间完全不设防，自动路径会点掉 CRM 刚拨出去的新电话。
            if (live1 !== null) {
              await sleep(1000);
              const live2 = readLiveCallTimer();
              if (live2 !== null && live2 > live1) {
                log.push('检测到正在进行的通话（计时 ' + live1 + 's→' + live2 + 's），绝不挂断');
                console.warn('[云客助手][防误挂] 页面计时器在走(' + live1 + '→' + live2 + 's)，跳过挂断');
                continue;
              }
            }
          }
          if (opts && opts.gentleHangup) {
            // CRM 页面同步点击之后收到同一通手机回报，不再重复点击页面。
            if (opts.evAt && lastCrmHangupSyncAt && opts.evAt >= lastCrmHangupSyncAt - 2000) {
              log.push('CRM 页面 ' + Math.max(1, Math.round((Date.now() - lastCrmHangupSyncAt) / 1000)) + ' 秒前已同步挂断，本次不重复点击');
              console.log('[云客助手][防重复] 跳过同一通的 CRM 页面重复同步');
              continue;
            }
            // 信号新鲜（通话刚结束 2.5 秒内）：页面上的"通话中"必然是没同步的旧状态，
            // 直接立即补点挂断，不等任何超时 —— 这是"手机挂了页面慢半拍"的主修复。
            const fresh = typeof opts.eventAge === 'number' && opts.eventAge < 4000;
            if (!fresh) {
              // 老信号（可能被延迟处理）：先给页面 2.5 秒自己同步
              const selfEnded = await waitUntil(() => {
                const btns = findClickablesByText('挂断').filter((el) => !/请挂断|请先/.test(normalizeText(el.innerText || el.textContent)));
                return btns.length === 0 && !hasVisibleText('通话中');
              }, 1200, 100);
              if (selfEnded) { log.push('CRM已自行挂断，跳过点挂断'); continue; }
            }
            log.push(fresh ? '通话刚结束，立即补点挂断同步' : '页面疑似卡在通话中，补点挂断同步');
          }
          // [v1.19.7→v1.22.9] 手动挂断与 CRM 客户匹配分离：先保存身份核对结果，继续执行手机挂断；
          // 若无法唯一匹配，只在下一步 CRM 跟进填写/提交前暂停，绝不把跟进写到错误客户。
          if (!autoTrigger) {
            const alignment = await alignToLivePhoneCall(log);
            if (alignment.active && !alignment.aligned) {
              manualCrmFollowupBlocked = true;
              const message = '手机通话客户无法唯一匹配 CRM 页面；继续处理手动挂断，后续跟进录入暂停';
              log.push(message);
              ykStatusUpdate({ progress: '手动挂断继续 · CRM 跟进暂停', outcome: '客户页未唯一匹配' });
            }
          }
          // 手机状态轮询与结果按钮点击并行。最多额外等 300ms 捕获刚到的本通挂断回执；
          // 只有客户详情仍匹配、手机明确结束同一通且没有下一通在拨时，才提前同步 CRM。
          // 没等到回执就走原兜底，不额外拖慢流程，也不碰手机上的下一通。
          if (!autoTrigger && manualHangupCommandSent && manualHangupSnapshot && !manualCrmFollowupBlocked &&
              currentCustomerDetailMatches('', manualHangupSnapshot.number)) {
            const confirmed = await waitUntil(() => manualHangupConfirmedFor(manualHangupSnapshot), 300, 50);
            if (confirmed) await syncCrmHangupAfterManualConfirm(log, manualHangupSnapshot);
          }
          // [v1.16.8] 页面已经在结束态（被拒/秒挂后 CRM 自己同步成"通话结束/已挂断"）——
          // 手机端显然已挂断：跳过整个挂断步骤，直接进"未接通"结果选择（用户明确要求）
          if (hasVisibleText('通话结束') || hasVisibleText('已挂断') || hasVisibleText('已结束') || hasVisibleText('呼叫结束')) {
            log.push('页面已挂断，跳过挂断步骤，直接选未接通');
          } else {
          if (!phoneCallEndedFresh() && !phoneHangupEventFresh(opts)) {
            if (!autoTrigger) {
              log.push('手动结果流程不等待手机确认；跳过 CRM 挂断控件，继续填写跟进');
              ykStatusUpdate({ progress: '继续填写已选跟进结果', outcome: '跳过等待手机状态确认' });
              continue;
            }
            log.push('自动联动尚无本通手机挂断回执，暂停 CRM 挂断同步');
            throw new Error('还没有收到本通手机挂断回执。自动跟进已暂停，请检查 APK 联动。');
          }
          if (!phoneCallEndedFresh() && phoneHangupEventFresh(opts)) {
            log.push('已收到 APK 本通挂断事件，不等待手机状态表刷新，继续同步 CRM 跟进');
          }
          // 只要页面上还有挂断按钮，就一定先挂断。
          // 注意：跟进表单（有意向/无意向...）在某些布局下是常驻可见的，
          // 不能用"结果面板已在"来跳过挂断，否则通话中就去点提交，被 CRM 拦下（"请挂断电话"）。
          let hangBtn = null, usedLabel = '';
          for (const label of HANGUP_TEXTS) {
            const all = findClickablesByText(label).filter((el) => {
              // 排除"请挂断电话"这类校验提示气泡
              const t = normalizeText(el.innerText || el.textContent);
              return !/请挂断|请先/.test(t);
            });
            const btn = all.find((el) => getClickableAncestor(el).tagName === 'BUTTON') || all[0] || null;
            if (btn) { hangBtn = btn; usedLabel = label; break; }
          }

          if (hangBtn) {
            if (!realClick(getClickableAncestor(hangBtn))) throw new Error('挂断按钮点击失败');
            log.push('已点击' + usedLabel);
            lastCrmHangupSyncAt = Date.now();
            log.push('已点击 CRM 挂断控件同步页面；未向手机下挂断指令');
            // 等待真正的通话结束：出现结束文案，或挂断按钮消失且「通话中」状态消失
            const ended = await waitUntil(() =>
              hasVisibleText('通话结束') ||
              hasVisibleText('已挂断') ||
              hasVisibleText('已结束') ||
              hasVisibleText('呼叫结束') ||
              (findClickablesByText('挂断').length === 0 && !hasVisibleText('通话中')),
              15000, 80
            );
            // [v1.14.6] 超时不再报错弹窗（用户反馈吓人）：手机端早已挂断，这里只是页面同步问题，
            // 静默记录后继续走选结果流程；若 CRM 真的没挂断，后续提交会被"请挂断电话"校验拦下并提示
            if (!ended) log.push('⚠ 15秒未检测到通话结束文案，继续流程');
          } else if (hasVisibleText('通话中') || hasVisibleText('拨打中')) {
            // [v1.16.7] 兜底：被拒/秒挂的通话，页面常停在"拨打中"胶囊、没有挂断按钮
            // （此前这类通话全走人工弹窗，v1.16.4 起自动跑流程才暴露此坑）。三步兜底：
            // ① 点"拨打中/通话中"胶囊尝试展开出挂断按钮；② 等 4 秒页面自行进入结束态；
            // ③ 仍不行就按已挂断继续——提交前还有"请挂断电话"校验兜底，不会误提交。
            log.push('没有挂断按钮，尝试点开通话胶囊…');
            let hb2 = null, lb2 = '';
            const pill = pickSmallest(
              findClickablesByText('拨打中')
                .concat(findClickablesByText('通话中'))
                .filter((el) => !/请挂断/.test(normalizeText(el.innerText || el.textContent)))
            );
            if (pill) {
              try { realClick(getClickableAncestor(pill)); log.push('已点开通话胶囊'); } catch (e) {}
              await sleep(900);
              for (const label of HANGUP_TEXTS) {
                const all2 = findClickablesByText(label).filter((el) => !/请挂断|请先/.test(normalizeText(el.innerText || el.textContent)));
                const b2 = all2.find((el) => getClickableAncestor(el).tagName === 'BUTTON') || all2[0] || null;
                if (b2) { hb2 = b2; lb2 = label; break; }
              }
              if (hb2) {
                if (!realClick(getClickableAncestor(hb2))) throw new Error('挂断按钮点击失败');
                log.push('展开后已点击' + lb2);
                lastCrmHangupSyncAt = Date.now();
                log.push('已点击 CRM 挂断控件同步页面；未向手机下挂断指令');
                await waitUntil(() =>
                  hasVisibleText('通话结束') || hasVisibleText('已挂断') || hasVisibleText('已结束') ||
                  hasVisibleText('呼叫结束') ||
                  (findClickablesByText('挂断').length === 0 && !hasVisibleText('通话中')), 8000, 80);
              }
            }
            if (!hb2) {
              const selfEnd = await waitUntil(() =>
                hasVisibleText('通话结束') || hasVisibleText('已挂断') || hasVisibleText('已结束') || hasVisibleText('呼叫结束'),
                4000, 100);
              log.push(selfEnd ? '页面已自行进入结束态' : '⚠ 未见挂断按钮/结束态，按已挂断继续（提交前有校验兜底）');
            }
          } else {
            log.push('未找到挂断按钮，按已挂断处理');
          }
          } // [v1.16.8] else：页面已挂断时跳过上面全部挂断逻辑
          await sleep(80); // 等 UI 稳定
          log.push('通话已结束');
          toast('CRM 页面已同步结束，正在选择结果…');

        } else if (step.act === 'expandMore') {
          // [v1.9.9] 只认"结果区"的目标文字：全页搜索会被通话列表/跟进记录里的
          // 同名历史文字骗到跳过展开（同事机器翻车根因：未明确藏在"..."里却报"已显示"）
          if (step.ensureText && panelHasVisibleText(step.ensureText)) {
            log.push(step.ensureText + ' 已显示');
          } else {
            // [v1.17.3] 展开按钮逐个候选点，点完直接确认目标露出来，不再点一次就死等 4 秒
            const got = await tryExpandMore(log, step.ensureText);
            if (!got) {
              // 报错分诊：老版一律"展开后没有找到"，看不出是页面真没这项还是没展开成功
              throw new Error(textExistsAnywhere(step.ensureText)
                ? '「' + step.ensureText + '」在页面里但没展开出来（结果区里的按钮都试过了），请确认当前客户页面后重试'
                : '页面里没有「' + step.ensureText + '」这个通话结果（CRM 改版改名，或该客户/号码不适用）');
            }
          }

        } else if (step.act === 'click') {
          const tried = new Set(); // 已点过但没生效的元素，重试时换下一个候选
          // 已选中的目标直接跳过，父 tab 还要求子选项与目标同面板显示。
          // 不能只看子选项文字是否可见——沟通记录里的"无人接听"等历史文字会造成误判。
          {
            const preTarget = locateTarget(step, tried);
            if (preTarget && isElementSelected(preTarget)) {
              // 子结果在自动补偿重跑时可能已被上次选中；重复点可能把单选状态取消。
              if (!step.afterText) { log.push(step.text + ' 已选中，跳过'); continue; }
              const nearChild = findClickablesByText(step.afterText).some((c) => {
                const ca = commonAncestor(c, preTarget);
                return ca && elArea(ca) < window.innerWidth * window.innerHeight * 0.25;
              });
              if (nearChild) { log.push(step.text + ' 已选中，跳过'); continue; }
            }
          }

          const attempts = (step.retryCount || 0) + 1;
          let done = false, lastErr = '';
          for (let i = 0; i < attempts && !done; i++) {
            // 有 parentTab 时优先"就近等待"：等同面板的子选项真正渲染出来再点
            let appeared;
            if (step.parentTab) {
              const appearTimeout = fastFlow ? 700 : (step.waitTimeout || 5000) / 2;
              appeared = await waitForNearChild(step.text, step.parentTab, appearTimeout, fastFlow ? 25 : 30);
              if (!appeared) appeared = await waitForText(step.text, fastFlow ? 350 : (step.waitTimeout || 5000) / 2, fastFlow ? 25 : 30);
            } else {
              appeared = await waitForText(step.text, fastFlow ? 900 : (step.waitTimeout || 5000), fastFlow ? 25 : 30);
            }
            if (!appeared) { lastErr = '页面中没有出现「' + step.text + '」'; break; }

            const target = locateTarget(step, tried);
            if (!target) { lastErr = '没找到可点击的「' + step.text + '」'; break; }

            // 第 1 次普通 click；无效则升级为完整鼠标事件序列
            if (i === 0) clickElement(target);
            else realClick(target);
            log.push('点了 ' + step.text + (i > 0 ? '(重试' + i + ')' : ''));

            if (step.afterText) {
              // 父 tab（有意向/无意向/资料错误/二次呼叫/未明确）的子选项用"就近等待"，
              // 不被历史记录里的同名文字骗到提前点击
              let childAppeared;
              const parentKey = step.parentTab || step.text;
              if (step.parentTab || TOP_TABS.includes(step.text)) {
                childAppeared = await waitForNearChild(step.afterText, parentKey, fastFlow ? 900 : (step.waitTimeout || 3000), fastFlow ? 25 : 50);
                if (!childAppeared) childAppeared = await waitForText(step.afterText, fastFlow ? 400 : 1000, fastFlow ? 25 : 50);
              } else {
                childAppeared = await waitForText(step.afterText, fastFlow ? 900 : (step.waitTimeout || 3000), fastFlow ? 25 : 50);
              }
              if (!childAppeared) {
                // 已选中也点不出来？可能子选项藏在"..."里，展开后再找一次
                if (isElementSelected(target) || i > 0) {
                  await tryExpandMore(log, step.afterText);
                  childAppeared = await waitForText(step.afterText, fastFlow ? 900 : 2500, fastFlow ? 25 : 50);
                }
              }
              if (childAppeared) {
                done = true;
              } else {
                lastErr = '点击「' + step.text + '」后没有出现「' + step.afterText + '」';
                // 普通点击(i=0)失败先别换候选——重试会用完整鼠标事件序列点同一个；
                // 强化点击(i>=1)也失败才换下一个候选
                if (i >= 1) tried.add(target);
                if (isElementSelected(target)) {
                  // tab 已处于选中态，继续重试点击反而可能把它点回去 → 直接放弃重试
                  break;
                }
                await sleep(step.retryDelay || 200);
              }
            } else {
              // 选项点击一次后留少量时间让 CRM 保存状态
              await sleep(60);
              done = true;
            }
          }
          if (!done && lastErr) throw new Error(lastErr + '（已重试' + (attempts - 1) + '次）');

        } else if (step.act === 'fillNote') {
          let noteEl = null;
          const visibleTextareas = $$('textarea').filter((t) => t.offsetParent !== null);
          for (const t of visibleTextareas) {
            const ph = (t.placeholder || '').toLowerCase();
            if (/备注|记录|跟进/.test(ph)) { noteEl = t; break; }
          }
          if (!noteEl && visibleTextareas.length) noteEl = visibleTextareas[visibleTextareas.length - 1];
          if (noteEl) {
            const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
            setter.call(noteEl, step.text);
            noteEl.dispatchEvent(new Event('input', { bubbles: true }));
            noteEl.dispatchEvent(new Event('change', { bubbles: true }));
            noteEl.blur();
            log.push('备注 ' + step.text);
          } else {
            log.push('没找到备注框');
          }

        } else if (step.act === 'claimCustomer') {
          const els = findClickablesByText('领取客户');
          if (els.length) {
            realClick(getClickableAncestor(pickSmallest(els)));
            log.push('领取客户');
            await sleep(50);
          } else {
            log.push('没找到领取客户');
          }

        } else if (step.act === 'toggleDial') {
          // 空格切换拨号状态：正在拨号 → 暂停（挂断+停止连续拨打）；已暂停 → 恢复（点开始拨号）
          const RESUME_TEXTS = ['开始拨号', '继续拨号', '恢复拨号', '开始外呼', '继续外呼'];
          const PAUSE_TEXTS = ['停止连续拨打', '暂停拨号', '暂停外呼', '停止拨号'];
          let action = '';
          for (const t of RESUME_TEXTS) {
            const els = findClickablesByText(t);
            if (els.length) {
              realClick(getClickableAncestor(pickSmallest(els)));
              action = '▶ 已恢复拨号（点了「' + t + '」）';
              break;
            }
          }
          if (!action) {
            // 暂停前先把进行中的通话挂断（若有）
            if (findClickablesByText('挂断').length || hasVisibleText('通话中')) {
              try {
                let hangBtn = null;
                for (const label of HANGUP_TEXTS) {
                  const all = findClickablesByText(label).filter((el) => !/请挂断|请先/.test(normalizeText(el.innerText || el.textContent)));
                  const b = all.find((el) => getClickableAncestor(el).tagName === 'BUTTON') || all[0] || null;
                  if (b) { hangBtn = b; break; }
                }
                if (hangBtn) {
                  realClick(getClickableAncestor(hangBtn));
                  log.push('已挂断');
                  await waitUntil(() =>
                    hasVisibleText('通话结束') || hasVisibleText('已挂断') ||
                    (findClickablesByText('挂断').length === 0 && !hasVisibleText('通话中')),
                    15000, 80
                  );
                }
              } catch (e2) { log.push('挂断等待超时，继续暂停'); }
            }
            for (const t of PAUSE_TEXTS) {
              const els = findClickablesByText(t);
              if (els.length) {
                realClick(getClickableAncestor(pickSmallest(els)));
                action = '⏸ 已暂停拨号（点了「' + t + '」）';
                break;
              }
            }
            if (!action) action = '';
          }
          if (action) {
            log.push(action);
            toast(action);
          } else {
            log.push('没找到拨号控制按钮');
            toast('没找到「开始拨号/停止连续拨打」按钮，本次未操作', true);
          }

        } else if (step.act === 'publicFilter') {
          await runPublicFilter(log);

        } else if (step.act === 'submit') {
          const els = findClickablesByText('提交');
          if (els.length) {
            const submitBtn = getClickableAncestor(pickSmallest(els));
            if (!realClick(submitBtn)) throw new Error('提交按钮点击失败');
            submitClicked = true;
            if (opts && opts.pendingEventId && typeof PW.__YK_PENDING_UPDATE__ === 'function') {
              PW.__YK_PENDING_UPDATE__(opts.pendingEventId, { state: 'submitting', submittedAt: Date.now(), leaseUntil: Date.now() + 60000 });
            }
            submitOutcome = 'pending';
            log.push('提交');
            // [v1.14.1] 提交后自适应收尾：按钮消失或出现拦截提示就立刻继续，
            // 不再固定等 700+500ms（快节奏下这段尾巴会拖慢下一通事件的消费）
            let currentSubmitButtons = [];
            let validationBlocked = false;
            const settled = await waitUntil(() => {
              currentSubmitButtons = findClickablesByText('提交');
              validationBlocked = hasVisibleText('不可为空') || hasVisibleText('提交失败');
              return currentSubmitButtons.length === 0 || validationBlocked;
            }, 900, 60);
            if (settled && !validationBlocked && currentSubmitButtons.length === 0) {
              submitOutcome = 'confirmed';
              log.push('提交已生效');
            }
            // [v1.17.8] 手机挂了但页面还停在"通话中"时，CRM 会用"请挂断电话"拦住提交。
            // 提示条可能一闪而过，所以同时认"提交按钮还在 + 页面仍显示通话中"这种卡住状态。
            const blockedByCall = hasVisibleText('请挂断电话') || hasVisibleText('请先挂断') ||
              (currentSubmitButtons.includes(submitBtn) && hasVisibleText('通话中'));
            if (blockedByCall && await staleHangupSync(log, opts)) {
              const els2 = findClickablesByText('提交');
              if (els2.length) {
                realClick(getClickableAncestor(pickSmallest(els2)));
                submitOutcome = 'pending';
                log.push('重新提交');
                const retrySettled = await waitUntil(() => {
                  currentSubmitButtons = findClickablesByText('提交');
                  validationBlocked = hasVisibleText('不可为空') || hasVisibleText('提交失败');
                  return currentSubmitButtons.length === 0 || validationBlocked;
                }, 1200, 60);
                if (retrySettled && !validationBlocked && currentSubmitButtons.length === 0) submitOutcome = 'confirmed';
              }
            }
            // CRM 校验提示检查（如"沟通意向不可为空"），拦截时明确告警
            validationBlocked = validationBlocked || hasVisibleText('不可为空') || hasVisibleText('提交失败');
            if (validationBlocked) {
              submitOutcome = 'blocked';
              log.push('⚠ CRM拦截：有必填项没选上');
            }
            // [v1.14.6] 按用户要求去掉"补点一次"：不再二次点击提交，只静默记录
            const still = findClickablesByText('提交');
            if (still.length && still.includes(submitBtn)) {
              if (submitOutcome !== 'blocked') submitOutcome = 'unconfirmed';
              log.push('提交按钮仍在（不补点）');
            } else if (submitOutcome === 'pending' && still.length === 0) {
              submitOutcome = 'confirmed';
            }
          } else {
            submitOutcome = 'missing';
            log.push('没找到提交');
          }
        }
        } finally {
          const phaseMs = Date.now() - phaseStartedAt;
          if (phaseMs >= 250) slowPhases.push({ name: phaseName, ms: phaseMs });
        }
      }
      // 注意：自动模式的默认流程固定为「未接通·无人接听」（F），
      // 不再跟随手动按过的流程变化（v1.8.6 用户明确要求；v1.16.1 F 改为未接通）
      const totalMs = Date.now() - tFlow0;
      const slowSummary = slowPhases.sort((a, b) => b.ms - a.ms).slice(0, 2)
        .map((x) => x.name + ' ' + (x.ms / 1000).toFixed(1) + '秒').join('、');
      const timingHint = totalMs >= 2500
        ? '\n⏱ 流程 ' + (totalMs / 1000).toFixed(1) + '秒；最慢：' + (slowSummary || '页面响应')
        : '';
      const outcomeText = submitOutcome === 'confirmed' ? 'CRM 已确认保存'
        : submitOutcome === 'unconfirmed' ? '已点提交，CRM 尚未确认保存'
          : submitOutcome === 'blocked' ? 'CRM 拦截了提交'
            : submitOutcome === 'missing' ? '未找到提交按钮'
              : submitOutcome === 'pending' ? '已提交，仍在等 CRM 确认'
                : '流程已结束';
      ykStatusUpdate({
        progress: '流程结束 · ' + (totalMs / 1000).toFixed(1) + '秒',
        outcome: outcomeText + (slowSummary ? '；较慢步骤：' + slowSummary : ''),
      });
      if (submitOutcome === 'confirmed' && opts && opts.pendingEventId && typeof PW.__YK_PENDING_REMOVE__ === 'function') {
        PW.__YK_PENDING_REMOVE__(opts.pendingEventId);
      } else if (opts && opts.pendingEventId && typeof PW.__YK_PENDING_UPDATE__ === 'function') {
        const attempts = Number(opts.retryAttempt || 1);
        const canRetry = !submitClicked && attempts < 3;
        PW.__YK_PENDING_UPDATE__(opts.pendingEventId, {
          state: submitClicked ? 'submit-uncertain' : (canRetry ? 'queued' : 'needs-review'),
          nextRetryAt: Date.now() + (canRetry ? 1500 * attempts : 0),
          leaseUntil: 0,
          workerTab: '',
          lastError: submitClicked
            ? '已点提交，但 CRM 未确认保存；为防重复跟进，需核对页面后再处理'
            : (canRetry ? '提交前步骤未完成，正在自动重试' : '自动重试 3 次后仍未确认提交，需核对页面'),
        });
      }
      if (submitOutcome === 'unconfirmed') {
        toast('⚠ 已点提交，但 CRM 尚未确认保存（提交按钮仍在/仍转圈）。请查看页面状态；流程不会重复提交。' + timingHint + '\n' + log.join(' | '), true, true);
      } else if (submitOutcome === 'blocked') {
        toast('⚠ CRM 拦截了提交：请查看页面上的必填提示或通话状态。' + timingHint + '\n' + log.join(' | '), true, true);
      } else if (submitOutcome === 'missing') {
        toast('⚠ 未找到提交按钮，本次跟进没有提交。' + timingHint + '\n' + log.join(' | '), true, true);
      } else {
        toast('✓ ' + flow.name + ' 完成' + timingHint + '\n' + log.join(' | '));
      }
    } catch (err) {
      console.error('[跟进助手] 流程出错', err);
      ykStatusUpdate({ progress: '操作未完成', outcome: String(err && err.message || '未知错误') });
      if (opts && opts.pendingEventId && typeof PW.__YK_PENDING_UPDATE__ === 'function') {
        const attempts = Number(opts.retryAttempt || 1);
        const canRetry = !submitClicked && attempts < 3;
        PW.__YK_PENDING_UPDATE__(opts.pendingEventId, {
          state: submitClicked ? 'submit-uncertain' : (canRetry ? 'queued' : 'needs-review'),
          nextRetryAt: Date.now() + (canRetry ? 1500 * attempts : 0),
          leaseUntil: 0,
          workerTab: '',
          lastError: String(err && err.message || '流程执行失败'),
        });
      }
      toast('✗ 操作未完成：' + err.message + '\n请确认当前打开的是对应客户页面后重试。', true);
    } finally {
      running = false;
      if (opts && opts.linkBusyTab) {
        try {
          const lock = JSON.parse(localStorage.getItem('yk_link_busy') || 'null');
          if (lock && lock.tab === opts.linkBusyTab) localStorage.removeItem('yk_link_busy');
        } catch (e) {}
      }
      // [v1.19.4] 只报慢的那几次（>2.5 秒）：把每一段的耗时写进中转，事后能查
      try {
        const total = Date.now() - tFlow0;
        if (total > 2500) {
          relayFetch(RELAY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-wb-webapp-access-key': RELAY_KEY },
            body: JSON.stringify({
              event_type: 'pc_stage',
              source: 'pc:stage:' + flow.name + ':' + String((opts && opts.trigger) || '手动') + ':' + log.join('|').slice(0, 230),
            }),
          }).catch(() => {});
        }
      } catch (e) {}
    }
    console.log('[跟进助手]', flow.name, '→', log.join(' | '));
  }

  // ============================================================
  // 诊断函数
  // ============================================================
  PW.__YK_DIAG__ = function () {
    const anchors = tabAnchorEls();
    const panel = findResultPanel();
    const cands = collectMoreCandidates(anchors);
    const rectOf = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return Math.round(r.left) + ',' + Math.round(r.top) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height);
    };
    const report = {
      分辨率: window.innerWidth + 'x' + window.innerHeight,
      是否iframe: window !== window.top,
      脚本版本: YK_BUILD + '（挂断事件自动补偿与提交状态核对）',
      后台计时Worker: (typeof workerTicks !== 'undefined' && workerTicks) ? '可用（后台不降速）' : '不可用（已退回原生定时器）',
      结果tab锚点数: anchors.length,
      结果tab位置: anchors.map((el) => normalizeText(el.innerText || el.textContent) + ' @' + rectOf(el)),
      结果面板: panel ? rectOf(panel) + ' <' + (String(panel.className || panel.tagName).split(/\s+/)[0]) + '>' : '圈不出来（退回全页判定）',
      展开按钮候选: cands.length ? cands.map((el) => describeMoreBtn(el) + ' @' + rectOf(el)) : '无（tab 条里没有可点的折叠按钮）',
      关键文本检测: {},
    };
    ['挂断', '挂机', '结束通话', '通话中', '通话结束', '有意向', '无意向', '资料错误', '二次呼叫', '未明确', '未接通', '无人接听', '拒绝', '意向不明', '稍后联系', '停机', '提交', '领取客户', '...'].forEach((t) => {
      report.关键文本检测['「' + t + '」'] = findClickablesByText(t).length + (textExistsAnywhere(t) ? ' (DOM里有)' : ' (DOM里没有)');
    });
    console.table(report.关键文本检测);
    console.log(report);
    return report;
  };

  // ============================================================
  // UI —— 简洁风格 + 可自定义按钮布局（显隐 / 排序 / 重命名，本地记忆）
  // ============================================================
  const LAYOUT_KEY = 'yk_flow_layout_v1';

  // v1.5.0 键位改版：1-8 → F/D/S/R/T/E/Z/Space。
  // 迁移原则：用户自定义过的（顺序/显隐/改名/键位）全部保留；
  // 没改过（仍是旧默认值）的直接采用新默认，绝不覆盖用户的手动修改。
  const KEY_MIGRATE = { '1': 'F', '2': 'D', '3': 'S', '4': 'T', '5': ' ', '6': 'R', '7': 'Z', '8': 'E' };
  const OLD_DEFAULT_ORDER = ['1', '2', '3', '4', '5', '6', '7', '8'];

  function migrateLayout(l) {
    if (!l || typeof l !== 'object' || l.km === 'v2') return l;
    if (Array.isArray(l.order)) {
      l.order = l.order.map((k) => (Object.prototype.hasOwnProperty.call(KEY_MIGRATE, k) ? KEY_MIGRATE[k] : k));
      // 顺序从没自定义过 → 改用新默认顺序
      if (l.order.join() === OLD_DEFAULT_ORDER.map((k) => KEY_MIGRATE[k]).join()) l.order = null;
    }
    if (Array.isArray(l.hidden)) {
      l.hidden = l.hidden.map((k) => (Object.prototype.hasOwnProperty.call(KEY_MIGRATE, k) ? KEY_MIGRATE[k] : k));
    }
    const ren = {};
    Object.keys(l.renames || {}).forEach((k) => { ren[KEY_MIGRATE[k] || k] = l.renames[k]; });
    l.renames = ren;
    const ks = {};
    Object.keys(l.keys || {}).forEach((k) => {
      const nk = KEY_MIGRATE[k] || k;
      // 旧键位值等于旧默认编号 = 没自定义过，丢弃让新默认生效；否则保留
      if (String(l.keys[k]) !== String(k)) ks[nk] = l.keys[k];
    });
    l.keys = ks;
    l.km = 'v2';
    saveLayout(l);
    return l;
  }

  function loadLayout() {
    try {
      const l = JSON.parse(localStorage.getItem(LAYOUT_KEY));
      return migrateLayout(l || {});
    } catch (e) { return {}; }
  }
  function saveLayout(l) { try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(l)); } catch (e) {} }

  function getLayoutState() {
    const saved = loadLayout();
    const order = Array.isArray(saved.order)
      ? saved.order.filter((k) => FLOWS.some((f) => f.hotkey === k))
      : [];
    // 新增的流程自动排到末尾
    FLOWS.forEach((f) => { if (!order.includes(f.hotkey)) order.push(f.hotkey); });
    const hidden = Array.isArray(saved.hidden) ? saved.hidden : [];
    const renames = saved.renames || {};
    const keys = saved.keys || {};
    return { order, hidden, renames, keys };
  }

  // 流程的实际触发键：自定义过用自定义的，否则用默认编号
  function getEffectiveKey(flow, keys) {
    return (keys && keys[flow.hotkey]) || flow.hotkey;
  }

  function flowDisplayName(flow, renames) {
    return (renames && renames[flow.hotkey]) || flow.name;
  }

  // 触发键的显示名：空格显示 Space，单字符大写，其余原样（F1、ArrowUp 等）
  function keyDisplay(key) {
    if (key === ' ' || String(key).toLowerCase() === 'space') return 'Space';
    const s = String(key);
    return s.length === 1 ? s.toUpperCase() : s;
  }

  // ============================================================
  // 自动模式设置与关键词识别
  // ============================================================
  const AUTO_KEY = 'yk_auto_settings_v1';
  const AUTO_DEFAULTS = { autoMode: true, autoSeconds: 0, useKeywords: false, lastFlow: 'F', linkFlow: 'D', execKey: 'Enter', noAnsOn: false, noAnsSec: 15, focusOnLink: false, connectNotice: true };

  // 手机挂断联动中转（APK POST 事件 → 这里轮询）
  // [v1.15.0] 改走本机中转：relay-server 跑在这台电脑的 8787 端口，不再依赖云端额度。
  const RELAY_URL = 'http://127.0.0.1:8787/rest/call_events';
  const RELAY_KEY = 'wbpk_RuRaegc67Ryj6IVBy2ukTz_IPFe58thPnT5ck005el76XpxYEWA0P5l';

  // ---- 联动网络层：云客页面直连本机 8787 会被页面 CORS 拦掉 ----
  // 优先级：扩展后台桥（绕过跨域）→ 油猴 GM_xmlhttpRequest → 页面直连（兜底）
  let __ykRelayCh = 0;
  const __ykRelayWaiters = new Map();
  let __ykBridgeOk = false;
  PW.addEventListener('message', (e) => {
    if (e.source !== PW) return;
    const d = e.data;
    if (!d || d.__ykRelay !== true || d.dir !== 'toPage') return;
    if (d.ch === '__yk_ping') { __ykBridgeOk = true; return; }
    const w = __ykRelayWaiters.get(d.ch);
    if (w) { __ykRelayWaiters.delete(d.ch); w(d.resp); }
  });
  // 探测扩展桥是否在（bridge.js 于 document_start 注入，收到 ping 会立刻回）
  PW.postMessage({ __ykRelay: true, dir: 'toBridge', ch: '__yk_ping' }, '*');

  function gmFetch(url, opts) {
    return new Promise((resolve, reject) => {
      const g = (typeof GM_xmlhttpRequest !== 'undefined') ? GM_xmlhttpRequest
        : (typeof GM !== 'undefined' && GM && GM.xmlHttpRequest);
      if (!g) return reject(0);
      g({
        method: (opts && opts.method) || 'GET',
        url: url,
        headers: (opts && opts.headers) || {},
        timeout: 8000,
        onload: (res) => {
          let body = null;
          try { body = JSON.parse(res.responseText); } catch (e2) {}
          if (res.status >= 200 && res.status < 300) resolve(body); else reject(res.status);
        },
        onerror: () => reject(0),
        ontimeout: () => reject(0),
      });
    });
  }

  function bridgeFetch(url, opts) {
    return new Promise((resolve, reject) => {
      const ch = 'c' + (++__ykRelayCh) + '_' + Date.now();
      const timer = setTimeout(() => {
        if (__ykRelayWaiters.delete(ch)) reject(0);
      }, 5000);
      __ykRelayWaiters.set(ch, (resp) => {
        clearTimeout(timer);
        if (resp && resp.status >= 200 && resp.status < 300) resolve(resp.body);
        else reject(resp ? resp.status : 0);
      });
      PW.postMessage({ __ykRelay: true, dir: 'toBridge', ch: ch, url: url, opts: opts }, '*');
    });
  }

  function relayFetch(url, opts) {
    if (__ykBridgeOk) return bridgeFetch(url, opts);
    const hasGm = (typeof GM_xmlhttpRequest !== 'undefined') || (typeof GM !== 'undefined' && GM && GM.xmlHttpRequest);
    if (hasGm) return gmFetch(url, opts);
    // 桥探测还没回来时先直连试一次，探测成功后自动切到桥
    return fetch(url, opts).then((r) => r.json().then((body) => {
      if (!r.ok) throw r.status;
      return body;
    }));
  }

  // [v1.18.0] 把本标签页（云客通话页）切到前台：手机挂断时人常常在别的窗口/网站，
  // 后台标签页其实也能提交，但唤到前台更好确认，也免得被当成"不在页面就不干活"
  function requestFocusCrmTab() {
    try { window.postMessage({ __ykRelay: true, dir: 'toBridge', __ykFocus: true }, '*'); } catch (e) {}
  }

  function loadAuto() {
    let s = {};
    try { s = JSON.parse(localStorage.getItem(AUTO_KEY)) || {}; } catch (e) { s = {}; }
    // v1.5.0 键位迁移：lastFlow/linkFlow 里存的旧编号换成新键位
    if (s.km !== 'v2') {
      if (s.lastFlow && KEY_MIGRATE[s.lastFlow]) s.lastFlow = KEY_MIGRATE[s.lastFlow];
      if (s.linkFlow && KEY_MIGRATE[s.linkFlow]) s.linkFlow = KEY_MIGRATE[s.linkFlow];
      s.km = 'v2';
      try { localStorage.setItem(AUTO_KEY, JSON.stringify(s)); } catch (e) {}
    }
    // [v1.16.1] F 恢复为「未接通·无人接听」：老配置里的 F 不再迁走；G（公海筛选，已移除）回落到 F
    // [v1.16.5] 用户明确要求：挂断联动默认一律「未接通·无人接听」——存量配置里的 D/其他键位一次性切到 F
    if (s.lf5 !== '1') {
      if (s.linkFlow && s.linkFlow !== 'F') s.linkFlow = 'F';
      if (s.lastFlow && s.lastFlow !== 'F') s.lastFlow = 'F';
      s.lf5 = '1';
      try { PW.localStorage.setItem(AUTO_KEY, JSON.stringify(s)); } catch (e) {}
    }
    // [v1.17.5] 用户改口：挂断联动默认走「无意向·拒绝」——把上面强设成 F 的存量配置一次性切到 D。
    // 只此一次：之后在面板里手动选别的流程就尊重用户。F 键仍是「未接通·无人接听」。
    if (s.lf6 !== '1') {
      if (s.linkFlow === 'F') s.linkFlow = 'D';
      s.lf6 = '1';
      try { PW.localStorage.setItem(AUTO_KEY, JSON.stringify(s)); } catch (e) {}
    }
    const merged = Object.assign({}, AUTO_DEFAULTS, s);
    if (!merged.lastFlow) merged.lastFlow = 'F';
    // [v1.14.2] 公海筛选(G)流程已移除：联动流程若指向它，回落到 F（未接通），避免联动失效
    if (merged.linkFlow === 'G') merged.linkFlow = 'F';
    if (merged.lastFlow === 'G') merged.lastFlow = 'F';
    // [v1.9.5] 关键词识别已移除，无论老配置存的是什么一律强制关闭
    merged.useKeywords = false;
    // [v1.18.7] 「联动时把云客页抢到前台」默认改为不抢（他明确选了后台静默写）。
    // 一次性把已存开的关掉；之后他在面板里自己勾上就尊重他。
    try {
      if (PW.localStorage.getItem('yk_focus_v1') !== '1') {
        s.focusOnLink = false;
        PW.localStorage.setItem(AUTO_KEY, JSON.stringify(s));
        PW.localStorage.setItem('yk_focus_v1', '1');
        merged.focusOnLink = false;
      }
    } catch (e) {}
    // [v1.20.2] 用户要求自动相关选项升级后默认启用；只迁移一次，后续保留手动修改。
    try {
      if (PW.localStorage.getItem('yk_autodefaults_v1202') !== '1') {
        s.autoMode = true;
        s.autoSeconds = 0;
        s.linkFlow = 'D';
        s.focusOnLink = true;
        s.connectNotice = true;
        s.useKeywords = false;
        PW.localStorage.setItem(AUTO_KEY, JSON.stringify(s));
        PW.localStorage.setItem('yk_autodefaults_v1202', '1');
        Object.assign(merged, s);
      }
    } catch (e) {}
    // [v1.22.6] 用户截图确认“通话结束后自动执行”被旧存储值关掉，
    // 这会让 CRM 已结束时的自动跟进监听直接退出。新版本重新迁移一次为开启，
    // 并恢复空的手机联动流程；之后用户手动关闭仍按他的选择保留。
    try {
      if (PW.localStorage.getItem('yk_autodefaults_v1226') !== '1') {
        s.autoMode = true;
        s.autoSeconds = 0;
        if (!s.linkFlow) s.linkFlow = 'D';
        s.useKeywords = false;
        PW.localStorage.setItem(AUTO_KEY, JSON.stringify(s));
        PW.localStorage.setItem('yk_autodefaults_v1226', '1');
        Object.assign(merged, s);
      }
    } catch (e) {}
    // [v1.22.7] 接通提醒默认启用：升级后不用重新勾选；之后仍尊重面板里的手动选择。
    try {
      if (PW.localStorage.getItem('yk_connectdefaults_v1227') !== '1') {
        s.connectNotice = true;
        PW.localStorage.setItem(AUTO_KEY, JSON.stringify(s));
        PW.localStorage.setItem('yk_connectdefaults_v1227', '1');
        Object.assign(merged, s);
      }
    } catch (e) {}
    // [v1.22.8] 手机挂断联动在后台 CRM 页执行，不抢走当前窗口焦点。
    // 之前 v1.20.2 迁移曾把它重新打开，覆盖了“不抢前台”的旧默认。
    try {
      if (PW.localStorage.getItem('yk_backgroundlink_v1228') !== '1') {
        s.focusOnLink = false;
        PW.localStorage.setItem(AUTO_KEY, JSON.stringify(s));
        PW.localStorage.setItem('yk_backgroundlink_v1228', '1');
        merged.focusOnLink = false;
      }
    } catch (e) {}
    // [v1.24.0] 恢复用户要求的自动跟进默认值；升级只迁移一次，延迟为 0 秒。
    try {
      if (PW.localStorage.getItem('yk_autofollowdefaults_v1240') !== '1') {
        s.autoMode = true;
        s.autoSeconds = 0;
        if (!s.linkFlow) s.linkFlow = 'D';
        s.useKeywords = false;
        PW.localStorage.setItem(AUTO_KEY, JSON.stringify(s));
        PW.localStorage.setItem('yk_autofollowdefaults_v1240', '1');
        Object.assign(merged, s);
      }
    } catch (e) {}
    // [v1.22.0] 手机 APK 是唯一实际挂断方。旧配置、导入文件都不能重新打开电脑自动强挂。
    merged.noAnsOn = false;
    if (s.noAnsOn !== false) {
      s.noAnsOn = false;
      try { PW.localStorage.setItem(AUTO_KEY, JSON.stringify(s)); } catch (e) {}
    }
    return merged;
  }
  // [v1.16.1] F 恢复为「未接通」：清掉本地可能残留的旧按钮名（仅一次）
  (function fixFRename() {
    try {
      if (PW.localStorage.getItem('yk_f_unconnected_v1') === '1') return;
      const l = JSON.parse(PW.localStorage.getItem(LAYOUT_KEY) || 'null');
      if (l && l.renames && l.renames.F) { delete l.renames.F; saveLayout(l); }
      PW.localStorage.setItem('yk_f_unconnected_v1', '1');
    } catch (e) {}
  })();

  function saveAuto(s) { try { localStorage.setItem(AUTO_KEY, JSON.stringify(s)); } catch (e) {} }

  // [v1.9.3] 一次性推荐预设：联动流程=无意向·拒绝、自动模式开、延迟0。
  // 无人接听挂断现在固定由手机 APK 处理；扩展只负责 CRM 页面和跟进记录。
  (function ensurePreset() {
    try {
      if (PW.localStorage.getItem('yk_preset_v1') === '1') return;
      const s = loadAuto();
      s.useKeywords = false;
      if (!s.linkFlow) s.linkFlow = 'D'; // 无意向·拒绝
      if (!s.autoMode) s.autoMode = true;
      if (typeof s.autoSeconds !== 'number' || s.autoSeconds > 0) s.autoSeconds = 0;
      if (!s.execKey) s.execKey = 'Enter';
      saveAuto(s);
      PW.localStorage.setItem('yk_preset_v1', '1');
      console.log('[云客助手] 已应用推荐预设（仅此一次）：关键词识别关、挂断由手机负责、联动=无意向·拒绝');
    } catch (e) {}
  })();

  // 关键词 → 流程（仅在页面出现通话字幕/转写文本时用于自动判定）
  const KEYWORD_MAP = [
    { hotkey: 'S', words: ['发资料', '资料发我', '发个资料', '多少钱', '怎么收费', '怎么合作', '加个微信', '感兴趣'] },
    { hotkey: 'D', words: ['不需要', '不感兴趣', '别打了', '不用了', '不考虑', '已经有合作', '已合作'] },
    { hotkey: 'E', words: ['空号', '号码是空号'] },
    { hotkey: 'T', words: ['已停机', '关机'] },
  ];

  // 找页面里的通话字幕/转写文本容器（有才做关键词识别，避免被历史记录文字干扰）
  function findTranscriptText() {
    try {
      const els = $$('[class*="subtitle"],[class*="caption"],[class*="transcript"],[class*="asr"],[class*="record-text"],[class*="speech-text"]');
      const texts = els.map((e) => e.innerText || '').filter((t) => t.trim());
      if (texts.length) return normalizeText(texts.join(' '));
    } catch (e) {}
    return null;
  }

  function detectFlowByKeywords() {
    const text = findTranscriptText();
    if (!text) return null;
    for (const group of KEYWORD_MAP) {
      if (group.words.some((w) => text.includes(w))) return group.hotkey;
    }
    return null;
  }

  function injectStyles() {
    if (document.getElementById('yk_helper_style')) return;
    const st = document.createElement('style');
    st.id = 'yk_helper_style';
    st.textContent = `
      #yk_helper_fab {
        position: fixed; z-index: 2147483647; width: 54px; height: 54px; border-radius: 18px;
        background: linear-gradient(135deg, #0ea5e9, #6366f1); color: #fff;
        font-size: 12px; line-height: 1.25; font-weight: 600; letter-spacing: .5px;
        display: flex; align-items: center; justify-content: center;
        cursor: grab; user-select: none; text-align: center;
        font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
        box-shadow: 0 10px 28px -6px rgba(56,189,248,.5), 0 0 0 1px rgba(255,255,255,.08) inset,
                    0 2px 6px rgba(2,6,23,.6);
        right: 20px; top: 200px; transition: transform .18s cubic-bezier(.34,1.56,.64,1), box-shadow .18s;
      }
      #yk_helper_fab:hover { transform: scale(1.08) rotate(-2deg); box-shadow: 0 14px 34px -6px rgba(99,102,241,.6), 0 0 0 1px rgba(255,255,255,.12) inset; }
      #yk_helper_fab:active { cursor: grabbing; transform: scale(1.02); }

      /* 悬浮球快捷菜单：深色玻璃卡片 + 流程全名 + 键位角标 */
      #yk_helper_ring { position: fixed; z-index: 2147483647; display: none; pointer-events: none; }
      .yk-quickmenu {
        pointer-events: auto; width: 216px;
        background: rgba(17,24,39,.86); backdrop-filter: blur(16px) saturate(1.4); -webkit-backdrop-filter: blur(16px) saturate(1.4);
        border-radius: 16px; border: 1px solid rgba(148,163,184,.16); padding: 6px;
        box-shadow: 0 20px 48px -12px rgba(2,6,23,.7), 0 4px 14px rgba(2,6,23,.4);
        display: flex; flex-direction: column; gap: 2px;
        font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
        animation: ykPop .14s ease;
      }
      .yk-qm-row {
        display: flex; align-items: center; gap: 8px; width: 100%;
        padding: 8px 10px; border: none; background: transparent; border-radius: 10px;
        cursor: pointer; text-align: left; font-size: 12.5px; font-weight: 500; color: #e2e8f0;
        font-family: inherit; transition: background .12s, transform .12s;
      }
      .yk-qm-row:hover { background: rgba(56,189,248,.12); transform: translateX(2px); }
      .yk-qm-row .dot { width: 8px; height: 8px; border-radius: 50%; flex: none; box-shadow: 0 0 8px currentColor; }
      .yk-qm-row .label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .yk-qm-row .k {
        font-size: 10px; font-weight: 700; color: #a5b4fc; background: rgba(99,102,241,.18);
        border-radius: 6px; padding: 1px 6px; flex: none; min-width: 16px; text-align: center;
      }
      .yk-qm-edit {
        margin-top: 2px; padding: 7px 10px; border: none; border-top: 1px solid rgba(148,163,184,.14);
        background: transparent; color: #94a3b8; font-size: 11.5px; cursor: pointer;
        border-radius: 0 0 12px 12px; font-family: inherit; text-align: left; transition: background .12s, color .12s;
      }
      .yk-qm-edit:hover { background: rgba(148,163,184,.1); color: #f1f5f9; }
      @keyframes ykPop { from { transform: scale(.92) translateY(4px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
      @keyframes ykBannerIn { from { transform: translateX(-50%) scale(.7); opacity: 0; } to { transform: translateX(-50%) scale(1); opacity: 1; } }

      #yk_helper_panel {
        position: fixed; z-index: 2147483647; width: 308px; max-height: 84vh; overflow-y: auto;
        background: linear-gradient(180deg, #131a2b 0%, #0d1322 100%);
        border-radius: 20px; padding: 16px 14px 14px;
        border: 1px solid rgba(148,163,184,.14);
        box-shadow: 0 28px 64px -16px rgba(2,6,23,.8), 0 6px 18px rgba(2,6,23,.5),
                    inset 0 1px 0 rgba(255,255,255,.05);
        display: none; flex-direction: column; gap: 10px;
        font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
        color: #e2e8f0;
      }
      #yk_helper_panel * { box-sizing: border-box; }
      #yk_helper_panel::-webkit-scrollbar { width: 6px; }
      #yk_helper_panel::-webkit-scrollbar-thumb { background: rgba(148,163,184,.25); border-radius: 3px; }
      #yk_helper_panel::-webkit-scrollbar-track { background: transparent; }

      .yk-head { display: flex; align-items: center; gap: 9px; }
      .yk-logo {
        width: 32px; height: 32px; border-radius: 11px; flex: none;
        background: linear-gradient(135deg, #0ea5e9, #6366f1);
        display: flex; align-items: center; justify-content: center;
        color: #fff; font-size: 15px;
        box-shadow: 0 4px 14px -3px rgba(99,102,241,.6), inset 0 1px 0 rgba(255,255,255,.3);
      }
      .yk-title { font-size: 14px; font-weight: 700; flex: 1; line-height: 1.25; letter-spacing: .3px; color: #f1f5f9; }
      .yk-title small { display: block; font-size: 10px; font-weight: 400; color: #7d8aa3; margin-top: 2px; letter-spacing: 0; }
      .yk-iconbtn {
        width: 28px; height: 28px; border-radius: 9px; border: 1px solid rgba(148,163,184,.14); flex: none;
        background: rgba(148,163,184,.08); color: #94a3b8; cursor: pointer; font-size: 12px;
        display: flex; align-items: center; justify-content: center; transition: .15s;
      }
      .yk-iconbtn:hover { background: rgba(56,189,248,.15); color: #7dd3fc; border-color: rgba(56,189,248,.3); }
      .yk-iconbtn.on { background: rgba(99,102,241,.2); color: #a5b4fc; border-color: rgba(99,102,241,.35); }

      /* 状态卡片区：手机在线 / 通话状态 / 重拨提醒 */
      #yk_hb_status, #yk_call_status {
        display: flex; justify-content: space-between; align-items: center;
        font-size: 11px; color: #7d8aa3; padding: 7px 10px;
        background: rgba(148,163,184,.07); border: 1px solid rgba(148,163,184,.1);
        border-radius: 11px; transition: border-color .2s;
      }
      #yk_call_status { margin-top: -4px; }
      #yk_status_card {
        display: flex; flex-direction: column; gap: 4px; padding: 7px 10px;
        background: rgba(148,163,184,.045); border: 1px solid rgba(148,163,184,.09);
        border-radius: 10px; font-size: 10px; line-height: 1.35;
      }
      .yk-status-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
      .yk-status-label { color: #8491a7; flex: none; }
      .yk-status-value { color: #d4dbea; text-align: right; min-width: 0; overflow-wrap: anywhere; }
      #yk_status_match[data-state="ok"] { color: #4ade80; }
      #yk_status_match[data-state="warn"] { color: #fbbf24; }
      #yk_status_match[data-state="error"] { color: #fb7185; }
      #yk_status_outcome[data-state="error"] { color: #fb7185; }
      .yk-settings-backup {
        display: flex; align-items: center; gap: 6px; padding: 8px 9px;
        border: 1px solid rgba(148,163,184,.12); border-radius: 10px;
        background: rgba(148,163,184,.045); font-size: 11px;
      }
      .yk-settings-backup > div { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
      .yk-settings-backup b { color: #cbd5e1; font-size: 11px; }
      .yk-settings-backup small { color: #8491a7; font-size: 9px; line-height: 1.35; }
      .yk-settings-backup button {
        flex: none; border: 1px solid rgba(96,165,250,.25); border-radius: 7px;
        background: rgba(59,130,246,.12); color: #93c5fd; padding: 5px 8px; cursor: pointer; font-size: 10px;
      }
      .yk-settings-backup button:hover { background: rgba(59,130,246,.22); }
      #yk_eff_line {
        font-size: 11px; color: #7d8aa3; padding: 0 4px; cursor: pointer; line-height: 1.5;
      }
      #yk_eff_line:hover { color: #fbbf24; }

      .yk-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }
      .yk-card {
        display: flex; align-items: center; gap: 7px; padding: 10px 10px 10px 13px;
        border: 1px solid rgba(148,163,184,.12); border-radius: 13px;
        background: rgba(148,163,184,.06);
        cursor: pointer; text-align: left; position: relative; overflow: hidden;
        font-family: inherit; transition: transform .14s, background .14s, box-shadow .14s, border-color .14s;
      }
      .yk-card:hover {
        background: rgba(56,189,248,.1); transform: translateY(-2px);
        box-shadow: 0 8px 20px -6px rgba(2,6,23,.7); border-color: rgba(56,189,248,.28);
      }
      .yk-card:active { transform: translateY(0) scale(.98); }
      .yk-card.hidden-card { opacity: .35; }
      .yk-card .bar { position: absolute; left: 0; top: 0; bottom: 0; width: 3.5px; box-shadow: 0 0 10px currentColor; }
      .yk-card .key {
        min-width: 19px; height: 19px; padding: 0 4px; border-radius: 7px; flex: none;
        color: #fff; font-size: 11px; font-weight: 700;
        display: flex; align-items: center; justify-content: center;
        box-shadow: inset 0 1px 0 rgba(255,255,255,.25);
      }
      .yk-card .name { font-size: 12px; font-weight: 500; color: #dbe4f0; line-height: 1.3; flex: 1; }

      .yk-edit-actions { display: flex; gap: 3px; flex: none; }
      .yk-mini {
        border: 1px solid rgba(148,163,184,.2); background: rgba(148,163,184,.08); width: 21px; height: 21px;
        border-radius: 7px; cursor: pointer; font-size: 10px; color: #a5b4fc;
        display: flex; align-items: center; justify-content: center; padding: 0;
        font-family: inherit; transition: .12s;
      }
      .yk-mini:hover { color: #fff; border-color: rgba(56,189,248,.4); background: rgba(56,189,248,.18); }

      .yk-card .key.listening { box-shadow: 0 0 0 2px #131a2b, 0 0 0 4px #f59e0b; animation: ykBlink 1s ease-in-out infinite; }
      @keyframes ykBlink { 50% { opacity: .45; } }

      /* 自动模式设置区 */
      .yk-auto {
        border-top: 1px solid rgba(148,163,184,.12); padding-top: 10px;
        display: flex; flex-direction: column; gap: 5px;
      }
      .yk-auto-row {
        display: flex; align-items: center; gap: 6px;
        font-size: 11px; color: #8b98ad; cursor: pointer; line-height: 1.6;
      }
      .yk-auto-row b { color: #c7d2e3; }
      .yk-auto-row select, .yk-auto-row input {
        border: 1px solid rgba(148,163,184,.2); border-radius: 7px; padding: 2px 5px;
        font-size: 11px; color: #dbe4f0; background: rgba(148,163,184,.08);
        font-family: inherit; outline: none; transition: border-color .15s;
      }
      .yk-auto-row select:focus, .yk-auto-row input:focus { border-color: rgba(56,189,248,.5); }
      .yk-auto-row input::placeholder { color: #5b6880; }

      /* 自动执行倒计时浮层 */
      #yk_auto_overlay {
        position: fixed; z-index: 2147483647; left: 50%; transform: translateX(-50%);
        bottom: 28px; width: 344px;
        background: linear-gradient(180deg, rgba(30,41,59,.96), rgba(15,23,42,.96));
        backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
        color: #fff; border: 1px solid rgba(148,163,184,.18);
        border-radius: 16px; padding: 14px 16px; display: none;
        box-shadow: 0 20px 52px -12px rgba(2,6,23,.85);
        font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
        animation: ykPop .18s ease;
      }
      .yk-auto-title { font-size: 13px; font-weight: 600; display: flex; justify-content: space-between; align-items: center; color: #f1f5f9; }
      .yk-auto-count { font-size: 22px; font-weight: 800; color: #fbbf24; font-variant-numeric: tabular-nums; text-shadow: 0 0 18px rgba(251,191,36,.4); }
      .yk-auto-suggest { font-size: 12px; color: #b6c2d4; margin: 8px 0 12px; line-height: 1.6; }
      .yk-auto-btns { display: flex; gap: 8px; }
      .yk-auto-btn {
        flex: 1; padding: 9px 0; border-radius: 10px; border: none; cursor: pointer;
        font-size: 12px; font-weight: 600; font-family: inherit; transition: transform .12s, opacity .12s, box-shadow .12s;
      }
      .yk-auto-btn:hover { transform: translateY(-1px); }
      .yk-btn-run { background: linear-gradient(135deg, #16a34a, #22c55e); color: #fff; box-shadow: 0 4px 14px -4px rgba(34,197,94,.5); }
      .yk-btn-menu { background: rgba(148,163,184,.14); color: #e2e8f0; }
      .yk-btn-cancel { background: transparent; color: #94a3b8; border: 1px solid rgba(148,163,184,.3); }

      .yk-macros { border-top: 1px solid rgba(148,163,184,.12); margin-top: 4px; padding-top: 10px; }
      .yk-macros-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 7px; }
      .yk-macros-title { font-size: 11px; font-weight: 700; color: #8b98ad; letter-spacing: .5px; }
      #yk_rec_btn {
        background: rgba(244,63,94,.16); color: #fb7185; border: 1px solid rgba(244,63,94,.3); border-radius: 8px;
        padding: 3px 11px; font-size: 10.5px; font-weight: 700; cursor: pointer; font-family: inherit; transition: .15s;
      }
      #yk_rec_btn:hover { background: rgba(244,63,94,.26); }
      #yk_imp_btn {
        background: rgba(99,102,241,.16); color: #a5b4fc; border: 1px solid rgba(99,102,241,.3); border-radius: 8px;
        padding: 3px 11px; font-size: 10.5px; font-weight: 700; cursor: pointer; font-family: inherit; transition: .15s;
      }
      #yk_imp_btn:hover { background: rgba(99,102,241,.28); }
      #yk_rec_btn.recording { background: #f43f5e; color: #fff; animation: ykblink 1s infinite; }
      @keyframes ykblink { 50% { opacity: .55; } }
      .yk-macro-row {
        display: flex; align-items: center; gap: 6px; padding: 6px 8px; border-radius: 10px;
        background: rgba(148,163,184,.06); margin-bottom: 5px; cursor: pointer;
        border: 1px solid rgba(148,163,184,.1); transition: .14s;
      }
      .yk-macro-row:hover { background: rgba(56,189,248,.1); border-color: rgba(56,189,248,.3); transform: translateX(2px); }
      .yk-macro-key {
        min-width: 24px; height: 20px; border-radius: 6px;
        background: linear-gradient(135deg, #0ea5e9, #6366f1); color: #fff;
        font-size: 10px; font-weight: 700; display: inline-flex; align-items: center;
        justify-content: center; padding: 0 5px; cursor: pointer; flex-shrink: 0;
      }
      .yk-macro-name { flex: 1; font-size: 11.5px; color: #dbe4f0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .yk-macro-empty { font-size: 10.5px; color: #5b6880; padding: 1px 0 4px; }

      #yk_exec_key {
        min-width: 44px; padding: 2px 9px; border: 1px solid rgba(99,102,241,.35); border-radius: 7px;
        background: rgba(99,102,241,.18); color: #a5b4fc; font-size: 10.5px; font-weight: 700;
        cursor: pointer; font-family: inherit; vertical-align: middle; transition: .15s;
      }
      #yk_exec_key:hover { background: rgba(99,102,241,.3); }
      #yk_exec_key.listening { background: #4f46e5; color: #fff; animation: ykblink 1s infinite; }

      .yk-tip {
        font-size: 10.5px; color: #6b7a93; line-height: 1.7;
        border-top: 1px solid rgba(148,163,184,.12); padding-top: 9px;
      }
      .yk-tip b { color: #a5b4fc; }

      /* v1.22.3 — 收起低频设置，优先呈现通话状态与跟进结果 */
      #yk_helper_fab {
        width: 58px; height: 58px; border-radius: 20px;
        background: linear-gradient(145deg, #0f766e 0%, #0e7490 52%, #2563eb 100%);
        box-shadow: 0 14px 32px -10px rgba(8,145,178,.78), 0 0 0 1px rgba(255,255,255,.18) inset, 0 3px 8px rgba(2,6,23,.45);
        font-size: 11px; font-weight: 700; letter-spacing: .2px;
      }
      #yk_helper_panel {
        width: 340px; max-height: min(80vh, 760px); overflow-y: auto;
        padding: 12px; gap: 7px; border-radius: 17px;
        background: rgba(15,23,42,.98);
        border: 1px solid rgba(148,163,184,.18);
        box-shadow: 0 20px 54px -22px rgba(2,8,23,.88), 0 5px 16px rgba(2,8,23,.36), inset 0 1px 0 rgba(255,255,255,.045);
        backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
        scrollbar-width: thin; scrollbar-color: rgba(148,163,184,.25) transparent;
      }
      #yk_helper_panel::-webkit-scrollbar { width: 5px; }
      #yk_helper_panel::-webkit-scrollbar-thumb { background: rgba(148,163,184,.25); border-radius: 8px; }
      .yk-head { order: 0; position: sticky; top: -12px; z-index: 3; gap: 8px; padding: 2px 0 5px; margin-top: -2px; background: #0f172a; }
      .yk-logo {
        width: 30px; height: 30px; border-radius: 9px;
        background: linear-gradient(145deg, #0e7490, #2563eb);
        box-shadow: inset 0 1px 0 rgba(255,255,255,.24);
      }
      .yk-title { font-size: 13px; letter-spacing: 0; }
      .yk-title small { font-size: 10px; color: #8da1b8; }
      .yk-title small i { color: #22d3ee; font-style: normal; }
      .yk-iconbtn { width: 28px; height: 28px; border-radius: 8px; color: #9fb0c5; }
      #yk_hb_status, #yk_call_status {
        min-height: 27px; padding: 5px 8px; border-radius: 8px;
        background: rgba(30,41,59,.62); border-color: rgba(148,163,184,.1); color: #a8b6c8;
        font-size: 10px;
      }
      #yk_hb_status { order: 1; }
      #yk_call_status { order: 2; }
      #yk_hb_status > span, #yk_call_status > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      #yk_pending_line { flex: none; max-width: 45%; }
      #yk_hb_status { border-left: 2px solid rgba(34,211,238,.6); }
      #yk_call_status { border-left: 2px solid rgba(96,165,250,.55); margin-top: -3px; }
      #yk_pending_line { padding: 3px 7px; color: #67e8f9 !important; background: rgba(8,145,178,.12); border-radius: 7px; font-weight: 600; }
      #yk_call_timer { color: #67e8f9 !important; font-size: 11px; font-variant-numeric: tabular-nums; font-weight: 700; }
      #yk_manual_call_card {
        order: 3; display: flex; align-items: center; gap: 8px; padding: 7px 8px; border-radius: 10px;
        border: 1px solid rgba(248,113,113,.17);
        background: rgba(127,29,29,.12);
      }
      #yk_manual_hangup_status { flex: 1; min-width: 0; min-height: 18px; color: #cbd5e1; font-size: 10px; line-height: 1.35; overflow-wrap: anywhere; }
      #yk_manual_hangup {
        display: flex; align-items: center; justify-content: center; gap: 6px; width: auto; flex: none;
        min-height: 32px; margin: 0; padding: 6px 9px; border: 1px solid rgba(248,113,113,.3);
        border-radius: 8px; background: #b91c1c; color: white;
        box-shadow: none; font-family: inherit; font-size: 10px; font-weight: 700; cursor: pointer; transition: filter .14s;
      }
      #yk_manual_hangup:not(:disabled):hover { transform: translateY(-1px); filter: brightness(1.08); box-shadow: 0 12px 24px -10px rgba(239,68,68,.75); }
      #yk_manual_hangup:not(:disabled):active { transform: scale(.99); }
      #yk_manual_hangup:disabled { cursor: not-allowed; color: #8996a8; border-color: rgba(148,163,184,.16); background: rgba(71,85,105,.28); box-shadow: none; }
      .yk-hangup-icon, .yk-hangup-arrow { display: none; }
      .yk-progress-line { display: flex; justify-content: space-between; gap: 8px; padding: 0 2px; color: #a6b4c5; font-size: 10px; line-height: 1.4; }
      .yk-progress-line { order: 4; }
      .yk-progress-line span:first-child { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .yk-progress-line span:last-child { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #7dd3fc; text-align: right; }
      #yk_status_card {
        gap: 5px; padding: 8px 9px; border-radius: 9px;
        background: rgba(20,32,51,.42); border: 1px solid rgba(148,163,184,.1); font-size: 10px;
      }
      .yk-status-row { gap: 10px; line-height: 1.4; }
      .yk-status-label { color: #8395aa; }
      .yk-status-value { color: #d4deea; }
      .yk-owner-row { padding-bottom: 6px; margin-bottom: 1px; border-bottom: 1px solid rgba(148,163,184,.1); }
      #yk_status_owner { color: #7dd3fc; }
      #yk_eff_line { order: 6; padding: 0 2px; color: #9baec2; font-size: 9px; }
      .yk-section-head {
        order: 7; display: flex; align-items: baseline; justify-content: space-between; gap: 8px;
        margin: 0 1px; color: #e6edf7; font-size: 12px; font-weight: 700; letter-spacing: 0;
      }
      .yk-section-head small { color: #8193a9; font-size: 9px; font-weight: 500; letter-spacing: 0; }
      .yk-section-head small b { color: #39c5d8; }
      .yk-auto-heading { order: 0; margin: 0 0 2px; }
      #yk_grid { order: 8; gap: 6px; }
      .yk-card {
        min-height: 38px; gap: 7px; padding: 7px 8px 7px 11px; border-radius: 9px;
        background: rgba(30,41,59,.72);
        border-color: rgba(148,163,184,.1); box-shadow: none;
      }
      .yk-card:hover { background: rgba(38,58,82,.92); transform: translateY(-1px); box-shadow: none; border-color: rgba(34,211,238,.26); }
      .yk-card .bar { width: 3px; }
      .yk-card .key { min-width: 22px; height: 22px; border-radius: 7px; font-size: 10px; }
      .yk-card .name { font-size: 10.5px; font-weight: 600; color: #e0e9f4; }
      .yk-auto {
        order: 9; margin-top: 2px; padding: 11px 11px 10px; gap: 8px;
        border: 1px solid rgba(148,163,184,.13); border-radius: 15px;
        background: rgba(20,32,51,.6);
      }
      .yk-auto-row { gap: 7px; color: #aab9ca; font-size: 10.5px; line-height: 1.45; cursor: default; }
      .yk-toggle-row { cursor: pointer; }
      .yk-toggle-row input { margin: 0 2px 0 0; accent-color: #22c3d6; }
      .yk-toggle-row span { flex: 1; }
      .yk-toggle-row em { color: #8294aa; font-size: 9px; font-style: normal; }
      .yk-auto-row b { color: #dce8f5; }
      .yk-auto-row select, .yk-auto-row input {
        min-height: 27px; padding: 4px 8px; border-radius: 8px; border-color: rgba(148,163,184,.2);
        background: rgba(10,18,31,.8); color: #e4edf8; font-size: 10px;
      }
      .yk-auto-row input { min-width: 0; }
      .yk-tool-btn { padding: 5px 8px; border: 1px solid rgba(148,163,184,.2); border-radius: 8px; background: rgba(30,45,67,.8); color: #c4d1df; font-family: inherit; font-size: 10px; cursor: pointer; }
      .yk-tool-btn:hover { border-color: rgba(34,211,238,.34); color: #67e8f9; }
      .yk-auto-note { padding: 6px 8px; border-radius: 8px; color: #8ea0b5; background: rgba(8,145,178,.08); font-size: 9px; line-height: 1.4; }
      #yk_exec_key { border-radius: 8px; background: rgba(8,145,178,.15); border-color: rgba(34,211,238,.25); color: #67e8f9; }
      .yk-macros { order: 10; margin-top: 1px; padding: 11px 11px 5px; border: 1px solid rgba(148,163,184,.13); border-radius: 15px; background: rgba(20,32,51,.6); }
      .yk-macros-head { gap: 6px; margin-bottom: 7px; }
      .yk-macros-title { color: #e2eaf4; font-size: 12px; letter-spacing: 0; }
      .yk-macros-title small { margin-left: 4px; color: #8294aa; font-size: 9px; font-weight: 400; }
      #yk_imp_btn, #yk_rec_btn { padding: 5px 9px; border-radius: 8px; font-size: 9px; }
      .yk-macro-row { min-height: 36px; padding: 6px 8px; border-radius: 10px; background: rgba(30,45,67,.6); }
      .yk-macro-row:hover { transform: translateY(-1px); }
      .yk-macro-name { font-size: 10.5px; }
      .yk-settings-backup { order: 11; padding: 10px 11px; gap: 8px; border-radius: 13px; background: rgba(20,32,51,.7); border-color: rgba(148,163,184,.13); }
      .yk-settings-backup b { color: #dce6f2; font-size: 10.5px; }
      .yk-settings-backup small { font-size: 8.5px; }
      .yk-settings-backup button { padding: 6px 10px; border-radius: 8px; font-size: 9px; }
      .yk-tip { order: 12; padding: 8px 2px 0; border-color: rgba(148,163,184,.1); font-size: 9px; }
      .yk-details { order: 5; border: 1px solid rgba(148,163,184,.1); border-radius: 9px; background: rgba(30,41,59,.34); }
      .yk-details > summary { min-height: 32px; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 7px 9px; color: #cbd5e1; font-size: 10px; font-weight: 600; cursor: pointer; list-style: none; }
      .yk-details > summary::-webkit-details-marker { display: none; }
      .yk-details > summary::after { content: '+'; color: #7d8ea4; font-size: 14px; line-height: 1; }
      .yk-details[open] > summary::after { content: '−'; }
      .yk-details > summary small { margin-left: auto; color: #8193a9; font-size: 9px; font-weight: 400; }
      .yk-details[open] { padding-bottom: 7px; }
      #yk_status_details { order: 5; }
      #yk_tools_details { order: 9; }
      .yk-tools-inner { display: flex; flex-direction: column; gap: 7px; padding: 0 7px; }
      .yk-tools-inner .yk-auto, .yk-tools-inner .yk-macros, .yk-tools-inner .yk-settings-backup { order: initial; margin-top: 0; }
      .yk-tools-inner .yk-auto { padding: 8px; gap: 6px; }
      .yk-tools-inner .yk-macros { padding: 8px 8px 4px; }
      .yk-tools-inner .yk-settings-backup { padding: 8px; }
      .yk-tools-inner .yk-section-head { order: initial; }
      .yk-tools-inner .yk-tip { order: initial; padding-top: 5px; }
      #yk_helper_toast { max-width: min(420px, calc(100vw - 32px)) !important; border-radius: 14px !important; border: 1px solid rgba(255,255,255,.12); backdrop-filter: blur(14px); box-shadow: 0 16px 42px rgba(2,8,23,.38) !important; }
      .yk-quickmenu { background: rgba(13,23,39,.97); border-color: rgba(148,163,184,.2); border-radius: 17px; box-shadow: 0 22px 56px rgba(2,8,23,.6); }
      .yk-qm-row { min-height: 38px; font-size: 12px; }
      @media (max-width: 450px) {
        #yk_helper_panel { width: calc(100vw - 20px); max-height: 80vh; padding: 11px; }
        .yk-section-head { font-size: 12px; }
      }
    `;
    document.documentElement.appendChild(st);
  }

  function ensureBody(cb) {
    if (document.body) return cb();
    const t = setInterval(() => { if (document.body) { clearInterval(t); cb(); } }, 50);
  }

  function initUI() {
    try {
      injectStyles();
      let editMode = false;
      let capturing = null; // 正在为哪个流程捕获触发键

      // ---- 悬浮球 ----
      let savedPos = null;
      try { savedPos = JSON.parse(localStorage.getItem('yk_fab_pos_v3')); } catch (e) {}
      const fab = document.createElement('div');
      fab.id = 'yk_helper_fab';
      if (savedPos) {
        fab.style.left = savedPos.x + 'px';
        fab.style.top = savedPos.y + 'px';
        fab.style.right = 'auto';
      }
      fab.textContent = '跟进\n助手';

      let dragState = null;
      let wasDragged = false;
      fab.addEventListener('mousedown', (e) => {
        dragState = {
          startX: e.clientX, startY: e.clientY,
          origX: fab.offsetLeft, origY: fab.offsetTop,
          moved: false,
        };
        e.preventDefault();
      });
      document.addEventListener('mousemove', (e) => {
        if (!dragState) return;
        const dx = e.clientX - dragState.startX;
        const dy = e.clientY - dragState.startY;
        if (Math.abs(dx) + Math.abs(dy) > 5) dragState.moved = true;
        if (dragState.moved) {
          wasDragged = true;
          let nx = Math.max(0, Math.min(window.innerWidth - 52, dragState.origX + dx));
          let ny = Math.max(0, Math.min(window.innerHeight - 52, dragState.origY + dy));
          fab.style.left = nx + 'px';
          fab.style.top = ny + 'px';
          fab.style.right = 'auto';
          fab.style.bottom = 'auto';
        }
      });
      document.addEventListener('mouseup', () => {
        if (dragState && dragState.moved) {
          localStorage.setItem('yk_fab_pos_v3', JSON.stringify({
            x: parseInt(fab.style.left), y: parseInt(fab.style.top),
          }));
        }
        dragState = null;
        setTimeout(() => { wasDragged = false; }, 50);
      });

      // ---- 面板骨架 ----
      const panel = document.createElement('div');
      panel.id = 'yk_helper_panel';
      panel.innerHTML = `
        <div class="yk-head">
          <div class="yk-logo">⚡</div>
          <div class="yk-title">云客跟进助手<small>通话面板 <i>·</i> v1.24.1</small></div>
          <button class="yk-iconbtn" id="yk_edit" title="自定义按钮布局">✎</button>
          <button class="yk-iconbtn" id="yk_close" title="关闭">✕</button>
        </div>
        <div id="yk_hb_status"><span id="yk_hb_dot">⚪ 手机未上报</span><span id="yk_pending_line" style="cursor:pointer;" onclick="window.__ykPendingClick && window.__ykPendingClick()"></span></div>
        <div id="yk_call_status"><span id="yk_call_dot">⚪ 暂无通话</span><span id="yk_call_timer"></span></div>
        <section id="yk_manual_call_card" aria-live="polite">
          <div id="yk_manual_hangup_status">正在等待手机状态…</div>
          <button id="yk_manual_hangup" type="button" title="由手机 APK 执行挂断" aria-label="挂断当前手机通话" disabled><span class="yk-hangup-icon">■</span><span>挂断手机</span><span class="yk-hangup-arrow">↗</span></button>
        </section>
        <div class="yk-progress-line" aria-live="polite"><span id="yk_status_progress">待命</span><span id="yk_status_outcome">—</span></div>
        <details class="yk-details" id="yk_status_details">
          <summary>客户与联动详情</summary>
          <div id="yk_status_card" aria-live="polite">
          <div class="yk-status-row"><span class="yk-status-label">挂断职责</span><span class="yk-status-value" id="yk_status_owner">手机 APK 挂断；扩展同步 CRM 并提交跟进</span></div>
          <div class="yk-status-row"><span class="yk-status-label">手机客户</span><span class="yk-status-value" id="yk_status_phone">等待手机通话</span></div>
          <div class="yk-status-row"><span class="yk-status-label">CRM客户</span><span class="yk-status-value" id="yk_status_crm">等待通话</span></div>
          <div class="yk-status-row"><span class="yk-status-label">客户核对</span><span class="yk-status-value" id="yk_status_match" data-state="">等待手机号码</span></div>
          <div class="yk-status-row"><span class="yk-status-label">最近事件</span><span class="yk-status-value" id="yk_status_event">暂无新事件</span></div>
          </div>
        </details>
        <div id="yk_eff_line" onclick="window.__ykEffClick && window.__ykEffClick()" title="点击清除已到时的重拨提醒"></div>
        <div class="yk-section-head yk-results-head"><span>跟进结果</span></div>
        <div class="yk-grid" id="yk_grid"></div>
        <details class="yk-details" id="yk_tools_details">
          <summary>设置与工具<small>自动化 · 我的动作 · 备份</small></summary>
          <div class="yk-tools-inner">
        <div class="yk-auto" id="yk_auto_box">
          <div class="yk-section-head yk-auto-heading"><span>自动化</span></div>
          <label class="yk-auto-row yk-toggle-row"><input type="checkbox" id="yk_auto_on"><span>通话结束后自动执行</span><em>免按键</em></label>
          <div id="yk_auto_opts" style="display:none;flex-direction:column;gap:4px;">
            <div class="yk-auto-row">通话结束延迟
              <select id="yk_auto_sec">
                <option value="0">0（立即执行）</option><option value="3">3</option><option value="5">5</option><option value="8">8</option>
              </select> 秒执行默认<b>无意向·拒绝</b>
            </div>
            <div class="yk-auto-row">📱 手机挂断联动
              <select id="yk_auto_link"><option value="">不启用</option></select>
            </div>
            <div class="yk-auto-row">📞 拨前号码检测
              <input id="yk_numchk_key" placeholder="聚合 API Key" type="password" style="width:104px;" oninput="localStorage.setItem('yk_numchk_key', this.value)">
              <button id="yk_numchk_now" class="yk-tool-btn">检测本页号码</button>
            </div>
            <div class="yk-auto-row">🔍 查微信
              <input id="yk_wxchk_url" placeholder="接口地址 {phone}" style="width:118px;" oninput="localStorage.setItem('yk_wxchk_url', this.value.trim())">
              <button id="yk_wxchk_cfg" title="配置鉴权与返回判定">⚙</button>
              <button id="yk_wxchk_now" class="yk-tool-btn">查本页</button>
            </div>
            <div class="yk-auto-row">⚡ 倒计时快捷键
              <button id="yk_exec_key" title="点击后按任意键设置">Enter</button> 键
            </div>
          </div>
          <label class="yk-auto-row yk-toggle-row"><input type="checkbox" id="yk_auto_focus"><span>手机挂断后切到云客页面</span><em>前台提交</em></label>
          <label class="yk-auto-row yk-toggle-row"><input type="checkbox" id="yk_connect_notice"><span>电话接通提醒</span><em>线路预提醒 + 客户接听确认</em></label>
        </div>
        <div class="yk-macros">
          <div class="yk-macros-head">
            <span class="yk-macros-title">我的动作</span>
            <button id="yk_imp_btn" title="从 JSON 文件导入动作（升级/换机后恢复用）">⤒ 导入</button>
            <button id="yk_rec_btn" title="录制新的页面操作，之后一键复现">● 录制</button>
          </div>
          <div id="yk_macro_list"></div>
        </div>
        <div class="yk-settings-backup">
          <div><b>设置备份</b><small>自动流程、快捷键和录制动作</small></div>
          <button id="yk_settings_export">导出</button>
          <button id="yk_settings_import">恢复</button>
        </div>
        <div class="yk-tip" id="yk_foot"></div>
          </div>
        </details>
      `;
      const grid = panel.querySelector('#yk_grid');
      const foot = panel.querySelector('#yk_foot');
      const editBtn = panel.querySelector('#yk_edit');
      const toolsDetails = panel.querySelector('#yk_tools_details');

      function handleEdit(action, hotkey) {
        const cur = getLayoutState();
        if (action === 'up' || action === 'down') {
          const idx = cur.order.indexOf(hotkey);
          const j = action === 'up' ? idx - 1 : idx + 1;
          if (j < 0 || j >= cur.order.length) return;
          const tmp = cur.order[idx];
          cur.order[idx] = cur.order[j];
          cur.order[j] = tmp;
        } else if (action === 'toggle') {
          const i2 = cur.hidden.indexOf(hotkey);
          if (i2 >= 0) cur.hidden.splice(i2, 1);
          else cur.hidden.push(hotkey);
        }
        saveLayout(cur);
        renderGrid();
      }

      function renderGrid() {
        const st = getLayoutState();
        const byKey = {};
        FLOWS.forEach((f) => { byKey[f.hotkey] = f; });
        grid.innerHTML = '';

        st.order.forEach((k) => {
          const flow = byKey[k];
          if (!flow) {
            ykStatusUpdate({ event: '收到手机挂断信号', eventAt: Date.now(), progress: '未启动 CRM 自动处理', outcome: '手机挂断联动流程未启用' });
            return;
          }
          const isHidden = st.hidden.includes(k);
          // 非编辑模式下，隐藏的按钮不渲染
          if (isHidden && !editMode) return;
          const name = flowDisplayName(flow, st.renames);
          const effKey = getEffectiveKey(flow, st.keys);

          const card = document.createElement('button');
          card.className = 'yk-card' + (isHidden ? ' hidden-card' : '');
          card.innerHTML =
            `<span class="bar" style="background:${flow.color}"></span>` +
            `<span class="key" style="background:${flow.color}${editMode ? ';cursor:pointer' : ''}" ${editMode ? 'title="点击后按键盘任意键设置触发键"' : ''}>${keyDisplay(effKey)}</span>` +
            `<span class="name">${name}</span>`;

          if (editMode) {
            // 点徽标 → 进入捕获模式，下一个按下的键（键盘上任意键）即为触发键
            const keyBadge = card.querySelector('.key');
            if (capturing === k) keyBadge.classList.add('listening');
            keyBadge.onclick = (ev) => {
              ev.stopPropagation();
              capturing = k;
              keyBadge.classList.add('listening');
              toast('⚙ 请直接按下「' + flowDisplayName(flow, st.renames) + '」要用的触发键…\n支持 F1-F12 / 字母 / 数字 / 任意符号，按 Esc 取消', false, true);
            };
            const acts = document.createElement('span');
            acts.className = 'yk-edit-actions';
            acts.innerHTML =
              `<button class="yk-mini" data-a="up" title="上移">↑</button>` +
              `<button class="yk-mini" data-a="down" title="下移">↓</button>` +
              `<button class="yk-mini" data-a="toggle" title="${isHidden ? '显示' : '隐藏'}">${isHidden ? '＋' : '－'}</button>`;
            card.appendChild(acts);
            acts.onclick = (ev) => {
              ev.stopPropagation();
              const a = ev.target && ev.target.getAttribute ? ev.target.getAttribute('data-a') : null;
              if (a) handleEdit(a, k);
            };
            card.ondblclick = () => {
              const nn = prompt('修改按钮名称（留空恢复默认）：', name);
              if (nn === null) return;
              const cur = getLayoutState();
              const t = nn.trim();
              if (t === '' || t === flow.name) delete cur.renames[k];
              else cur.renames[k] = t;
              saveLayout(cur);
              renderGrid();
            };
          } else {
            card.onclick = () => runFlow(flow, { trigger: '流程卡片' });
          }
          grid.appendChild(card);
        });

        foot.innerHTML = editMode
          ? '✎ 编辑中：<b>－/＋</b> 显隐，<b>↑/↓</b> 排序，<b>双击名称</b> 重命名，<b>点徽标再按任意键</b> 设触发键（Esc 取消）。点 ✎ 退出。'
          : '<b>单击悬浮球</b>：弹出快捷菜单，点一下就执行；中文输入法下可在云客页按 Ctrl+Shift+F1~F8 执行流程。出错时请截屏发给技术支持。';
      }
      renderGrid();

      // ---- 动作录制：全局监听只绑一次（initUI 可能被 observer 重复调用）----
      let capturingMacro = null; // 正在为哪个宏捕获触发键
      let capturingExec = false; // 正在捕获「立即执行」快捷键
      if (!window.__ykRecBound) {
        window.__ykRecBound = true;
        // 点击记录
        document.addEventListener('click', (e) => {
          if (!macroRec) return;
          const t = e.target;
          if (!t || !t.closest) return;
          if (t.closest('#yk_helper_panel, #yk_helper_fab, #yk_helper_toast, #yk_auto_overlay')) return;
          const d = describeTarget(t);
          macroRec.actions.push({ t: 'click', text: d.text, sel: d.sel, x: e.clientX, y: e.clientY });
          toast('🎬 已记录第 ' + macroRec.actions.length + ' 步（点击' + (d.text ? '「' + d.text + '」' : '') + '）', false, true);
        }, true);
        // 输入记录（change 触发：输入完点到别处或失焦时记录最终值）
        document.addEventListener('change', (e) => {
          if (!macroRec) return;
          const el = e.target;
          if (!el || (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA' && el.tagName !== 'SELECT')) return;
          const r = el.getBoundingClientRect();
          if (el.type === 'checkbox' || el.type === 'radio') {
            // 勾选/单选按点击复现（点一下就是切换）
            const d = describeTarget(el);
            macroRec.actions.push({ t: 'click', text: d.text, sel: d.sel, x: r.left + r.width / 2, y: r.top + r.height / 2 });
          } else {
            const d = describeTarget(el);
            macroRec.actions.push({ t: 'input', text: d.text, sel: d.sel, x: r.left + r.width / 2, y: r.top + r.height / 2, value: el.value });
          }
          toast('🎬 已记录第 ' + macroRec.actions.length + ' 步（输入/选择）', false, true);
        }, true);
      }

      function renderMacros() {
        const list = panel.querySelector('#yk_macro_list');
        const recBtn = panel.querySelector('#yk_rec_btn');
        if (!list || !recBtn) return;
        recBtn.textContent = macroRec ? '■ 停止录制' : '● 录制';
        recBtn.classList.toggle('recording', !!macroRec);
        const macros = loadMacros();
        list.innerHTML = '';
        if (!macros.length && !macroRec) {
          const empty = document.createElement('div');
          empty.className = 'yk-macro-empty';
          empty.textContent = '重复操作录一遍，以后一键复现';
          list.appendChild(empty);
        }
        macros.forEach((m) => {
          const row = document.createElement('div');
          row.className = 'yk-macro-row';
          row.title = m.actions.length + ' 步 · 点击复现';
          row.innerHTML =
            '<span class="yk-macro-key" title="点击后按任意键设触发键">' + (m.key ? keyDisplay(m.key) : '⌨') + '</span>' +
            '<span class="yk-macro-name">' + escapeHtml(m.name) + '</span>' +
            '<button class="yk-mini" data-a="run" title="复现">▶</button>' +
            '<button class="yk-mini" data-a="exp" title="导出这套动作到文件">⤓</button>' +
            '<button class="yk-mini" data-a="del" title="删除">✕</button>';
          row.querySelector('.yk-macro-key').onclick = (ev) => {
            ev.stopPropagation();
            capturingMacro = m.id;
            toast('⚙ 请按下「' + m.name + '」要用的触发键…（Esc 取消）', false, true);
          };
          row.onclick = () => runMacro(m);
          row.querySelector('[data-a="run"]').onclick = (ev) => { ev.stopPropagation(); runMacro(m); };
          row.querySelector('[data-a="exp"]').onclick = (ev) => {
            ev.stopPropagation();
            const blob = new Blob([JSON.stringify(m, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = '云客动作-' + m.name + '.json';
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 5000);
            toast('✓ 已导出「' + m.name + '」，请把文件保存好');
          };
          row.querySelector('[data-a="del"]').onclick = (ev) => {
            ev.stopPropagation();
            saveMacros(loadMacros().filter((x) => x.id !== m.id));
            renderMacros();
            toast('已删除「' + m.name + '」');
          };
          list.appendChild(row);
        });
      }
      renderMacros();

      // [v1.15.6] 导出/导入：升级扩展、换电脑、清缓存都不再丢录制动作
      const impBtn = panel.querySelector('#yk_imp_btn');
      if (impBtn) {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json,application/json';
        fileInput.style.display = 'none';
        document.documentElement.appendChild(fileInput);
        impBtn.onclick = () => fileInput.click();
        fileInput.onchange = () => {
          const f = fileInput.files && fileInput.files[0];
          fileInput.value = '';
          if (!f) return;
          const reader = new FileReader();
          reader.onload = () => {
            try {
              const data = JSON.parse(reader.result);
              // 兼容三种格式：单个动作对象 / 动作数组 / {macros:[...]} 包装
              let incoming = Array.isArray(data) ? data : (data && Array.isArray(data.macros) ? data.macros : (data && data.actions ? [data] : null));
              if (!incoming) throw new Error('bad format');
              const cur = loadMacros();
              const names = new Set(cur.map((x) => x && x.name));
              let added = 0;
              incoming.forEach((m) => {
                if (!m || !Array.isArray(m.actions) || !m.actions.length) return;
                const name = String(m.name || '导入的动作');
                if (names.has(name)) return; // 同名跳过，避免重复
                cur.push({ id: 'm' + Date.now() + '_' + (added++), name: name, key: m.key || '', actions: m.actions });
                names.add(name);
              });
              saveMacros(cur);
              renderMacros();
              toast(added ? '✓ 已导入 ' + added + ' 个动作' : '没有可导入的新动作（可能同名已存在）');
            } catch (e) {
              toast('✗ 文件格式不对，请选择本插件导出的 JSON 文件');
            }
          };
          reader.readAsText(f);
        };
      }

      panel.querySelector('#yk_rec_btn').onclick = () => {
        if (!macroRec) {
          macroRec = { actions: [] };
          renderMacros();
          toast('🎬 录制开始！去页面上正常操作（点击/输入/回车都会被记录），\n完成后回这里点「停止录制」', false, true);
        } else {
          const acts = macroRec.actions;
          macroRec = null;
          renderMacros();
          if (!acts.length) { toast('没录到任何操作，已取消'); return; }
          const name = prompt('录制了 ' + acts.length + ' 步，给这套动作起个名字：', '我的动作' + (loadMacros().length + 1));
          if (name === null) { toast('已放弃本次录制'); return; }
          const list2 = loadMacros();
          list2.push({ id: 'm' + Date.now(), name: (name.trim() || '未命名动作'), key: '', actions: acts });
          saveMacros(list2);
          renderMacros();
          toast('✓ 已保存「' + (name.trim() || '未命名动作') + '」，以后点它就能一键复现');
        }
      };

      // ---- 自动模式：设置项接线 ----
      // 关键词识别已移除；无人接听挂断由手机 APK 处理，不再设电脑端计时器。
      const autoOn = panel.querySelector('#yk_auto_on');
      const autoSec = panel.querySelector('#yk_auto_sec');
      const autoOpts = panel.querySelector('#yk_auto_opts');
      const a0 = loadAuto();
      autoOn.checked = a0.autoMode;
      autoSec.value = String(a0.autoSeconds);
      autoOpts.style.display = a0.autoMode ? 'flex' : 'none';
      autoOn.onchange = () => {
        const s = loadAuto(); s.autoMode = autoOn.checked; s.useKeywords = false; saveAuto(s);
        autoOpts.style.display = autoOn.checked ? 'flex' : 'none';
        toast(autoOn.checked ? '✓ 自动模式已开启：通话结束后将自动执行' : '自动模式已关闭');
      };
      autoSec.onchange = () => { const s = loadAuto(); const v = parseInt(autoSec.value, 10); s.autoSeconds = isNaN(v) ? 5 : v; s.useKeywords = false; saveAuto(s); toast(v === 0 ? '✓ 已设为 0：通话一结束立即执行，不再倒计时' : '延迟已设为 ' + v + ' 秒'); };

      // 手机挂断时是否把云客页切到前台
      const autoFocus = panel.querySelector('#yk_auto_focus');
      autoFocus.checked = loadAuto().focusOnLink !== false;
      autoFocus.onchange = () => {
        const s2 = loadAuto(); s2.focusOnLink = autoFocus.checked; saveAuto(s2);
        toast(autoFocus.checked ? '✓ 手机一挂断就把云客通话页切到前台并立即提交' : '已设为不切前台：后台标签页里静默提交');
      };
      const connNoticeBox = panel.querySelector('#yk_connect_notice');
      if (connNoticeBox) {
        connNoticeBox.checked = loadAuto().connectNotice !== false;
        connNoticeBox.onchange = () => {
          const s3 = loadAuto(); s3.connectNotice = connNoticeBox.checked; saveAuto(s3);
          toast(connNoticeBox.checked ? '✓ 电话接通时会响提示音并显示醒目提醒' : '已关闭接通提醒');
          if (!connNoticeBox.checked) connStopTitleFlash();
        };
      }

      // 手机挂断联动下拉
      const autoLink = panel.querySelector('#yk_auto_link');
      FLOWS.forEach((f) => {
        const opt = document.createElement('option');
        opt.value = f.hotkey;
        opt.textContent = f.name;
        autoLink.appendChild(opt);
      });
      autoLink.value = loadAuto().linkFlow || '';
      autoLink.onchange = () => {
        const s = loadAuto(); s.linkFlow = autoLink.value; saveAuto(s);
        toast(autoLink.value ? '✓ 联动已开启：APK 发来挂断信号将立即执行「' + flowDisplayName(FLOWS.find((f) => f.hotkey === autoLink.value), s.renames) + '」' : '联动已关闭');
      };

      // 「立即执行」快捷键设置
      const execKeyBtn = panel.querySelector('#yk_exec_key');
      const renderExecKey = () => { execKeyBtn.textContent = keyDisplay(loadAuto().execKey || 'Enter'); };
      renderExecKey();
      execKeyBtn.onclick = () => {
        capturingExec = true;
        execKeyBtn.classList.add('listening');
        toast('⚙ 请按下「立即执行」要用的键…（Esc 取消）', false, true);
      };

      // 完整设置备份：自动执行、手机联动、按键布局和录制动作；特意排除 API 密钥与接口鉴权。
      const settingsExportBtn = panel.querySelector('#yk_settings_export');
      const settingsImportBtn = panel.querySelector('#yk_settings_import');
      const settingsFile = document.createElement('input');
      settingsFile.type = 'file';
      settingsFile.accept = '.json,application/json';
      settingsFile.style.display = 'none';
      document.documentElement.appendChild(settingsFile);
      settingsExportBtn.onclick = () => {
        const current = loadAuto();
        const backup = {
          format: 'yunke-follow-assistant-settings', schema: 1, extensionVersion: YK_BUILD,
          exportedAt: new Date().toISOString(),
          auto: {
            autoMode: current.autoMode !== false,
            autoSeconds: [0, 3, 5, 8].includes(Number(current.autoSeconds)) ? Number(current.autoSeconds) : 0,
            linkFlow: current.linkFlow || '', lastFlow: current.lastFlow || 'F',
            execKey: String(current.execKey || 'Enter').slice(0, 32),
            focusOnLink: current.focusOnLink !== false,
            connectNotice: current.connectNotice !== false,
          },
          layout: getLayoutState(),
          macros: loadMacros(),
        };
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = '云客跟进助手设置-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '.json';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        toast('✓ 设置备份已导出（录制动作内容会一并保存；接口地址和密钥未导出）');
      };
      settingsImportBtn.onclick = () => settingsFile.click();
      settingsFile.onchange = () => {
        const file = settingsFile.files && settingsFile.files[0];
        settingsFile.value = '';
        if (!file) return;
        if (file.size > 4 * 1024 * 1024) { toast('✗ 备份文件超过 4 MB，无法恢复', true); return; }
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const data = JSON.parse(String(reader.result || ''));
            if (!data || data.format !== 'yunke-follow-assistant-settings' || data.schema !== 1) throw new Error('备份格式或版本不支持');
            const validFlowKeys = new Set(FLOWS.map((f) => f.hotkey));
            const cleanKey = (value, fallback) => {
              const key = typeof value === 'string' ? value : '';
              return key && key.length <= 32 && !/[\r\n\u0000-\u001f]/.test(key) ? key : fallback;
            };
            if (!data.auto || typeof data.auto !== 'object' || !data.layout || typeof data.layout !== 'object' || !Array.isArray(data.macros)) {
              throw new Error('备份缺少设置、布局或动作数据');
            }
            const a = data.auto;
            const seconds = Number(a.autoSeconds);
            if (![0, 3, 5, 8].includes(seconds)) throw new Error('自动执行延迟值无效');
            const autoRestore = {
              ...loadAuto(),
              autoMode: typeof a.autoMode === 'boolean' ? a.autoMode : true,
              autoSeconds: seconds,
              linkFlow: a.linkFlow === '' ? '' : (validFlowKeys.has(a.linkFlow) ? a.linkFlow : ''),
              lastFlow: validFlowKeys.has(a.lastFlow) ? a.lastFlow : 'F',
              execKey: cleanKey(a.execKey, 'Enter'),
              focusOnLink: typeof a.focusOnLink === 'boolean' ? a.focusOnLink : true,
              connectNotice: typeof a.connectNotice === 'boolean' ? a.connectNotice : true,
              useKeywords: false,
              noAnsOn: false,
            };

            const rawLayout = data.layout;
            const layout = { km: 'v2', order: [], hidden: [], renames: {}, keys: {} };
            if (Array.isArray(rawLayout.order)) rawLayout.order.forEach((key) => {
              if (validFlowKeys.has(key) && !layout.order.includes(key)) layout.order.push(key);
            });
            FLOWS.forEach((f) => { if (!layout.order.includes(f.hotkey)) layout.order.push(f.hotkey); });
            if (Array.isArray(rawLayout.hidden)) rawLayout.hidden.forEach((key) => {
              if (validFlowKeys.has(key) && !layout.hidden.includes(key)) layout.hidden.push(key);
            });
            if (rawLayout.renames && typeof rawLayout.renames === 'object' && !Array.isArray(rawLayout.renames)) {
              Object.keys(rawLayout.renames).forEach((key) => {
                const name = rawLayout.renames[key];
                if (validFlowKeys.has(key) && typeof name === 'string' && name.trim()) layout.renames[key] = name.trim().slice(0, 60);
              });
            }
            if (rawLayout.keys && typeof rawLayout.keys === 'object' && !Array.isArray(rawLayout.keys)) {
              Object.keys(rawLayout.keys).forEach((key) => {
                if (validFlowKeys.has(key)) layout.keys[key] = cleanKey(rawLayout.keys[key], key);
              });
            }

            if (data.macros.length > 100) throw new Error('录制动作超过 100 组，无法恢复');
            const macros = data.macros.map((m, mi) => {
              if (!m || typeof m !== 'object' || !Array.isArray(m.actions) || m.actions.length > 500) throw new Error('第 ' + (mi + 1) + ' 组动作格式无效');
              const actions = m.actions.map((act, ai) => {
                if (!act || !['click', 'input', 'enter'].includes(act.t)) throw new Error('第 ' + (mi + 1) + ' 组第 ' + (ai + 1) + ' 步动作无效');
                const out = { t: act.t };
                ['text', 'sel', 'value'].forEach((field) => {
                  if (act[field] != null) {
                    if (typeof act[field] !== 'string' || act[field].length > 10000) throw new Error('动作文本超出允许范围');
                    out[field] = act[field];
                  }
                });
                ['x', 'y'].forEach((field) => {
                  if (act[field] != null) {
                    const coord = Number(act[field]);
                    if (!Number.isFinite(coord) || Math.abs(coord) > 10000) throw new Error('动作坐标无效');
                    out[field] = coord;
                  }
                });
                return out;
              });
              return {
                id: String(m.id || ('m' + Date.now() + '_' + mi)).slice(0, 100),
                name: String(m.name || ('导入动作' + (mi + 1))).slice(0, 80),
                key: cleanKey(m.key, ''), actions,
              };
            });
            const packed = JSON.stringify({ auto: autoRestore, layout, macros });
            if (packed.length > 2 * 1024 * 1024) throw new Error('设置内容超过浏览器本地存储限制');

            saveAuto(autoRestore);
            saveLayout(layout);
            saveMacros(macros);
            autoOn.checked = autoRestore.autoMode;
            autoSec.value = String(autoRestore.autoSeconds);
            autoOpts.style.display = autoRestore.autoMode ? 'flex' : 'none';
            autoFocus.checked = autoRestore.focusOnLink;
            if (connNoticeBox) connNoticeBox.checked = autoRestore.connectNotice;
            autoLink.value = autoRestore.linkFlow;
            renderExecKey();
            renderGrid();
            renderMacros();
            toast('✓ 设置已恢复：自动流程、快捷键和录制动作已载入；接口地址和密钥沿用本机原设置');
          } catch (err) {
            toast('✗ 恢复失败：' + String(err && err.message || '文件内容无效'), true);
          }
        };
        reader.readAsText(file);
      };

      // ---- 自动模式：通话结束监听 + 倒计时浮层 ----
      const overlay = document.createElement('div');
      overlay.id = 'yk_auto_overlay';
      overlay.innerHTML =
        `<div class="yk-auto-title"><span>📞 通话已结束</span><span class="yk-auto-count" id="yk_auto_count"></span></div>` +
        `<div class="yk-auto-suggest" id="yk_auto_suggest"></div>` +
        `<div class="yk-auto-btns">` +
        `<button class="yk-auto-btn yk-btn-run" id="yk_auto_run">立即执行</button>` +
        `<button class="yk-auto-btn yk-btn-menu" id="yk_auto_menu">换一个</button>` +
        `<button class="yk-auto-btn yk-btn-cancel" id="yk_auto_cancel">取消本次</button>` +
        `</div>`;
      document.documentElement.appendChild(overlay);
      let autoTimer = null, autoPendingFlow = null;

      function hideAutoOverlay() {
        if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
        overlay.style.display = 'none';
        autoPendingFlow = null;
      }

      function showAutoOverlay(flow, seconds) {
        if (running) return;
        // 0 秒 = 不弹倒计时、不等待，通话一结束立刻执行
        if (seconds <= 0) {
          runFlow(flow, { gentleHangup: true, pageSelfEnded: true, trigger: '通话结束自动执行' });
          return;
        }
        autoPendingFlow = flow;
        const suggest = overlay.querySelector('#yk_auto_suggest');
        suggest.innerHTML = `即将自动执行：<b style="color:${flow.color}">【${flowDisplayName(flow, getLayoutState().renames)}】</b><br>按 <b>${keyDisplay(loadAuto().execKey || 'Enter')}</b> 立刻执行 · 不对就点下面的按钮换一个`;
        overlay.style.display = 'block';
        let remain = seconds;
        const count = overlay.querySelector('#yk_auto_count');
        count.textContent = remain + 's';
        if (autoTimer) clearInterval(autoTimer);
        autoTimer = setInterval(() => {
          remain -= 0.1;
          if (remain <= 0) {
            hideAutoOverlay();
            runFlow(flow, { gentleHangup: true, pageSelfEnded: true, trigger: '通话结束自动执行' });
            return;
          }
          count.textContent = Math.ceil(remain) + 's';
        }, 100);
      }
      overlay.querySelector('#yk_auto_run').onclick = () => { const f = autoPendingFlow; hideAutoOverlay(); if (f) runFlow(f, { gentleHangup: true, pageSelfEnded: true, trigger: '倒计时浮层按钮' }); };
      overlay.querySelector('#yk_auto_menu').onclick = () => { hideAutoOverlay(); toggleRing(); };
      overlay.querySelector('#yk_auto_cancel').onclick = () => { hideAutoOverlay(); toast('已取消，本次请手动选择结果'); };

      // ---- 手机挂断联动：轮询云端中转事件（APK 挂断时 POST 一条 hangup）----
      let linkLastSeenId = 0, linkBaselined = false, linkLastExecAt = 0, linkLastExecKey = '';
      const LINK_TAB_ID = Math.random().toString(36).slice(2); // 本标签页身份（互斥锁只拦别人）
      // [v1.10.0] 手机心跳状态：🟢在线 / 🟠无障碍异常 / 🔴失联（30 秒无心跳，弹窗+提示音）
      let linkHb = null;
      let hbOfflineNotified = false;
      let lastIncomingNotify = {};
      function beepAlarm() {
        try {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return;
          const ctx = new AC();
          [0, 350, 700].forEach((d) => {
            const o = ctx.createOscillator(), g = ctx.createGain();
            o.connect(g); g.connect(ctx.destination);
            o.frequency.value = 880; o.type = 'sine'; g.gain.value = 0.12;
            o.start(ctx.currentTime + d / 1000); o.stop(ctx.currentTime + d / 1000 + 0.18);
          });
        } catch (e) {}
      }
      function updateHbStatus() {
        const el = document.getElementById('yk_hb_dot');
        if (!el) return;
        // [v1.14.1] 无心跳但有新鲜挂断事件 = 手机跑的是无心跳的旧版，也按"在线"显示，不再误报未上报
        if (!linkHb && ykLastEventAt && Date.now() - ykLastEventAt < 90000) {
          el.textContent = '🟢 手机在线（旧版·无心跳）';
          el.style.color = '#22c55e';
          hbOfflineNotified = false;
          return;
        }
        if (!linkHb) { el.textContent = '⚪ 手机未上报'; el.style.color = '#8b98ad'; return; }
        const age = (Date.now() - linkHb.t) / 1000;
        if (age > 30) {
          el.textContent = '🔴 手机离线 ' + Math.round(age) + 's';
          el.style.color = '#fb7185';
          if (!hbOfflineNotified) {
            hbOfflineNotified = true;
            toast('🔴 手机状态上报已中断超过 30 秒，扩展无法核对客户和处理联动；请检查手机 App 连接', true);
            beepAlarm();
          }
          return;
        }
        hbOfflineNotified = false;
        if (linkHb.alive === false) {
          el.textContent = '🟠 手机在线·无障碍异常';
          el.style.color = '#fbbf24';
          return;
        }
        el.textContent = '🟢 手机在线';
        el.style.color = '#22c55e';
      }
      // [v1.15.5] ===== 手机接通状态：轮询中转 phone_status 单例表（只读，不影响联动事件消费）=====
      // 状态机：dialing 拨打中 / answered 已接通（横幅+提示音）/ incoming 客户来电 /
      //         ended 通话结束 / hangup 未接通挂断。不用再单独开状态屏网页。
      const PHONE_STATUS_URL = 'http://127.0.0.1:8787/rest/phone_status?select=state,number,name,reason,state_at,alive,hb_at&order=state_at.desc&limit=1';
      let phLastState = '', phLastStateAt = 0, phAnsweredAt = 0, phBusy = 0, phErrNotified = false;
      let phTimerEl = null, phDotEl = null, phBannerEl = null, phBannerTimer = null;
      let phAudioCtx = null, phConnectAlertEl = null, phConnectAlertTimer = null, phConnStateKey = '';
      const PH_META = {
        dialing:  { dot: '📘 拨打中',       color: 'linear-gradient(135deg,#0284c7,#4f46e5)', solid: '#38bdf8' },
        answered: { dot: '📗 已接通',       color: 'linear-gradient(135deg,#059669,#22c55e)', solid: '#22c55e' },
        incoming: { dot: '📫 客户来电',     color: 'linear-gradient(135deg,#7c3aed,#a855f7)', solid: '#c084fc' },
        ended:    { dot: '⬛ 通话结束',     color: 'linear-gradient(135deg,#334155,#475569)', solid: '#94a3b8' },
        hangup:   { dot: '⬜ 未接通挂断',   color: 'linear-gradient(135deg,#475569,#64748b)', solid: '#8b98ad' },
      };
      function phShowBanner(text, bg) {
        try {
          if (!phBannerEl || !phBannerEl.isConnected) {
            phBannerEl = document.createElement('div');
            phBannerEl.id = 'yk_call_banner';
            phBannerEl.style.cssText = [
              'position:fixed', 'z-index:2147483646', 'left:50%', 'bottom:96px', 'transform:translateX(-50%)',
              'padding:5px 14px', 'border-radius:10px', 'color:#fff', 'font-size:13px', 'font-weight:600',
              'font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif', 'letter-spacing:1px',
              'box-shadow:0 6px 20px rgba(0,0,0,.35)',
              'display:none', 'text-align:center', 'white-space:nowrap', 'cursor:move', 'user-select:none',
              'animation:ykBannerIn .28s cubic-bezier(.34,1.56,.64,1)',
            ].join(';');
            document.documentElement.appendChild(phBannerEl);
            // [v1.17.1] 所有横幅共用一个位置记忆：拖任意一个，全部跟着走
            ykBadgeDraggable(phBannerEl, 'yk_banner_pos');
          }
          phBannerEl.textContent = text;
          phBannerEl.style.background = bg;
          phBannerEl.style.display = 'block';
          if (phBannerTimer) clearTimeout(phBannerTimer);
          phBannerTimer = setTimeout(() => { if (phBannerEl) phBannerEl.style.display = 'none'; }, 5000);
        } catch (e) {}
      }
      function phUnlockAudio() {
        try {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return;
          if (!phAudioCtx) phAudioCtx = new AC();
          if (phAudioCtx.state === 'suspended') phAudioCtx.resume().catch(() => {});
        } catch (e) {}
      }
      ['pointerdown', 'keydown', 'touchstart'].forEach((eventName) => {
        try { window.addEventListener(eventName, phUnlockAudio, { capture: true, once: true, passive: true }); } catch (e) {}
      });
      function phShowConnectionAlert(text, confirmed) {
        try {
          if (!phConnectAlertEl || !phConnectAlertEl.isConnected) {
            phConnectAlertEl = document.createElement('div');
            phConnectAlertEl.id = 'yk_connection_alert';
            phConnectAlertEl.style.cssText = [
              'position:fixed', 'z-index:2147483647', 'top:18px', 'left:50%', 'transform:translateX(-50%)',
              'padding:15px 26px', 'border-radius:14px', 'color:#fff', 'font-size:19px', 'font-weight:800',
              'font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif', 'letter-spacing:.3px',
              'line-height:1.45', 'text-align:center', 'white-space:normal', 'width:max-content',
              'max-width:calc(100vw - 36px)', 'box-shadow:0 12px 36px rgba(2,6,23,.38)',
              'border:1px solid rgba(255,255,255,.24)', 'cursor:pointer', 'user-select:none',
              'animation:ykBannerIn .25s cubic-bezier(.34,1.56,.64,1)',
            ].join(';');
            phConnectAlertEl.title = '点击关闭提醒';
            phConnectAlertEl.addEventListener('click', () => { if (phConnectAlertEl) phConnectAlertEl.style.display = 'none'; });
            document.documentElement.appendChild(phConnectAlertEl);
          }
          phConnectAlertEl.textContent = text;
          phConnectAlertEl.style.background = confirmed
            ? 'linear-gradient(135deg,#047857,#16a34a)'
            : 'linear-gradient(135deg,#b45309,#ea580c)';
          phConnectAlertEl.style.display = 'block';
          if (phConnectAlertTimer) clearTimeout(phConnectAlertTimer);
          phConnectAlertTimer = setTimeout(() => { if (phConnectAlertEl) phConnectAlertEl.style.display = 'none'; }, 9000);
        } catch (e) {}
      }
      function phBeep(pattern) {
        try {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return;
          if (!phAudioCtx) phAudioCtx = new AC();
          const ctx = phAudioCtx;
          const play = () => pattern.forEach((d) => {
            const o = ctx.createOscillator(), g = ctx.createGain();
            o.connect(g); g.connect(ctx.destination);
            o.frequency.value = 920; o.type = 'triangle'; g.gain.value = 0.2;
            o.start(ctx.currentTime + d / 1000); o.stop(ctx.currentTime + d / 1000 + 0.2);
          });
          if (ctx.state === 'suspended') ctx.resume().then(play).catch(() => {});
          else play();
        } catch (e) {}
      }
      PW.__YK_CUSTOMER_CONNECTED_ALERT__ = (message) => {
        phShowConnectionAlert(message, true);
        phBeep([0, 180, 430, 610, 860]);
        toast(message, false, true);
      };
      function phFmt(ms) {
        const s = Math.max(0, Math.floor(ms / 1000));
        return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
      }
      // [v1.16.2] 回拨线路号码校正：云客回拨线路下，手机屏幕扫到的是平台中间号，
      // 不是客户真实号。拨号/接通/来电瞬间从 CRM 页面抓"手机号"字段里的真实号码：
      // ① PATCH 回写中转 phone_status → 悬浮条显示客户号；② ykNumMap 供横幅/toast 用。
      // [v1.18.2] 每通电话的客户身份快照（键：手机上报的原号 + 换算出的真实号都存一份），
      // 执行挂断前用它把对应页签切到前台，防"手机 A、电脑 B"。
      // 两个表都在模块作用域声明（见上方）：联动路径和手动按键路径共用同一份客户身份。
      function ykCtxPrune() {
        const ks = Object.keys(ykCallCtx);
        if (ks.length <= 24) return;
        ks.sort((a, b) => (ykCallCtx[a].at || 0) - (ykCallCtx[b].at || 0));
        for (let i = 0; i < ks.length - 24; i++) delete ykCallCtx[ks[i]];
      }
      let ykNumFixAt = '', ykNumFixTries = 0;
      function grabCrmNumber() {
        try {
          let best = null, bestPure = null;
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
          let node;
          while ((node = walker.nextNode())) {
            const el = node;
            if (!isVisible(el)) continue;
            if (el.closest && el.closest('#yk_helper_panel, #yk_helper_fab, #yk_helper_toast, #yk_cb_overlay')) continue;
            const own = normalizeText(el.innerText || '');
            if (!own || own.length > 40) continue;
            if (own.indexOf('手机号') >= 0) {
              const m = own.match(/1[3-9]\d{9}/);
              if (m) { const area = elArea(el); if (!best || area < best.area) best = { area, num: m[0] }; }
            } else if (/^1[3-9]\d{9}$/.test(own)) {
              const area = elArea(el);
              if (!bestPure || area < bestPure.area) bestPure = { area, num: own };
            }
          }
          if (best) return best.num;
          if (bestPure) return bestPure.num;
          return '';
        } catch (e) { return ''; }
      }
      // [v1.16.6] 抓客户姓名：以号码元素为锚，在其最近容器里找最像"姓名"的兄弟短文本。
      // 最佳猜测式提取——抓不到就返回空串（悬浮条只显示号码，不影响任何流程）
      function grabCrmName(phone) {
        try {
          if (!phone) return '';
          const tail = phone.slice(-4);
          const anchorCands = [];
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
          let n;
          while ((n = walker.nextNode())) {
            if (!isVisible(n)) continue;
            const own = normalizeText(n.innerText || n.textContent || '');
            if (own && own.length <= 24 && own.indexOf(tail) >= 0 && /\d{7,}/.test(own)) {
              anchorCands.push({ el: n, area: elArea(n) });
            }
          }
          if (!anchorCands.length) return '';
          anchorCands.sort((a, b) => a.area - b.area);
          const anchor = anchorCands[0].el;
          const BAD = /^(拨打|编辑|客户详情|切换到新版|收起|展开|备注|跟进|通话|记录|详情|客户|提交|取消|关闭|确定|保存|删除|复制|已复制|拨打中|已接通|挂断|暂停|恢复|资料|移交|公海|领取|转接|加微|微信|标签|来源|渠道|所属|状态|阶段|意向|等级|最近|创建|更新|姓名|手机|电话|号码|全部|筛选|搜索|导出|批量|更多|返回|刷新|待办|今日|本周|昨日|本月)/;
          let cur = anchor;
          for (let lv = 0; lv < 4 && cur; lv++) {
            cur = cur.parentElement;
            if (!cur) break;
            for (const sib of cur.querySelectorAll('*')) {
              if (sib === anchor || sib.contains(anchor)) continue;
              if (!isVisible(sib)) continue;
              const t = normalizeText(sib.innerText || sib.textContent || '');
              if (!t || t.length < 2 || t.length > 14) continue;
              const cjk = (t.match(/[\u4e00-\u9fa5]/g) || []).length;
              if (cjk < 2) continue;
              if (/\d{7,}/.test(t) || t.indexOf(tail) >= 0) continue;
              if (BAD.test(t)) continue;
              if (sib.querySelector && sib.querySelector('button,[role="button"],input,svg,img,video')) continue;
              return t;
            }
          }
          return '';
        } catch (e) { return ''; }
      }
      function statusClock(ms) {
        if (!ms) return '';
        const d = new Date(ms);
        return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ':' + ('0' + d.getSeconds()).slice(-2);
      }
      function renderYkStatus(state) {
        const set = (id, value) => {
          const el = document.getElementById(id);
          if (el) el.textContent = value || '—';
          return el;
        };
        set('yk_status_phone', state.phoneCustomer || YK_STATUS_DEFAULT.phoneCustomer);
        set('yk_status_owner', YK_STATUS_DEFAULT.owner);
        set('yk_status_crm', state.crmCustomer || YK_STATUS_DEFAULT.crmCustomer);
        const match = set('yk_status_match', state.match || YK_STATUS_DEFAULT.match);
        if (match) match.dataset.state = String(state.match || '').indexOf('✅') >= 0 ? 'ok'
          : /⚠|无法|缺少|失败|未找到/.test(String(state.match || '')) ? 'warn' : '';
        set('yk_status_event', (state.event || YK_STATUS_DEFAULT.event) + (state.eventAt ? ' · ' + statusClock(state.eventAt) : ''));
        set('yk_status_progress', state.progress || YK_STATUS_DEFAULT.progress);
        const outcome = set('yk_status_outcome', state.outcome || '—');
        if (outcome) outcome.dataset.state = /尚未确认|拦截|未找到|未完成|错误|失败/.test(String(state.outcome || '')) ? 'error' : '';
      }
      PW.__YK_STATUS_RENDER__ = renderYkStatus;
      renderYkStatus(PW.__YK_STATUS_STATE__ || YK_STATUS_DEFAULT);
      let ykStatusIdentityKey = '';
      function refreshYkStatusIdentity(force) {
        const ph = PW.__ykPhRow || {};
        const key = [ph.state || '', ph.stateAt || '', ph.number || '', ph.name || ''].join('|');
        if (!force && key === ykStatusIdentityKey) return;
        ykStatusIdentityKey = key;
        const phone = String(ykNumMap[ph.number] || ph.number || '');
        const name = String(ph.name || (ykCallCtx[phone] && ykCallCtx[phone].name) || '');
        const phoneLabel = (PH_META[ph.state] ? PH_META[ph.state].dot : '⚪ 暂无通话') + ([name, phone].filter(Boolean).join(' ') ? ' · ' + [name, phone].filter(Boolean).join(' ') : '');
        const crmPhone = grabCrmNumber();
        const crmName = grabCrmName(crmPhone);
        const crmLabel = [crmName, crmPhone].filter(Boolean).join(' ');
        if (!/^(dialing|answered|incoming|ringing)$/i.test(String(ph.state || ''))) {
          ykStatusUpdate({
            phoneCustomer: phoneLabel,
            crmCustomer: crmLabel || '当前 CRM 客户未识别',
            match: /^(ended|hangup)$/i.test(String(ph.state || '')) ? '本通已结束；查看最近事件' : '等待手机外呼',
          });
          return;
        }
        let match = '⚠ 手机状态没有客户号码，无法核对';
        if (phone && currentCustomerDetailMatches(name, phone)) {
          match = '✅ 右侧客户详情手机号一致';
        } else if (phone || name) {
          const tab = matchCallTab(callTabKeys(name, phone));
          if (tab && isTabActive(tab.el)) {
            const byPhone = tab.key === phone.replace(/\D/g, '').slice(-4);
            match = '✅ 当前页签' + (byPhone ? '号码尾号匹配' : '姓名唯一匹配');
          } else if (tab) {
            match = '⚠ 找到「' + (tab.label || name || '客户') + '」页签，当前 CRM 尚未切换';
          } else {
            match = '⚠ CRM 未找到唯一对应客户页签/详情';
          }
        }
        ykStatusUpdate({
          phoneCustomer: phoneLabel || '手机号码/姓名未识别',
          crmCustomer: crmLabel || '当前 CRM 客户未识别',
          match: match,
        });
      }
      PW.__YK_STATUS_REFRESH_IDENTITY__ = refreshYkStatusIdentity;
      refreshYkStatusIdentity(true);
      function maybeFixNumber(row) {
        try {
          if (!row || !row.state_at) return;
          if (['dialing', 'answered', 'incoming'].indexOf(row.state) < 0) return;
          if (row.state_at !== ykNumFixAt) { ykNumFixAt = row.state_at; ykNumFixTries = 0; }
          if (ykNumFixTries >= 10) return;
          ykNumFixTries++;
          const real = grabCrmNumber();
          const name = grabCrmName(real || row.number);
          // [v1.18.2] 记下这通是谁（姓名 + 真实号），联动前拿来对齐页签
          if (real || name) {
            const ctx = { num: real || String(row.number || ''), name: name || '', at: Date.now() };
            if (row.number) ykCallCtx[String(row.number)] = ctx;
            if (real) ykCallCtx[String(real)] = ctx;
            ykCtxPrune();
          }
          if ((!real || real === row.number) && !name) return;
          ykNumFixTries = 10;
          if (real && real !== row.number) ykNumMap[row.number] = real;
          const patch = {};
          if (real && real !== row.number) patch.number = real;
          if (name) patch.name = name;
          if (!Object.keys(patch).length) return;
          relayFetch(PHONE_STATUS_URL.split('?')[0], {
            method: 'PATCH',
            headers: { 'x-wb-webapp-access-key': RELAY_KEY, 'content-type': 'application/json' },
            body: JSON.stringify(patch),
          }).catch(() => {});
        } catch (e) {}
      }
      function phRender(row) {
        if (!phDotEl || !phDotEl.isConnected) { phDotEl = document.getElementById('yk_call_dot'); phTimerEl = document.getElementById('yk_call_timer'); }
        if (!phDotEl) return;
        const state = row ? row.state : '';
        const meta = PH_META[state];
        phDotEl.textContent = meta ? meta.dot : '⚪ 暂无通话';
        phDotEl.style.color = meta ? (meta.solid || meta.color) : '#8b98ad';
        // 通话计时（接通中显示已通话时长；结束 8 秒后清空回空闲）
        if (phTimerEl) {
          if (state === 'answered' && phAnsweredAt) phTimerEl.textContent = phFmt(Date.now() - phAnsweredAt);
          else if (phTimerEl.textContent) phTimerEl.textContent = '';
        }
        // 状态跃迁提示：同一条 state_at 只提示一次（后台轮询 + 页面刷新不会重复响）
        const at = row && row.state_at ? Date.parse(row.state_at) : 0;
        // [v1.16.2] 回拨线路：显示客户真实号（ykNumMap 由 maybeFixNumber 抓到后回填）
        // [v1.16.6] 同时带上客户姓名（maybeFixNumber 抓到后 PATCH 进 phone_status）
        const num = row && row.number ? String(ykNumMap[row.number] || row.number) : '';
        const who = (row && row.name ? row.name + ' ' : '') + num;
        if (state && state !== phLastState && at > phLastStateAt) {
          phLastState = state; phLastStateAt = at;
          const eventTitle = meta ? meta.dot : '手机状态变化：' + state;
          const eventReason = row && row.reason ? ' · ' + String(row.reason) : '';
          const progressByState = state === 'dialing' ? '手机正在拨号，等待通话结果'
            : state === 'answered' ? '手机线路已接通，正在确认 CRM 客户是否接听'
              : state === 'hangup' || state === 'ended' ? '手机报告通话结束，扩展正在核对自动跟进'
                : state === 'incoming' ? '手机收到客户来电' : '手机状态已更新';
          ykStatusUpdate({
            event: eventTitle + (who ? ' · ' + who : '') + eventReason,
            eventAt: at || Date.now(),
            progress: progressByState,
            outcome: state === 'dialing' ? '等待手机通话结果'
              : state === 'answered' ? '等待 CRM 通话计时启动'
              : state === 'hangup' || state === 'ended' ? '检查挂断联动与 CRM 通话结束状态' : '',
          });
          if (state === 'answered') {
            phAnsweredAt = at;
            phShowConnectionAlert('📞 手机线路已接通 · 正在确认客户接听', false);
            phBeep([0, 280, 560]);
            connStartTitleFlash('📞 手机线路已接通');
            toast('📞 手机线路已接通，云客正在确认客户是否接听', false, true);
          } else if (state === 'incoming') {
            phBeep([0, 180, 360]);
            phShowBanner('📫 客户来电' + (num ? '：' + num : ''), '#7c3aed');
            toast('📫 客户来电' + (num ? ' ' + num : ''), false, true);
          } else if (state === 'dialing') {
            phShowBanner('📘 拨打中…', '#2563eb');
          } else if (state === 'ended') {
            phBeep([0, 300]);
            const dur = phAnsweredAt ? '，通话时长 ' + phFmt(at - phAnsweredAt) : '';
            phShowBanner('⬛ 通话结束' + dur, '#475569');
            toast('⬛ 通话结束' + (num ? ' ' + num : '') + dur);
            // [v1.16.3] 没配查微信API时：真通话结束自动复制客户号 → 粘进微信PC看有没有微信
            if (num && phAnsweredAt && !wxchkReady()) wxSemiCopy(num);
          } else if (state === 'hangup') {
            phShowBanner('⬜ 未接通挂断', '#64748b');
          }
        }
        // 结束/挂断 8 秒后状态行自动回空闲（不自动清，靠新事件覆盖；中转 idle 时 state 为空）
        syncManualHangupControl();
      }
      let manualHangupPending = false;
      let lastManualHangupCommandAt = 0;
      let manualHangupRequestPromise = null;
      const manualHangupButton = document.getElementById('yk_manual_hangup');
      const manualHangupStatus = document.getElementById('yk_manual_hangup_status');
      function manualPhoneCallIsActive() {
        try {
          const ph = PW.__ykPhRow;
          return !!(ph && ph.alive && ph.hbAt > 0 && Date.now() - ph.hbAt <= 20000 &&
            /^(dialing|ringing|answered|incoming)$/i.test(String(ph.state || '')));
        } catch (e) { return false; }
      }
      function syncManualHangupControl() {
        const ph = PW.__ykPhRow || {};
        const fresh = !!(ph.alive && ph.hbAt > 0 && Date.now() - ph.hbAt <= 20000);
        const active = fresh && /^(dialing|ringing|answered|incoming)$/i.test(String(ph.state || ''));
        const ended = fresh && /^(hangup|ended|idle|none|disconn|over|finish)$/i.test(String(ph.state || ''));
        if (manualHangupPending && ended) manualHangupPending = false;
        if (!manualHangupButton || !manualHangupStatus) return;
        manualHangupButton.disabled = !active || manualHangupPending;
        manualHangupButton.dataset.active = active ? 'true' : 'false';
        if (manualHangupPending) manualHangupStatus.textContent = '挂断处理中 · 等待手机状态回执';
        else if (active) manualHangupStatus.textContent = '手机显示' + (ph.state === 'answered' ? '通话中' : ph.state === 'incoming' ? '来电中' : '拨号中') + ' · ' + ([ph.name, ph.number].filter(Boolean).join(' ') || '当前号码');
        else if (ended) manualHangupStatus.textContent = '手机已结束通话 · 可继续选结果并提交';
        else if (fresh) manualHangupStatus.textContent = '手机当前没有可挂断的通话';
        else manualHangupStatus.textContent = '手机状态未连接或已过期';
      }
      function requestManualPhoneHangup(origin) {
        if (manualHangupPending) return manualHangupRequestPromise || Promise.resolve(true);
        const ph = PW.__ykPhRow || {};
        if (!manualPhoneCallIsActive()) {
          syncManualHangupControl();
          if (origin !== 'flow') toast('当前没有收到手机正在通话的有效状态，未发送挂断请求。', true);
          return Promise.resolve(phoneCallEndedFresh());
        }
        const now = Date.now();
        if (now - lastManualHangupCommandAt < 6000) {
          if (origin !== 'flow') toast('刚刚已发过挂断请求，请等手机状态更新后再试。', true);
          return Promise.resolve(true);
        }
        lastManualHangupCommandAt = now;
        manualHangupPending = true;
        syncManualHangupControl();
        const callSnapshot = {
          state: String(ph.state || '').toLowerCase(),
          stateAt: Number(ph.stateAt) || 0,
          number: String(ph.number || '').replace(/\D/g, ''),
        };
        const sameCallStillActive = () => {
          const current = PW.__ykPhRow || {};
          const currentNumber = String(current.number || '').replace(/\D/g, '');
          const sameNumber = callSnapshot.number && currentNumber && callSnapshot.number === currentNumber;
          const sameStateAt = callSnapshot.stateAt > 0 && Number(current.stateAt) === callSnapshot.stateAt;
          const sameCallIdentity = callSnapshot.stateAt > 0 ? sameStateAt : !!sameNumber;
          return manualPhoneCallIsActive() &&
            String(current.state || '').toLowerCase() === callSnapshot.state &&
            sameCallIdentity && (!callSnapshot.number || sameNumber);
        };
        const sendManualHangup = (attempt) => {
          const source = 'pc:manual_hangup|manual=1|ph=' + callSnapshot.state + '|attempt=' + attempt + '|at=' + Date.now();
          return relayFetch(RELAY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-wb-webapp-access-key': RELAY_KEY },
            body: JSON.stringify({ event_type: 'pc_hangup', source }),
          });
        };
        const request = sendManualHangup(1).then(async () => {
          // 手机在通话接通时会重启电脑挂断命令的轮询基线；如果首条指令刚好被基线略过，
          // 约 1 秒后仅对仍是同一通、状态未变化的电话补发一次，避免命令落到下一通。
          await sleep(900);
          if (sameCallStillActive() && !phoneCallEndedFresh()) {
            await sendManualHangup(2);
            if (origin !== 'flow') toast('手机尚未确认挂断；已对当前这通电话补发一次请求。', false, true);
          } else if (origin !== 'flow') {
            toast('挂断请求已交给中转；手机状态正在同步。', false, true);
          }
          setTimeout(() => {
            if (!manualHangupPending) return;
            manualHangupPending = false;
            syncManualHangupControl();
            if (sameCallStillActive()) toast('手机仍未确认这通电话已挂断；请检查 APK 联动或直接在手机挂断。', true, true);
          }, 5000);
          return true;
        }).catch(() => {
          manualHangupPending = false;
          syncManualHangupControl();
          toast('挂断请求没有送到手机中转服务；请检查本机中转服务后重试。', true, true);
          return false;
        });
        manualHangupRequestPromise = request;
        return request.finally(() => { if (manualHangupRequestPromise === request) manualHangupRequestPromise = null; });
      }
      PW.__YK_MANUAL_PHONE_ACTIVE__ = manualPhoneCallIsActive;
      PW.__YK_REQUEST_MANUAL_HANGUP__ = requestManualPhoneHangup;
      if (manualHangupButton) manualHangupButton.addEventListener('click', requestManualPhoneHangup);
      syncManualHangupControl();
      function phPoll() {
        if (phBusy) return;
        phBusy = 1;
        relayFetch(PHONE_STATUS_URL, { headers: { 'x-wb-webapp-access-key': RELAY_KEY } })
          .then((rows) => {
            phErrNotified = false;
            const row = Array.isArray(rows) && rows.length ? rows[0] : null;
            // [v1.18.5] 留一份手机状态快照：点页面「挂断」之前用它判活（见 phoneCallLive）
            if (row) {
              PW.__ykPhRow = {
                state: String(row.state || ''),
                alive: row.alive === true || row.alive === 'true',
                hbAt: Date.parse(row.hb_at) || 0,
                stateAt: Date.parse(row.state_at) || 0,
                number: String(row.number || ''),
                name: String(row.name || ''),
                reason: String(row.reason || ''),
              };
            }
            syncManualHangupControl();
            maybeFixNumber(row);
            phRender(row);
            if (row) {
              const callKey = String(row.state || '') + ':' + String(row.state_at || '');
              if (callKey !== phConnStateKey) { phConnStateKey = callKey; connTick(); }
            }
            refreshYkStatusIdentity(false);
          })
          .catch(() => {
            syncManualHangupControl();
            if (!phErrNotified) {
              phErrNotified = true;
              const el = document.getElementById('yk_call_dot');
              if (el && el.isConnected) { el.textContent = '⚪ 状态屏未连接'; el.style.color = '#dc2626'; }
              ykStatusUpdate({ event: '手机状态连接失败', progress: '无法读取手机通话状态', outcome: '请检查手机 App 与本机中转服务连接' });
            }
          })
          .finally(() => { phBusy = 0; });
      }
      workerEvery(200, phPoll); // 与联动轮询同节奏；只读 phone_status，不消费 call_events
      workerEvery(1000, connTick); // [v1.19.2] 接通提醒：1 秒一次，且不在通话中时完全不扫 DOM
      bindPublicPoolFilterCapture();
      workerEvery(1000, () => { if (phLastState === 'answered' && phAnsweredAt) phRender({ state: 'answered', state_at: new Date(phAnsweredAt).toISOString(), number: '' }); });
      // [v1.24.0] 本地持久队列：滞留/暂时失配的事件会自动重试，无法安全确认时保留在面板供核对
      function readPendingList() {
        try {
          const list = JSON.parse(localStorage.getItem('yk_pending_results') || '[]');
          return Array.isArray(list) ? list : [];
        } catch (e) { return []; }
      }
      function writePendingList(list) {
        try { localStorage.setItem('yk_pending_results', JSON.stringify(list.slice(0, 50))); } catch (e) {}
        updatePendingLine();
      }
      function callIdFromSource(source) {
        const parts = String(source || '').split(':');
        return parts.length > 3 ? parts.slice(3).join(':') : '';
      }
      function updatePendingEvent(id, patch) {
        if (id == null || id === '') return null;
        const list = readPendingList();
        const index = list.findIndex((x) => String(x.id) === String(id));
        if (index < 0) return null;
        list[index] = Object.assign({}, list[index], patch || {}, { id: String(id), updatedAt: Date.now() });
        writePendingList(list);
        return list[index];
      }
      PW.__YK_PENDING_UPDATE__ = updatePendingEvent;
      function addPendingList(rows, metadata) {
        try {
          const list = readPendingList();
          for (const r of rows) {
            if (!r || r.id == null) continue;
            const parts = (r.source || '').split(':');
            const id = String(r.id);
            const pending = {
              id,
              num: parts[1] || '',
              reason: parts[2] || '',
              callId: callIdFromSource(r.source),
              t: r.created_at || '',
              source: String(r.source || ''),
              state: 'queued',
              nextRetryAt: Date.now() + 1500,
              attempts: 0,
            };
            const existing = list.findIndex((x) => String(x.id) === id);
            if (existing >= 0) {
              list[existing] = Object.assign({}, pending, list[existing], metadata || {}, {
                id,
                source: pending.source || list[existing].source || '',
                t: pending.t || list[existing].t || '',
              });
            } else list.unshift(Object.assign({}, pending, metadata || {}));
          }
          localStorage.setItem('yk_pending_results', JSON.stringify(list.slice(0, 50)));
        } catch (e) {}
        updatePendingLine();
      }
      function removePendingEvent(id) {
        if (id == null || id === '') return;
        try {
          const list = JSON.parse(localStorage.getItem('yk_pending_results') || '[]');
          const completed = list.find((x) => String(x.id) === String(id));
          if (completed && completed.callId) {
            let seen = [];
            try { seen = JSON.parse(localStorage.getItem('yk_link_processed_calls_v1') || '[]'); } catch (e2) {}
            if (!Array.isArray(seen)) seen = [];
            seen = [String(completed.callId)].concat(seen.filter((x) => String(x) !== String(completed.callId))).slice(0, 200);
            localStorage.setItem('yk_link_processed_calls_v1', JSON.stringify(seen));
          }
          localStorage.setItem('yk_pending_results', JSON.stringify(list.filter((x) => String(x.id) !== String(id))));
        } catch (e) {}
        updatePendingLine();
      }
      PW.__YK_PENDING_REMOVE__ = removePendingEvent;
      function updatePendingLine() {
        const el = document.getElementById('yk_pending_line');
        if (!el) return;
        const list = readPendingList();
        el.textContent = list.length ? ('📋 待补录 ' + list.length + ' 条') : '';
      }
      const ykW = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
      ykW.__ykPendingClick = () => {
        let list = [];
        try { list = JSON.parse(localStorage.getItem('yk_pending_results') || '[]'); } catch (e) {}
        if (!list.length) return;
        const safeToRetry = list.filter((x) => x.state === 'needs-review');
        for (const x of safeToRetry) {
          updatePendingEvent(x.id, { state: 'queued', attempts: 0, matchFailures: 0, nextRetryAt: Date.now(), leaseUntil: 0, lastError: '已请求重新匹配并自动补录' });
        }
        if (safeToRetry.length) {
          toast('↻ 已重新尝试 ' + safeToRetry.length + ' 条待补录；系统会先核对唯一客户，再自动提交。', false, true);
          return;
        }
        const lines = list.slice(0, 8).map((x) => {
          const state = x.state === 'submit-uncertain' || x.state === 'submitting' ? '需核对是否已保存' : '自动补录中';
          return '· ' + (x.num || '号码未知') + (x.reason ? '（' + x.reason + '）' : '') + ' · ' + state + (x.lastError ? '：' + x.lastError : '');
        });
        toast('📋 挂断跟进 ' + list.length + ' 条（最新在前）：\n' + lines.join('\n') + (list.length > 8 ? '\n…' : '') + '\n—— 核对完后点这里清空', false, true);
      };
      ykW.__ykPendingClear = () => {
        try { localStorage.removeItem('yk_pending_results'); } catch (e) {}
        updatePendingLine();
      };

      // 挂断事件被保存在本地后，不能只展示“待补录”就停止。
      // 页面/客户页签暂时未就绪时按号码重新唯一定位；提交前失败最多自动重试 3 次。
      // 提交按钮一旦点过但 CRM 没有明确确认，转人工核对状态，绝不重复写同一条跟进。
      let pendingRetryBusy = false;
      function pendingReasonFlow(item, settings) {
        if (item.flowKey && FLOWS.some((f) => f.hotkey === item.flowKey)) return item.flowKey;
        const reason = String(item.reason || '');
        if (/空号/.test(reason)) return 'E';
        if (/停机/.test(reason)) return 'T';
        return settings.linkFlow || 'D';
      }
      function releaseLinkBusy(tabId) {
        if (!tabId) return;
        try {
          const lock = JSON.parse(localStorage.getItem('yk_link_busy') || 'null');
          if (lock && lock.tab === tabId) localStorage.removeItem('yk_link_busy');
        } catch (e) {}
      }
      function retryPendingHangup() {
        if (pendingRetryBusy || running || capturing) return;
        const list = readPendingList();
        const now = Date.now();
        for (const stale of list) {
          if (stale && stale.state === 'submitting' && Number(stale.leaseUntil || 0) <= now) {
            updatePendingEvent(stale.id, { state: 'submit-uncertain', leaseUntil: 0, lastError: '提交期间页面中断，需确认 CRM 是否已保存，系统不会重复提交' });
          }
        }
        const item = list.find((x) => {
          if (!x || !x.id) return false;
          if (x.state === 'submitting' || x.state === 'submit-uncertain' || x.state === 'needs-review') return false;
          if (x.state === 'running' && Number(x.leaseUntil || 0) > now) return false;
          if (x.state === 'queued' && Number(x.updatedAt || 0) && now - Number(x.updatedAt) < 4000) return false;
          if (Number(x.nextRetryAt || 0) > now) return false;
          return x.state === 'queued' || x.state === 'running';
        });
        if (!item) return;
        const eventAt = Date.parse(item.eventAt || item.t || '') || 0;
        if (!eventAt || now - eventAt > 15 * 60 * 1000) {
          updatePendingEvent(item.id, { state: 'needs-review', lastError: '挂断事件超过 15 分钟，需人工核对客户身份', leaseUntil: 0 });
          return;
        }
        const phone = String(item.crmNum || item.num || '').replace(/\D/g, '');
        if (phone.length < 7) {
          updatePendingEvent(item.id, { state: 'needs-review', lastError: '事件没有可核对的客户号码', leaseUntil: 0 });
          return;
        }
        const busy = (() => { try { return JSON.parse(localStorage.getItem('yk_link_busy') || 'null'); } catch (e) { return null; } })();
        if (busy && busy.tab !== LINK_TAB_ID && Date.now() < Number(busy.until || 0)) return;
        const runTabId = LINK_TAB_ID + ':retry:' + item.id + ':' + Math.random().toString(36).slice(2, 7);
        const nextAttempt = Number(item.attempts || 0) + 1;
        updatePendingEvent(item.id, { state: 'running', attempts: nextAttempt, leaseUntil: now + 60000, workerTab: runTabId });
        try { localStorage.setItem('yk_link_busy', JSON.stringify({ tab: runTabId, until: now + 60000 })); } catch (e) {}
        const claimed = (() => { try { return JSON.parse(localStorage.getItem('yk_link_busy') || 'null'); } catch (e) { return null; } })();
        if (!claimed || claimed.tab !== runTabId) {
          updatePendingEvent(item.id, { state: 'queued', nextRetryAt: now + 2000, leaseUntil: 0, workerTab: '' });
          return;
        }
        pendingRetryBusy = true;
        return (async () => {
          try {
            const settings = loadAuto();
            const flowKey = pendingReasonFlow(item, settings);
            const flow = FLOWS.find((f) => f.hotkey === flowKey);
            if (!flow) {
              updatePendingEvent(item.id, { state: 'needs-review', lastError: '没有可用的自动跟进流程', leaseUntil: 0 });
              return;
            }
            const customerName = String(item.crmName || '');
            const aligned = await switchToCallTab(customerName, phone);
            if (!aligned) {
              const failures = Number(item.matchFailures || 0) + 1;
              updatePendingEvent(item.id, {
                state: failures >= 50 ? 'needs-review' : 'queued',
                matchFailures: failures,
                nextRetryAt: now + Math.min(15000, 2000 + failures * 500),
                leaseUntil: 0,
                workerTab: '',
                lastError: '暂未找到唯一对应的 CRM 客户页签',
              });
              return;
            }
            const detailMatched = currentCustomerDetailMatches(customerName, phone);
            const callTrace = hasVisibleText('通话结束') || hasVisibleText('已挂断') || hasVisibleText('已结束') ||
              hasVisibleText('呼叫结束') || hasVisibleText('通话中') ||
              findClickablesByText(...HANGUP_TEXTS).some((el) => !/请挂断|请先/.test(normalizeText(el.innerText || el.textContent)));
            if (!detailMatched && !callTrace) {
              const failures = Number(item.matchFailures || 0) + 1;
              updatePendingEvent(item.id, {
                state: failures >= 50 ? 'needs-review' : 'queued',
                matchFailures: failures,
                nextRetryAt: now + Math.min(15000, 2000 + failures * 500),
                leaseUntil: 0,
                workerTab: '',
                lastError: '客户页身份或通话状态尚未确认',
              });
              return;
            }
            updatePendingEvent(item.id, {
              state: 'running', flowKey, crmName: customerName,
              crmNum: phone, eventAt, leaseUntil: Date.now() + 30000,
              lastError: '',
            });
            const reason = String(item.reason || '');
            const noAnswer = /short|无人接听|未接|拒接|noans|no_answer|关机|空号|停机|呼转/i.test(reason);
            await runFlow(flow, {
              trigger: '挂断事件自动补偿',
              gentleHangup: true,
              pageSelfEnded: true, // 手机已挂断；补录时绝不点 CRM 挂断，防误伤下一通
              eventAge: Date.now() - eventAt,
              matchPhone: phone,
              noAnswer,
              evAt: eventAt,
              pendingEventId: String(item.id),
              linkBusyTab: runTabId,
              retryAttempt: nextAttempt,
            });
          } catch (err) {
            const failures = Number(item.matchFailures || 0) + 1;
            updatePendingEvent(item.id, {
              state: failures >= 50 ? 'needs-review' : 'queued',
              matchFailures: failures,
              nextRetryAt: Date.now() + Math.min(15000, 2000 + failures * 500),
              leaseUntil: 0,
              workerTab: '',
              lastError: String(err && err.message || err || '自动补偿暂时失败'),
            });
          } finally {
            releaseLinkBusy(runTabId);
            pendingRetryBusy = false;
          }
        })();
      }
      workerEvery(2000, () => withEventLock(retryPendingHangup));
      // [v1.11.0] ===== 效率套件：智能重拨 / 预约回拨 / 今日效率 =====
      function statsKey() {
        const d = new Date();
        return 'yk_stats_' + d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2);
      }
      function bumpStat(kind, reason) {
        try {
          const k = statsKey();
          const st = JSON.parse(localStorage.getItem(k) || '{}');
          if (kind === 'auto') {
            const r = reason || '';
            const bucket = /空号/.test(r) ? '空号' : (/停机/.test(r) ? '停机' : (/占线/.test(r) ? '占线' : (/rejected/.test(r) ? '拒接' : (/timeout/.test(r) ? '无人接' : (r ? '其它' : '未标注')))));
            st.auto = st.auto || {};
            st.auto[bucket] = (st.auto[bucket] || 0) + 1;
          } else {
            st.manual = (st.manual || 0) + 1;
          }
          // [v1.14.0] 小时分布（合规提醒用）
          st.hourly = st.hourly || {};
          const hh = new Date().getHours();
          st.hourly[hh] = (st.hourly[hh] || 0) + 1;
          localStorage.setItem(k, JSON.stringify(st));
        } catch (e) {}
      }
      function todayAt(h, m, tomorrow) {
        const d = new Date();
        if (tomorrow) d.setDate(d.getDate() + 1);
        d.setHours(h, m, 0, 0);
        return d.getTime();
      }
      // [v1.11.0] 智能重拨规则：占线45分钟 / 关机次日 / 无人接听时段轮换(最多3次,超了降为一周)
      function scheduleRedial(num, reason) {
        if (!num) return;
        if (reason && /空号|停机/.test(reason)) return; // 无效号已归档，不再重拨
        try {
          const list = JSON.parse(localStorage.getItem('yk_redial_plan') || '[]');
          const now = Date.now();
          const entry = list.find((x) => x.num === num);
          const count = entry ? (entry.count || 1) + 1 : 1;
          let nextTs, note, dnd = false;
          if (reason && /占线/.test(reason)) { nextTs = now + 45 * 60 * 1000; note = '占线'; }
          else if (reason && /关机|无法接通/.test(reason)) { nextTs = todayAt(10, 0, 1); note = reason; }
          else if (reason && /rejected/.test(reason) && count >= 3) { nextTs = now + 7 * 86400000; note = '连续' + count + '次拒接，已标记勿扰'; dnd = true; }
          else if (count >= 3) { nextTs = now + 7 * 86400000; note = '连续' + count + '次未接，降级一周后再试'; }
          else {
            const h = new Date().getHours();
            if (h < 12) { nextTs = todayAt(14, 0); note = '无人接第' + count + '次→下午'; }
            else if (h < 18) { nextTs = todayAt(19, 0); note = '无人接第' + count + '次→傍晚'; }
            else { nextTs = todayAt(10, 0, 1); note = '无人接第' + count + '次→明早'; }
          }
          const e2 = { num, reason: note, nextTs, count, t: now, dnd: dnd };
          const idx = list.findIndex((x) => x.num === num);
          if (idx >= 0) list[idx] = e2; else list.unshift(e2);
          localStorage.setItem('yk_redial_plan', JSON.stringify(list.slice(0, 100)));
        } catch (e) {}
      }
      let lastDueNotify = { count: 0, t: 0 };
      function checkDueReminders() {
        let plan = [];
        try { plan = JSON.parse(localStorage.getItem('yk_redial_plan') || '[]'); } catch (e) {}
        const now = Date.now();
        const due = plan.filter((x) => x.nextTs && x.nextTs <= now && !x.dnd);
        if (due.length && (due.length !== lastDueNotify.count || now - lastDueNotify.t > 30 * 60 * 1000)) {
          lastDueNotify = { count: due.length, t: now };
          toast('⏰ 有 ' + due.length + ' 个号码到重拨时间：\n' + due.slice(0, 6).map((x) => '· ' + x.num + (x.reason ? '（' + x.reason + '）' : '')).join('\n') + '\n—— 在 CRM 里找到客户拨打即可', false, true);
          beepAlarm();
        }
        let rems = [];
        try { rems = JSON.parse(localStorage.getItem('yk_reminders') || '[]'); } catch (e) {}
        const dueRem = rems.filter((x) => x.ts && x.ts <= now);
        if (dueRem.length) {
          try { localStorage.setItem('yk_reminders', JSON.stringify(rems.filter((x) => x.ts > now))); } catch (e) {}
          toast('⏰ 预约回拨时间到！' + (dueRem[0].num ? '客户 ' + dueRem[0].num : '联系刚才那位客户') + (dueRem.length > 1 ? '（另有 ' + (dueRem.length - 1) + ' 条同时到期）' : ''), false, true);
          beepAlarm();
        }
      }
      function updateEffLine() {
        const el = document.getElementById('yk_eff_line');
        if (!el) return;
        let st = {};
        try { st = JSON.parse(localStorage.getItem(statsKey()) || '{}'); } catch (e) {}
        let plan = [];
        try { plan = JSON.parse(localStorage.getItem('yk_redial_plan') || '[]'); } catch (e) {}
        let rems = [];
        try { rems = JSON.parse(localStorage.getItem('yk_reminders') || '[]'); } catch (e) {}
        const now = Date.now();
        const due = plan.filter((x) => x.nextTs && x.nextTs <= now && !x.dnd);
        const auto = st.auto || {};
        const parts = [];
        let autoSum = 0;
        for (const k2 of Object.keys(auto)) { parts.push(k2 + auto[k2]); autoSum += auto[k2]; }
        parts.unshift('自动 ' + autoSum);
        parts.push('手动 ' + (st.manual || 0));
        if (st.delay && st.delay.n) {
          const avg = (st.delay.sum / st.delay.n / 1000).toFixed(1);
          const mn = st.delay.min != null ? (st.delay.min / 1000).toFixed(1) : '?';
          const mx = ((st.delay.max || 0) / 1000).toFixed(1);
          parts.push('延迟均 ' + avg + 's（最快' + mn + '/最慢' + mx + '）');
        }
        if (due.length) parts.push('🔄 到时重拨 ' + due.length);
        if (rems.length) parts.push('⏰ 预约 ' + rems.length);
        el.textContent = '今日 ' + parts.join(' · ');
      }
      window.__ykEffClick = () => {
        let plan = [];
        try { plan = JSON.parse(localStorage.getItem('yk_redial_plan') || '[]'); } catch (e) {}
        const now = Date.now();
        const due = plan.filter((x) => x.nextTs && x.nextTs <= now);
        if (!due.length) return;
        try { localStorage.setItem('yk_redial_plan', JSON.stringify(plan.filter((x) => x.nextTs > now))); } catch (e) {}
        toast('🧹 已清除 ' + due.length + ' 条到时提醒（已拨的无需再记）');
        updateEffLine();
      };
      // [v1.11.0] H 一键预约回拨：再按 H 或点取消关闭；到点弹窗+提示音
      function showCallbackPicker() {
        const old = document.getElementById('yk_cb_overlay');
        if (old) { old.remove(); return; }
        let num = '';
        try { const m = document.body.innerText.match(/1[3-9]\d{9}/); if (m) num = m[0]; } catch (e) {}
        const ov = document.createElement('div');
        ov.id = 'yk_cb_overlay';
        ov.style.cssText = 'position:fixed;inset:0;z-index:2147483646;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;';
        const mk = (label, ts) => '<button data-ts="' + ts + '" style="margin:4px;padding:10px 14px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;cursor:pointer;font-size:13px;">' + label + '</button>';
        ov.innerHTML = '<div style="background:#fff;border-radius:12px;padding:16px 18px;box-shadow:0 10px 40px rgba(0,0,0,.25);font-family:sans-serif;">' +
          '<div style="font-size:14px;font-weight:600;margin-bottom:4px;">⏰ 预约回拨</div>' +
          '<div style="font-size:12px;color:#64748b;margin-bottom:10px;">' + (num ? '客户 ' + num : '⚠ 页面上没识别到号码，到点仅提醒') + '</div>' +
          '<div>' + mk('30 分钟后', Date.now() + 30 * 60 * 1000) + mk('1 小时后', Date.now() + 3600 * 1000) +
          mk('今天傍晚', todayAt(19, 0)) + mk('明天上午', todayAt(10, 0, 1)) + mk('明天下午', todayAt(15, 0, 1)) + '</div>' +
          '<div style="text-align:right;margin-top:8px;"><button id="yk_cb_cancel" style="border:none;background:none;color:#94a3b8;cursor:pointer;font-size:12px;">取消</button></div>' +
          '</div>';
        document.documentElement.appendChild(ov);
        ov.addEventListener('click', (e2) => {
          const t = e2.target;
          if (t === ov || t.id === 'yk_cb_cancel') { ov.remove(); return; }
          if (t.dataset && t.dataset.ts) {
            const ts = parseInt(t.dataset.ts, 10);
            let rems = [];
            try { rems = JSON.parse(localStorage.getItem('yk_reminders') || '[]'); } catch (e3) {}
            rems.push({ ts, num });
            try { localStorage.setItem('yk_reminders', JSON.stringify(rems)); } catch (e3) {}
            ov.remove();
            toast('✓ 已预约 ' + new Date(ts).toLocaleString('zh-CN') + ' 回拨' + (num ? '（' + num + '）' : '') + '，到点弹窗提醒');
            updateEffLine();
          }
        });
      }
      // [v1.14.0] ===== 拨打合规：小时上限提醒 =====
      let hourlyWarned = '';
      function checkHourlyLimit() {
        const st = (() => { try { return JSON.parse(localStorage.getItem(statsKey()) || '{}'); } catch (e) { return {}; } })();
        const h = new Date().getHours();
        const n = (st.hourly && st.hourly[h]) || 0;
        const key = statsKey() + '-' + h;
        if (n >= 40 && hourlyWarned !== key) {
          hourlyWarned = key;
          toast('⚠ 本小时已拨打 ' + n + ' 通，接近运营商风控阈值（建议每小时 ≤40 通）。\n建议：放慢节奏、两通之间多歇几十秒，连续被秒断就休息几分钟。', true);
          beepAlarm();
        }
      }

      // [v1.13.0] 假接通/秒挂快捷选择条：不自动提交，人工点选结果
      function showShortPicker(num) {
        const old = document.getElementById('yk_short_pick');
        if (old) old.remove();
        const ov = document.createElement('div');
        ov.id = 'yk_short_pick';
        ov.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483646;width:300px;background:#fff;border:1px solid #f59e0b;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,.2);padding:14px;font-family:sans-serif;font-size:13px;';
        const btnCss = 'padding:6px 10px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;cursor:pointer;font-size:12px;margin-right:6px;';
        ov.innerHTML = '<div style="font-weight:600;margin-bottom:6px;">⚠ 疑似假接通/秒挂' + (num ? ' · ' + num : '') + '</div>' +
          '<div style="color:#64748b;margin-bottom:10px;">通话不到 10 秒就结束，请按实际情况选择结果：</div>' +
          '<div><button data-hk="F" style="' + btnCss + '">未接通</button><button data-hk="R" style="' + btnCss + '">二次呼叫</button><button data-hk="D" style="' + btnCss + '">无意向</button></div>' +
          '<div style="margin-top:8px;text-align:right;"><button id="yk_sp_close" style="border:none;background:none;color:#94a3b8;cursor:pointer;font-size:12px;">忽略</button></div>';
        document.documentElement.appendChild(ov);
        // [v1.16.0] 查微信结果随选择条展示（有微信 → 提示可加好友）
        const wxLine = document.createElement('div');
        wxLine.style.cssText = 'display:none;margin-top:8px;padding:6px 8px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;color:#166534;font-weight:600;font-size:12px;';
        ov.insertBefore(wxLine, ov.querySelector('#yk_sp_close').parentNode);
        if (num && wxchkReady()) {
          wxLine.style.display = 'block';
          wxLine.textContent = '💬 微信查询中…';
          wxchkCheck(num).then((w) => {
            if (!document.body.contains(wxLine)) return;
            if (w.has) wxLine.textContent = '💬 ' + num + ' 有微信' + (w.nick ? '（' + w.nick + '）' : '') + ' → 可加好友';
            else {
              wxLine.textContent = '💬 ' + num + ' 查不到微信（未注册或关了手机号搜索）';
              wxLine.style.background = '#f8fafc'; wxLine.style.borderColor = '#e2e8f0'; wxLine.style.color = '#64748b';
            }
          }).catch(() => {
            if (!document.body.contains(wxLine)) return;
            wxLine.textContent = '💬 微信查询失败（接口没配或没配对）';
            wxLine.style.background = '#fef2f2'; wxLine.style.borderColor = '#fecaca'; wxLine.style.color = '#b91c1c';
          });
        }
        ov.querySelectorAll('button[data-hk]').forEach((b) => {
          b.addEventListener('click', () => {
            if (num) {
              const tail = num.slice(-4);
              const pageTxt = document.body.innerText.replace(/[\s-]/g, '');
              if (tail && pageTxt.indexOf(tail) === -1) {
                toast('⚠ 号码 ' + num + ' 与当前页面客户不一致，已阻止提交', true);
                return;
              }
            }
            const flow = FLOWS.find((f) => f.hotkey === b.dataset.hk);
            if (flow) { bumpStat('auto', 'short'); runFlow(flow, { pageSelfEnded: true, trigger: '无人接听跳过' }); }
            ov.remove();
          });
        });
        ov.querySelector('#yk_sp_close').addEventListener('click', () => ov.remove());
        beepAlarm();
      }
      workerEvery(2000, () => {
        checkDueReminders();
        updateEffLine();
        checkHourlyLimit();
        // [v1.15.0] 拨前号码检测：回填 key + 手动检测按钮
        const nkEl = document.getElementById('yk_numchk_key');
        if (nkEl && nkEl.dataset.init !== '1') {
          nkEl.dataset.init = '1';
          nkEl.value = localStorage.getItem('yk_numchk_key') || '';
          const nowBtn = document.getElementById('yk_numchk_now');
          if (nowBtn) nowBtn.onclick = () => {
            const cands = numchkFindContextNumbers();
            if (!cands.size) { toast('本页没找到完整手机号（打码号码无法检测）', true); return; }
            numchkTick(true, 3); // 手动一次最多查 3 个，防烧钱
          };
        }
        // [v1.16.0] 查微信：回填接口地址 + 配置/手动按钮
        const wxUrlEl = document.getElementById('yk_wxchk_url');
        if (wxUrlEl && wxUrlEl.dataset.init !== '1') {
          wxUrlEl.dataset.init = '1';
          wxUrlEl.value = localStorage.getItem('yk_wxchk_url') || '';
          const cfgBtn = document.getElementById('yk_wxchk_cfg');
          if (cfgBtn) cfgBtn.onclick = openWxchkCfg;
          const wxNow = document.getElementById('yk_wxchk_now');
          if (wxNow) wxNow.onclick = () => {
            if (!wxchkReady()) { toast('⚠ 先点 ⚙ 配置查微信接口（地址 + 判定字段）', true); return; }
            const cands = numchkFindContextNumbers();
            if (!cands.size) { toast('本页没找到完整手机号（打码号码无法检测）', true); return; }
            wxchkTick(true, 3); // 手动一次最多查 3 个，防烧钱
          };
        }
      });
      console.log('[云客助手] 手机挂断联动轮询已启动' + (loadAuto().linkFlow ? '' : '（注意：联动流程尚未设置）'));
      // [v1.14.9] 轮询降频：60ms/双并发 → 500ms/单并发。
      // CloudBase 按 API 调用计资源点（100 点/万次），原频率约 8 请求/秒 ≈ 2,300 点/天，
      // 体验版 5,000 点约两天就烧穿 → 云服务暂停 → DATABASE_RESOURCE_ISOLATED（402）。
      // 500ms 单并发约 2 请求/秒，消耗降到原来的 1/4 左右，检测延迟约 0.7-0.9s。
      let ykPollBusy = 0;
      let ykLastEventAt = Date.now();
      let ykRelaySuspendedUntil = 0; // [v1.14.9] 402 熔断：云端被隔离时停止轮询，避免空烧资源点
      let ykRelaySuspendedNotified = false;
      workerEvery(200, () => {
        let st = loadAuto();
        // [v1.24.0] 空联动配置不再让挂断事件一直留在服务器却不处理；使用用户一直采用的无意向默认流程。
        if (!st.linkFlow) {
          st.linkFlow = 'D';
          saveAuto(st);
          ykStatusUpdate({ progress: '联动流程已自动恢复', outcome: '使用默认「无意向·拒绝」' });
        }
        if (Date.now() < ykRelaySuspendedUntil) return;
        if (ykPollBusy >= 1) return; // 单请求在途，防堆积
        // 连续 10 分钟没有新事件自动降频（下班挂机不空转），一来事件立即恢复极速
        if (ykPollBusy > 0 && Date.now() - ykLastEventAt > 600000) return;
        ykPollBusy++;
        relayFetch(RELAY_URL + '?select=id,event_type,source,created_at&order=id.desc&limit=50', {
          headers: { 'x-wb-webapp-access-key': RELAY_KEY },
        }).then((rows) => withEventLock(async () => {
          ykRelaySuspendedNotified = false;
          if (!Array.isArray(rows) || !rows.length) return;
          const latest = rows[0].id;
          if (latest > linkLastSeenId) ykLastEventAt = Date.now(); // 有新流量=手机活跃，保持极速轮询
          if (!linkBaselined) {
            linkBaselined = true;
            // [v1.22.8] 有共享游标时从它继续，不能把扩展重载期间刚到的挂断事件跳过。
            // 首次安装没有游标时，仅回收两分钟内的挂断；更早的事件作为历史基线跳过。
            let shared = 0;
            try { shared = parseInt(localStorage.getItem('yk_link_last_id_v2') || '0', 10) || 0; } catch (e) {}
            if (shared > 0) {
              linkLastSeenId = shared;
            } else {
              const recent = rows.filter((r) => r.event_type === 'hangup' &&
                (Date.now() - (Date.parse(r.created_at) || 0)) <= 120000)
                .sort((a, b) => Number(a.id) - Number(b.id));
              linkLastSeenId = recent.length ? Number(recent[0].id) - 1 : Number(latest);
            }
            if (linkLastSeenId >= Number(latest)) {
              try { localStorage.setItem('yk_link_last_id_v2', String(linkLastSeenId)); } catch (e) {}
              return;
            }
          }
          if (latest <= linkLastSeenId) return;
          // [v1.9.2] 共享游标每次消费前都同步：另一个标签页可能已处理到更新的位置
          let sharedId = 0;
          try { sharedId = parseInt(localStorage.getItem('yk_link_last_id_v2') || '0', 10) || 0; } catch (e) {}
          const linkFloor = Math.max(linkLastSeenId, sharedId);
          if (latest <= linkFloor) { linkLastSeenId = linkFloor; return; }
          let freshRows = rows.filter((r) => r.id > linkFloor && r.event_type === 'hangup')
            .sort((a, b) => Number(a.id) - Number(b.id));
          // 手机端对挂断事件重试投递时 callId 不变；同一通已入队/已保存则吞掉重复投递。
          if (freshRows.length) {
            let processedCalls = [];
            try { processedCalls = JSON.parse(localStorage.getItem('yk_link_processed_calls_v1') || '[]'); } catch (e) {}
            if (!Array.isArray(processedCalls)) processedCalls = [];
            const pendingCalls = new Set(readPendingList().map((x) => String(x.callId || '')).filter(Boolean));
            freshRows = freshRows.filter((r) => {
              const callId = callIdFromSource(r.source);
              return !callId || (!processedCalls.includes(callId) && !pendingCalls.has(callId));
            });
          }
          // [v1.10.0] 心跳行处理：更新手机在线状态（不触发流程）
          for (const r of rows) {
            if (r.event_type === 'heartbeat' && /:hb:/.test(r.source || '')) {
              linkHb = { t: Date.parse(r.created_at) || Date.now(), alive: /:hb:1$/.test(r.source) };
            }
          }
          updateHbStatus();
          // [v1.13.0] 来电识别：客户回拨 → 提示"回电客户"（重拨名单里的额外标记意向高）
          for (const r of rows) {
            if (r.event_type === 'incoming') {
              const inum = (String(r.source || '').split(':')[1] || '').replace(/\D/g, '');
              if (inum && Date.now() - (lastIncomingNotify.t || 0) > 15000 && lastIncomingNotify.num !== inum) {
                lastIncomingNotify = { t: Date.now(), num: inum };
                let plan = [];
                try { plan = JSON.parse(localStorage.getItem('yk_redial_plan') || '[]'); } catch (e) {}
                const hit = plan.find((x) => x.num === inum);
                if (hit && hit.dnd) { toast('📞 来电 ' + inum + '（⚠ 此号码已标记勿扰，谨慎接听）'); return; }
                toast('📞 来电 ' + inum + (hit ? ' —— ⭐ 回电客户！之前未接通，意向通常更高，优先接' : ''), false, true);
                if (hit) beepAlarm();
              }
            }
          }
          // 流程执行中/正在捕获按键：不消费事件，留在云端等下一轮
          if (running || capturing) return;
          // 每轮只消费最早的一条挂断事件；其余事件留在中转表，等本条跟进完成后继续处理。
          // 避免连续拨打时多个事件被合并成一条、只给最后一个客户写记录。
          if (freshRows.length > 1) freshRows = [freshRows[0]];
          // [v1.24.0] 先检查跨页签锁，再把事件移出中转。
          // 旧顺序是先删服务端事件、后发现另一个页签占锁，事件只进“待补录”展示队列，永远不会自动执行。
          if (freshRows.length) {
            let lockObj = null;
            try { lockObj = JSON.parse(localStorage.getItem('yk_link_busy') || 'null'); } catch (e) {}
            if (lockObj && lockObj.tab !== LINK_TAB_ID && Date.now() < (lockObj.until || 0)) {
              console.log('[云客助手] 其他标签页正在执行联动；本条事件保留在中转，稍后自动接着处理');
              return;
            }
          }
          const consumeThrough = freshRows.length ? Number(freshRows[0].id) : Number(latest);
          // 先落入浏览器本地持久队列，再推进共享游标/删中转行；页面短暂失配或切后台也不会丢事件。
          if (freshRows.length) addPendingList([freshRows[0]]);
          linkLastSeenId = consumeThrough;
          try { localStorage.setItem('yk_link_last_id_v2', String(consumeThrough)); } catch (e) {}
          // 只清理到本轮消费位置，后续挂断事件留待下一轮。
          relayFetch(RELAY_URL + '?id=lte.' + consumeThrough, { method: 'DELETE', headers: { 'x-wb-webapp-access-key': RELAY_KEY } }).catch(() => {});
          if (!freshRows.length) return;
          // 手动选结果时，runFlow 已请求 APK 挂断；手机随后补报的 hangup
          // 属于同一通，消费掉这一条，防止它在当前流程结束后再次自动提交。
          let manualFlowMarker = PW.__YK_MANUAL_FLOW_HANGUP__ || null;
          if (!manualFlowMarker) {
            try { manualFlowMarker = JSON.parse(localStorage.getItem('yk_manual_flow_hangup_v1') || 'null'); } catch (e) {}
          }
          if (manualFlowMarker && Number(manualFlowMarker.at) > 0) {
            const markerAge = Date.now() - Number(manualFlowMarker.at);
            if (markerAge > 45000 || markerAge < -5000) {
              if (PW.__YK_MANUAL_FLOW_HANGUP__ === manualFlowMarker) PW.__YK_MANUAL_FLOW_HANGUP__ = null;
              try { localStorage.removeItem('yk_manual_flow_hangup_v1'); } catch (e) {}
            } else {
              const markerDigits = String(manualFlowMarker.number || '').replace(/\D/g, '');
              const sameManualCall = (r) => {
                const eventAt = Date.parse(r.created_at) || 0;
                if (!eventAt || eventAt < Number(manualFlowMarker.at) - 5000 || eventAt > Number(manualFlowMarker.at) + 35000) return false;
                const source = String(r.source || '');
                if (!source.startsWith('apk:')) return false;
                const eventDigits = (source.split(':')[1] || '').replace(/\D/g, '');
                if (!markerDigits || !eventDigits) return true;
                if (markerDigits === eventDigits) return true;
                const tailLength = Math.min(7, markerDigits.length, eventDigits.length);
                return tailLength >= 4 && markerDigits.slice(-tailLength) === eventDigits.slice(-tailLength);
              };
              const duplicateRows = freshRows.filter(sameManualCall);
              if (duplicateRows.length) {
                freshRows = freshRows.filter((r) => !duplicateRows.includes(r));
                for (const r of duplicateRows) removePendingEvent(r.id);
                if (PW.__YK_MANUAL_FLOW_HANGUP__ === manualFlowMarker) PW.__YK_MANUAL_FLOW_HANGUP__ = null;
                try { localStorage.removeItem('yk_manual_flow_hangup_v1'); } catch (e) {}
                ykStatusUpdate({ progress: '手机挂断已由当前手动流程处理', outcome: '已跳过重复自动联动' });
                toast('📱 手机挂断已由当前手动流程处理，已跳过重复提交。', false, true);
              }
            }
          }
          if (!freshRows.length) return;
          // [v1.9.1] 滞留事件一律丢弃，绝不补执行！
          // 手机上报是"决定挂断"瞬间发出的（<1 秒新鲜）。流程执行期间积压的第二条上报、
          // 或另一个标签页已消费的事件，拖到现在必然超过 8 秒——此时新电话可能已在拨，
          // 补执行会直接点掉在拨的电话 → 电话结束又上报 → 无限循环（"疯狂挂断"的根源）
          let newestAge = Infinity;
          for (const r of freshRows) {
            const t = Date.parse(r.created_at);
            if (!isNaN(t)) { const age = Date.now() - t; if (age < newestAge) newestAge = age; }
          }
          if (!(newestAge < 120000)) {
            // 长时间排队的事件仍转本地持久队列，由后台重试器唯一匹配客户后补录。
            console.log('[云客助手] 挂断事件超过 2 分钟，转入待补录');
            toast('📱 手机挂断事件等待 ' + Math.round(newestAge / 1000) + ' 秒，已保存并会自动尝试匹配客户。', true, true);
            addPendingList(freshRows);
            return;
          }
          // [v1.9.7→v1.10.0] 一对一核对：解析事件号码与挂断原因（source 形如 "apk:号码:原因"）
          let evPhone = null, evReason = null;
          for (const r of freshRows) {
            if (typeof r.source === 'string' && r.source.startsWith('apk:')) {
              const parts = r.source.split(':');
              let p = (parts[1] || '').replace(/[\s-]/g, '');
              if (!/^\+?\d{7,15}$/.test(p)) { p = ''; }
              if (p) evPhone = p;
              if (evReason === null && parts[2]) evReason = parts[2];
              else if (evReason === null && p === '' && parts[1] && !/^\+?\d/.test(parts[1])) evReason = parts[1];
            }
          }
          // [v1.16.4] short（回拨线路下 APK 无人接听自动挂断的标记）不再弹窗拦截：
          // 按用户默认直接走联动流程自动提交（v1.17.5 起默认=「无意向·拒绝」）。旧版行为见 v1.13.0。
          // 疑似假接通/秒挂（接通后 10 秒内结束）也曾在这里弹快捷选择条让人定。
          // [v1.10.0] 原因路由：空号→E 流程（空号标注）、停机→T 流程，其余走默认联动流程
          let routeHotkey = st.linkFlow;
          if (evReason) {
            if (/空号/.test(evReason)) routeHotkey = 'E';
            else if (/停机/.test(evReason)) routeHotkey = 'T';
          }
          const flow = FLOWS.find((f) => f.hotkey === routeHotkey) || FLOWS.find((f) => f.hotkey === st.linkFlow);
          if (!flow) return;
          // [v1.16.4] 回拨线路：事件里的号码是平台中间号 → 用号码映射换算成客户真实号，
          // 一对一核对/查微信/预约回拨全部用真实号（ykNumMap 由 maybeFixNumber 拨号时回填）
          const matchNum = (ykNumMap && ykNumMap[evPhone]) || evPhone;
          let evAt = 0;
          for (const r of freshRows) {
            const t = Date.parse(r.created_at);
            if (!isNaN(t) && t > evAt) evAt = t;
          }
          // [v1.18.2] 先对齐客户：手机这通到底是谁？把它的页签切到前台，再判断页面上下文、再跑流程。
          // v1.20.0：找不到唯一页签、或客户快照是在挂断事件之后才采到，停止自动处理并转待补录。
          const ctxRow = (evPhone && ykCallCtx[String(evPhone)]) || (matchNum && ykCallCtx[String(matchNum)]) || null;
          const ctxName = (ctxRow && ctxRow.name) || '';
          const ctxNum = (ctxRow && ctxRow.num) || matchNum || evPhone || '';
          const ctxArrivedAfterCall = !!(ctxRow && evAt && ctxRow.at && ctxRow.at > evAt + 1500);
          updatePendingEvent(freshRows[0].id, {
            state: 'queued',
            // 下一通的页面快照不能冒充本通客户；晚到快照只保留挂断事件原号码，等待唯一匹配。
            crmName: ctxArrivedAfterCall ? '' : ctxName,
            crmNum: ctxArrivedAfterCall ? (matchNum || evPhone || '') : ctxNum,
            flowKey: flow.hotkey,
            eventAt: evAt,
            reason: evReason || '',
            nextRetryAt: Date.now() + 1000,
          });
          const eventCallKey = [evPhone || '', String((ctxRow && ctxRow.at) || Math.floor(evAt / 1000))].join('|');
          if (Date.now() - linkLastExecAt < 1000 && linkLastExecKey === eventCallKey) {
            console.log('[云客助手] 忽略同一通电话的重复挂断事件');
            removePendingEvent(freshRows[0].id);
            return;
          }
          if (ctxArrivedAfterCall) {
            console.warn('[云客助手][联动对齐] 客户快照晚于挂断事件，可能已属于下一通，停止自动处理', ctxName || ctxNum);
            ykStatusUpdate({
              phoneCustomer: [ctxName, ctxNum].filter(Boolean).join(' '),
              event: '手机挂断' + (evReason ? ' · ' + evReason : ''), eventAt: evAt || Date.now(),
              progress: '客户身份快照时间晚于挂断事件', outcome: '为避免写错客户，已暂停并放入待补录',
            });
            toast('🛑 手机已进入下一通，客户身份快照晚于挂断事件；为防标错人，本次已停止并放入待补录。', true, true);
            addPendingList(freshRows);
            return;
          }
          let alignedTab = null;
          try { alignedTab = await switchToCallTab(ctxName, ctxNum); } catch (e) { alignedTab = null; }
          if (alignedTab) {
            console.log('[云客助手][联动对齐] 已切到手机那通的页签：' + alignedTab + '（' + (ctxName || ctxNum) + '）');
            toast('🎯 已对齐手机客户「' + (ctxName || alignedTab) + '」', false, true);
          } else {
            console.warn('[云客助手][联动对齐] 无法唯一匹配手机客户页签/详情，停止 CRM 同步/提交', ctxName || ctxNum || evPhone || '无号码');
            ykStatusUpdate({
              phoneCustomer: [ctxName, ctxNum || evPhone].filter(Boolean).join(' '),
              event: '手机挂断' + (evReason ? ' · ' + evReason : ''), eventAt: evAt || Date.now(),
              progress: '手机 APK 已挂断；CRM 客户页未匹配', outcome: '为防误操作，未点 CRM 挂断或提交；事件已保留待补录',
            });
            toast('📱 手机 APK 已挂断；CRM 未能唯一匹配「' + (ctxName || ctxNum || evPhone || '未知') + '」，电脑暂不点客户页的挂断/提交，事件已保留待补录。', true, true);
            addPendingList(freshRows);
            return;
          }
          // [v1.14.8] 页面上下文闸门：当前页面必须有通话痕迹（通话中/挂断按钮/结束文案）才执行联动。
          // 之前没有这道闸：人停在公海/客户列表页时来了一条联动信号（误报、残留或别的来源），
          // 流程会在当前页面瞎找"挂断/未接通"去点 → 把公海筛选页点乱、翻页（用户实测被弄到第6页）
          const hangBtnsCtx = findClickablesByText(...HANGUP_TEXTS).filter((el) => !/请挂断|请先/.test(normalizeText(el.innerText || el.textContent)));
          const inCallCtx = hasVisibleText('通话中') ||
            hangBtnsCtx.length > 0 ||
            hasVisibleText('通话结束') || hasVisibleText('已挂断') || hasVisibleText('已结束');
          if (!inCallCtx) {
            console.warn('[云客助手][联动] 当前页面无通话上下文（无 通话中/挂断/结束 痕迹），跳过联动流程', flow.name);
            ykStatusUpdate({
              phoneCustomer: [ctxName || '', ctxNum || evPhone || ''].filter(Boolean).join(' '),
              event: '手机挂断' + (evReason ? ' · ' + evReason : ''), eventAt: evAt || Date.now(),
              progress: '已收到挂断，CRM 页面没有通话状态', outcome: '自动跟进已暂停；请切回对应客户通话页',
            });
            // [v1.19.8] 以前这里只写控制台，你看到的就是"手机明明挂了、电脑一点动静没有"。
            toast('📵 手机报：' + (evReason || '已挂断') + (ctxName || ctxNum ? '（' + (ctxName || ctxNum) + '）' : '') +
              '，客户事件已保存；切回对应客户页后会继续自动匹配并补录。', true, true);
            return;
          }
          // [v1.18.9] 用手机自己的时间线判断这条事件还算不算数：手机 state_at 明显晚于本事件、
          // 且状态已是 dialing/answered/incoming ⇒ CRM 已经拨出下一通了，此刻页面上的「通话中」
          // 属于新一通，点下去就是误挂（真机连环误挂就是这么来的）。
          // 处理方式不是整条放弃（那样上一通的跟进又写不了），而是照写跟进、只跳过点挂断。
          const superseded = phoneMovedOn(evAt);
          if (superseded) {
            console.warn('[云客助手][防误挂] 手机已拨出更新的电话（state=' + ((PW.__ykPhRow || {}).state || '') + '），本次只写跟进、绝不点页面挂断');
            toast('🛑 手机已拨出下一通：本次只写跟进，不点页面挂断', false, true);
          }
          ykStatusUpdate({
            phoneCustomer: [ctxName || '', ctxNum || evPhone || ''].filter(Boolean).join(' '),
            event: '手机挂断' + (evReason ? ' · ' + evReason : ''), eventAt: evAt || Date.now(),
            progress: '收到手机挂断，准备处理 CRM 跟进', outcome: '正在核对 CRM 页面与通话状态',
          });
          console.log('[云客助手][联动计时] 事件#' + latest + ' 号码: ' + (evPhone || '无') + ' 原因: ' + (evReason || '未标注') + ' → 流程 ' + flow.hotkey);
          try { localStorage.setItem('yk_link_busy', JSON.stringify({ tab: LINK_TAB_ID, until: Date.now() + 60000 })); } catch (e) {}
          hideAutoOverlay(); // 联动信号优先级最高，取消待决的倒计时
          // 事件年龄：信号越新鲜，页面上的"通话中"越确定是没同步的旧状态
          let eventAge = Infinity;
          for (const r of freshRows) {
            const t = Date.parse(r.created_at);
            if (!isNaN(t)) eventAge = Math.min(eventAge, Date.now() - t);
          }
          const ageTxt = isFinite(eventAge) ? ((eventAge / 1000).toFixed(1) + 's前') : '?';
          console.log('[云客助手][联动计时] 事件#' + latest + ' 手机挂断于 ' + ageTxt + '，开始执行流程');
          toast('📱 手机已挂' + (evReason ? '（' + evReason + '）' : '') + '（' + ageTxt + '）→ 自动执行「' + flowDisplayName(flow, getLayoutState().renames) + '」…');
          // [v1.16.0] 查微信：挂断后随联动出结果（有微信 → 可加好友跟进）
          if (matchNum) {
            wxchkCheck(matchNum).then((w) => {
              toast('💬 ' + matchNum + (w.has ? ' 有微信' + (w.nick ? '（' + w.nick + '）' : '') + ' → 可加好友跟进' : ' 未注册微信（或关了手机号搜索）'), false, true);
            }).catch(() => {});
          }
          linkLastExecAt = Date.now();
          linkLastExecKey = eventCallKey;
          bumpStat('auto', evReason);
          if (isFinite(eventAge)) {
            try {
              const k2 = statsKey();
              const st2 = JSON.parse(localStorage.getItem(k2) || '{}');
              st2.delay = st2.delay || { sum: 0, n: 0, max: 0 };
              st2.delay.sum += eventAge; st2.delay.n += 1;
              st2.delay.max = Math.max(st2.delay.max, eventAge);
              st2.delay.min = st2.delay.min == null ? eventAge : Math.min(st2.delay.min, eventAge);
              localStorage.setItem(k2, JSON.stringify(st2));
            } catch (e) {}
          }
          scheduleRedial(matchNum, evReason);
          // [v1.18.0] 面板开着"自动切回云客页"时，先把通话页唤到前台再跑流程
          if (st.focusOnLink !== false) requestFocusCrmTab();
          // [v1.17.5] 手机上报的原因表明这通压根没接通 → 电脑绝不点页面挂断（见 hangup 步骤），
          // 避免点掉已经拨出去的下一通电话
          const noAnswer = !!evReason && /short|无人接听|未接|拒接|noans|no_answer|关机|空号|停机|呼转/i.test(evReason);
          const pendingId = String(freshRows[0].id);
          const pendingBeforeRun = readPendingList().find((x) => String(x.id) === pendingId) || {};
          const firstAttempt = Number(pendingBeforeRun.attempts || 0) + 1;
          updatePendingEvent(pendingId, { state: 'running', attempts: firstAttempt, leaseUntil: Date.now() + 30000, workerTab: LINK_TAB_ID });
          await runFlow(flow, {
            trigger: '联动', gentleHangup: true,
            eventAge: isFinite(eventAge) ? eventAge : null,
            matchPhone: matchNum, noAnswer, pageSelfEnded: superseded,
            evAt, pendingEventId: pendingId, linkBusyTab: LINK_TAB_ID,
            retryAttempt: firstAttempt,
          });
        })).catch((st) => {
          // [v1.14.9] 402 = 云端资源点用尽/欠费导致数据库被隔离：熔断 5 分钟，别再空烧
          if (st === 402) {
            ykRelaySuspendedUntil = Date.now() + 5 * 60 * 1000;
            if (!ykRelaySuspendedNotified) {
              ykRelaySuspendedNotified = true;
              toast('☁️ 云端中转已暂停（资源点用尽或欠费），手机联动暂时不可用；云服务恢复后会自动继续', true, true);
            }
            return;
          }
          // 网络异常不再完全静默：限频打日志，便于排查"手机挂了电脑不动"
          const now = Date.now();
          if (now - (relayFetch._lastErrLog || 0) > 5000) {
            relayFetch._lastErrLog = now;
            console.warn('[云客助手] 手机联动轮询失败（状态 ' + st + '），下轮自动重试');
          }
        }).finally(() => { ykPollBusy--; });
      });

      // [v1.14.2] ===== 拨前号码检测：聚合数据「手机状态查询」=====
      // 接口: https://apis.juhe.cn/invalid_number/query?key=KEY&mobiles=号码
      // status: 0空号 1实号 2停机 3库无 4沉默号 5风险号；单次约0.02元，同号7天缓存只查一次
      const NUMCHK_STATUS = {
        '0': ['空号', '#dc2626'], '1': ['实号', '#16a34a'], '2': ['停机', '#ea580c'],
        '3': ['库无', '#94a3b8'], '4': ['沉默号', '#d97706'], '5': ['风险号', '#dc2626'],
      };
      function numchkCache() { try { return JSON.parse(localStorage.getItem('yk_numchk_cache')) || {}; } catch (e) { return {}; } }
      function numchkSaveCache(c) { try { localStorage.setItem('yk_numchk_cache', JSON.stringify(c)); } catch (e) {} }

      function numchkCheck(num) {
        const c = numchkCache();
        const hit = c[num];
        if (hit && hit.r && Date.now() - hit.t < 7 * 864e5) return Promise.resolve(hit.r);
        const key = localStorage.getItem('yk_numchk_key') || '';
        if (!key) return Promise.resolve(null);
        const url = 'https://apis.juhe.cn/invalid_number/query?key=' + encodeURIComponent(key) + '&mobiles=' + num;
        return relayFetch(url).then((j) => {
          if (!j || j.error_code !== 0) throw new Error((j && j.reason) || '接口错误');
          const d = j.result && j.result.data && j.result.data[0];
          if (!d) throw new Error('无结果');
          const r = { status: String(d.status), area: d.area || '', numberType: d.numberType || '' };
          const c2 = numchkCache();
          c2[num] = { r: r, t: Date.now() };
          numchkSaveCache(c2);
          return r;
        });
      }

      function numchkBadge(num, res) {
        const old = document.getElementById('yk_numchk_badge');
        if (old) old.remove();
        if (!res) return;
        const masked = num.slice(0, 3) + '****' + num.slice(-4);
        const pair = NUMCHK_STATUS[String(res.status)] || ['未知', '#94a3b8'];
        const bad = res.status === '0' || res.status === '2' || res.status === '5';
        const el = document.createElement('div');
        el.id = 'yk_numchk_badge';
        el.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483646;background:#fff;border:2px solid ' + pair[1] + ';border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.18);padding:8px 16px;font-size:14px;font-weight:600;font-family:sans-serif;color:' + pair[1] + ';';
        el.textContent = '📞 ' + masked + '：' + pair[0] + (res.area ? ' · ' + res.area : '') + (res.numberType ? ' · ' + res.numberType : '');
        document.documentElement.appendChild(el);
        setTimeout(() => { if (el.parentNode) el.remove(); }, bad ? 15000 : 6000);
        if (bad) {
          try { beepAlarm(); } catch (e) {}
          toast('⚠ ' + masked + ' 是' + pair[0] + '！' + (res.status === '0' ? '建议直接标空号(E)' : res.status === '2' ? '建议直接标停机(T)' : '谨慎拨打'), true);
        }
      }

      // [v1.16.0] ===== 查微信：这个号码能不能被搜到微信 =====
      // 微信官方没有"手机号查微信"接口（加好友搜索只在微信 App 内、要本人微信在线），
      // 能用的都是第三方检测接口（按次计费，需自购 Key）。本模块做成通用可配：
      // 接口地址({phone} 占位) + 鉴权 Header 名/值 + 返回判定字段，任一商家格式都能接。
      // 触发点：① 拨打前自动（跟随拨前号码检测的节奏，限速+缓存防烧钱）
      //         ② 号码旁手动按钮（选中页面上的 11 位手机号即弹出）
      //         ③ 挂断后随联动/秒挂选择条展示
      const WXCHK_CACHE_DAYS = 30;
      function wxchkCfg() {
        return {
          url: (localStorage.getItem('yk_wxchk_url') || '').trim(),
          hk: (localStorage.getItem('yk_wxchk_hk') || '').trim(),
          hv: (localStorage.getItem('yk_wxchk_hv') || '').trim(),
          okp: (localStorage.getItem('yk_wxchk_okp') || '').trim(),
          okv: (localStorage.getItem('yk_wxchk_okv') || '').trim(),
          nick: (localStorage.getItem('yk_wxchk_nick') || '').trim(),
        };
      }
      function wxchkReady() { const c = wxchkCfg(); return !!(c.url && c.okp); }
      function wxchkCache() { try { return JSON.parse(localStorage.getItem('yk_wxchk_cache')) || {}; } catch (e) { return {}; } }
      function wxchkSaveCache(c) { try { localStorage.setItem('yk_wxchk_cache', JSON.stringify(c)); } catch (e) {} }
      // 点号分层取字段：wxPath(j, 'data.status')
      function wxPath(obj, path) {
        if (!path) return undefined;
        return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
      }
      function wxchkCheck(num) {
        const c = wxchkCfg();
        if (!c.url || !c.okp) return Promise.reject(new Error('接口未配置'));
        const hit = wxchkCache()[num];
        if (hit && hit.r && Date.now() - hit.t < WXCHK_CACHE_DAYS * 864e5) return Promise.resolve(hit.r);
        let url = c.url;
        if (url.indexOf('{phone}') >= 0) url = url.split('{phone}').join(encodeURIComponent(num));
        else url += (url.indexOf('?') >= 0 ? '&' : '?') + 'phone=' + encodeURIComponent(num);
        const opts = {};
        if (c.hk && c.hv) opts.headers = { [c.hk]: c.hv };
        return relayFetch(url, opts).then((j) => {
          if (!j || typeof j !== 'object') throw new Error('返回不是 JSON');
          const v = wxPath(j, c.okp);
          if (v === undefined) throw new Error('判定字段 ' + c.okp + ' 不存在');
          const r = { has: String(v) === String(c.okv), nick: c.nick ? String(wxPath(j, c.nick) || '') : '' };
          const c2 = wxchkCache();
          c2[num] = { r: r, t: Date.now() };
          wxchkSaveCache(c2);
          return r;
        });
      }
      // [v1.16.9] 横幅可拖动 + 位置永久记住：挡到姓名/数字就拖到旁边，以后一直在那儿
      function ykBadgeDraggable(el, key) {
        try {
          const saved = JSON.parse(localStorage.getItem(key) || 'null');
          if (saved && typeof saved.top === 'number' && typeof saved.left === 'number') {
            el.style.left = saved.left + 'px';
            el.style.top = saved.top + 'px';
            el.style.transform = 'none';
            el.style.bottom = 'auto';
          }
        } catch (e) {}
        let sx = 0, sy = 0, drag = false, moved = 0;
        el.addEventListener('mousedown', (ev) => {
          if (ev.button !== 0) return;
          const r = el.getBoundingClientRect();
          drag = true; moved = 0; sx = ev.clientX - r.left; sy = ev.clientY - r.top;
          ev.preventDefault();
        });
        window.addEventListener('mousemove', (ev) => {
          if (!drag) return;
          const r = el.getBoundingClientRect();
          const L = Math.min(Math.max(0, ev.clientX - sx), window.innerWidth - r.width - 4);
          const T = Math.min(Math.max(0, ev.clientY - sy), window.innerHeight - r.height - 4);
          moved += Math.abs(ev.movementX || 0) + Math.abs(ev.movementY || 0);
          el.style.left = L + 'px'; el.style.top = T + 'px'; el.style.transform = 'none';
        });
        window.addEventListener('mouseup', () => {
          if (!drag) return;
          drag = false;
          if (moved > 6) {
            el.dataset.ykDragged = '1';
            try { localStorage.setItem(key, JSON.stringify({ left: parseInt(el.style.left, 10) || 0, top: parseInt(el.style.top, 10) || 0 })); } catch (e) {}
          }
        });
      }
      function wxchkBadge(num, res) {
        const old = document.getElementById('yk_wxchk_badge');
        if (old) old.remove();
        const masked = num.slice(0, 3) + '****' + num.slice(-4);
        const ok = !!(res && res.has);
        const el = document.createElement('div');
        el.id = 'yk_wxchk_badge';
        el.style.cssText = 'position:fixed;top:58px;left:50%;transform:translateX(-50%);z-index:2147483646;background:#fff;border:2px solid ' + (ok ? '#16a34a' : '#94a3b8') + ';border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.18);padding:5px 12px;font-size:12px;font-weight:600;font-family:sans-serif;color:' + (ok ? '#16a34a' : '#64748b') + ';opacity:.93;cursor:move;user-select:none;';
        el.textContent = ok
          ? '💬 ' + masked + '：有微信' + (res.nick ? ' · ' + res.nick : '') + '（可加好友）'
          : '💬 ' + masked + '：查不到微信（未注册或关了手机号搜索）';
        ykBadgeDraggable(el, 'yk_banner_pos');
        document.documentElement.appendChild(el);
        setTimeout(() => { if (el.parentNode) el.remove(); }, ok ? 8000 : 6000);
      }
      let wxchkLastCall = 0;
      // [v1.16.3] 半自动兜底（不配 API 也能用）：复制号码 + 提示粘到微信PC搜索框人眼看结果
      function wxchkBadgeSemi(num) {
        const old = document.getElementById('yk_wxchk_badge');
        if (old) old.remove();
        const masked = num.slice(0, 3) + '****' + num.slice(-4);
        const el = document.createElement('div');
        el.id = 'yk_wxchk_badge';
        el.style.cssText = 'position:fixed;top:58px;left:50%;transform:translateX(-50%);z-index:2147483646;background:#fff;border:2px solid #2563eb;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.18);padding:5px 12px;font-size:12px;font-weight:600;font-family:sans-serif;color:#2563eb;cursor:move;user-select:none;opacity:.93;';
        el.textContent = '💬 ' + masked + ' 已复制 → 切到微信PC版，Ctrl+F 粘贴回车，看有没有微信';
        el.title = '按住可拖到不挡字的位置，位置会记住；轻点一下关闭';
        ykBadgeDraggable(el, 'yk_banner_pos');
        el.addEventListener('click', () => {
          if (el.dataset.ykDragged === '1') { el.dataset.ykDragged = '0'; return; }
          if (el.parentNode) el.remove();
        });
        document.documentElement.appendChild(el);
        setTimeout(() => { if (el.parentNode) el.remove(); }, 10000);
      }
      let wxCopyCh = 0;
      function wxSemiCopy(num) {
        if (!num) return;
        let settled = false;
        const show = (okc) => {
          if (settled) return;
          settled = true;
          if (okc) wxchkBadgeSemi(num);
          else toast('💬 通话结束，号码 ' + num + '（自动复制失败，请手动复制后到微信PC搜索）', false, true);
        };
        const pageCopy = () => {
          try {
            const ta = document.createElement('textarea');
            ta.value = num;
            ta.style.cssText = 'position:fixed;opacity:0;left:-999px;top:0;';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            ta.remove();
            show(true);
          } catch (e) { show(false); }
        };
        // ① 走桥：隔离世界有 clipboardWrite 权限，后台标签页也能复制成功
        try {
          if (typeof __ykBridgeOk !== 'undefined' && __ykBridgeOk) {
            const ch = 'ykcopy' + (++wxCopyCh);
            const onMsg = (e) => {
              const d = e.data;
              if (!d || d.__ykRelay !== true || d.dir !== 'toPage' || d.ch !== ch) return;
              window.removeEventListener('message', onMsg);
              show(!!(d.resp && d.resp.ok));
            };
            window.addEventListener('message', onMsg);
            window.postMessage({ __ykRelay: true, dir: 'toBridge', ch: ch, __ykCopy: num }, '*');
            setTimeout(() => { window.removeEventListener('message', onMsg); pageCopy(); }, 1800);
            return;
          }
        } catch (e) {}
        // ② 页面内兜底
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(num).then(() => show(true), pageCopy);
          } else pageCopy();
        } catch (e) { pageCopy(); }
      }
      // force=false：自动（限速 3 秒一次、每轮最多 1 个）；force=true：手动（limit 个上限）
      function wxchkTick(force, limit) {
        if (!wxchkReady()) return;
        const cands = numchkFindContextNumbers();
        if (!cands.size) return;
        const cache = wxchkCache();
        const now = Date.now();
        let done = 0;
        for (const [num] of cands) {
          const hit = cache[num];
          if (hit && hit.r && now - hit.t < WXCHK_CACHE_DAYS * 864e5) continue; // 30 天内查过
          if (!force && (done > 0 || now - wxchkLastCall < 3000)) return; // 按次计费，限速别烧钱
          wxchkLastCall = now;
          done++;
          wxchkCheck(num).then((r) => wxchkBadge(num, r)).catch(() => {});
          if (force && limit && done >= limit) return;
        }
        if (!done && force) toast('本页号码都已查过微信（30 天缓存）', false, true);
      }
      workerEvery(3000, () => { try { wxchkTick(false); } catch (e) {} });

      // 号码旁手动按钮：选中页面上的 11 位手机号 → 光标处弹出"查微信"
      let wxSelBtn = null;
      function hideWxSelBtn() { if (wxSelBtn) { wxSelBtn.remove(); wxSelBtn = null; } }
      document.addEventListener('mouseup', (e) => {
        // 点在"查微信"按钮自身上不重建按钮（否则按钮被移除，click 打不中）
        if (wxSelBtn && (e.target === wxSelBtn || wxSelBtn.contains(e.target))) return;
        setTimeout(() => {
          try {
            const sel = window.getSelection();
            const t = String((sel && sel.toString()) || '').replace(/[\s-]/g, '');
            if (!/^1[3-9]\d{9}$/.test(t)) { hideWxSelBtn(); return; }
            hideWxSelBtn();
            const b = document.createElement('button');
            b.textContent = '💬 查微信';
            b.style.cssText = 'position:fixed;z-index:2147483647;left:' + Math.min(e.clientX + 4, window.innerWidth - 92) + 'px;top:' + (e.clientY + 14) + 'px;border:none;border-radius:8px;background:#16a34a;color:#fff;font-size:12px;font-weight:600;padding:5px 10px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.2);font-family:sans-serif;';
            b.addEventListener('click', (ev) => {
              ev.stopPropagation();
              hideWxSelBtn();
              if (!wxchkReady()) { wxSemiCopy(t); return; } // [v1.16.3] 没配API：复制号码走半自动
              const btn2 = b;
              btn2.textContent = '查询中…';
              document.documentElement.appendChild(btn2);
              wxSelBtn = btn2;
              wxchkCheck(t).then((r) => { hideWxSelBtn(); wxchkBadge(t, r); }).catch(() => { hideWxSelBtn(); toast('💬 微信查询失败（接口地址/Key 没配对？失败不计费）', true); });
            });
            document.documentElement.appendChild(b);
            wxSelBtn = b;
          } catch (err) {}
        }, 0);
      });

      // 查微信配置弹窗：接口地址/鉴权/返回判定全部可配，改动即存
      function openWxchkCfg() {
        const old = document.getElementById('yk_wxchk_cfg_box');
        if (old) { old.remove(); return; }
        const box = document.createElement('div');
        box.id = 'yk_wxchk_cfg_box';
        box.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:2147483647;width:360px;max-height:82vh;overflow:auto;background:#fff;border-radius:12px;box-shadow:0 12px 48px rgba(0,0,0,.25);padding:16px;font-family:sans-serif;font-size:12px;color:#334155;';
        const row = (label, id, val, ph, isPw) =>
          '<div style="margin-bottom:8px;"><div style="color:#64748b;margin-bottom:2px;">' + label + '</div>' +
          '<input id="' + id + '" value="' + String(val || '').replace(/"/g, '&quot;') + '" placeholder="' + ph + '" ' + (isPw ? 'type="password"' : '') + ' style="width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:6px;padding:5px 8px;font-size:12px;"></div>';
        box.innerHTML =
          '<div style="font-weight:700;font-size:13px;margin-bottom:6px;">🔍 查微信 · 接口配置</div>' +
          '<div style="color:#94a3b8;margin-bottom:10px;line-height:1.5;">微信官方没有"手机号查微信"接口，需自购第三方检测接口（按次计费，约 0.05~0.3 元/次；同号 30 天只查一次，失败不计费）。把商家文档里的地址和参数填进来即可，改动即存。</div>' +
          row('接口地址（{phone} 是号码占位符；地址里没有占位符会自动加 ?phone=）', 'yk_wxchk_cfg_url', localStorage.getItem('yk_wxchk_url') || '', 'https://api.xxx.com/wxcheck?phone={phone}') +
          row('鉴权 Header 名（如 X-APISpace-Token / Authorization；没有就留空）', 'yk_wxchk_cfg_hk', localStorage.getItem('yk_wxchk_hk') || '', 'X-APISpace-Token') +
          row('鉴权 Header 值（密钥）', 'yk_wxchk_cfg_hv', localStorage.getItem('yk_wxchk_hv') || '', 'your-key', true) +
          row('有微信判定：返回 JSON 字段路径（点号分层）', 'yk_wxchk_cfg_okp', localStorage.getItem('yk_wxchk_okp') || '', 'code 或 data.status') +
          row('……等于该值算"有微信"', 'yk_wxchk_cfg_okv', localStorage.getItem('yk_wxchk_okv') || '', '1') +
          row('昵称字段路径（可选，查到后显示昵称）', 'yk_wxchk_cfg_nick', localStorage.getItem('yk_wxchk_nick') || '', 'data.nickname') +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;">' +
          '<button id="yk_wxchk_cfg_test" style="border:1px solid #16a34a;background:#fff;color:#16a34a;border-radius:8px;padding:5px 12px;cursor:pointer;font-size:12px;">测一下</button>' +
          '<button id="yk_wxchk_cfg_close" style="border:none;background:#2563eb;color:#fff;border-radius:8px;padding:5px 14px;cursor:pointer;font-size:12px;">完成</button></div>';
        document.documentElement.appendChild(box);
        const bind = (id, key) => {
          const el = box.querySelector('#' + id);
          if (el) el.addEventListener('input', () => { try { localStorage.setItem(key, el.value.trim()); } catch (e) {} });
        };
        bind('yk_wxchk_cfg_url', 'yk_wxchk_url');
        bind('yk_wxchk_cfg_hk', 'yk_wxchk_hk');
        bind('yk_wxchk_cfg_hv', 'yk_wxchk_hv');
        bind('yk_wxchk_cfg_okp', 'yk_wxchk_okp');
        bind('yk_wxchk_cfg_okv', 'yk_wxchk_okv');
        bind('yk_wxchk_cfg_nick', 'yk_wxchk_nick');
        // 弹窗里改地址时同步面板输入框
        box.querySelector('#yk_wxchk_cfg_url').addEventListener('input', () => {
          const p = document.getElementById('yk_wxchk_url');
          if (p) p.value = localStorage.getItem('yk_wxchk_url') || '';
        });
        box.querySelector('#yk_wxchk_cfg_close').onclick = () => box.remove();
        box.querySelector('#yk_wxchk_cfg_test').onclick = () => {
          if (!wxchkReady()) { toast('⚠ 至少填：接口地址 + 判定字段', true); return; }
          const cands = numchkFindContextNumbers();
          if (!cands.size) { toast('本页没找到完整手机号（打码号码测不了）', true); return; }
          const num = cands.keys().next().value;
          toast('💬 正在查询 ' + num + ' …', false, true);
          wxchkCheck(num).then((r) => {
            toast('✓ 测试结果：' + (r.has ? '有微信' + (r.nick ? '（' + r.nick + '）' : '') : '无微信'), !r.has, true);
          }).catch((e) => {
            toast('✗ 查询失败：' + ((e && e.message) || '接口/Key 没配对') + '（失败不计费）', true, true);
          });
        };
      }

      // 收集"通话上下文"里的完整号码：拨打/呼叫/外呼按钮附近，或输入框/号码属性里。
      // 不扫整页列表 —— 批量扫一次就是几十次计费，烧钱。
      let numchkBtnsCache = [];
      let numchkBtnsAt = 0;
      function numchkDialBtns() {
        if (Date.now() - numchkBtnsAt < 2000) return numchkBtnsCache;
        numchkBtnsAt = Date.now();
        numchkBtnsCache = [];
        try {
          ['拨打', '呼叫', '外呼'].forEach((t) => {
            findClickablesByText(t).forEach((b) => {
              if (isVisible(b)) numchkBtnsCache.push(b);
            });
          });
        } catch (e) {}
        return numchkBtnsCache;
      }
      function numchkFindContextNumbers() {
        const out = new Map();
        try {
          const btns = numchkDialBtns();
          const re = /1[3-9]\d{9}/g;
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          let node;
          while ((node = walker.nextNode())) {
            const t = node.nodeValue || '';
            if (t.length < 11 || !/1[3-9]\d{9}/.test(t)) continue;
            const el = node.parentElement;
            if (!el || !isVisible(el)) continue;
            const inInput = el.tagName === 'INPUT' || !!el.closest('input');
            const attrs = el.closest('[data-phone],[data-mobile],[data-tel],[data-value]');
            let ctx = inInput || !!attrs;
            if (!ctx && btns.length) {
              const r1 = el.getBoundingClientRect();
              for (const b of btns) {
                const r2 = b.getBoundingClientRect();
                const dx = Math.abs((r1.left + r1.width / 2) - (r2.left + r2.width / 2));
                const dy = Math.abs((r1.top + r1.height / 2) - (r2.top + r2.height / 2));
                if (dx < 800 && dy < 300) { ctx = true; break; }
              }
            }
            if (!ctx) continue;
            let m;
            re.lastIndex = 0;
            while ((m = re.exec(t))) { if (!out.has(m[0])) out.set(m[0], el); }
          }
        } catch (e) {}
        return out;
      }

      let numchkLastCall = 0;
      // force=false：自动模式（限速2秒、每轮最多查1个）；force=true：手动（limit 个上限）
      function numchkTick(force, limit) {
        const key = localStorage.getItem('yk_numchk_key') || '';
        if (!key) return;
        const cands = numchkFindContextNumbers();
        if (!cands.size) return;
        const cache = numchkCache();
        const now = Date.now();
        let done = 0;
        for (const [num] of cands) {
          const hit = cache[num];
          if (hit && hit.r && now - hit.t < 7 * 864e5) continue; // 7天内查过
          if (!force && (done > 0 || now - numchkLastCall < 2000)) return; // 限速：最多2秒一次计费查询
          numchkLastCall = now;
          done++;
          numchkCheck(num).then((r) => { if (r) numchkBadge(num, r); }).catch(() => {});
          if (force && limit && done >= limit) return;
        }
        if (!done && force) toast('本页号码最近 7 天都已检测过', false, true);
      }
      workerEvery(2000, () => { try { numchkTick(false); } catch (e) {} });

      // 监听通话状态：挂断按钮/通话中 消失即视为通话结束
      let callWasActive = false;
      workerEvery(600, () => {
        let inCall = false;
        try { inCall = findClickablesByText('挂断').length > 0 || hasVisibleText('通话中'); } catch (e) {}
        if (inCall) { callWasActive = true; return; }
        if (!callWasActive) return;
        callWasActive = false;
        if (running || capturing) return; // 手动流程进行中不抢
        const st = loadAuto();
        if (!st.autoMode) {
          ykStatusUpdate({ progress: '自动跟进未执行', outcome: '通话结束后自动执行已关闭；请手动选择结果' });
          toast('📞 自动跟进开关已关闭；本次没有自动填写，请在设置里打开“通话结束后自动执行”', true, true);
          return;
        }
        let flow = null;
        if (st.useKeywords) {
          const hk = detectFlowByKeywords();
          if (hk) flow = FLOWS.find((f) => f.hotkey === hk);
        }
        // 默认流程写死「无意向·拒绝」（D），不跟随手动按过的流程
        if (!flow) flow = FLOWS.find((f) => f.hotkey === 'D');
        if (!flow) { toast('📞 通话已结束，没有可自动执行的默认流程，请手动选择'); return; }
        // 注意 0 是合法值（立即执行），不能用 || 兜底
        showAutoOverlay(flow, typeof st.autoSeconds === 'number' ? st.autoSeconds : 5);
      }, 600);

      document.documentElement.appendChild(fab);
      document.documentElement.appendChild(panel);
      if (typeof PW.__YK_STATUS_RENDER__ === 'function') PW.__YK_STATUS_RENDER__(PW.__YK_STATUS_STATE__ || YK_STATUS_DEFAULT);

      // ---- 悬浮球快捷菜单：单击悬浮球，按钮在球旁弹出成一列，纯鼠标一键触发 ----
      const ring = document.createElement('div');
      ring.id = 'yk_helper_ring';
      document.documentElement.appendChild(ring);
      let ringOpen = false;

      function closeRing() {
        ringOpen = false;
        ring.style.display = 'none';
        ring.innerHTML = '';
      }

      function openPanel() {
        const fr = fab.getBoundingClientRect();
        const panelWidth = Math.min(340, window.innerWidth - 20);
        let px = fr.left + fr.width / 2 - panelWidth / 2;
        let py = fr.top - 10;
        px = Math.max(10, Math.min(window.innerWidth - panelWidth - 10, px));
        const panelHeight = Math.min(760, window.innerHeight * 0.8);
        if (py - panelHeight < 10) {
          py = fr.bottom + 10;
        } else {
          py = py - panelHeight;
        }
        py = Math.max(10, Math.min(window.innerHeight - panelHeight - 10, py));
        panel.style.left = px + 'px';
        panel.style.top = py + 'px';
        panel.style.display = 'flex';
        closeRing();
      }

      function toggleRing() {
        if (ringOpen) { closeRing(); return; }
        panel.style.display = 'none';

        const st = getLayoutState();
        const byKey = {};
        FLOWS.forEach((f) => { byKey[f.hotkey] = f; });
        const items = st.order
          .map((k) => byKey[k])
          .filter((f) => f && !st.hidden.includes(f.hotkey));

        // 构建菜单：白卡片，每行 = 色点 + 完整流程名 + 键位角标
        ring.innerHTML = '';
        const menu = document.createElement('div');
        menu.className = 'yk-quickmenu';
        items.forEach((f) => {
          const row = document.createElement('button');
          row.className = 'yk-qm-row';
          row.innerHTML =
            `<span class="dot" style="background:${f.color}"></span>` +
            `<span class="label">${flowDisplayName(f, st.renames)}</span>` +
            `<span class="k">${keyDisplay(getEffectiveKey(f, st.keys))}</span>`;
          row.title = flowDisplayName(f, st.renames) + '（点击执行）';
          row.onclick = () => { closeRing(); runFlow(f, { trigger: '悬浮球菜单' }); };
          menu.appendChild(row);
        });
        const editRow = document.createElement('button');
        editRow.className = 'yk-qm-edit';
        editRow.textContent = '✎ 编辑按钮（显隐 / 排序 / 改名 / 改键）';
        editRow.onclick = () => { closeRing(); openPanel(); };
        menu.appendChild(editRow);
        ring.appendChild(menu);

        // 定位：优先贴悬浮球侧面，空间不够放上方/下方，最终夹回屏幕内
        ring.style.display = 'block';
        ringOpen = true;
        const fr = fab.getBoundingClientRect();
        const cx = fr.left + fr.width / 2;
        const cy = fr.top + fr.height / 2;
        const mw = menu.offsetWidth, mh = menu.offsetHeight;
        let x, y;
        if (fr.right + mw + 12 < window.innerWidth) {
          x = fr.right + 10; y = cy - mh / 2;
        } else if (fr.left - mw - 10 > 10) {
          x = fr.left - mw - 10; y = cy - mh / 2;
        } else if (fr.bottom + mh + 12 < window.innerHeight) {
          x = cx - mw / 2; y = fr.bottom + 10;
        } else {
          x = cx - mw / 2; y = fr.top - mh - 10;
        }
        x = Math.max(10, Math.min(window.innerWidth - mw - 10, x));
        y = Math.max(10, Math.min(window.innerHeight - mh - 10, y));
        ring.style.left = x + 'px';
        ring.style.top = y + 'px';
      }

      // 点击空白处收起快捷菜单
      document.addEventListener('click', (e) => {
        if (ringOpen && !ring.contains(e.target) && !fab.contains(e.target)) closeRing();
      }, true);

      fab.onclick = () => {
        if (wasDragged) return;
        toggleRing();
      };
      panel.querySelector('#yk_close').onclick = () => { panel.style.display = 'none'; };
      editBtn.onclick = () => {
        editMode = !editMode;
        toolsDetails.open = editMode;
        editBtn.classList.toggle('on', editMode);
        renderGrid();
      };

      document.addEventListener('keydown', (e) => {
        // 触发键捕获模式：下一个按下的键即为触发键（键盘上任意键都行）
        if (capturing) {
          if (e.key === 'Escape') {
            capturing = null;
            renderGrid();
            toast('已取消设置触发键');
            e.preventDefault();
            return;
          }
          // 修饰键/锁定键不作为触发键，忽略等待下一次按键
          if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Dead', 'NumLock', 'ScrollLock'].includes(e.key)) return;
          if (e.ctrlKey || e.altKey || e.metaKey) return; // 带修饰键的组合不捕获
          e.preventDefault();
          e.stopPropagation();
          const cur = getLayoutState();
          cur.keys[capturing] = e.key;
          saveLayout(cur);
          const conflict = FLOWS.find((f) => f.hotkey !== capturing &&
            String(getEffectiveKey(f, cur.keys)).toLowerCase() === e.key.toLowerCase());
          const doneKey = capturing;
          capturing = null;
          renderGrid();
          const doneFlow = FLOWS.find((f) => f.hotkey === doneKey);
          if (conflict) {
            toast('⚠ 「' + keyDisplay(e.key) + '」和「' + flowDisplayName(conflict, cur.renames) + '」重复了，列表里靠前的优先生效', true);
          } else {
            toast('✓ 「' + flowDisplayName(doneFlow, cur.renames) + '」触发键已设为 ' + keyDisplay(e.key));
          }
          return;
        }

        // 宏触发键捕获模式：下一个按下的键即为该动作的触发键
        if (capturingMacro) {
          if (e.key === 'Escape') {
            capturingMacro = null;
            renderMacros();
            toast('已取消设置触发键');
            e.preventDefault();
            return;
          }
          if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Dead', 'NumLock', 'ScrollLock'].includes(e.key)) return;
          if (e.ctrlKey || e.altKey || e.metaKey) return;
          e.preventDefault();
          e.stopPropagation();
          const list3 = loadMacros();
          const mm = list3.find((x) => x.id === capturingMacro);
          capturingMacro = null;
          if (mm) {
            mm.key = e.key;
            saveMacros(list3);
            const conflict = loadMacros().find((x) => x.id !== mm.id && x.key && String(x.key).toLowerCase() === e.key.toLowerCase());
            toast('✓ 「' + mm.name + '」触发键已设为 ' + keyDisplay(e.key) + (conflict ? '\n⚠ 与宏「' + conflict.name + '」重复，靠前的生效' : ''));
          }
          renderMacros();
          return;
        }

        // 「立即执行」快捷键捕获模式
        if (capturingExec) {
          if (e.key === 'Escape') {
            capturingExec = false;
            renderExecKey();
            toast('已取消设置');
            e.preventDefault();
            return;
          }
          if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Dead', 'NumLock', 'ScrollLock'].includes(e.key)) return;
          if (e.ctrlKey || e.altKey || e.metaKey) return;
          e.preventDefault();
          e.stopPropagation();
          const s2 = loadAuto(); s2.execKey = e.key; saveAuto(s2);
          capturingExec = false;
          renderExecKey();
          toast('✓ 「立即执行」键已设为 ' + keyDisplay(e.key) + '（通话结束倒计时时按它直接执行）');
          return;
        }

        if (e.ctrlKey && e.shiftKey && (e.key === 'Y' || e.key === 'y')) {
          e.preventDefault();
          panel.style.display = panel.style.display === 'flex' ? 'none' : 'flex';
          return;
        }
        // 录制中：回车记为一步动作，其余按键一律不触发流程
        if (macroRec) {
          if (e.key === 'Enter' && !(e.ctrlKey || e.altKey || e.metaKey)) {
            macroRec.actions.push({ t: 'enter' });
            toast('🎬 已记录第 ' + macroRec.actions.length + ' 步（回车）', false, true);
          }
          return;
        }
        const target = e.target;
        const isTyping = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
        // 物理组合键不依赖当前中英文输入法；适合旁边开着置顶便签时点击回 CRM 后快速标注。
        // 只能在 CRM 页面有焦点时触发，避免跨窗口抢键或影响便签文本输入。
        if (!isTyping && e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey && !e.repeat) {
          const functionKey = /^F([1-8])$/.exec(e.code || '');
          if (functionKey) {
            const digit = Number(functionKey[1]);
            const st = getLayoutState();
            const byKey = {};
            FLOWS.forEach((f) => { byKey[f.hotkey] = f; });
            const visibleFlows = st.order.map((k) => byKey[k]).filter((f) => f && !st.hidden.includes(f.hotkey));
            const flow = visibleFlows[digit - 1];
            if (flow) {
              e.preventDefault();
              e.stopPropagation();
              bumpStat('manual');
              runFlow(flow, { trigger: '中文输入法快捷键 Ctrl+Shift+F' + digit });
              return;
            }
          }
        }
        // [v1.9.4] 输入法组词中（isComposing/keyCode 229）绝不触发：拼音打字含 f/d/s 等字母，
        // 之前会凭空触发"未明确·意向不明"等流程（F 键正是它的快捷键）
        if (isTyping || e.isComposing || e.keyCode === 229 || e.ctrlKey || e.altKey || e.metaKey || e.repeat) return;
        // 匹配触发键：用 e.key 全键比较（数字/字母/符号/F键均可），大小写不敏感
        const pressed = (e.key || '').toLowerCase();
        // 倒计时浮层挂着时：按「立即执行」键 = 直接执行（不用等倒计时走完）
        if (autoPendingFlow && overlay.style.display === 'block' &&
            pressed === String(loadAuto().execKey || 'Enter').toLowerCase()) {
          e.preventDefault();
          e.stopPropagation();
          const f = autoPendingFlow;
          hideAutoOverlay();
          console.log('[跟进助手] 快捷键「' + keyDisplay(e.key) + '」立即执行：' + f.name);
          bumpStat('auto');
          runFlow(f, { gentleHangup: true, pageSelfEnded: true, trigger: '立即执行键' });
          return;
        }
        const st = getLayoutState();
        const flow = FLOWS.find((f) => String(getEffectiveKey(f, st.keys)).toLowerCase() === pressed);
        if (flow) {
          e.preventDefault();
          e.stopPropagation();
          console.log('[跟进助手] 快捷键触发：' + flow.name);
          bumpStat('manual');
          runFlow(flow, { trigger: '快捷键' });
          return;
        }
        // [v1.11.0] H：一键预约回拨（H 未被流程/宏占用时生效；再按 H 关闭）
        if (pressed === 'h' &&
            !FLOWS.some((f) => String(getEffectiveKey(f, st.keys)).toLowerCase() === 'h') &&
            !loadMacros().some((m) => m.key && String(m.key).toLowerCase() === 'h')) {
          e.preventDefault();
          e.stopPropagation();
          showCallbackPicker();
          return;
        }
        // 流程没匹配到 → 试宏触发键
        const mhit = loadMacros().find((m) => m.key && String(m.key).toLowerCase() === pressed);
        if (mhit) {
          e.preventDefault();
          e.stopPropagation();
          console.log('[跟进助手] 快捷键触发宏：' + mhit.name);
          runMacro(mhit);
        }
      }, true);

      console.log('%c[云客CRM跟进助手] v' + YK_BUILD + ' 已加载｜挂断事件自动补偿、重复提交保护', 'color:#0e7490;font-weight:bold;font-size:14px;');
    } catch (err) {
      console.error('[云客CRM跟进助手] 初始化失败：', err);
      toast('[云客CRM跟进助手] 初始化失败：' + err.message, true);
    }
  }

  function guardUI() {
    const obs = new MutationObserver(() => {
      if (!document.getElementById('yk_helper_fab')) initUI();
    });
    obs.observe(document.documentElement, { childList: true, subtree: false });
  }

  ensureBody(() => { initUI(); guardUI(); });
})();
