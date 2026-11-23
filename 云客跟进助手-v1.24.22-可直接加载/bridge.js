// 云客CRM跟进助手 - 隔离世界桥（ISOLATED world，默认世界）
// 职责：MAIN 世界的 content.js 无法调用扩展 API，通过 window.postMessage 把联动请求
// 委托给本桥 → chrome.runtime.sendMessage → bg.js 后台 fetch（绕过跨域 Origin 校验）。
(function () {
  'use strict';
  window.addEventListener('message', (e) => {
    if (e.source !== window) return;
    const d = e.data;
    if (!d || d.__ykRelay !== true || d.dir !== 'toBridge') return;
    // [v1.18.0] 焦点请求：让后台把本标签页切到前台
    if (d.__ykFocus === true) {
      try { chrome.runtime.sendMessage({ __ykFocus: true }, () => {}); } catch (err) {}
      return;
    }
    // 探测包：直接回执，证明桥在线
    if (d.ch === '__yk_ping') {
      window.postMessage({ __ykRelay: true, dir: 'toPage', ch: d.ch, resp: { ok: true, status: 200 } }, '*');
      return;
    }
    // [v1.14.1] 扩展存储通道：宏等贵重数据双写到 chrome.storage.local，
    // 页面 localStorage 被 CRM 清掉/换域名时也能从扩展存储恢复
    if (d.__ykStore === 'set') {
      try {
        const o = {};
        o[d.key] = d.value;
        chrome.storage.local.set(o, () => reply({ ok: true }));
      } catch (err) { reply({ ok: false }); }
      return;
    }
    if (d.__ykStore === 'get') {
      try {
        chrome.storage.local.get(d.key, (res) => reply({ ok: true, value: res ? res[d.key] : null }));
      } catch (err) { reply({ ok: false }); }
      return;
    }
    // [v1.16.3] 剪贴板通道：隔离世界有 clipboardWrite 权限，后台标签页也能复制成功
    if (d.__ykCopy) {
      const num = String(d.__ykCopy);
      let acked = false;
      const ack = (ok) => {
        if (acked) return;
        acked = true;
        try { window.postMessage({ __ykRelay: true, dir: 'toPage', ch: d.ch, resp: { ok: ok } }, '*'); } catch (err) {}
      };
      try {
        navigator.clipboard.writeText(num).then(() => ack(true), () => {
          try {
            const ta = document.createElement('textarea');
            ta.value = num;
            ta.style.cssText = 'position:fixed;opacity:0;left:-999px;top:0;';
            document.documentElement.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            ta.remove();
            ack(true);
          } catch (err) { ack(false); }
        });
        setTimeout(() => ack(false), 1500);
      } catch (err) { ack(false); }
      return;
    }
    let responded = false;
    const reply = (resp) => {
      if (responded) return;
      responded = true;
      try { window.postMessage({ __ykRelay: true, dir: 'toPage', ch: d.ch, resp: resp }, '*'); } catch (err) {}
    };
    try {
      chrome.runtime.sendMessage({ __ykRelay: true, url: d.url, opts: d.opts }, (resp) => {
        if (chrome.runtime.lastError) {
          reply({ ok: false, status: -1, body: null, error: chrome.runtime.lastError.message });
          return;
        }
        reply(resp || { ok: false, status: -1, body: null });
      });
    } catch (err) {
      reply({ ok: false, status: -2, body: null, error: String(err) });
    }
  });
})();
