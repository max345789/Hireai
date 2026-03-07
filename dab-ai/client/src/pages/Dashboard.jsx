import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Send, Sparkles, MailPlus, X, Bell, CheckCircle2,
  MessageSquare, Mail, Globe, Bot, Zap, Users, Calendar,
  Settings, BarChart2, Inbox, RefreshCw, TrendingUp, Clock,
  Link2, Unlink, Copy, Check, Eye, EyeOff, ChevronDown,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import ConversationFeed from '../components/ConversationFeed';
import LeadPipeline from '../components/LeadPipeline';
import AgentActivityLog from '../components/AgentActivityLog';
import BookingsPanel from '../components/BookingsPanel';
import TakeoverButton from '../components/TakeoverButton';
import { apiRequest } from '../lib/api';
import { connectSocket, disconnectSocket } from '../lib/socket';

/* ─── helpers ─────────────────────────────────────────────── */
function upsertById(items, next, prepend = true) {
  const has = items.some((i) => Number(i.id) === Number(next.id));
  if (has) return items.map((i) => (Number(i.id) === Number(next.id) ? { ...i, ...next } : i));
  return prepend ? [next, ...items] : [...items, next];
}
const processedActions = new Set(['replied','qualified','booked','escalated','followed_up','needs_human']);

function fmtTime(ts) {
  if (!ts) return '';
  const d = new Date(String(ts).replace(' ', 'T'));
  if (isNaN(d)) return '';
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return d.toLocaleDateString([], { month:'short', day:'numeric' });
}

/* ─── Channel connect config ─────────────────────────────── */
const CHANNEL_CONNECT_CONFIG = {
  whatsapp: {
    label: 'WhatsApp',
    color: 'emerald',
    icon: MessageSquare,
    description: 'Connect via WhatsApp Business API',
    providers: ['Twilio', 'Meta Cloud API', '360dialog', 'Vonage'],
    fields: [
      { key: 'provider',   label: 'Provider',          type: 'select' },
      { key: 'accountSid', label: 'Account SID / App ID', type: 'text',     placeholder: 'AC...' },
      { key: 'authToken',  label: 'Auth Token / Secret', type: 'password',  placeholder: 'Your auth token' },
      { key: 'phone',      label: 'WhatsApp Number',    type: 'text',     placeholder: '+1 415 555 0000' },
    ],
  },
  email: {
    label: 'Email',
    color: 'sky',
    icon: Mail,
    description: 'Connect via SMTP or OAuth',
    providers: ['Gmail', 'Outlook / Office 365', 'Custom SMTP', 'SendGrid', 'Mailgun'],
    fields: [
      { key: 'provider',  label: 'Provider',      type: 'select' },
      { key: 'smtpHost',  label: 'SMTP Host',     type: 'text',     placeholder: 'smtp.gmail.com' },
      { key: 'smtpPort',  label: 'SMTP Port',     type: 'text',     placeholder: '587' },
      { key: 'username',  label: 'Email / Login', type: 'text',     placeholder: 'you@example.com' },
      { key: 'password',  label: 'Password / App Password', type: 'password', placeholder: '••••••••' },
      { key: 'fromName',  label: 'From Name',     type: 'text',     placeholder: 'DAB AI' },
    ],
  },
  web: {
    label: 'Web Chat',
    color: 'violet',
    icon: Globe,
    description: 'Embed the chat widget on your website',
    providers: [],
    fields: [
      { key: 'widgetTitle',   label: 'Widget Title',    type: 'text', placeholder: 'Chat with us' },
      { key: 'welcomeMsg',    label: 'Welcome Message', type: 'text', placeholder: 'Hi! How can we help?' },
      { key: 'primaryColor',  label: 'Primary Color',   type: 'color' },
    ],
    embed: true,
  },
};

const COLOR_MAP = {
  emerald: { bg:'bg-emerald-50', border:'border-emerald-100', text:'text-emerald-600', badge:'bg-emerald-100 text-emerald-700', btn:'bg-emerald-500 hover:bg-emerald-600' },
  sky:     { bg:'bg-sky-50',     border:'border-sky-100',     text:'text-sky-600',     badge:'bg-sky-100 text-sky-700',     btn:'bg-sky-500 hover:bg-sky-600' },
  violet:  { bg:'bg-violet-50',  border:'border-violet-100',  text:'text-violet-600',  badge:'bg-violet-100 text-violet-700',  btn:'bg-violet-500 hover:bg-violet-600' },
};

/* ─── Stat Card ──────────────────────────────────────────── */
const STAT_CONFIG = [
  { key:'whatsapp',  label:'WhatsApp',   icon:MessageSquare, bg:'bg-emerald-50',  border:'border-emerald-100', text:'text-emerald-600', dot:'bg-emerald-400', connectable: true },
  { key:'email',     label:'Email',       icon:Mail,          bg:'bg-sky-50',      border:'border-sky-100',     text:'text-sky-600',     dot:'bg-sky-400',     connectable: true },
  { key:'web',       label:'Web Chat',    icon:Globe,         bg:'bg-violet-50',   border:'border-violet-100',  text:'text-violet-600',  dot:'bg-violet-400',  connectable: true },
  { key:'aiReplies', label:'AI Replies',  icon:Bot,           bg:'bg-orange-50',   border:'border-orange-100',  text:'text-coral',       dot:'bg-coral' },
  { key:'qualified', label:'Qualified',   icon:Users,         bg:'bg-amber-50',    border:'border-amber-100',   text:'text-amber-600',   dot:'bg-amber-400' },
  { key:'booked',    label:'Booked',      icon:Calendar,      bg:'bg-teal-50',     border:'border-teal-100',    text:'text-teal-600',    dot:'bg-teal-400' },
];

function StatCard({ label, value, icon: Icon, bg, border, text, dot, connectable, connected, onConnect }) {
  return (
    <div className={`bento-card ${bg} border ${border} px-3 py-3 flex items-center gap-3 min-w-0 group relative`}>
      <div className="flex-shrink-0 h-9 w-9 rounded-xl bg-white shadow-xs flex items-center justify-center">
        <Icon className={`h-4 w-4 ${text}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`font-heading font-bold text-2xl leading-none tabular-nums ${text}`}>{value ?? 0}</p>
        <p className="mt-0.5 text-[11px] text-muted font-medium truncate">{label}</p>
      </div>
      {connectable && (
        <button
          onClick={onConnect}
          title={connected ? `${label} connected — click to manage` : `Connect ${label}`}
          className={`flex-shrink-0 flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold transition-all border
            ${connected
              ? 'bg-white border-current opacity-80 hover:opacity-100'
              : 'bg-white/70 border-dashed border-current hover:bg-white hover:opacity-100 opacity-60 group-hover:opacity-100'
            } ${text}`}
        >
          {connected
            ? <><CheckCircle2 className="h-3 w-3" /><span>Live</span></>
            : <><Link2 className="h-3 w-3" /><span>Connect</span></>
          }
        </button>
      )}
    </div>
  );
}

/* ─── Channel Connect Modal ──────────────────────────────── */
function ChannelConnectModal({ channel, saved, onSave, onDisconnect, onClose }) {
  const cfg = CHANNEL_CONNECT_CONFIG[channel];
  const colors = COLOR_MAP[cfg.color] || COLOR_MAP.sky;
  const Icon = cfg.icon;

  const [form, setForm] = useState(() => ({
    provider: cfg.providers[0] || '',
    primaryColor: '#FF6B35',
    ...saved,
  }));
  const [showPw, setShowPw] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  const embedCode = `<script>
  window.DAB_WIDGET = {
    apiUrl: "${window.location.origin || 'https://your-server.com'}",
    title: "${form.widgetTitle || 'Chat with us'}",
    welcome: "${form.welcomeMsg || 'Hi! How can we help?'}",
    color: "${form.primaryColor || '#FF6B35'}",
  };
</script>
<script src="${window.location.origin || 'https://your-server.com'}/widget.js" async></script>`;

  function copyEmbed() {
    navigator.clipboard.writeText(embedCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    await new Promise((r) => setTimeout(r, 400)); // simulate save
    onSave(form);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bento-card w-full max-w-md shadow-card2 animate-scale-in overflow-hidden" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 ${colors.bg} border-b ${colors.border}`}>
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-white shadow-xs flex items-center justify-center">
              <Icon className={`h-4 w-4 ${colors.text}`} />
            </div>
            <div>
              <h2 className={`font-heading font-bold text-sm ${colors.text}`}>Connect {cfg.label}</h2>
              <p className="text-[11px] text-muted">{cfg.description}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/60 transition-colors">
            <X className="h-4 w-4 text-muted" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSave} className="px-5 py-4 flex flex-col gap-3 max-h-[70vh] overflow-y-auto">

          {/* Provider select */}
          {cfg.providers.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-muted mb-1.5">Provider</label>
              <div className="relative">
                <select
                  value={form.provider}
                  onChange={(e) => setForm((p) => ({ ...p, provider: e.target.value }))}
                  className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-coral/30 focus:border-coral/40 transition-all pr-8"
                >
                  {cfg.providers.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
              </div>
            </div>
          )}

          {/* Dynamic fields */}
          {cfg.fields.filter((f) => f.type !== 'select').map((field) => (
            <div key={field.key}>
              <label className="block text-xs font-semibold text-muted mb-1.5">{field.label}</label>
              {field.type === 'color' ? (
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form[field.key] || '#FF6B35'}
                    onChange={(e) => setForm((p) => ({ ...p, [field.key]: e.target.value }))}
                    className="h-9 w-14 rounded-lg border border-gray-200 cursor-pointer bg-gray-50 p-0.5"
                  />
                  <span className="text-xs text-muted font-mono">{form[field.key] || '#FF6B35'}</span>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type={field.type === 'password' ? (showPw ? 'text' : 'password') : field.type}
                    value={form[field.key] || ''}
                    onChange={(e) => setForm((p) => ({ ...p, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-ink placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-coral/30 focus:border-coral/40 transition-all pr-9"
                  />
                  {field.type === 'password' && (
                    <button type="button" onClick={() => setShowPw((p) => !p)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition-colors">
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Embed code for Web Chat */}
          {cfg.embed && (
            <div>
              <label className="block text-xs font-semibold text-muted mb-1.5">Embed Code</label>
              <div className="relative bg-gray-900 rounded-xl overflow-hidden">
                <pre className="text-[10px] text-green-400 font-mono px-3 py-3 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                  {embedCode}
                </pre>
                <button type="button" onClick={copyEmbed}
                  className="absolute top-2 right-2 flex items-center gap-1 bg-white/10 hover:bg-white/20 text-white rounded-lg px-2 py-1 text-[10px] font-semibold transition-all">
                  {copied ? <><Check className="h-3 w-3" />Copied!</> : <><Copy className="h-3 w-3" />Copy</>}
                </button>
              </div>
              <p className="text-[10px] text-muted mt-1.5">Paste this snippet before the &lt;/body&gt; tag on your website.</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving}
              className={`flex-1 text-white rounded-xl py-2.5 font-semibold text-sm transition-all shadow-xs flex items-center justify-center gap-2 ${colors.btn} disabled:opacity-60`}>
              {saving
                ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" />Saving…</>
                : <><CheckCircle2 className="h-3.5 w-3.5" />Save & Connect</>
              }
            </button>
            {saved && (
              <button type="button" onClick={onDisconnect}
                className="flex items-center gap-1.5 bg-rose/10 text-rose border border-rose/20 rounded-xl px-3 py-2 text-xs font-semibold hover:bg-rose/20 transition-all">
                <Unlink className="h-3.5 w-3.5" />Disconnect
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Lead Row ───────────────────────────────────────────── */
const STATUS_STYLE = {
  new:       'pill-new',
  qualified: 'pill-qualified',
  booked:    'pill-booked',
  escalated: 'pill-escalated',
  closed:    'pill-closed',
};
const CHANNEL_ICON = { whatsapp: MessageSquare, email: Mail, web: Globe, instagram: Sparkles, messenger: Sparkles };

function LeadRow({ lead, selected, onClick, needsAttention }) {
  const ChanIcon = CHANNEL_ICON[lead.channel] || Globe;
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-3 transition-all group
        ${selected ? 'bg-coral/8 ring-1 ring-coral/20' : 'hover:bg-gray-50'}`}
    >
      <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gradient-to-br from-coral/30 to-violet/30 flex items-center justify-center">
        <span className="text-xs font-bold text-ink">{(lead.name || '?')[0].toUpperCase()}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-ink truncate">{lead.name}</span>
          {needsAttention && <span className="h-1.5 w-1.5 rounded-full bg-rose flex-shrink-0 animate-pulse-soft" />}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <ChanIcon className="h-3 w-3 text-muted flex-shrink-0" />
          <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_STYLE[lead.status] || 'pill-new'}`}>
            {lead.status}
          </span>
        </div>
      </div>
      <span className="text-[10px] text-muted flex-shrink-0">{fmtTime(lead.updatedAt || lead.createdAt)}</span>
    </button>
  );
}

/* ─── Activity Item ──────────────────────────────────────── */
const ACTION_COLORS = {
  replied:     'bg-sky-100 text-sky-600',
  qualified:   'bg-emerald-100 text-emerald-600',
  booked:      'bg-teal-100 text-teal-600',
  escalated:   'bg-rose-100 text-rose-600',
  followed_up: 'bg-violet-100 text-violet-600',
  needs_human: 'bg-amber-100 text-amber-600',
};

function ActivityItem({ item }) {
  return (
    <div className="flex items-start gap-2.5 py-2">
      <span className={`mt-0.5 flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${ACTION_COLORS[item.action] || 'bg-gray-100 text-gray-600'}`}>
        {item.action?.replace(/_/g, ' ') || 'update'}
      </span>
      <div className="min-w-0 flex-1">
        <span className="text-xs text-ink font-medium">{item.leadName || 'Lead'}</span>
        {item.description && <span className="text-xs text-muted ml-1 truncate">{item.description}</span>}
      </div>
      <span className="text-[10px] text-muted flex-shrink-0">{fmtTime(item.timestamp)}</span>
    </div>
  );
}

/* ─── Main Dashboard ─────────────────────────────────────── */
export default function Dashboard({ user, onLogout }) {
  const [leads, setLeads]                   = useState([]);
  const [messages, setMessages]             = useState([]);
  const [conversationMessages, setConversationMessages] = useState([]);
  const [bookings, setBookings]             = useState([]);
  const [activityLog, setActivityLog]       = useState([]);
  const [agentStatus, setAgentStatus]       = useState({ active: true, messagesProcessed: 0, leadsQualified: 0, bookingsMade: 0 });
  const [todayStats, setTodayStats]         = useState({ whatsapp:0, email:0, web:0, aiReplies:0, qualified:0, booked:0 });
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [manualReply, setManualReply]       = useState('');
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState('');
  const [alerts, setAlerts]                 = useState([]);
  const [showAlerts, setShowAlerts]         = useState(false);
  const [showSimModal, setShowSimModal]     = useState(false);
  const [simLoading, setSimLoading]         = useState(false);
  const [simForm, setSimForm]               = useState({ name:'Sarah', phone:'+1555000111', message:'I want to buy an apartment', channel:'whatsapp' });

  // ── Channel connection state ──
  const [channelConnections, setChannelConnections] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dab_channel_connections') || '{}'); } catch { return {}; }
  });
  const [connectingChannel, setConnectingChannel] = useState(null); // 'whatsapp' | 'email' | 'web' | null

  const selectedLeadIdRef = useRef(selectedLeadId);
  const leadsRef          = useRef(leads);
  useEffect(() => { leadsRef.current = leads; }, [leads]);
  useEffect(() => { selectedLeadIdRef.current = selectedLeadId; }, [selectedLeadId]);

  const selectedLead = useMemo(
    () => leads.find((l) => Number(l.id) === Number(selectedLeadId)) || null,
    [leads, selectedLeadId],
  );

  const needsAttentionLeadIds = useMemo(() => {
    const set = new Set();
    leads.forEach((l) => {
      if (l.status === 'escalated' || Number(l.aiPaused) === 1 || l.sentiment === 'negative') set.add(Number(l.id));
    });
    const latest = new Map();
    messages.forEach((m) => {
      const ex = latest.get(Number(m.leadId));
      if (!ex || Number(m.id) > Number(ex.id)) latest.set(Number(m.leadId), m);
    });
    latest.forEach((m, lid) => {
      if (m.direction === 'in') {
        const ts = new Date(String(m.timestamp).replace(' ', 'T')).getTime();
        if (!isNaN(ts) && Date.now() - ts > 5 * 60 * 1000) set.add(lid);
      }
    });
    return Array.from(set);
  }, [leads, messages]);

  const visibleMessages = useMemo(() => {
    if (!selectedLead) return messages;
    return conversationMessages.map((m) => ({ ...m, leadName: selectedLead.name, leadStatus: selectedLead.status }));
  }, [conversationMessages, messages, selectedLead]);

  const unreadAlerts = useMemo(() => alerts.filter((a) => !a.read).length, [alerts]);

  function pushAlert(payload) {
    setAlerts((prev) => [{ id: Date.now() + Math.random(), title: payload.title, body: payload.body, leadId: payload.leadId || null, urgent: Boolean(payload.urgent), read: false, createdAt: new Date().toISOString() }, ...prev].slice(0, 40));
  }

  // ── Save channel connection ──
  function handleChannelSave(channel, formData) {
    const updated = { ...channelConnections, [channel]: formData };
    setChannelConnections(updated);
    try { localStorage.setItem('dab_channel_connections', JSON.stringify(updated)); } catch {}
    setConnectingChannel(null);
    pushAlert({ title: `${CHANNEL_CONNECT_CONFIG[channel].label} Connected`, body: `Your ${CHANNEL_CONNECT_CONFIG[channel].label} channel is now active.` });
  }

  function handleChannelDisconnect(channel) {
    const updated = { ...channelConnections };
    delete updated[channel];
    setChannelConnections(updated);
    try { localStorage.setItem('dab_channel_connections', JSON.stringify(updated)); } catch {}
    setConnectingChannel(null);
  }

  /* ── Data load ── */
  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const [leadData, messageData, activityData, bookingData, statusData, analyticsData] = await Promise.all([
          apiRequest('/leads'),
          apiRequest('/messages?limit=120'),
          apiRequest('/activity-log?limit=120'),
          apiRequest('/bookings'),
          apiRequest('/agent/status'),
          apiRequest('/analytics/today'),
        ]);
        if (!mounted) return;
        setLeads(leadData.leads || []);
        setMessages(messageData.messages || []);
        setActivityLog(activityData.items || []);
        setBookings(bookingData.bookings || []);
        setAgentStatus(statusData || { active:true, messagesProcessed:0, leadsQualified:0, bookingsMade:0 });
        setTodayStats(analyticsData || { whatsapp:0, email:0, web:0, aiReplies:0, qualified:0, booked:0 });
        const firstLead = (leadData.leads || [])[0];
        if (firstLead) setSelectedLeadId(firstLead.id);
      } catch (e) {
        if (mounted) setError(e.message);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  /* ── Conversation messages ── */
  useEffect(() => {
    if (!selectedLeadId) { setConversationMessages([]); return; }
    apiRequest(`/messages/${selectedLeadId}`).then((d) => setConversationMessages(d.messages || [])).catch(() => {});
  }, [selectedLeadId]);

  /* ── Socket ── */
  useEffect(() => {
    const socket = connectSocket();
    if (!socket) return;

    socket.on('agent:action', (payload) => {
      const action = payload.action || payload.type;
      if (!processedActions.has(action)) return;
      if (payload.lead) setLeads((prev) => upsertById(prev, payload.lead));
      if (payload.message) {
        setMessages((prev) => upsertById(prev, payload.message));
        if (Number(payload.message.leadId) === Number(selectedLeadIdRef.current)) {
          setConversationMessages((prev) => upsertById(prev, payload.message));
        }
      }
      if (payload.booking) setBookings((prev) => upsertById(prev, payload.booking, false));
      if (action === 'escalated' || action === 'needs_human') {
        pushAlert({ title: 'Needs Attention', body: `${payload.lead?.name || 'Lead'} requires human follow-up`, leadId: payload.lead?.id, urgent: true });
      }
      setActivityLog((prev) => [{ id: Date.now() + Math.random(), leadId: payload.lead?.id, leadName: payload.lead?.name, action, description: payload.reason || payload.message?.content?.slice(0, 60) || '', timestamp: new Date().toISOString() }, ...prev].slice(0, 120));
    });

    socket.on('lead:new', (lead) => {
      setLeads((prev) => upsertById(prev, lead));
      pushAlert({ title: 'New Lead', body: `${lead.name} via ${lead.channel}`, leadId: lead.id });
    });

    socket.on('message:new', (msg) => {
      setMessages((prev) => upsertById(prev, msg));
      if (Number(msg.leadId) === Number(selectedLeadIdRef.current)) {
        setConversationMessages((prev) => upsertById(prev, msg));
      }
    });

    return () => disconnectSocket();
  }, []);

  /* ── Send manual reply ── */
  async function handleSend(e) {
    e.preventDefault();
    if (!manualReply.trim() || !selectedLeadId) return;
    try {
      const data = await apiRequest(`/messages/${selectedLeadId}`, { method:'POST', body: JSON.stringify({ content: manualReply }) });
      if (data.message) {
        setConversationMessages((prev) => upsertById(prev, data.message));
        setMessages((prev) => upsertById(prev, data.message));
      }
      setManualReply('');
    } catch (err) { setError(err.message); }
  }

  /* ── Simulate lead ── */
  async function handleSimulate(e) {
    e.preventDefault();
    setSimLoading(true);
    try {
      await apiRequest('/widget/message', { method:'POST', body: JSON.stringify(simForm) });
      setShowSimModal(false);
    } catch (err) { setError(err.message); }
    finally { setSimLoading(false); }
  }

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-oat">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-coral flex items-center justify-center shadow-card">
            <span className="text-white font-heading font-bold text-lg">D</span>
          </div>
          <p className="text-sm text-muted font-medium animate-pulse-soft">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  /* ─────────────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col h-screen bg-oat overflow-hidden">

      {/* ── TOP NAV ── */}
      <header className="flex-shrink-0 bg-white border-b border-black/[0.07] px-4 h-14 flex items-center gap-3 shadow-xs z-30">
        <div className="flex items-center gap-2 mr-2">
          <div className="h-8 w-8 rounded-xl bg-coral flex items-center justify-center shadow-xs">
            <span className="text-white font-heading font-bold text-sm">D</span>
          </div>
          <span className="font-heading font-bold text-ink text-base hidden sm:block">DAB AI</span>
        </div>

        <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 rounded-full px-3 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse-soft" />
          <span className="text-xs font-semibold text-emerald-700">Agent Active</span>
        </div>

        <div className="flex-1" />

        <nav className="hidden md:flex items-center gap-1">
          {[
            { to:'/dashboard', icon:BarChart2, label:'Dashboard' },
            { to:'/inbox',     icon:Inbox,     label:'Inbox' },
            { to:'/analytics', icon:TrendingUp, label:'Analytics' },
            { to:'/settings',  icon:Settings,  label:'Settings' },
          ].map(({ to, icon: Icon, label }) => (
            <Link key={to} to={to}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium text-muted hover:text-ink hover:bg-gray-50 transition-all">
              <Icon className="h-3.5 w-3.5" />
              <span>{label}</span>
            </Link>
          ))}
        </nav>

        <button onClick={() => setShowSimModal(true)}
          className="flex items-center gap-1.5 bg-coral text-white rounded-xl px-3 py-1.5 text-sm font-semibold hover:opacity-90 transition-opacity shadow-xs">
          <MailPlus className="h-3.5 w-3.5" />
          <span className="hidden sm:block">Simulate Lead</span>
        </button>

        <button onClick={() => setShowAlerts(!showAlerts)} className="relative p-2 rounded-xl hover:bg-gray-50 transition-colors">
          <Bell className="h-4 w-4 text-muted" />
          {unreadAlerts > 0 && (
            <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-rose text-white text-[9px] font-bold flex items-center justify-center">
              {unreadAlerts > 9 ? '9+' : unreadAlerts}
            </span>
          )}
        </button>
      </header>

      {/* ── ALERTS DROPDOWN ── */}
      {showAlerts && (
        <div className="absolute top-14 right-4 z-50 w-80 bento-card shadow-card2 overflow-hidden animate-fade-in">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="font-heading font-semibold text-sm text-ink">Alerts</span>
            <button onClick={() => { setAlerts((p) => p.map((a) => ({ ...a, read:true }))); setShowAlerts(false); }}
              className="text-xs text-muted hover:text-coral transition-colors">Mark all read</button>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {alerts.length === 0
              ? <p className="px-4 py-6 text-center text-sm text-muted">No alerts yet</p>
              : alerts.slice(0, 12).map((a) => (
                  <div key={a.id} className={`px-4 py-3 border-b border-gray-50 flex gap-3 ${!a.read ? 'bg-orange-50/50' : ''}`}>
                    <div className={`flex-shrink-0 mt-0.5 h-2 w-2 rounded-full ${a.urgent ? 'bg-rose' : 'bg-sky'}`} />
                    <div>
                      <p className="text-xs font-semibold text-ink">{a.title}</p>
                      <p className="text-xs text-muted">{a.body}</p>
                    </div>
                  </div>
                ))
            }
          </div>
        </div>
      )}

      {/* ── STAT BAR ── */}
      <div className="flex-shrink-0 px-4 pt-3 pb-0">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {STAT_CONFIG.map((cfg) => (
            <StatCard
              key={cfg.key}
              {...cfg}
              value={todayStats[cfg.key] ?? 0}
              connected={Boolean(channelConnections[cfg.key])}
              onConnect={cfg.connectable ? () => setConnectingChannel(cfg.key) : undefined}
            />
          ))}
        </div>
      </div>

      {/* ── MAIN BENTO GRID ── */}
      <main className="flex-1 overflow-hidden px-4 pt-3 pb-3">
        {error && (
          <div className="mb-3 bg-rose/10 border border-rose/20 rounded-xl px-4 py-2.5 flex items-center gap-2">
            <span className="text-xs font-semibold text-rose">{error}</span>
            <button onClick={() => setError('')} className="ml-auto"><X className="h-3.5 w-3.5 text-rose" /></button>
          </div>
        )}

        <div className="h-full grid grid-cols-12 gap-3">

          {/* ── LEFT: Lead List + Conversation ── */}
          <div className="col-span-12 lg:col-span-5 flex flex-col gap-3 min-h-0">
            <div className="bento-card flex flex-col" style={{ height: '220px' }}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-coral" />
                  <span className="font-heading font-semibold text-sm text-ink">Leads</span>
                  <span className="bg-coral/10 text-coral text-xs font-bold rounded-full px-2 py-0.5">{leads.length}</span>
                </div>
                <button onClick={() => window.location.reload()} className="p-1 rounded-lg hover:bg-gray-50 transition-colors">
                  <RefreshCw className="h-3.5 w-3.5 text-muted" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-2 py-1">
                {leads.length === 0
                  ? <p className="text-center text-xs text-muted py-6">No leads yet — simulate one above!</p>
                  : leads.map((l) => (
                      <LeadRow key={l.id} lead={l} selected={Number(selectedLeadId) === Number(l.id)}
                        onClick={() => setSelectedLeadId(l.id)} needsAttention={needsAttentionLeadIds.includes(Number(l.id))} />
                    ))
                }
              </div>
            </div>

            <div className="bento-card flex flex-col flex-1 min-h-0">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-sky-500" />
                  <span className="font-heading font-semibold text-sm text-ink">
                    {selectedLead ? selectedLead.name : 'Conversation'}
                  </span>
                  {selectedLead && (
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLE[selectedLead.status] || 'pill-new'}`}>
                      {selectedLead.status}
                    </span>
                  )}
                </div>
                {selectedLead && <TakeoverButton lead={selectedLead} onUpdate={(updated) => setLeads((prev) => upsertById(prev, updated))} />}
              </div>
              <div className="flex-1 overflow-y-auto min-h-0">
                <ConversationFeed messages={visibleMessages} selectedLead={selectedLead} />
              </div>
              <form onSubmit={handleSend} className="flex-shrink-0 flex items-center gap-2 px-3 py-2.5 border-t border-gray-100">
                <input
                  value={manualReply}
                  onChange={(e) => setManualReply(e.target.value)}
                  placeholder={selectedLead ? `Reply to ${selectedLead.name}…` : 'Select a lead to reply…'}
                  disabled={!selectedLead}
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-coral/30 focus:border-coral/40 disabled:opacity-50 transition-all"
                />
                <button type="submit" disabled={!manualReply.trim() || !selectedLead}
                  className="flex-shrink-0 h-9 w-9 rounded-xl bg-coral text-white flex items-center justify-center hover:opacity-90 disabled:opacity-40 transition-all shadow-xs">
                  <Send className="h-3.5 w-3.5" />
                </button>
              </form>
            </div>
          </div>

          {/* ── MIDDLE: Pipeline + Activity ── */}
          <div className="col-span-12 lg:col-span-4 flex flex-col gap-3 min-h-0">
            <div className="bento-card flex flex-col flex-1 min-h-0">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 flex-shrink-0">
                <Zap className="h-4 w-4 text-amber-500" />
                <span className="font-heading font-semibold text-sm text-ink">Pipeline</span>
              </div>
              <div className="flex-1 overflow-y-auto min-h-0">
                <LeadPipeline leads={leads} onSelectLead={setSelectedLeadId} selectedLeadId={selectedLeadId} needsAttentionIds={needsAttentionLeadIds} />
              </div>
            </div>

            <div className="bento-card flex flex-col" style={{ height: '200px' }}>
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 flex-shrink-0">
                <Bot className="h-4 w-4 text-violet" />
                <span className="font-heading font-semibold text-sm text-ink">Agent Activity</span>
                <div className="ml-auto flex items-center gap-1.5 bg-emerald-50 rounded-full px-2 py-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse-soft" />
                  <span className="text-[10px] font-semibold text-emerald-700">{agentStatus.messagesProcessed} msgs</span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-3 min-h-0">
                {activityLog.length === 0
                  ? <p className="text-center text-xs text-muted py-4">No activity yet</p>
                  : activityLog.slice(0, 20).map((item, i) => <ActivityItem key={item.id || i} item={item} />)
                }
              </div>
            </div>
          </div>

          {/* ── RIGHT: Bookings + Stats ── */}
          <div className="col-span-12 lg:col-span-3 flex flex-col gap-3 min-h-0">
            <div className="bento-card flex flex-col flex-1 min-h-0">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 flex-shrink-0">
                <Calendar className="h-4 w-4 text-teal-500" />
                <span className="font-heading font-semibold text-sm text-ink">Bookings</span>
                <span className="ml-auto bg-teal-50 text-teal-600 text-xs font-bold rounded-full px-2 py-0.5">{bookings.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto min-h-0">
                <BookingsPanel bookings={bookings} />
              </div>
            </div>

            <div className="bento-card px-4 py-3 flex-shrink-0">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-4 w-4 text-coral" />
                <span className="font-heading font-semibold text-sm text-ink">Totals</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label:'Processed', value: agentStatus.messagesProcessed, color:'text-coral' },
                  { label:'Qualified', value: agentStatus.leadsQualified, color:'text-emerald-600' },
                  { label:'Booked', value: agentStatus.bookingsMade, color:'text-teal-600' },
                  { label:'Active AI', value: leads.filter((l) => !l.aiPaused).length, color:'text-violet' },
                ].map((s) => (
                  <div key={s.label} className="bg-gray-50 rounded-xl p-2.5 text-center">
                    <p className={`font-heading font-bold text-xl tabular-nums ${s.color}`}>{s.value}</p>
                    <p className="text-[10px] text-muted font-medium mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Channel quick-connect strip */}
            <div className="bento-card px-3 py-3 flex-shrink-0">
              <p className="text-[10px] font-bold text-muted uppercase tracking-wide mb-2">Channels</p>
              <div className="flex flex-col gap-1.5">
                {['whatsapp', 'email', 'web'].map((ch) => {
                  const cfg = CHANNEL_CONNECT_CONFIG[ch];
                  const colors = COLOR_MAP[cfg.color];
                  const Icon = cfg.icon;
                  const isConnected = Boolean(channelConnections[ch]);
                  return (
                    <button key={ch} onClick={() => setConnectingChannel(ch)}
                      className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-all border
                        ${isConnected ? `${colors.bg} ${colors.border}` : 'bg-gray-50 border-gray-200 hover:border-gray-300'}`}>
                      <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${isConnected ? colors.text : 'text-muted'}`} />
                      <span className={`text-xs font-semibold flex-1 ${isConnected ? colors.text : 'text-muted'}`}>{cfg.label}</span>
                      {isConnected
                        ? <span className={`text-[9px] font-bold rounded-full px-1.5 py-0.5 ${colors.badge}`}>Live</span>
                        : <span className="text-[9px] font-bold text-muted bg-gray-200 rounded-full px-1.5 py-0.5">Connect</span>
                      }
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2 flex-shrink-0">
              <Link to="/analytics" className="flex-1 flex items-center justify-center gap-1.5 bg-white border border-gray-200 rounded-xl py-2.5 text-xs font-semibold text-muted hover:text-ink hover:border-gray-300 transition-all">
                <BarChart2 className="h-3.5 w-3.5" /> Analytics
              </Link>
              <Link to="/settings" className="flex-1 flex items-center justify-center gap-1.5 bg-white border border-gray-200 rounded-xl py-2.5 text-xs font-semibold text-muted hover:text-ink hover:border-gray-300 transition-all">
                <Settings className="h-3.5 w-3.5" /> Settings
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* ── CHANNEL CONNECT MODAL ── */}
      {connectingChannel && (
        <ChannelConnectModal
          channel={connectingChannel}
          saved={channelConnections[connectingChannel] || null}
          onSave={(data) => handleChannelSave(connectingChannel, data)}
          onDisconnect={() => handleChannelDisconnect(connectingChannel)}
          onClose={() => setConnectingChannel(null)}
        />
      )}

      {/* ── SIMULATE LEAD MODAL ── */}
      {showSimModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowSimModal(false)}>
          <div className="bento-card w-full max-w-sm shadow-card2 animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-heading font-bold text-ink">Simulate Lead</h2>
              <button onClick={() => setShowSimModal(false)} className="p-1 rounded-lg hover:bg-gray-50"><X className="h-4 w-4 text-muted" /></button>
            </div>
            <form onSubmit={handleSimulate} className="px-5 py-4 flex flex-col gap-3">
              {[
                { label:'Name', key:'name', type:'text', placeholder:'Sarah' },
                { label:'Phone', key:'phone', type:'text', placeholder:'+1555000111' },
                { label:'Message', key:'message', type:'text', placeholder:'I want to buy an apartment' },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-muted mb-1">{label}</label>
                  <input type={type} value={simForm[key]} onChange={(e) => setSimForm((p) => ({ ...p, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-coral/30 focus:border-coral/40 transition-all" />
                </div>
              ))}
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">Channel</label>
                <select value={simForm.channel} onChange={(e) => setSimForm((p) => ({ ...p, channel: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-coral/30 transition-all">
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">Email</option>
                  <option value="web">Web Chat</option>
                </select>
              </div>
              <button type="submit" disabled={simLoading}
                className="w-full bg-coral text-white rounded-xl py-2.5 font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition-all shadow-xs flex items-center justify-center gap-2">
                {simLoading ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Sending…</> : <><Sparkles className="h-3.5 w-3.5" /> Send Lead</>}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
