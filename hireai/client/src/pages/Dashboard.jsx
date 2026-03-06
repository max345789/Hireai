import { useEffect, useMemo, useRef, useState } from 'react';
import { LogOut, Send, Sparkles, MailPlus, X, Bell, CheckCircle2 } from 'lucide-react';
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
  if (has) {
    return items.map((item) => (Number(item.id) === Number(next.id) ? { ...item, ...next } : item));
  }
  return prepend ? [next, ...items] : [...items, next];
}

const processedActions = new Set(['replied', 'qualified', 'booked', 'escalated', 'followed_up', 'needs_human']);

function StatPill({ label, value, color }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-gray-100 bg-white px-4 py-2.5 shadow-sm">
      <span className={`text-lg font-bold ${color}`}>{value}</span>
      <span className="text-[10px] text-gray-400">{label}</span>
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
        const [leadData, messageData, activityData, bookingData, settingsData, statusData, analyticsData] = await Promise.all([
          apiRequest('/leads'),
          apiRequest('/messages?limit=120'),
          apiRequest('/activity-log?limit=120'),
          apiRequest('/bookings'),
          apiRequest('/settings'),
          apiRequest('/agent/status'),
          apiRequest('/analytics/today'),
        ]);
        if (!mounted) return;
        setLeads(leadData.leads || []);
        setMessages(messageData.messages || []);
        setActivityLog(activityData.items || []);
        setBookings(bookingData.bookings || []);
        setSettings(settingsData.settings || null);
        setAgentStatus(statusData || { active: true, messagesProcessed: 0, leadsQualified: 0, bookingsMade: 0 });
        setTodayStats(analyticsData || { whatsapp: 0, email: 0, web: 0, aiReplies: 0, qualified: 0, booked: 0 });
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
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="animate-fade-in rounded-3xl bg-white px-8 py-5 shadow-card text-gray-600 font-medium">
          Loading HireAI...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900">
      <div className="p-3 sm:p-5">

        {/* ── Header ── */}
        <header className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-white px-5 py-3.5 shadow-card">
          <div>
            <h1 className="font-heading text-xl font-bold text-gray-900">{user?.agencyName || 'HireAI Workspace'}</h1>
            <p className="text-xs text-gray-400">Single-window AI operations for real estate</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Agent status badge */}
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-600">
              <Sparkles className="h-3.5 w-3.5" />
              Agent Active · {activeCount} running · {agentStatus.messagesProcessed || 0} today
            </span>

            {/* Alerts */}
            <div className="relative">
              <button
                type="button"
                onClick={() => { setShowAlerts((prev) => !prev); markAlertsRead(); }}
                className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
              >
                <Bell className="h-3.5 w-3.5" />
                Alerts
                {unreadAlerts > 0 && (
                  <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] text-white">{unreadAlerts}</span>
                )}
              </button>

              {showAlerts && (
                <div className="absolute right-0 z-30 mt-2 w-80 rounded-3xl border border-gray-100 bg-white p-2 shadow-card2">
                  {alerts.length === 0 ? (
                    <p className="p-3 text-xs text-gray-400">No alerts yet.</p>
                  ) : (
                    <div className="max-h-72 space-y-1 overflow-auto">
                      {alerts.map((alert) => (
                        <button
                          key={alert.id}
                          type="button"
                          onClick={() => { if (alert.leadId) setSelectedLeadId(alert.leadId); setShowAlerts(false); }}
                          className="w-full rounded-2xl border border-gray-100 bg-gray-50 p-2.5 text-left text-xs transition hover:bg-gray-100"
                        >
                          <p className="font-semibold text-gray-900">{alert.title}</p>
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
              className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
            >
              <MailPlus className="h-3.5 w-3.5" />
              Simulate Message
            </button>

            {/* Logout */}
            <button
              type="button"
              onClick={handleLogoutClick}
              className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-500 transition hover:bg-gray-50"
            >
              <LogOut className="h-3.5 w-3.5" />
              Logout
            </button>
          </div>
        </header>

        {/* ── Stats bar ── */}
        <div className="mb-3 flex flex-wrap gap-2">
          <StatPill label="WhatsApp"  value={todayStats.whatsapp} color="text-emerald-600" />
          <StatPill label="Email"     value={todayStats.email}    color="text-blue-600" />
          <StatPill label="Web"       value={todayStats.web}      color="text-violet-600" />
          <StatPill label="AI Replies" value={todayStats.aiReplies} color="text-accent" />
          <StatPill label="Qualified" value={todayStats.qualified} color="text-amber-600" />
          <StatPill label="Booked"    value={todayStats.booked}   color="text-sky-600" />
        </div>

        {error && (
          <div className="mb-3 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-2.5 text-sm text-rose-600">{error}</div>
        )}

        {/* ── Main grid ── */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[260px_1fr_440px]">

          {/* Sidebar */}
          <div className="min-h-[50vh]">
            <Sidebar settings={settings} agentActiveCount={activeCount} totalLeads={leads.length} />
          </div>

          {/* Centre column */}
          <div className="space-y-4">
            {/* Controls card */}
            <div className="rounded-3xl bg-white p-5 shadow-card">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-gray-900">Conversation Controls</p>
                  <p className="text-xs text-gray-400">Quick-process or reply manually</p>
                </div>
                <TakeoverButton lead={selectedLead} onToggle={handleToggleTakeover} />
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-500">Run agent on selected lead</label>
                  <div className="flex gap-2">
                    <input
                      value={incomingText}
                      onChange={(event) => setIncomingText(event.target.value)}
                      placeholder="Client says..."
                      className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-accent focus:bg-white"
                    />
                    <button
                      type="button"
                      onClick={handleQuickProcess}
                      className="rounded-2xl bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                    >
                      Run
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-500">Manual response</label>
                  <div className="flex gap-2">
                    <input
                      value={manualReply}
                      onChange={(event) => setManualReply(event.target.value)}
                      placeholder="Type manual reply"
                      className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-accent focus:bg-white"
                    />
                    <button
                      type="button"
                      onClick={handleManualSend}
                      className="inline-flex items-center gap-1 rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
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
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <form onSubmit={handleSimulationSubmit} className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-card2">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-heading text-lg font-semibold text-gray-900">Simulate Incoming Message</h2>
              <button
                type="button"
                onClick={() => setShowSimModal(false)}
                className="rounded-xl border border-gray-200 p-1.5 text-gray-400 transition hover:bg-gray-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {[
                { label: 'Name',  key: 'name',  type: 'text',  span: false },
                { label: 'Phone', key: 'phone', type: 'text',  span: false },
              ].map(({ label, key, type, span }) => (
                <label key={key} className={`text-xs font-medium text-gray-500 ${span ? 'md:col-span-2' : ''}`}>
                  {label}
                  <input
                    type={type}
                    value={simForm[key]}
                    onChange={(event) => setSimForm((prev) => ({ ...prev, [key]: event.target.value }))}
                    className="mt-1.5 w-full rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-accent focus:bg-white"
                  />
                </label>
              ))}

              <label className="text-xs font-medium text-gray-500 md:col-span-2">
                Channel
                <select
                  value={simForm.channel}
                  onChange={(event) => setSimForm((prev) => ({ ...prev, channel: event.target.value }))}
                  className="mt-1.5 w-full rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-accent focus:bg-white"
                >
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">Email</option>
                  <option value="web">Web</option>
                  <option value="sms">SMS</option>
                </select>
              </label>

              <label className="text-xs font-medium text-gray-500 md:col-span-2">
                Message
                <textarea
                  rows={4}
                  value={simForm.message}
                  onChange={(event) => setSimForm((prev) => ({ ...prev, message: event.target.value }))}
                  className="mt-1.5 w-full rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-accent focus:bg-white"
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
                className="rounded-2xl bg-accent px-5 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {simLoading ? 'Sending...' : 'Run Simulation'}
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
          className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full border border-gray-100 bg-white px-4 py-2 text-xs font-semibold text-gray-700 shadow-card2"
        >
          <CheckCircle2 className="h-4 w-4 text-accent" />
          {unreadAlerts} urgent alert{unreadAlerts > 1 ? 's' : ''}
        </button>
      )}
    </div>
  );
}
