// 云客CRM跟进助手 - 后台中转（MV3 service worker）
// 职责：代替云客页面发跨域请求（联动轮询/清理/LLM）。扩展有 host_permissions，后台 fetch 不受 CORS 限制。
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg) return;
  // [v1.18.0] 手机挂断时把云客标签页唤到前台（人在别的窗口/网站时也能立刻看到并提交）
  if (msg.__ykFocus === true) {
    try {
      const tab = sender.tab;
      if (tab && tab.id !== undefined && tab.id >= 0) {
        chrome.tabs.update(tab.id, { active: true });
        if (tab.windowId !== undefined) chrome.windows.update(tab.windowId, { focused: true });
      }
    } catch (e) {}
    sendResponse({ ok: true });
    return;
  }
  if (msg.__ykRelay === true) {
    const init = {
      method: (msg.opts && msg.opts.method) || 'GET',
      headers: Object.assign({}, (msg.opts && msg.opts.headers) || {}),
    };
    if (init.method !== 'GET' && init.method !== 'HEAD' && msg.opts && msg.opts.body) init.body = msg.opts.body;
    // [v1.12.0] LLM 流式响应是 SSE 文本，不能按 JSON 解析
    const isLLM = String(msg.url || '').includes('/.cloud/llm/');
    fetch(msg.url, init)
      .then(async (r) => {
        let body = null;
        try { body = isLLM ? await r.text() : await r.json(); } catch (e) { body = null; }
        sendResponse({ ok: r.ok, status: r.status, body: body });
      })
      .catch((err) => sendResponse({ ok: false, status: 0, body: null, error: String((err && err.message) || err) }));
    return true;
  }
});
