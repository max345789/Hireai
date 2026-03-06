(function () {
  const cfg = window.HireAIConfig || {};
  const agencyName = cfg.agencyName || 'Dream Properties';
  const primaryColor = cfg.primaryColor || '#6C63FF';
  const greeting = cfg.greeting || 'Hi! Looking for your dream property? I can help 24/7 🏠';
  const agencyId = cfg.agencyId || 'agency_001';

  const script = document.currentScript;
  const baseUrl = cfg.baseUrl || (script ? new URL(script.src).origin : window.location.origin);

  const storageKey = `hireai_widget_sid_${agencyId}`;
  let sessionId = localStorage.getItem(storageKey) || null;
  let lastMessageId = 0;
  let pollTimer = null;

  const style = document.createElement('style');
  style.textContent = `
    .hireai-widget-btn { position: fixed; right: 20px; bottom: 20px; width: 58px; height: 58px; border-radius: 999px; border: none; background: ${primaryColor}; color: #fff; font-size: 26px; cursor: pointer; box-shadow: 0 12px 28px rgba(0,0,0,.25); z-index: 2147483000; }
    .hireai-widget-panel { position: fixed; right: 20px; bottom: 90px; width: 350px; height: 500px; background: #111217; color: #fff; border-radius: 14px; box-shadow: 0 18px 40px rgba(0,0,0,.45); overflow: hidden; display: none; flex-direction: column; z-index: 2147483000; }
    .hireai-widget-header { background: ${primaryColor}; padding: 12px 14px; font-family: Inter, sans-serif; font-size: 14px; font-weight: 600; }
    .hireai-widget-messages { flex: 1; overflow-y: auto; padding: 12px; background: #151722; display: flex; flex-direction: column; gap: 8px; }
    .hireai-msg { max-width: 85%; padding: 10px 12px; border-radius: 12px; font: 13px/1.4 Inter, sans-serif; white-space: pre-wrap; }
    .hireai-msg-client { align-self: flex-end; background: ${primaryColor}; color: #fff; border-bottom-right-radius: 4px; }
    .hireai-msg-agent { align-self: flex-start; background: #222538; color: #f5f7ff; border-bottom-left-radius: 4px; }
    .hireai-widget-input-wrap { display: flex; gap: 8px; padding: 10px; background: #111217; border-top: 1px solid rgba(255,255,255,.08); }
    .hireai-widget-input { flex: 1; border: 1px solid rgba(255,255,255,.12); background: #0c0d13; color: #fff; border-radius: 8px; padding: 10px; font: 13px Inter, sans-serif; }
    .hireai-widget-send { border: none; border-radius: 8px; background: ${primaryColor}; color: #fff; padding: 0 14px; font: 12px Inter, sans-serif; cursor: pointer; }
    .hireai-widget-footer { font: 11px Inter, sans-serif; color: #9da3b0; text-align: center; padding: 8px; border-top: 1px solid rgba(255,255,255,.05); background: #0f1016; }
  `;
  document.head.appendChild(style);

  const button = document.createElement('button');
  button.className = 'hireai-widget-btn';
  button.innerHTML = '💬';

  const panel = document.createElement('div');
  panel.className = 'hireai-widget-panel';
  panel.innerHTML = `
    <div class="hireai-widget-header">${agencyName} — We reply instantly 🟢</div>
    <div class="hireai-widget-messages"></div>
    <div class="hireai-widget-input-wrap">
      <input class="hireai-widget-input" placeholder="Type your message..." />
      <button class="hireai-widget-send">Send</button>
    </div>
    <div class="hireai-widget-footer">Powered by HireAI</div>
  `;

  document.body.appendChild(button);
  document.body.appendChild(panel);

  const messagesEl = panel.querySelector('.hireai-widget-messages');
  const inputEl = panel.querySelector('.hireai-widget-input');
  const sendEl = panel.querySelector('.hireai-widget-send');

  function addMessage(text, role) {
    const item = document.createElement('div');
    item.className = `hireai-msg ${role === 'client' ? 'hireai-msg-client' : 'hireai-msg-agent'}`;
    item.textContent = text;
    messagesEl.appendChild(item);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function api(path, body) {
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });

    if (!response.ok) {
      throw new Error(`Widget request failed (${response.status})`);
    }

    return response.json();
  }

  async function fetchMessages() {
    if (!sessionId) return;

    try {
      const response = await fetch(`${baseUrl}/api/widget/messages/${encodeURIComponent(sessionId)}?since=${lastMessageId}`);
      if (!response.ok) return;

      const data = await response.json();
      (data.messages || []).forEach((msg) => {
        lastMessageId = Math.max(lastMessageId, Number(msg.id || 0));
        if (msg.direction === 'out') {
          addMessage(msg.content, 'agent');
        }
      });
    } catch (_err) {
      // ignore polling error
    }
  }

  async function ensureSession() {
    if (sessionId) return;

    const data = await api('/api/widget/session', {
      agencyId,
      agencyName,
      greeting,
      visitorName: cfg.visitorName || 'Website Visitor',
    });

    sessionId = data.sessionId;
    localStorage.setItem(storageKey, sessionId);

    (data.messages || []).forEach((msg) => {
      lastMessageId = Math.max(lastMessageId, Number(msg.id || 0));
      if (msg.direction === 'out') {
        addMessage(msg.content, 'agent');
      }
    });
  }

  async function sendMessage() {
    const text = inputEl.value.trim();
    if (!text) return;

    inputEl.value = '';
    addMessage(text, 'client');

    try {
      await ensureSession();
      await api('/api/widget/message', {
        sessionId,
        message: text,
        visitorName: cfg.visitorName || 'Website Visitor',
      });
      setTimeout(fetchMessages, 350);
    } catch (error) {
      addMessage('Sorry, we could not send that message. Please try again.', 'agent');
    }
  }

  function openWidget() {
    panel.style.display = 'flex';
    button.style.display = 'none';
    ensureSession().catch(() => undefined);

    if (!pollTimer) {
      pollTimer = setInterval(fetchMessages, 2000);
    }
  }

  function closeWidget() {
    panel.style.display = 'none';
    button.style.display = 'block';
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  button.addEventListener('click', openWidget);
  panel.querySelector('.hireai-widget-header').addEventListener('dblclick', closeWidget);
  sendEl.addEventListener('click', sendMessage);
  inputEl.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
      sendMessage();
    }
  });
})();
