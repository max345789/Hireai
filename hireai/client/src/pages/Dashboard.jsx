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
import { apiRequest, clearToken } from '../lib/api';
import { connectSocket, disconnectSocket } from '../lib/socket';

function upsertById(items, next, prepend = true) {
  const has = items.some((item) => Number(item.id) === Number(next.id));
  if (has) return items.map((item) => (Number(item.id) === Number(next.id) ? { ...item, ...next } : item));
  return prepend ? [next, ...items] : [...items, next];
}

const processedActions = new Set(['replied', 'qualified', 'booked', 'escalated', 'followed_up', 'needs_human']);

const STAT_CONFIG = [
  { key: 'whatsapp',  label: 'WhatsApp',   icon: MessageSquare, color: 'text-emerald-600', bg: 'bg-emerald-50',  border: 'border-emerald-100' },
  { key: 'email',     label: 'Email',       icon: Mail,          color: 'text-blue-600',    bg: 'bg-blue-50',     border: 'border-blue-100' },
  { key: 'web',       label: 'Web Chat',    icon: Globe,         color: 'text-violet-600',  bg: 'bg-violet-50',   border: 'border-violet-100' },
  { key: 'aiReplies', label: 'AI Replies',  icon: Bot,           color: 'text-accent',      bg: 'bg-orange-50',   border: 'border-orange-100' },
  { key: 'qualified', label: 'Qualified',   icon: Users,         color: 'text-amber-600',   bg: 'bg-amber-50',    border: 'border-amber-100' },
  { key: 'booked',    label: 'Booked',      icon: Calendar,      color: 'text-sky-600',     bg: 'bg-sky-50',      border: 'border-sky-100' },
];

function StatCard({ label, value, icon: Icon, color, bg, border }) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl border ${border} ${bg} px-4 py-3`}>
      <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-white shadow-xs`}>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <div>
        <p className={`tabular-nums text-xl font-bold leading-none ${color}`}>{value}</p>
        <p className="mt-0.5 text-[10px] font-medium text-gray-500">{label}</p>
      </div>
    </div>
  );
}

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
      <div className="flex min-h-screen items-center justify-center bg-[#F7F6F2]">
        <div className="animate-fade-in rounded-3xl bg-white px-8 py-5 shadow-card">
          <div className="flex items-center gap-3 text-gray-600">
            <Zap className="h-4 w-4 animate-pulse text-accent" />
            <span className="text-sm font-medium">Loading HireAI...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F6F2] text-gray-900">
      <div className="p-3 sm:p-5">

        {/* ── Header ── */}
        <header className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-white px-5 py-4 shadow-card">
          <div>
            <h1 className="font-heading text-xl font-bold text-gray-900">{user?.agencyName || 'HireAI Workspace'}</h1>
            <p className="mt-0.5 text-xs text-gray-400">AI operations · real estate · live dashboard</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Agent status badge */}
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3.5 py-1.5 text-xs font-semibold text-emerald-700">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Agent Active · {activeCount} running · {agentStatus.messagesProcessed || 0} today
            </span>

            {/* Alerts */}
            <div className="relative">
              <button
                type="button"
                onClick={() => { setShowAlerts((prev) => !prev); markAlertsRead(); }}
                className="relative inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
              >
                <Bell className="h-3.5 w-3.5" />
                Alerts
                {unreadAlerts > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-white">
                    {unreadAlerts}
                  </span>
                )}
              </button>

              {showAlerts && (
                <div className="absolute right-0 z-30 mt-2 w-80 rounded-3xl border border-gray-100 bg-white p-2 shadow-card2 animate-fade-in">
                  {alerts.length === 0 ? (
                    <p className="p-4 text-center text-xs text-gray-400">No alerts yet</p>
                  ) : (
                    <div className="max-h-72 space-y-1 overflow-auto">
                      {alerts.map((alert) => (
                        <button
                          key={alert.id}
                          type="button"
                          onClick={() => { if (alert.leadId) setSelectedLeadId(alert.leadId); setShowAlerts(false); }}
                          className={`w-full rounded-2xl border p-3 text-left text-xs transition hover:border-gray-200 hover:bg-gray-50 ${alert.urgent ? 'border-amber-100 bg-amber-50/60' : 'border-gray-100 bg-gray-50'}`}
                        >
                          <p className={`font-semibold ${alert.urgent ? 'text-amber-700' : 'text-gray-900'}`}>{alert.title}</p>
                          <p className="mt-0.5 text-gray-500">{alert.body}</p>
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
              className="inline-flex items-center gap-2 rounded-full bg-accent px-3.5 py-1.5 text-xs font-semibold text-white shadow-glow-sm transition hover:opacity-90"
            >
              <MailPlus className="h-3.5 w-3.5" />
              Simulate
            </button>

            {/* Logout */}
            <button
              type="button"
              onClick={handleLogoutClick}
              className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-xs text-gray-500 transition hover:bg-gray-50"
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
          <div className="mb-3 flex items-center gap-2 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-2.5 text-sm text-rose-600">
            <span className="flex-1">{error}</span>
            <button type="button" onClick={() => setError('')} className="text-rose-400 hover:text-rose-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ── Main grid ── */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[260px_1fr_440px]">

          {/* Sidebar */}
          <div className="min-h-[50vh]">
            <Sidebar settings={settings} channelStatus={channelStatus} agentActiveCount={activeCount} totalLeads={leads.length} />
          </div>

          {/* Centre column */}
          <div className="space-y-4">
            {/* Controls card */}
            <div className="rounded-3xl bg-white p-5 shadow-card">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-gray-900">Conversation Controls</p>
                  <p className="text-xs text-gray-400">Quick-process or reply manually to selected lead</p>
                </div>
                <TakeoverButton lead={selectedLead} onToggle={handleToggleTakeover} />
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-500">Run AI on selected lead</label>
                  <div className="flex gap-2">
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
                      className="rounded-2xl bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                    >
                      <Sparkles className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-500">Manual response</label>
                  <div className="flex gap-2">
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
                      className="inline-flex items-center gap-1.5 rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
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
          <div className="space-y-4">
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
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleSimulationSubmit}
            className="w-full max-w-lg animate-scale-in rounded-3xl bg-white p-6 shadow-card3"
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="font-heading text-lg font-bold text-gray-900">Simulate Incoming Message</h2>
                <p className="mt-0.5 text-xs text-gray-400">Test the AI agent with a mock lead message</p>
              </div>
              <button
                type="button"
                onClick={() => setShowSimModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-gray-200 text-gray-400 transition hover:bg-gray-50 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {[
                { label: 'Name',  key: 'name',  type: 'text' },
                { label: 'Phone', key: 'phone', type: 'text' },
              ].map(({ label, key, type }) => (
                <label key={key} className="text-xs font-semibold text-gray-500">
                  {label}
                  <input
                    type={type}
                    value={simForm[key]}
                    onChange={(e) => setSimForm((prev) => ({ ...prev, [key]: e.target.value }))}
                    className="input-premium mt-1.5 w-full"
                  />
                </label>
              ))}

              <label className="text-xs font-semibold text-gray-500 md:col-span-2">
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

              <label className="text-xs font-semibold text-gray-500 md:col-span-2">
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
                className="rounded-2xl border border-gray-200 bg-white px-4 py-2 text-xs font-medium text-gray-500 transition hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={simLoading}
                className="inline-flex items-center gap-2 rounded-2xl bg-accent px-5 py-2 text-xs font-bold text-white shadow-glow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {simLoading ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
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
          className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full border border-gray-100 bg-white px-4 py-2.5 text-xs font-bold text-gray-700 shadow-card2 animate-slide-up"
        >
          <CheckCircle2 className="h-4 w-4 text-accent" />
          {unreadAlerts} alert{unreadAlerts > 1 ? 's' : ''} need attention
        </button>
      )}
    </div>
  );
}
