import { useEffect, useMemo, useRef, useState } from 'react';
import {
  LogOut, Send, Sparkles, MailPlus, X, Bell, CheckCircle2,
  MessageSquare, Mail, Globe, Bot, Zap, Users, Calendar,
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import ConversationFeed from '../components/ConversationFeed';
import LeadPipeline from '../components/LeadPipeline';
import AgentActivityLog from '../components/AgentActivityLog';
import BookingsPanel from '../components/BookingsPanel';
import TakeoverButton from '../components/TakeoverButton';
import AgentSelector from '../components/AgentSelector';
import { apiRequest, clearToken } from '../lib/api';
import { connectSocket, disconnectSocket } from '../lib/socket';

function upsertById(items, next, prepend = true) {
  const has = items.some((item) => Number(item.id) === Number(next.id));
  if (has) return items.map((item) => (Number(item.id) === Number(next.id) ? { ...item, ...next } : item));
  return prepend ? [next, ...items] : [...items, next];
}

const processedActions = new Set(['replied', 'qualified', 'booked', 'escalated', 'followed_up', 'needs_human']);

const STAT_CONFIG = [
  { key: 'whatsapp',  label: 'WhatsApp',  icon: MessageSquare, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  { key: 'email',     label: 'Email',      icon: Mail,          color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20' },
  { key: 'web',       label: 'Web Chat',   icon: Globe,         color: 'text-violet-400',  bg: 'bg-violet-500/10',  border: 'border-violet-500/20' },
  { key: 'aiReplies', label: 'AI Replies', icon: Bot,           color: 'text-accent',      bg: 'bg-accent/10',      border: 'border-accent/20' },
  { key: 'qualified', label: 'Qualified',  icon: Users,         color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20' },
  { key: 'booked',    label: 'Booked',     icon: Calendar,      color: 'text-sky-400',     bg: 'bg-sky-500/10',     border: 'border-sky-500/20' },
];

function StatCard({ label, value, icon: Icon, color, bg, border }) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl border ${border} ${bg} px-4 py-3.5 min-w-0`}>
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-white/[0.07]">
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <div className="min-w-0">
        <p className={`font-heading tabular-nums text-xl font-bold leading-none ${color}`}>{value}</p>
        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-white/30 truncate">{label}</p>
      </div>
    </div>
  );
}

const AGENT_COLORS = {
  salesbot: 'text-orange-400',
  bookingbot: 'text-blue-400',
  nurturebot: 'text-violet-400',
};

export default function Dashboard({ onLogout, user }) {
  const [leads, setLeads] = useState([]);
  const [messages, setMessages] = useState([]);
  const [conversationMessages, setConversationMessages] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [activityLog, setActivityLog] = useState([]);
  const [settings, setSettings] = useState(null);
  const [channelStatus, setChannelStatus] = useState(null);
  const [agentStatus, setAgentStatus] = useState({ active: true, messagesProcessed: 0, leadsQualified: 0, bookingsMade: 0 });
  const [todayStats, setTodayStats] = useState({ whatsapp: 0, email: 0, web: 0, aiReplies: 0, qualified: 0, booked: 0 });
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [activeAgent, setActiveAgent] = useState(user?.selectedAgent || null);
  const [showAgentSelector, setShowAgentSelector] = useState(false);
  const [manualReply, setManualReply] = useState('');
  const [incomingText, setIncomingText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [movedLeadId, setMovedLeadId] = useState(null);
  const [showSimModal, setShowSimModal] = useState(false);
  const [simLoading, setSimLoading] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [showAlerts, setShowAlerts] = useState(false);
  const [simForm, setSimForm] = useState({
    name: 'Sarah',
    phone: '+1555000111',
    message: 'I want to buy apartment',
    channel: 'whatsapp',
  });

  const selectedLeadIdRef = useRef(selectedLeadId);
  const leadsRef = useRef(leads);

  useEffect(() => { leadsRef.current = leads; }, [leads]);

  const selectedLead = useMemo(
    () => leads.find((lead) => Number(lead.id) === Number(selectedLeadId)) || null,
    [leads, selectedLeadId]
  );

  const activeCount = useMemo(() => leads.filter((lead) => !lead.aiPaused).length, [leads]);

  const needsAttentionLeadIds = useMemo(() => {
    const set = new Set();
    leads.forEach((lead) => {
      if (lead.status === 'escalated' || Number(lead.aiPaused) === 1 || lead.sentiment === 'negative') {
        set.add(Number(lead.id));
      }
    });
    const latestByLead = new Map();
    messages.forEach((msg) => {
      const existing = latestByLead.get(Number(msg.leadId));
      if (!existing || Number(msg.id) > Number(existing.id)) {
        latestByLead.set(Number(msg.leadId), msg);
      }
    });
    latestByLead.forEach((msg, leadId) => {
      if (msg.direction === 'in') {
        const ts = new Date(String(msg.timestamp).replace(' ', 'T')).getTime();
        if (!Number.isNaN(ts) && Date.now() - ts > 5 * 60 * 1000) set.add(leadId);
      }
    });
    return Array.from(set);
  }, [leads, messages]);

  const visibleMessages = useMemo(() => {
    if (!selectedLead) return messages;
    return conversationMessages.map((item) => ({
      ...item,
      leadName: selectedLead.name,
      leadStatus: selectedLead.status,
    }));
  }, [conversationMessages, messages, selectedLead]);

  const unreadAlerts = useMemo(() => alerts.filter((item) => !item.read).length, [alerts]);

  function pushAlert(payload) {
    const alert = {
      id: Date.now() + Math.random(),
      title: payload.title,
      body: payload.body,
      leadId: payload.leadId || null,
      urgent: Boolean(payload.urgent),
      read: false,
      createdAt: new Date().toISOString(),
    };
    setAlerts((prev) => [alert, ...prev].slice(0, 40));
    if ('Notification' in window) {
      const shouldNotify = document.hidden || alert.urgent;
      if (Notification.permission === 'granted' && shouldNotify) {
        // eslint-disable-next-line no-new
        new Notification(alert.title, { body: alert.body });
      }
    }
  }

  function markAlertsRead() {
    setAlerts((prev) => prev.map((item) => ({ ...item, read: true })));
  }

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => undefined);
    }
  }, []);

  useEffect(() => { selectedLeadIdRef.current = selectedLeadId; }, [selectedLeadId]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const [leadData, messageData, activityData, bookingData, settingsData, statusData, analyticsData, channelStatusData] = await Promise.all([
          apiRequest('/leads'),
          apiRequest('/messages?limit=120'),
          apiRequest('/activity-log?limit=120'),
          apiRequest('/bookings'),
          apiRequest('/settings'),
          apiRequest('/agent/status'),
          apiRequest('/analytics/today'),
          apiRequest('/channels/status').catch(() => null),
        ]);
        if (!mounted) return;
        setLeads(leadData.leads || []);
        setMessages(messageData.messages || []);
        setActivityLog(activityData.items || []);
        setBookings(bookingData.bookings || []);
        setSettings(settingsData.settings || null);
        setAgentStatus(statusData || { active: true, messagesProcessed: 0, leadsQualified: 0, bookingsMade: 0 });
        setTodayStats(analyticsData || { whatsapp: 0, email: 0, web: 0, aiReplies: 0, qualified: 0, booked: 0 });
        setChannelStatus(channelStatusData || null);
        if ((leadData.leads || []).length > 0) setSelectedLeadId((leadData.leads || [])[0].id);
        // Show agent selector if no agent selected yet
        const currentAgent = settingsData?.settings?.selectedAgent || user?.selectedAgent;
        if (!currentAgent) setShowAgentSelector(true);
        else setActiveAgent(currentAgent);
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!selectedLeadId) { setConversationMessages([]); return; }
    apiRequest(`/messages/${selectedLeadId}`)
      .then((data) => setConversationMessages(data.messages || []))
      .catch(() => setConversationMessages([]));
  }, [selectedLeadId]);

  useEffect(() => {
    const socket = connectSocket();

    const onLeadUpdated = (lead) => {
      const existsBefore = leadsRef.current.some((item) => Number(item.id) === Number(lead.id));
      setLeads((prev) => upsertById(prev, lead));
      if (!existsBefore) pushAlert({ title: 'New Lead', body: `${lead.name} joined via ${lead.channel}`, leadId: lead.id, urgent: document.hidden });
    };

    const onLeadMoved = (payload) => {
      if (payload?.lead) setLeads((prev) => upsertById(prev, payload.lead));
      setMovedLeadId(payload?.leadId || null);
      setTimeout(() => setMovedLeadId(null), 1400);
    };

    const onMessageNew = (message) => {
      setMessages((prev) => upsertById(prev, message));
      if (Number(message.leadId) === Number(selectedLeadIdRef.current)) {
        setConversationMessages((prev) => [...prev, message]);
      }
      const channelKey = message.channel === 'webchat' || message.channel === 'web' ? 'web'
        : message.channel === 'whatsapp' ? 'whatsapp'
        : message.channel === 'email' ? 'email' : null;
      if (channelKey) setTodayStats((prev) => ({ ...prev, [channelKey]: (prev[channelKey] || 0) + 1 }));
      if (document.hidden) pushAlert({ title: 'New Client Message', body: `${message.leadName || 'Lead'} sent a ${message.channel} message`, leadId: message.leadId, urgent: false });
    };

    const onMessageSent = (message) => {
      setMessages((prev) => upsertById(prev, message));
      if (Number(message.leadId) === Number(selectedLeadIdRef.current)) setConversationMessages((prev) => [...prev, message]);
      if (Number(message.sentByAI) === 1) setTodayStats((prev) => ({ ...prev, aiReplies: (prev.aiReplies || 0) + 1 }));
    };

    const onAgentAction = (item) => {
      setActivityLog((prev) => upsertById(prev, item));
      if (item?.sentByAI && processedActions.has(item.action)) {
        setAgentStatus((prev) => ({
          ...prev,
          messagesProcessed: (prev.messagesProcessed || 0) + 1,
          leadsQualified: item.action === 'qualified' ? (prev.leadsQualified || 0) + 1 : prev.leadsQualified,
          bookingsMade: item.action === 'booked' ? (prev.bookingsMade || 0) + 1 : prev.bookingsMade,
        }));
        setTodayStats((prev) => ({
          ...prev,
          qualified: item.action === 'qualified' ? (prev.qualified || 0) + 1 : prev.qualified,
          booked: item.action === 'booked' ? (prev.booked || 0) + 1 : prev.booked,
        }));
      }
      if (item?.action === 'needs_human') pushAlert({ title: 'Needs Human Attention', body: item.description || 'A conversation requires manual response.', leadId: item.leadId, urgent: true });
    };

    const onAgentEscalated = (payload) => {
      setError(`Escalation: ${payload?.leadName || 'Lead'} needs human attention (${payload?.reason || 'No reason provided'})`);
      pushAlert({ title: 'Lead Escalated', body: `${payload?.leadName || 'Lead'}: ${payload?.reason || 'Needs manual support'}`, leadId: payload?.leadId, urgent: true });
    };

    const onBookingCreated = (booking) => {
      setBookings((prev) => upsertById(prev, booking));
      setTodayStats((prev) => ({ ...prev, booked: (prev.booked || 0) + 1 }));
    };

    socket.on('lead:updated', onLeadUpdated);
    socket.on('lead:moved', onLeadMoved);
    socket.on('message:new', onMessageNew);
    socket.on('message:sent', onMessageSent);
    socket.on('agent:action', onAgentAction);
    socket.on('agent:escalated', onAgentEscalated);
    socket.on('booking:created', onBookingCreated);

    return () => {
      socket.off('lead:updated', onLeadUpdated);
      socket.off('lead:moved', onLeadMoved);
      socket.off('message:new', onMessageNew);
      socket.off('message:sent', onMessageSent);
      socket.off('agent:action', onAgentAction);
      socket.off('agent:escalated', onAgentEscalated);
      socket.off('booking:created', onBookingCreated);
      disconnectSocket();
    };
  }, []);

  async function handleMoveLead(leadId, status) {
    try {
      const response = await apiRequest(`/leads/${leadId}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      setLeads((prev) => upsertById(prev, response.lead));
    } catch (moveError) { setError(moveError.message); }
  }

  async function handleToggleTakeover(lead) {
    try {
      const route = lead.aiPaused ? `/agent/handback/${lead.id}` : `/agent/takeover/${lead.id}`;
      const response = await apiRequest(route, { method: 'POST' });
      setLeads((prev) => upsertById(prev, response.lead));
      if (response.activity) setActivityLog((prev) => upsertById(prev, response.activity));
    } catch (toggleError) { setError(toggleError.message); }
  }

  async function handleManualSend() {
    if (!selectedLead || !manualReply.trim()) return;
    try {
      await apiRequest('/messages/send', { method: 'POST', body: JSON.stringify({ leadId: selectedLead.id, content: manualReply.trim(), channel: selectedLead.channel }) });
      setManualReply('');
    } catch (sendError) { setError(sendError.message); }
  }

  async function handleQuickProcess() {
    if (!incomingText.trim()) return;
    try {
      await apiRequest('/agent/process', { method: 'POST', body: JSON.stringify({ leadId: selectedLead?.id, channel: selectedLead?.channel || 'web', message: incomingText.trim(), name: selectedLead?.name, phone: selectedLead?.phone, email: selectedLead?.email }) });
      setIncomingText('');
    } catch (processError) { setError(processError.message); }
  }

  async function handleSimulationSubmit(event) {
    event.preventDefault();
    setSimLoading(true);
    setError('');
    try {
      const result = await apiRequest('/simulate/message', { method: 'POST', body: JSON.stringify(simForm) });
      if (result?.lead?.id) setSelectedLeadId(result.lead.id);
      setShowSimModal(false);
    } catch (simulateError) { setError(simulateError.message); }
    finally { setSimLoading(false); }
  }

  function handleLogoutClick() { clearToken(); onLogout(); }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#090B12]">
        <div className="animate-fade-in rounded-3xl border border-white/[0.08] bg-[#111521] px-8 py-5">
          <div className="flex items-center gap-3 text-white/50">
            <Zap className="h-4 w-4 animate-pulse text-accent" />
            <span className="font-mono text-sm tracking-widest">LOADING HIREAI...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090B12] text-[#F4F5FC]">
      {/* Subtle noise texture matching the landing page */}
      <div className="noise-overlay" />

      <div className="relative z-10 p-3 sm:p-5 2xl:mx-auto 2xl:max-w-[2200px]">

        {/* ── Header ── */}
        <header className="mb-3 flex flex-wrap items-start sm:items-center justify-between gap-3 rounded-3xl border border-white/[0.08] bg-[#111521] px-5 py-4">
          <div className="min-w-0">
            <h1 className="font-heading text-xl font-bold text-white break-words">{user?.agencyName || 'DAB AI'}</h1>
            <p className="mt-0.5 font-mono text-xs tracking-widest text-white/30 break-words">AI OPERATIONS · REAL ESTATE · LIVE</p>
          </div>

          <div className="flex w-full sm:w-auto flex-wrap items-center gap-2">
            {/* Active agent badge */}
            {activeAgent && (
              <button
                type="button"
                onClick={() => setShowAgentSelector(true)}
                className={`inline-flex items-center gap-2 rounded-full border border-white/[0.10] bg-white/[0.05] px-3 py-1.5 text-xs font-semibold transition hover:bg-white/[0.08] ${AGENT_COLORS[activeAgent] || 'text-accent'}`}
              >
                <Bot className="h-3.5 w-3.5" />
                {activeAgent === 'salesbot' ? 'Aria' : activeAgent === 'bookingbot' ? 'Cal' : 'Ivy'}
              </button>
            )}

            {/* Agent status */}
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-[11px] sm:text-xs font-semibold text-emerald-400 min-w-0">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <span className="truncate">
                Agent Active · {activeCount} running
                <span className="hidden sm:inline"> · {agentStatus.messagesProcessed || 0} today</span>
              </span>
            </span>

            {/* Alerts */}
            <div className="relative">
              <button
                type="button"
                onClick={() => { setShowAlerts((prev) => !prev); markAlertsRead(); }}
                className="relative inline-flex items-center gap-2 rounded-full border border-white/[0.10] bg-white/[0.05] px-3.5 py-1.5 text-xs font-medium text-white/50 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
              >
                <Bell className="h-3.5 w-3.5" />
                Alerts
                {unreadAlerts > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-[#090B12]">
                    {unreadAlerts}
                  </span>
                )}
              </button>

              {showAlerts && (
                <div className="absolute right-0 z-30 mt-2 w-[min(92vw,20rem)] rounded-3xl border border-white/[0.08] bg-[#111521] p-2 shadow-card2 animate-fade-in">
                  {alerts.length === 0 ? (
                    <p className="p-4 text-center font-mono text-xs text-white/30">No alerts yet</p>
                  ) : (
                    <div className="max-h-72 space-y-1 overflow-auto">
                      {alerts.map((alert) => (
                        <button
                          key={alert.id}
                          type="button"
                          onClick={() => { if (alert.leadId) setSelectedLeadId(alert.leadId); setShowAlerts(false); }}
                          className={`w-full rounded-2xl border p-3 text-left text-xs transition hover:border-white/[0.15] ${alert.urgent ? 'border-amber-500/20 bg-amber-500/10' : 'border-white/[0.08] bg-white/[0.03]'}`}
                        >
                          <p className={`font-semibold ${alert.urgent ? 'text-amber-400' : 'text-white'}`}>{alert.title}</p>
                          <p className="mt-0.5 text-white/40">{alert.body}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Simulate */}
            <button
              type="button"
              onClick={() => setShowSimModal(true)}
              className="inline-flex items-center gap-2 rounded-full bg-accent px-3.5 py-1.5 text-xs font-bold text-[#090B12] shadow-glow-sm transition hover:opacity-90"
            >
              <MailPlus className="h-3.5 w-3.5" />
              Simulate
            </button>

            {/* Logout */}
            <button
              type="button"
              onClick={handleLogoutClick}
              className="inline-flex items-center gap-2 rounded-full border border-white/[0.10] bg-white/[0.05] px-3.5 py-1.5 text-xs text-white/40 transition hover:border-white/20 hover:text-white/70"
            >
              <LogOut className="h-3.5 w-3.5" />
              Logout
            </button>
          </div>
        </header>

        {/* ── Stats bar ── */}
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {STAT_CONFIG.map(({ key, label, icon, color, bg, border }) => (
            <StatCard
              key={key}
              label={label}
              value={todayStats[key] ?? 0}
              icon={icon}
              color={color}
              bg={bg}
              border={border}
            />
          ))}
        </div>

        {error && (
          <div className="mb-3 flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
            <span className="flex-1">{error}</span>
            <button type="button" onClick={() => setError('')} className="text-red-400/50 hover:text-red-400">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ── Main grid ── */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(240px,300px)_minmax(0,1fr)_minmax(320px,520px)] 2xl:grid-cols-[minmax(280px,360px)_minmax(0,1fr)_minmax(360px,600px)]">

          {/* Sidebar */}
          <div className="min-h-[50vh] min-w-0">
            <Sidebar settings={settings} channelStatus={channelStatus} agentActiveCount={activeCount} totalLeads={leads.length} activeAgent={activeAgent} />
          </div>

          {/* Centre column */}
          <div className="space-y-4 min-w-0">
            {/* Controls card */}
            <div className="rounded-3xl border border-white/[0.08] bg-[#111521] p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-heading font-semibold text-white">Conversation Controls</p>
                  <p className="font-mono text-xs tracking-wider text-white/30">QUICK-PROCESS OR REPLY MANUALLY</p>
                </div>
                <TakeoverButton lead={selectedLead} onToggle={handleToggleTakeover} />
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block font-mono text-xs uppercase tracking-wider text-white/30">Run AI on selected lead</label>
                  <div className="flex gap-2 min-w-0">
                    <input
                      value={incomingText}
                      onChange={(e) => setIncomingText(e.target.value)}
                      placeholder="Client says..."
                      className="input-premium w-full"
                      onKeyDown={(e) => e.key === 'Enter' && handleQuickProcess()}
                    />
                    <button
                      type="button"
                      onClick={handleQuickProcess}
                      className="rounded-2xl bg-accent px-4 py-2 text-sm font-bold text-[#090B12] transition hover:opacity-90"
                    >
                      <Sparkles className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block font-mono text-xs uppercase tracking-wider text-white/30">Manual response</label>
                  <div className="flex gap-2 min-w-0">
                    <input
                      value={manualReply}
                      onChange={(e) => setManualReply(e.target.value)}
                      placeholder="Type manual reply..."
                      className="input-premium w-full"
                      onKeyDown={(e) => e.key === 'Enter' && handleManualSend()}
                    />
                    <button
                      type="button"
                      onClick={handleManualSend}
                      className="inline-flex items-center gap-1.5 rounded-2xl border border-white/[0.10] bg-white/[0.05] px-3 py-2 text-xs font-semibold text-white/60 transition hover:bg-white/[0.08] hover:text-white"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Send
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <ConversationFeed
              messages={visibleMessages}
              selectedLead={selectedLead}
              needsAttentionLeadIds={needsAttentionLeadIds}
              onLeadSelect={(leadId) => setSelectedLeadId(leadId)}
            />
          </div>

          {/* Right column */}
          <div className="space-y-4 min-w-0">
            <LeadPipeline
              leads={leads}
              selectedLead={selectedLead}
              movedLeadId={movedLeadId}
              onSelectLead={(lead) => setSelectedLeadId(lead.id)}
              onMoveLead={handleMoveLead}
            />
            <AgentActivityLog items={activityLog} />
            <BookingsPanel bookings={bookings} />
          </div>
        </div>
      </div>

      {/* ── Sim Modal ── */}
      {showSimModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleSimulationSubmit}
            className="w-full max-w-lg animate-scale-in rounded-3xl border border-white/[0.10] bg-[#111521] p-6 shadow-card3"
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="font-heading text-lg font-bold text-white">Simulate Incoming Message</h2>
                <p className="mt-0.5 font-mono text-xs tracking-widest text-white/30">TEST THE AI AGENT WITH A MOCK LEAD</p>
              </div>
              <button
                type="button"
                onClick={() => setShowSimModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/[0.10] text-white/30 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {[
                { label: 'Name',  key: 'name',  type: 'text' },
                { label: 'Phone', key: 'phone', type: 'text' },
              ].map(({ label, key, type }) => (
                <label key={key} className="font-mono text-xs uppercase tracking-wider text-white/30">
                  {label}
                  <input
                    type={type}
                    value={simForm[key]}
                    onChange={(e) => setSimForm((prev) => ({ ...prev, [key]: e.target.value }))}
                    className="input-premium mt-1.5 w-full"
                  />
                </label>
              ))}

              <label className="font-mono text-xs uppercase tracking-wider text-white/30 md:col-span-2">
                Channel
                <select
                  value={simForm.channel}
                  onChange={(e) => setSimForm((prev) => ({ ...prev, channel: e.target.value }))}
                  className="input-premium mt-1.5 w-full"
                >
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">Email</option>
                  <option value="web">Web</option>
                  <option value="sms">SMS</option>
                </select>
              </label>

              <label className="font-mono text-xs uppercase tracking-wider text-white/30 md:col-span-2">
                Message
                <textarea
                  rows={4}
                  value={simForm.message}
                  onChange={(e) => setSimForm((prev) => ({ ...prev, message: e.target.value }))}
                  className="input-premium mt-1.5 w-full resize-none"
                />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSimModal(false)}
                className="rounded-2xl border border-white/[0.10] bg-white/[0.04] px-4 py-2 text-xs font-medium text-white/40 transition hover:border-white/20 hover:text-white/70"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={simLoading}
                className="inline-flex items-center gap-2 rounded-2xl bg-accent px-5 py-2 text-xs font-bold text-[#090B12] shadow-glow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {simLoading ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#090B12]/30 border-t-[#090B12]" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    Run Simulation
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Floating alert pip ── */}
      {unreadAlerts > 0 && !showAlerts && (
        <button
          type="button"
          onClick={() => { setShowAlerts(true); markAlertsRead(); }}
          className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-[#111521] px-4 py-2.5 text-xs font-bold text-white shadow-card2 animate-slide-up"
        >
          <CheckCircle2 className="h-4 w-4 text-accent" />
          {unreadAlerts} alert{unreadAlerts > 1 ? 's' : ''} need attention
        </button>
      )}

      {/* ── Agent Selector Modal ── */}
      {showAgentSelector && (
        <AgentSelector
          initialAgent={activeAgent}
          onAgentSelected={(agent) => {
            setActiveAgent(agent.id);
            setShowAgentSelector(false);
          }}
        />
      )}
    </div>
  );
}
