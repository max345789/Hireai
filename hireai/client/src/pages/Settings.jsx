import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, Save, Upload, Smartphone, Mail, MessageCircleMore,
  Copy, TestTube2, Unplug, ShieldBan, Calendar, Loader2,
  Bell, Palette, Zap, Heart, Users, Eye, EyeOff, RefreshCw, KeyRound,
  Lock, UserCog, ShieldCheck, AtSign,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../lib/api';

const defaultForm = {
  agencyName: '',
  twilioKey: '',
  gmailConfig: '',
  listingsData: '',
  agentPersonality: '',
  logoUrl: '',
  accentColor: '#f97316',
  slackWebhook: '',
  notificationPrefs: {
    newLead: true,
    escalation: true,
    booking: true,
    dailyDigest: false,
  },
};

/* ── Shared UI pieces ──────────────────────────────────────────────────── */

function StatusPill({ active }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${active ? 'text-emerald-600' : 'text-rose-500'}`}>
      <span className={`h-2 w-2 rounded-full ${active ? 'bg-emerald-400' : 'bg-rose-400'}`} />
      {active ? 'Connected' : 'Disconnected'}
    </span>
  );
}

function ChannelRow({ icon: Icon, label, subtitle, active, onTest, onDisconnect, onCopyEmbed, onPreview }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Icon className="h-4 w-4 text-gray-400" />
            {label}
          </p>
          <p className="text-xs text-gray-400">{subtitle}</p>
        </div>
        <StatusPill active={active} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {onTest && (
          <button
            type="button"
            onClick={onTest}
            className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-500 transition hover:text-gray-900"
          >
            <TestTube2 className="h-3.5 w-3.5" />
            Test
          </button>
        )}
        {onDisconnect && (
          <button
            type="button"
            onClick={onDisconnect}
            className="inline-flex items-center gap-1 rounded-xl border border-rose-100 bg-rose-50 px-3 py-1.5 text-xs text-rose-600 transition hover:bg-rose-100"
          >
            <Unplug className="h-3.5 w-3.5" />
            Disconnect
          </button>
        )}
        {onCopyEmbed && (
          <button
            type="button"
            onClick={onCopyEmbed}
            className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-500 transition hover:text-gray-900"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy Embed Code
          </button>
        )}
        {onPreview && (
          <button
            type="button"
            onClick={onPreview}
            className="inline-flex items-center gap-1 rounded-xl border border-accent/30 bg-orange-50 px-3 py-1.5 text-xs text-accent transition hover:bg-orange-100"
          >
            <MessageCircleMore className="h-3.5 w-3.5" />
            Preview
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Main component ────────────────────────────────────────────────────── */

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [channels, setChannels] = useState(null);
  const [blocked, setBlocked] = useState([]);
  const [blockInput, setBlockInput] = useState('');
  const [calStatus, setCalStatus] = useState({ connected: false, hasServerCreds: false });
  const [calLoading, setCalLoading] = useState(false);
  const [widgetCreds, setWidgetCreds] = useState({ widgetId: null, widgetSecret: null });
  const [showSecret, setShowSecret] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentEmail, setCurrentEmail] = useState('');

  // Change password form
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [showPw, setShowPw] = useState({ current: false, next: false });

  // Change email form
  const [emailForm, setEmailForm] = useState({ newEmail: '', password: '' });
  const [emailSaving, setEmailSaving] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);

  function showToast(msg, type = 'info') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 5000);
  }

  /* Handle OAuth redirect params (calendar_connected / calendar_error) */
  useEffect(() => {
    const connected = searchParams.get('calendar_connected');
    const calError  = searchParams.get('calendar_error');
    if (connected) {
      setCalStatus((s) => ({ ...s, connected: true }));
      showToast('Google Calendar connected successfully! 🎉', 'success');
      setSearchParams({});
    } else if (calError) {
      showToast(`Calendar connection failed: ${calError}`, 'error');
      setSearchParams({});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* Load initial data */
  useEffect(() => {
    async function load() {
      try {
        const [settingsData, channelData, blockedData, calData] = await Promise.all([
          apiRequest('/settings'),
          apiRequest('/channels/status'),
          apiRequest('/blocked'),
          apiRequest('/calendar/status'),
        ]);

        const s = settingsData.settings || {};
        let notifPrefs = defaultForm.notificationPrefs;
        try { notifPrefs = JSON.parse(s.notificationPrefs || '{}'); } catch {}
        setIsAdmin(s.role === 'admin');
        setCurrentEmail(s.email || '');
        setWidgetCreds({ widgetId: s.widgetId || null, widgetSecret: s.widgetSecret || null });
        setForm({
          agencyName:       s.agencyName       || '',
          twilioKey:        s.twilioKey        || '',
          gmailConfig:      s.gmailConfig      || '',
          listingsData:     s.listingsData     || '',
          agentPersonality: s.agentPersonality || '',
          logoUrl:          s.logoUrl          || '',
          accentColor:      s.accentColor      || '#f97316',
          slackWebhook:     s.slackWebhook     || '',
          notificationPrefs: { ...defaultForm.notificationPrefs, ...notifPrefs },
        });
        setChannels(channelData);
        setBlocked(blockedData.items || []);
        setCalStatus(calData);
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
    load();
  }, []);

  const status = useMemo(() => ({
    twilio:   Boolean(form.twilioKey),
    gmail:    Boolean(form.gmailConfig),
    calendar: calStatus.connected,
    listings: Boolean(form.listingsData),
  }), [form, calStatus]);

  const embedCode = useMemo(() => {
    const base = window.location.origin.replace(':3000', ':3001');
    const wid = widgetCreds.widgetId || 'YOUR_WIDGET_ID';
    return `<script>
  window.HireAIConfig = {
    widgetId: "${wid}",
    agencyName: "${form.agencyName || 'Dream Properties'}",
    primaryColor: "${form.accentColor || '#f97316'}",
    greeting: "Hi! Looking for your dream property? I can help 24/7 🏠",
    baseUrl: "${base}"
  };
</script>
<script src="${base}/widget.js"></script>`;
  }, [form.agencyName, form.accentColor, widgetCreds.widgetId]);

  function setField(field) {
    return (value) => setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleCsvUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setField('listingsData')(String(reader.result || ''));
    reader.readAsText(file);
  }

  async function saveSettings(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await apiRequest('/settings', { method: 'PATCH', body: JSON.stringify(form) });
      showToast('Settings saved.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function testChannel(channel) {
    const to = window.prompt(`Enter destination for ${channel} test (phone or email):`);
    if (!to) return;
    try {
      await apiRequest(`/channels/test/${channel}`, { method: 'POST', body: JSON.stringify({ to }) });
      showToast(`${channel} test triggered.`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function disconnectChannel(channel) {
    try {
      await apiRequest(`/channels/disconnect/${channel}`, { method: 'POST' });
      showToast(`${channel} disconnected.`, 'info');
      const data = await apiRequest('/channels/status');
      setChannels(data);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function connectCalendar() {
    setCalLoading(true);
    try {
      const data = await apiRequest('/calendar/oauth/url');
      window.location.href = data.url;
    } catch (err) {
      showToast(err.message, 'error');
      setCalLoading(false);
    }
  }

  async function disconnectCalendar() {
    setCalLoading(true);
    try {
      await apiRequest('/calendar/disconnect', { method: 'POST' });
      setCalStatus((s) => ({ ...s, connected: false }));
      showToast('Google Calendar disconnected.', 'info');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setCalLoading(false);
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
      showToast('Number blocked.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function copyEmbedCode() {
    await navigator.clipboard.writeText(embedCode);
    showToast('Embed code copied to clipboard.', 'success');
  }

  async function copyToClipboard(text, label) {
    await navigator.clipboard.writeText(text);
    showToast(`${label} copied.`, 'success');
  }

  async function changePassword(e) {
    e.preventDefault();
    if (pwForm.next !== pwForm.confirm) { showToast('New passwords do not match.', 'error'); return; }
    if (pwForm.next.length < 8) { showToast('New password must be at least 8 characters.', 'error'); return; }
    setPwSaving(true);
    try {
      await apiRequest('/auth/password', {
        method: 'PATCH',
        body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.next }),
      });
      setPwForm({ current: '', next: '', confirm: '' });
      showToast('Password updated successfully.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setPwSaving(false);
    }
  }

  async function changeEmail(e) {
    e.preventDefault();
    setEmailSaving(true);
    try {
      const data = await apiRequest('/auth/email', {
        method: 'PATCH',
        body: JSON.stringify({ newEmail: emailForm.newEmail, password: emailForm.password }),
      });
      if (data.token) localStorage.setItem('token', data.token);
      setCurrentEmail(data.user?.email || emailForm.newEmail);
      setEmailForm({ newEmail: '', password: '' });
      setShowEmailForm(false);
      showToast('Email updated. Please log in again if prompted.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setEmailSaving(false);
    }
  }

  async function regenerateSecret() {
    if (!window.confirm('Rotate widget secret? Your old secret will stop working immediately. Update your widget embed code after.')) return;
    setRegenerating(true);
    try {
      const data = await apiRequest('/widget-credentials/regenerate', { method: 'POST' });
      setWidgetCreds({ widgetId: data.widgetId, widgetSecret: data.widgetSecret });
      setShowSecret(true);
      showToast('Widget secret rotated. Update your embed code.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setRegenerating(false);
    }
  }

  function previewWidget() {
    const widgetBase = window.location.origin.replace(':3000', ':3001');
    const win = window.open('', '_blank', 'width=420,height=700');
    if (!win) return;
    const wid = widgetCreds.widgetId || 'YOUR_WIDGET_ID';
    const cfg = `window.HireAIConfig={widgetId:'${wid}',agencyName:'${
      (form.agencyName || 'Dream Properties').replace(/'/g, "\\'")
    }',primaryColor:'${form.accentColor || '#f97316'}',greeting:'Hi! Looking for your dream property? I can help 24/7 🏠',baseUrl:'${widgetBase}'};`;
    const escaped = embedCode.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    win.document.write(
      `<html><body style="font-family:Inter,sans-serif;background:#f2f2f2;color:#1a1a1a;padding:20px;">
        <h3>Widget Preview</h3>
        <pre style="background:#fff;padding:12px;border-radius:12px;border:1px solid #e5e7eb;white-space:pre-wrap;font-size:11px;">${escaped}</pre>
        <script>${cfg}<\/script>
        <script src="${widgetBase}/widget.js"><\/script>
      </body></html>`
    );
  }

  const toastStyle = {
    success: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    error:   'border-rose-100   bg-rose-50   text-rose-700',
    info:    'border-orange-100 bg-orange-50 text-orange-700',
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-4">

        {/* ── Header ── */}
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-white px-5 py-3.5 shadow-card">
          <div>
            <h1 className="font-heading text-xl font-bold text-gray-900">Settings</h1>
            <p className="text-xs text-gray-400">Connect channels, manage widget, and tune agent behaviour</p>
          </div>
          <Link
            to="/inbox"
            className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500 transition hover:text-gray-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Dashboard
          </Link>
        </header>

        {/* ── Toast ── */}
        {toast && (
          <div className={`rounded-2xl border px-4 py-2.5 text-sm ${toastStyle[toast.type] || toastStyle.info}`}>
            {toast.msg}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">

          {/* ── Account & Security card (above form) ── */}
          <div className="rounded-3xl bg-white p-5 shadow-card">
            <h2 className="mb-4 inline-flex items-center gap-2 text-base font-semibold text-gray-900">
              <ShieldCheck className="h-4 w-4 text-orange-400" />
              Account &amp; Security
              {isAdmin && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-orange-600 border border-orange-100">
                  <UserCog className="h-3 w-3" />
                  Owner / Admin
                </span>
              )}
            </h2>

            {/* Current email + change */}
            <div className="mb-4 rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Login Email</p>
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
                    <AtSign className="h-3.5 w-3.5 text-gray-400" />
                    {currentEmail || '—'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEmailForm((v) => !v)}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-500 transition hover:text-gray-900"
                >
                  Change Email
                </button>
              </div>

              {showEmailForm && (
                <form onSubmit={changeEmail} className="mt-4 space-y-3 border-t border-gray-100 pt-3">
                  <label className="block text-xs font-medium text-gray-500">
                    New Email Address
                    <input
                      type="email"
                      required
                      value={emailForm.newEmail}
                      onChange={(e) => setEmailForm((f) => ({ ...f, newEmail: e.target.value }))}
                      className="mt-1.5 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-400"
                    />
                  </label>
                  <label className="block text-xs font-medium text-gray-500">
                    Confirm with Current Password
                    <input
                      type="password"
                      required
                      value={emailForm.password}
                      onChange={(e) => setEmailForm((f) => ({ ...f, password: e.target.value }))}
                      className="mt-1.5 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-400"
                    />
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={emailSaving}
                      className="inline-flex items-center gap-1.5 rounded-2xl bg-orange-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-orange-600 disabled:opacity-60"
                    >
                      {emailSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      Save Email
                    </button>
                    <button type="button" onClick={() => setShowEmailForm(false)} className="rounded-2xl border border-gray-200 px-3 py-2 text-xs text-gray-500 hover:text-gray-900">
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Change password */}
            <form onSubmit={changePassword} className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-3">
              <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900">
                <Lock className="h-4 w-4 text-gray-400" />
                Change Password
              </h3>
              <label className="block text-xs font-medium text-gray-500">
                Current Password
                <div className="relative mt-1.5">
                  <input
                    type={showPw.current ? 'text' : 'password'}
                    required
                    value={pwForm.current}
                    onChange={(e) => setPwForm((f) => ({ ...f, current: e.target.value }))}
                    className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2.5 pr-9 text-sm text-gray-900 outline-none focus:border-orange-400"
                  />
                  <button type="button" onClick={() => setShowPw((s) => ({ ...s, current: !s.current }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700">
                    {showPw.current ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-xs font-medium text-gray-500">
                  New Password
                  <div className="relative mt-1.5">
                    <input
                      type={showPw.next ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={pwForm.next}
                      onChange={(e) => setPwForm((f) => ({ ...f, next: e.target.value }))}
                      className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2.5 pr-9 text-sm text-gray-900 outline-none focus:border-orange-400"
                    />
                    <button type="button" onClick={() => setShowPw((s) => ({ ...s, next: !s.next }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700">
                      {showPw.next ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </label>
                <label className="block text-xs font-medium text-gray-500">
                  Confirm New Password
                  <input
                    type="password"
                    required
                    value={pwForm.confirm}
                    onChange={(e) => setPwForm((f) => ({ ...f, confirm: e.target.value }))}
                    className="mt-1.5 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-400"
                  />
                </label>
              </div>
              <button
                type="submit"
                disabled={pwSaving}
                className="inline-flex items-center gap-1.5 rounded-2xl bg-orange-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-orange-600 disabled:opacity-60"
              >
                {pwSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
                Update Password
              </button>
            </form>
          </div>

          {/* ── Main form ── */}
          <form onSubmit={saveSettings} className="space-y-5 rounded-3xl bg-white p-5 shadow-card">
            <h2 className="text-base font-semibold text-gray-900">Agency Settings</h2>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                { label: 'Agency Name',       field: 'agencyName',   placeholder: '' },
                { label: 'Logo URL',          field: 'logoUrl',      placeholder: 'https://...' },
                { label: 'Twilio API Key',    field: 'twilioKey',    placeholder: '' },
                { label: 'Gmail SMTP Config', field: 'gmailConfig',  placeholder: 'smtp-user|smtp-pass' },
              ].map(({ label, field, placeholder }) => (
                <label key={field} className="block text-xs font-medium text-gray-500">
                  {label}
                  <input
                    value={form[field]}
                    onChange={(e) => setField(field)(e.target.value)}
                    placeholder={placeholder}
                    className="mt-1.5 w-full rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-accent focus:bg-white"
                  />
                </label>
              ))}
            </div>

            {/* ── Google Calendar connect box ── */}
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-orange-50">
                    <Calendar className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Google Calendar</p>
                    <p className="text-xs text-gray-400">Sync viewings and block busy slots in real time</p>
                  </div>
                </div>
                <StatusPill active={calStatus.connected} />
              </div>

              <div className="mt-4">
                {calStatus.connected ? (
                  <button
                    type="button"
                    onClick={disconnectCalendar}
                    disabled={calLoading}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-rose-100 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-100 disabled:opacity-50"
                  >
                    {calLoading
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Unplug className="h-3.5 w-3.5" />}
                    Disconnect Calendar
                  </button>
                ) : calStatus.hasServerCreds ? (
                  <button
                    type="button"
                    onClick={connectCalendar}
                    disabled={calLoading}
                    className="inline-flex items-center gap-1.5 rounded-2xl bg-accent px-4 py-2 text-xs font-semibold text-white shadow-glow transition hover:opacity-90 disabled:opacity-50"
                  >
                    {calLoading
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Calendar className="h-3.5 w-3.5" />}
                    Connect Google Calendar
                  </button>
                ) : (
                  <p className="text-xs text-gray-400">
                    Add{' '}
                    <code className="rounded bg-gray-200 px-1 py-0.5 text-[11px]">GOOGLE_CLIENT_ID</code>
                    {' '}and{' '}
                    <code className="rounded bg-gray-200 px-1 py-0.5 text-[11px]">GOOGLE_CLIENT_SECRET</code>
                    {' '}to your server environment to enable Calendar sync.
                  </p>
                )}
              </div>
            </div>

            {/* Listings */}
            <label className="block text-xs font-medium text-gray-500">
              Listings Database (CSV text or manual entries)
              <textarea
                rows={5}
                value={form.listingsData}
                onChange={(e) => setField('listingsData')(e.target.value)}
                className="mt-1.5 w-full rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-accent focus:bg-white"
              />
            </label>

            {/* Agent personality */}
            <label className="block text-xs font-medium text-gray-500">
              Custom Agent Personality
              <textarea
                rows={4}
                value={form.agentPersonality}
                onChange={(e) => setField('agentPersonality')(e.target.value)}
                className="mt-1.5 w-full rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-accent focus:bg-white"
              />
            </label>

            {/* ── Branding ── */}
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <h3 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-gray-900">
                <Palette className="h-4 w-4 text-gray-400" />
                Branding & Appearance
              </h3>
              <div className="flex items-center gap-4">
                <label className="block flex-1 text-xs font-medium text-gray-500">
                  Accent Color
                  <div className="mt-1.5 flex items-center gap-2">
                    <input
                      type="color"
                      value={form.accentColor || '#f97316'}
                      onChange={(e) => setField('accentColor')(e.target.value)}
                      className="h-9 w-12 cursor-pointer rounded-xl border border-gray-200"
                    />
                    <input
                      value={form.accentColor || '#f97316'}
                      onChange={(e) => setField('accentColor')(e.target.value)}
                      placeholder="#f97316"
                      className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-accent"
                    />
                  </div>
                </label>
              </div>
            </div>

            {/* ── Slack Notifications ── */}
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <h3 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-gray-900">
                <Bell className="h-4 w-4 text-gray-400" />
                Slack Notifications
              </h3>
              <label className="block text-xs font-medium text-gray-500">
                Slack Webhook URL
                <input
                  value={form.slackWebhook}
                  onChange={(e) => setField('slackWebhook')(e.target.value)}
                  placeholder="https://hooks.slack.com/services/..."
                  className="mt-1.5 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-accent"
                />
              </label>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {Object.entries(form.notificationPrefs || {}).map(([key, val]) => (
                  <label key={key} className="flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2">
                    <input
                      type="checkbox"
                      checked={Boolean(val)}
                      onChange={(e) => setForm((prev) => ({
                        ...prev,
                        notificationPrefs: { ...prev.notificationPrefs, [key]: e.target.checked },
                      }))}
                      className="accent-orange-500"
                    />
                    <span className="text-xs text-gray-600">
                      {key === 'newLead' ? 'New Lead' :
                       key === 'escalation' ? 'Escalations' :
                       key === 'booking' ? 'Bookings' :
                       key === 'dailyDigest' ? 'Daily Digest' : key}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500 transition hover:text-gray-900">
                <Upload className="h-3.5 w-3.5" />
                Upload CSV
                <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleCsvUpload} />
              </label>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-2xl bg-accent px-4 py-2 text-xs font-semibold text-white shadow-glow transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? 'Saving…' : 'Save Settings'}
              </button>
            </div>
          </form>

          {/* ── Sidebar ── */}
          <aside className="space-y-4">

            {/* Connected channels */}
            <section className="space-y-2 rounded-3xl bg-white p-5 shadow-card">
              <h2 className="mb-1 text-base font-semibold text-gray-900">Connected Channels</h2>
              <ChannelRow
                icon={Smartphone}
                label="WhatsApp"
                subtitle={`${channels?.whatsapp?.number || 'No number'} · Last: ${channels?.whatsapp?.lastMessage || 'never'}`}
                active={Boolean(channels?.whatsapp?.configured)}
                onTest={() => testChannel('whatsapp')}
                onDisconnect={() => disconnectChannel('whatsapp')}
              />
              <ChannelRow
                icon={Mail}
                label="Email"
                subtitle={`${channels?.email?.address || 'No sender'} · Last: ${channels?.email?.lastMessage || 'never'}`}
                active={Boolean(channels?.email?.configured)}
                onTest={() => testChannel('email')}
                onDisconnect={() => disconnectChannel('email')}
              />
              <ChannelRow
                icon={MessageCircleMore}
                label="Web Widget"
                subtitle={`${channels?.web?.activeSessions || 0} active · ${channels?.web?.totalChats || 0} total chats`}
                active
                onTest={() => testChannel('web')}
                onCopyEmbed={copyEmbedCode}
                onPreview={previewWidget}
              />
            </section>

            {/* Widget Credentials */}
            <section className="rounded-3xl bg-white p-5 shadow-card">
              <h3 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-gray-900">
                <KeyRound className="h-4 w-4 text-gray-400" />
                Widget Credentials
              </h3>

              {/* Widget ID */}
              <div className="mb-3">
                <p className="mb-1 text-xs font-medium text-gray-500">Widget ID <span className="font-normal text-gray-400">(public — safe to share)</span></p>
                <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2">
                  <code className="flex-1 truncate text-xs text-gray-700">{widgetCreds.widgetId || '—'}</code>
                  {widgetCreds.widgetId && (
                    <button type="button" onClick={() => copyToClipboard(widgetCreds.widgetId, 'Widget ID')} className="text-gray-400 hover:text-gray-700">
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Widget Secret — admin only */}
              {isAdmin ? (
                <>
                  <div className="mb-3">
                    <p className="mb-1 text-xs font-medium text-gray-500">Widget Secret <span className="font-normal text-gray-400">(admin only — keep private)</span></p>
                    <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2">
                      <code className="flex-1 truncate text-xs text-gray-700">
                        {widgetCreds.widgetSecret
                          ? (showSecret ? widgetCreds.widgetSecret : `${widgetCreds.widgetSecret.slice(0, 12)}${'•'.repeat(20)}`)
                          : '—'}
                      </code>
                      <button type="button" onClick={() => setShowSecret((s) => !s)} className="text-gray-400 hover:text-gray-700">
                        {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                      {widgetCreds.widgetSecret && (
                        <button type="button" onClick={() => copyToClipboard(widgetCreds.widgetSecret, 'Widget Secret')} className="text-gray-400 hover:text-gray-700">
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={regenerateSecret}
                    disabled={regenerating}
                    className="mb-4 inline-flex items-center gap-1.5 rounded-xl border border-amber-100 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 transition hover:bg-amber-100 disabled:opacity-50"
                  >
                    {regenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    Rotate Secret
                  </button>
                </>
              ) : (
                <p className="mb-4 rounded-2xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-400">
                  Widget secret is only visible to account admins.
                </p>
              )}

              {/* Embed snippet */}
              <p className="mb-1.5 text-xs font-medium text-gray-500">Embed Code</p>
              <textarea
                readOnly
                rows={9}
                value={embedCode}
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs text-gray-700 outline-none"
              />
            </section>

            {/* Blocked numbers */}
            <section className="rounded-3xl bg-white p-5 shadow-card">
              <h3 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-gray-900">
                <ShieldBan className="h-4 w-4 text-gray-400" />
                Blocked Numbers
              </h3>
              <div className="flex gap-2">
                <input
                  value={blockInput}
                  onChange={(e) => setBlockInput(e.target.value)}
                  placeholder="+1555000000"
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-accent"
                />
                <button
                  type="button"
                  onClick={blockNumber}
                  className="rounded-2xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600 transition hover:bg-rose-100"
                >
                  Block
                </button>
              </div>
              <div className="mt-2 max-h-[120px] space-y-1 overflow-auto pr-1">
                {blocked.length === 0 ? (
                  <p className="text-xs text-gray-400">No blocked numbers</p>
                ) : (
                  blocked.map((item) => (
                    <p key={item.id} className="text-xs text-gray-600">
                      {item.phone}{' '}
                      <span className="text-gray-400">({item.reason || 'No reason'})</span>
                    </p>
                  ))
                )}
              </div>
            </section>

            {/* Connection status summary */}
            <section className="rounded-3xl bg-white p-5 shadow-card">
              <h2 className="mb-3 text-sm font-semibold text-gray-900">Connection Status</h2>
              {[
                { label: 'WhatsApp (Twilio)',  active: status.twilio },
                { label: 'Email (Gmail SMTP)', active: status.gmail },
                { label: 'Google Calendar',    active: status.calendar },
                { label: 'Listings Database',  active: status.listings },
                { label: 'Web Widget',         active: true },
                { label: 'Slack Alerts',       active: Boolean(form.slackWebhook) },
              ].map(({ label, active }) => (
                <div
                  key={label}
                  className="mb-1.5 flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2 last:mb-0"
                >
                  <span className="text-xs text-gray-500">{label}</span>
                  <StatusPill active={active} />
                </div>
              ))}
            </section>

            {/* Owner Permissions card */}
            <section className="rounded-3xl bg-white p-5 shadow-card">
              <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-gray-900">
                <ShieldCheck className="h-4 w-4 text-orange-400" />
                What You Control
              </h2>

              <div className="mb-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-orange-500">Owner / Admin Only</p>
                <div className="space-y-1.5">
                  {[
                    'Change login email & password',
                    'View & rotate widget secret',
                    'Connect / disconnect channels',
                    'Configure integrations (Twilio, Gmail, Meta)',
                    'Manage billing & subscription',
                    'Select & configure AI agents',
                    'Block / unblock numbers',
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-2 rounded-xl bg-orange-50 border border-orange-100 px-3 py-1.5">
                      <ShieldCheck className="mt-0.5 h-3 w-3 flex-shrink-0 text-orange-400" />
                      <span className="text-[11px] text-gray-700">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Changeable by Any User</p>
                <div className="space-y-1.5">
                  {[
                    'Agency name & logo',
                    'Branding & accent colour',
                    'Slack notification preferences',
                    'Listings database (CSV)',
                    'Agent personality prompt',
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-2 rounded-xl bg-gray-50 border border-gray-100 px-3 py-1.5">
                      <span className="mt-0.5 h-3 w-3 flex-shrink-0 text-gray-300">–</span>
                      <span className="text-[11px] text-gray-500">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Agent Selector Quick Switch */}
            <section className="rounded-3xl bg-white p-5 shadow-card">
              <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-gray-900">
                <Users className="h-4 w-4 text-gray-400" />
                AI Agent
              </h2>
              <div className="space-y-1.5">
                {[
                  { id: 'salesbot',   label: 'Aria', desc: 'Qualifies & converts',  Icon: Zap },
                  { id: 'bookingbot', label: 'Cal',  desc: 'Books viewings',         Icon: Calendar },
                  { id: 'nurturebot', label: 'Ivy',  desc: 'Nurtures cold leads',    Icon: Heart },
                ].map(({ id, label, desc, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={async () => {
                      try {
                        await apiRequest('/agent-selector', { method: 'POST', body: JSON.stringify({ agentId: id }) });
                        showToast(`Switched to ${label}`, 'success');
                      } catch (err) { showToast(err.message, 'error'); }
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 px-3 py-2.5 text-left transition hover:border-orange-200 hover:bg-orange-50"
                  >
                    <Icon className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-xs font-semibold text-gray-700">{label}</p>
                      <p className="text-[10px] text-gray-400">{desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </section>

          </aside>
        </div>
      </div>
    </div>
  );
}
