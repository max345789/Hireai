(function () {
  const cfg = window.DABAIConfig || {};
  const agencyName = cfg.agencyName || 'Dream Properties';
  const primaryColor = cfg.primaryColor || '#6C63FF';
  const greeting = cfg.greeting || 'Hi! Looking for your dream property? I can help 24/7 🏠';
  const agencyId = cfg.agencyId || 'agency_001';
  const widgetId = cfg.widgetId || null;

  const script = document.currentScript;
  const baseUrl = cfg.baseUrl || (script ? new URL(script.src).origin : window.location.origin);

  const storageKey = `dab-ai_widget_sid_${agencyId}`;
  const accessTokenKey = `dab-ai_widget_sat_${agencyId}`;
  let sessionId = localStorage.getItem(storageKey) || null;
  let accessToken = localStorage.getItem(accessTokenKey) || null;
  let lastMessageId = 0;
  let pollTimer = null;

  const style = document.createElement('style');
  style.textContent = `
    .dab-ai-widget-btn { position: fixed; right: 20px; bottom: 20px; width: 58px; height: 58px; border-radius: 999px; border: none; background: ${primaryColor}; color: #fff; font-size: 26px; cursor: pointer; box-shadow: 0 12px 28px rgba(0,0,0,.25); z-index: 2147483000; }
    .dab-ai-widget-panel { position: fixed; right: 20px; bottom: 90px; width: 350px; height: 500px; background: #111217; color: #fff; border-radius: 14px; box-shadow: 0 18px 40px rgba(0,0,0,.45); overflow: hidden; display: none; flex-direction: column; z-index: 2147483000; }
    .dab-ai-widget-header { background: ${primaryColor}; padding: 12px 14px; font-family: Inter, sans-serif; font-size: 14px; font-weight: 600; }
    .dab-ai-widget-messages { flex: 1; overflow-y: auto; padding: 12px; background: #151722; display: flex; flex-direction: column; gap: 8px; }
    .dab-ai-msg { max-width: 85%; padding: 10px 12px; border-radius: 12px; font: 13px/1.4 Inter, sans-serif; white-space: pre-wrap; }
    .dab-ai-msg-client { align-self: flex-end; background: ${primaryColor}; color: #fff; border-bottom-right-radius: 4px; }
    .dab-ai-msg-agent { align-self: flex-start; background: #222538; color: #f5f7ff; border-bottom-left-radius: 4px; }
    .dab-ai-widget-input-wrap { display: flex; gap: 8px; padding: 10px; background: #111217; border-top: 1px solid rgba(255,255,255,.08); }
    .dab-ai-widget-input { flex: 1; border: 1px solid rgba(255,255,255,.12); background: #0c0d13; color: #fff; border-radius: 8px; padding: 10px; font: 13px Inter, sans-serif; }
    .dab-ai-widget-send { border: none; border-radius: 8px; background: ${primaryColor}; color: #fff; padding: 0 14px; font: 12px Inter, sans-serif; cursor: pointer; }
    .dab-ai-widget-footer { font: 11px Inter, sans-serif; color: #9da3b0; text-align: center; padding: 8px; border-top: 1px solid rgba(255,255,255,.05); background: #0f1016; }
  `;
  document.head.appendChild(style);

  const button = document.createElement('button');
  button.className = 'dab-ai-widget-btn';
  button.innerHTML = '💬';

  const panel = document.createElement('div');
  panel.className = 'dab-ai-widget-panel';
  panel.innerHTML = `
    <div class="dab-ai-widget-header">${agencyName} — We reply instantly 🟢</div>
    <div class="dab-ai-widget-messages"></div>
    <div class="dab-ai-widget-input-wrap">
      <input class="dab-ai-widget-input" placeholder="Type your message..." />
      <button class="dab-ai-widget-send">Send</button>
    </div>
    <div class="dab-ai-widget-footer">Powered by DAB AI</div>
  `;

  document.body.appendChild(button);
  document.body.appendChild(panel);

  const messagesEl = panel.querySelector('.dab-ai-widget-messages');
  const inputEl = panel.querySelector('.dab-ai-widget-input');
  const sendEl = panel.querySelector('.dab-ai-widget-send');

  function addMessage(text, role) {
    const item = document.createElement('div');
    item.className = `dab-ai-msg ${role === 'client' ? 'dab-ai-msg-client' : 'dab-ai-msg-agent'}`;
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
    if (!sessionId || !accessToken) return;

    try {
      const params = new URLSearchParams({
        since: String(lastMessageId),
        accessToken,
      });
      if (widgetId) params.set('widgetId', widgetId);
      else params.set('agencyId', agencyId);

      const response = await fetch(`${baseUrl}/api/widget/messages/${encodeURIComponent(sessionId)}?${params.toString()}`);
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
    if (sessionId && accessToken) return;
    if (sessionId && !accessToken) {
      localStorage.removeItem(storageKey);
      sessionId = null;
    }

    const data = await api('/api/widget/session', {
      sessionId,
      accessToken,
      widgetId,
      agencyId,
      agencyName,
      greeting,
      visitorName: cfg.visitorName || 'Website Visitor',
    });

    sessionId = data.sessionId;
    accessToken = data.accessToken;
    localStorage.setItem(storageKey, sessionId);
    localStorage.setItem(accessTokenKey, accessToken);

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
        accessToken,
        widgetId,
        agencyId,
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
  panel.querySelector('.dab-ai-widget-header').addEventListener('dblclick', closeWidget);
  sendEl.addEventListener('click', sendMessage);
  inputEl.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
      sendMessage();
    }
  });
})();
