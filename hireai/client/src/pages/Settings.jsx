import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Save, Upload, Smartphone, Mail, MessageCircleMore, Copy, TestTube2, Unplug, ShieldBan } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../lib/api';

const defaultState = {
  agencyName: '',
  twilioKey: '',
  gmailConfig: '',
  calendarConfig: '',
  listingsData: '',
  agentPersonality: '',
  logoUrl: '',
};

function StatusPill({ active }) {
  return (
    <span className={`inline-flex items-center gap-2 text-xs ${active ? 'text-emerald-300' : 'text-rose-300'}`}>
      <span className={`h-2.5 w-2.5 rounded-full ${active ? 'bg-emerald-400' : 'bg-rose-400'}`} />
      {active ? 'Connected' : 'Not Connected'}
    </span>
  );
}

function ChannelRow({ icon: Icon, label, subtitle, active, onTest, onDisconnect, onCopyEmbed, onPreview }) {
  return (
    <div className="rounded-xl border border-white/10 bg-surface/70 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-white">
            <Icon className="h-4 w-4" />
            {label}
          </p>
          <p className="text-xs text-textSoft">{subtitle}</p>
        </div>
        <StatusPill active={active} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {onTest && (
          <button
            type="button"
            onClick={onTest}
            className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-bg px-3 py-1.5 text-xs text-textSoft hover:text-white"
          >
            <TestTube2 className="h-3.5 w-3.5" />
            Test
          </button>
        )}
        {onDisconnect && (
          <button
            type="button"
            onClick={onDisconnect}
            className="inline-flex items-center gap-1 rounded-lg border border-rose-400/25 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-200 hover:bg-rose-500/20"
          >
            <Unplug className="h-3.5 w-3.5" />
            Disconnect
          </button>
        )}
        {onCopyEmbed && (
          <button
            type="button"
            onClick={onCopyEmbed}
            className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-bg px-3 py-1.5 text-xs text-textSoft hover:text-white"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy Embed Code
          </button>
        )}
        {onPreview && (
          <button
            type="button"
            onClick={onPreview}
            className="inline-flex items-center gap-1 rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs text-violet-200 hover:bg-accent/20"
          >
            <MessageCircleMore className="h-3.5 w-3.5" />
            Preview
          </button>
        )}
      </div>
    </div>
  );
}

export default function Settings() {
  const [form, setForm] = useState(defaultState);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [channels, setChannels] = useState(null);
  const [blocked, setBlocked] = useState([]);
  const [blockInput, setBlockInput] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [settingsData, channelData, blockedData] = await Promise.all([
          apiRequest('/settings'),
          apiRequest('/channels/status'),
          apiRequest('/blocked'),
        ]);

        const settings = settingsData.settings || {};
        setForm({
          agencyName: settings.agencyName || '',
          twilioKey: settings.twilioKey || '',
          gmailConfig: settings.gmailConfig || '',
          calendarConfig: settings.calendarConfig || '',
          listingsData: settings.listingsData || '',
          agentPersonality: settings.agentPersonality || '',
          logoUrl: settings.logoUrl || '',
        });
        setChannels(channelData);
        setBlocked(blockedData.items || []);
      } catch (error) {
        setMessage(error.message);
      }
    }

    load();
  }, []);

  const status = useMemo(
    () => ({
      twilio: Boolean(form.twilioKey),
      gmail: Boolean(form.gmailConfig),
      calendar: Boolean(form.calendarConfig),
      listings: Boolean(form.listingsData),
    }),
    [form]
  );

  const embedCode = useMemo(
    () => `<script>
  window.HireAIConfig = {
    agencyId: "${'YOUR_AGENCY_ID'}",
    agencyName: "${form.agencyName || 'Dream Properties'}",
    primaryColor: "#6C63FF",
    greeting: "Hi! Looking for your dream property? I can help 24/7 🏠",
    baseUrl: "${window.location.origin.replace(':3000', ':3001')}"
  };
</script>
<script src="${window.location.origin.replace(':3000', ':3001')}/widget.js"></script>`,
    [form.agencyName]
  );

  function onChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleCsvUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result || '');
      onChange('listingsData', content);
    };
    reader.readAsText(file);
  }

  async function saveSettings(event) {
    event.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      await apiRequest('/settings', {
        method: 'PATCH',
        body: JSON.stringify(form),
      });
      setMessage('Settings saved successfully.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function reloadChannels() {
    try {
      const data = await apiRequest('/channels/status');
      setChannels(data);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function testChannel(channel) {
    const to = window.prompt(`Enter destination for ${channel} test (phone or email):`);
    if (!to) return;

    try {
      await apiRequest(`/channels/test/${channel}`, {
        method: 'POST',
        body: JSON.stringify({ to }),
      });
      setMessage(`${channel} test triggered successfully.`);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function disconnectChannel(channel) {
    try {
      await apiRequest(`/channels/disconnect/${channel}`, { method: 'POST' });
      setMessage(`${channel} disconnected in app settings.`);
      await reloadChannels();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function blockNumber() {
    if (!blockInput.trim()) return;

    try {
      const data = await apiRequest('/blocked', {
        method: 'POST',
        body: JSON.stringify({ phone: blockInput.trim(), reason: 'Blocked from Settings' }),
      });
      setBlocked(data.items || []);
      setBlockInput('');
      setMessage('Number blocked successfully.');
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function copyEmbedCode() {
    await navigator.clipboard.writeText(embedCode);
    setMessage('Embed code copied.');
  }

  function previewWidget() {
    const win = window.open('', '_blank', 'width=420,height=700');
    if (!win) return;

    const escapedEmbed = embedCode.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const widgetBaseUrl = window.location.origin.replace(':3000', ':3001');
    const widgetConfigScript = `window.HireAIConfig={agencyId:'YOUR_AGENCY_ID',agencyName:'${(
      form.agencyName || 'Dream Properties'
    ).replace(/'/g, "\\'")}',primaryColor:'#6C63FF',greeting:'Hi! Looking for your dream property? I can help 24/7 🏠',baseUrl:'${widgetBaseUrl}'};`;
    win.document.write(`
      <html>
        <body style="font-family: Inter, sans-serif; background:#0A0A0F; color:#fff; padding:20px;">
          <h3>Widget Preview</h3>
          <p>Paste this on your site:</p>
          <pre style="background:#13131A;padding:12px;border-radius:8px;white-space:pre-wrap;">${escapedEmbed}</pre>
          <script>${widgetConfigScript}</script>
          <script src="${widgetBaseUrl}/widget.js"></script>
        </body>
      </html>
    `);
  }

  return (
    <div className="min-h-screen bg-bg p-4 text-white sm:p-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/5 bg-card/95 px-4 py-3">
          <div>
            <h1 className="font-heading text-2xl">Settings</h1>
            <p className="text-xs text-textSoft">Connect channels, manage widget, and tune agent behavior</p>
          </div>

          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-surface px-3 py-2 text-xs text-textSoft transition hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Dashboard
          </Link>
        </header>

        {message && (
          <div className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-2 text-sm text-slate-100">{message}</div>
        )}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
          <form onSubmit={saveSettings} className="space-y-4 rounded-2xl border border-white/5 bg-card/95 p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="text-xs text-textSoft">
                Agency Name
                <input
                  value={form.agencyName}
                  onChange={(event) => onChange('agencyName', event.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-bg px-3 py-2 text-sm text-white outline-none focus:border-accent"
                />
              </label>

              <label className="text-xs text-textSoft">
                Logo URL
                <input
                  value={form.logoUrl}
                  onChange={(event) => onChange('logoUrl', event.target.value)}
                  placeholder="https://..."
                  className="mt-1 w-full rounded-xl border border-white/10 bg-bg px-3 py-2 text-sm text-white outline-none focus:border-accent"
                />
              </label>

              <label className="text-xs text-textSoft">
                Twilio API Key
                <input
                  value={form.twilioKey}
                  onChange={(event) => onChange('twilioKey', event.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-bg px-3 py-2 text-sm text-white outline-none focus:border-accent"
                />
              </label>

              <label className="text-xs text-textSoft">
                Gmail SMTP Config
                <input
                  value={form.gmailConfig}
                  onChange={(event) => onChange('gmailConfig', event.target.value)}
                  placeholder="smtp-user|smtp-pass"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-bg px-3 py-2 text-sm text-white outline-none focus:border-accent"
                />
              </label>
            </div>

            <label className="block text-xs text-textSoft">
              Google Calendar OAuth JSON / Token
              <textarea
                rows={3}
                value={form.calendarConfig}
                onChange={(event) => onChange('calendarConfig', event.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-bg px-3 py-2 text-sm text-white outline-none focus:border-accent"
              />
            </label>

            <label className="block text-xs text-textSoft">
              Listings Database (CSV text or manual entries)
              <textarea
                rows={5}
                value={form.listingsData}
                onChange={(event) => onChange('listingsData', event.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-bg px-3 py-2 text-sm text-white outline-none focus:border-accent"
              />
            </label>

            <label className="block text-xs text-textSoft">
              Custom Agent Personality
              <textarea
                rows={4}
                value={form.agentPersonality}
                onChange={(event) => onChange('agentPersonality', event.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-bg px-3 py-2 text-sm text-white outline-none focus:border-accent"
              />
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-surface px-3 py-2 text-xs text-textSoft transition hover:text-white">
                <Upload className="h-3.5 w-3.5" />
                Upload CSV
                <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleCsvUpload} />
              </label>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </form>

          <aside className="space-y-4">
            <section className="space-y-2 rounded-2xl border border-white/5 bg-card/95 p-4">
              <h2 className="font-heading text-lg">Connected Channels</h2>

              <ChannelRow
                icon={Smartphone}
                label="WhatsApp"
                subtitle={`${channels?.whatsapp?.number || 'No number'} • Last: ${channels?.whatsapp?.lastMessage || 'never'}`}
                active={Boolean(channels?.whatsapp?.configured)}
                onTest={() => testChannel('whatsapp')}
                onDisconnect={() => disconnectChannel('whatsapp')}
              />

              <ChannelRow
                icon={Mail}
                label="Email"
                subtitle={`${channels?.email?.address || 'No sender'} • Last: ${channels?.email?.lastMessage || 'never'}`}
                active={Boolean(channels?.email?.configured)}
                onTest={() => testChannel('email')}
                onDisconnect={() => disconnectChannel('email')}
              />

              <ChannelRow
                icon={MessageCircleMore}
                label="Web Widget"
                subtitle={`${channels?.web?.activeSessions || 0} active • ${channels?.web?.totalChats || 0} total chats`}
                active
                onTest={() => testChannel('web')}
                onCopyEmbed={copyEmbedCode}
                onPreview={previewWidget}
              />
            </section>

            <section className="space-y-2 rounded-2xl border border-white/5 bg-card/95 p-4">
              <h3 className="font-heading text-base">Widget Embed Code</h3>
              <textarea
                readOnly
                rows={9}
                value={embedCode}
                className="w-full rounded-xl border border-white/10 bg-bg px-3 py-2 text-xs text-slate-200"
              />
            </section>

            <section className="space-y-2 rounded-2xl border border-white/5 bg-card/95 p-4">
              <h3 className="inline-flex items-center gap-2 font-heading text-base">
                <ShieldBan className="h-4 w-4" />
                Blocked Numbers
              </h3>
              <div className="flex gap-2">
                <input
                  value={blockInput}
                  onChange={(event) => setBlockInput(event.target.value)}
                  placeholder="+1555000000"
                  className="w-full rounded-xl border border-white/10 bg-bg px-3 py-2 text-sm text-white outline-none focus:border-accent"
                />
                <button
                  type="button"
                  onClick={blockNumber}
                  className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200"
                >
                  Block
                </button>
              </div>

              <div className="max-h-[120px] space-y-1 overflow-auto pr-1">
                {blocked.length === 0 ? (
                  <p className="text-xs text-textSoft">No blocked numbers</p>
                ) : (
                  blocked.map((item) => (
                    <p key={item.id} className="text-xs text-slate-300">
                      {item.phone} <span className="text-textSoft">({item.reason || 'No reason'})</span>
                    </p>
                  ))
                )}
              </div>
            </section>

            <section className="space-y-2 rounded-2xl border border-white/5 bg-card/95 p-4">
              <h2 className="font-heading text-lg">Connection Status</h2>
              <div className="flex items-center justify-between rounded-lg bg-surface/70 px-3 py-2 text-sm">
                <span className="text-textSoft">WhatsApp (Twilio)</span>
                <StatusPill active={status.twilio} />
              </div>
              <div className="flex items-center justify-between rounded-lg bg-surface/70 px-3 py-2 text-sm">
                <span className="text-textSoft">Email (Gmail SMTP)</span>
                <StatusPill active={status.gmail} />
              </div>
              <div className="flex items-center justify-between rounded-lg bg-surface/70 px-3 py-2 text-sm">
                <span className="text-textSoft">Calendar</span>
                <StatusPill active={status.calendar} />
              </div>
              <div className="flex items-center justify-between rounded-lg bg-surface/70 px-3 py-2 text-sm">
                <span className="text-textSoft">Listings Database</span>
                <StatusPill active={status.listings} />
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
