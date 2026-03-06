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

  useEffect(() => {
    leadsRef.current = leads;
  }, [leads]);

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
        if (!Number.isNaN(ts) && Date.now() - ts > 5 * 60 * 1000) {
          set.add(leadId);
        }
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

  useEffect(() => {
    selectedLeadIdRef.current = selectedLeadId;
  }, [selectedLeadId]);

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

        if ((leadData.leads || []).length > 0) {
          setSelectedLeadId((leadData.leads || [])[0].id);
        }
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedLeadId) {
      setConversationMessages([]);
      return;
    }

    apiRequest(`/messages/${selectedLeadId}`)
      .then((data) => setConversationMessages(data.messages || []))
      .catch(() => setConversationMessages([]));
  }, [selectedLeadId]);

  useEffect(() => {
    const socket = connectSocket();

    const onLeadUpdated = (lead) => {
      const existsBefore = leadsRef.current.some((item) => Number(item.id) === Number(lead.id));
      setLeads((prev) => upsertById(prev, lead));

      if (!existsBefore) {
        pushAlert({
          title: 'New Lead',
          body: `${lead.name} joined via ${lead.channel}`,
          leadId: lead.id,
          urgent: document.hidden,
        });
      }
    };

    const onLeadMoved = (payload) => {
      if (payload?.lead) {
        setLeads((prev) => upsertById(prev, payload.lead));
      }
      setMovedLeadId(payload?.leadId || null);
      setTimeout(() => setMovedLeadId(null), 1400);
    };

    const onMessageNew = (message) => {
      setMessages((prev) => upsertById(prev, message));
      if (Number(message.leadId) === Number(selectedLeadIdRef.current)) {
        setConversationMessages((prev) => [...prev, message]);
      }

      const channelKey =
        message.channel === 'webchat' || message.channel === 'web'
          ? 'web'
          : message.channel === 'whatsapp'
            ? 'whatsapp'
            : message.channel === 'email'
              ? 'email'
              : null;
      if (channelKey) {
        setTodayStats((prev) => ({ ...prev, [channelKey]: (prev[channelKey] || 0) + 1 }));
      }

      if (document.hidden) {
        pushAlert({
          title: 'New Client Message',
          body: `${message.leadName || 'Lead'} sent a ${message.channel} message`,
          leadId: message.leadId,
          urgent: false,
        });
      }
    };

    const onMessageSent = (message) => {
      setMessages((prev) => upsertById(prev, message));
      if (Number(message.leadId) === Number(selectedLeadIdRef.current)) {
        setConversationMessages((prev) => [...prev, message]);
      }

      if (Number(message.sentByAI) === 1) {
        setTodayStats((prev) => ({ ...prev, aiReplies: (prev.aiReplies || 0) + 1 }));
      }
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

      if (item?.action === 'needs_human') {
        pushAlert({
          title: 'Needs Human Attention',
          body: item.description || 'A conversation requires manual response.',
          leadId: item.leadId,
          urgent: true,
        });
      }
    };

    const onAgentEscalated = (payload) => {
      setError(`Escalation: ${payload?.leadName || 'Lead'} needs human attention (${payload?.reason || 'No reason provided'})`);
      pushAlert({
        title: 'Lead Escalated',
        body: `${payload?.leadName || 'Lead'}: ${payload?.reason || 'Needs manual support'}`,
        leadId: payload?.leadId,
        urgent: true,
      });
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
      const response = await apiRequest(`/leads/${leadId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setLeads((prev) => upsertById(prev, response.lead));
    } catch (moveError) {
      setError(moveError.message);
    }
  }

  async function handleToggleTakeover(lead) {
    try {
      const route = lead.aiPaused ? `/agent/handback/${lead.id}` : `/agent/takeover/${lead.id}`;
      const response = await apiRequest(route, { method: 'POST' });
      setLeads((prev) => upsertById(prev, response.lead));
      if (response.activity) {
        setActivityLog((prev) => upsertById(prev, response.activity));
      }
    } catch (toggleError) {
      setError(toggleError.message);
    }
  }

  async function handleManualSend() {
    if (!selectedLead || !manualReply.trim()) return;

    try {
      await apiRequest('/messages/send', {
        method: 'POST',
        body: JSON.stringify({
          leadId: selectedLead.id,
          content: manualReply.trim(),
          channel: selectedLead.channel,
        }),
      });
      setManualReply('');
    } catch (sendError) {
      setError(sendError.message);
    }
  }

  async function handleQuickProcess() {
    if (!incomingText.trim()) return;

    try {
      await apiRequest('/agent/process', {
        method: 'POST',
        body: JSON.stringify({
          leadId: selectedLead?.id,
          channel: selectedLead?.channel || 'web',
          message: incomingText.trim(),
          name: selectedLead?.name,
          phone: selectedLead?.phone,
          email: selectedLead?.email,
        }),
      });
      setIncomingText('');
    } catch (processError) {
      setError(processError.message);
    }
  }

  async function handleSimulationSubmit(event) {
    event.preventDefault();
    setSimLoading(true);
    setError('');

    try {
      const result = await apiRequest('/simulate/message', {
        method: 'POST',
        body: JSON.stringify(simForm),
      });

      if (result?.lead?.id) {
        setSelectedLeadId(result.lead.id);
      }

      setShowSimModal(false);
    } catch (simulateError) {
      setError(simulateError.message);
    } finally {
      setSimLoading(false);
    }
  }

  function handleLogoutClick() {
    clearToken();
    onLogout();
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg text-white">
        <div className="animate-fade-in rounded-xl border border-white/10 bg-card px-6 py-4">Loading HireAI Command Center...</div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-bg text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-10%] top-[-20%] h-[420px] w-[420px] animate-float rounded-full bg-accent/25 blur-[110px]" />
        <div className="absolute bottom-[-18%] right-[-12%] h-[420px] w-[420px] rounded-full bg-cyan-500/15 blur-[110px]" />
      </div>

      <div className="relative z-10 p-3 sm:p-5">
        <header className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/5 bg-card/75 px-4 py-3 backdrop-blur">
          <div>
            <h1 className="font-heading text-2xl">{user?.agencyName || 'HireAI Workspace'}</h1>
            <p className="text-xs text-textSoft">Single-window AI operations for real estate conversations</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-200">
              <Sparkles className="h-3.5 w-3.5" />
              {`🟢 Agent Active — ${activeCount} conversations running (${agentStatus.messagesProcessed || 0} processed today)`}
            </span>

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowAlerts((prev) => !prev);
                  markAlertsRead();
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-surface px-3 py-2 text-xs text-textSoft transition hover:text-white"
              >
                <Bell className="h-3.5 w-3.5" />
                Alerts
                {unreadAlerts > 0 && (
                  <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] text-white">{unreadAlerts}</span>
                )}
              </button>

              {showAlerts && (
                <div className="absolute right-0 z-30 mt-2 w-80 rounded-xl border border-white/10 bg-card p-2 shadow-glow">
                  {alerts.length === 0 ? (
                    <p className="p-3 text-xs text-textSoft">No alerts yet.</p>
                  ) : (
                    <div className="max-h-72 space-y-1 overflow-auto">
                      {alerts.map((alert) => (
                        <button
                          key={alert.id}
                          type="button"
                          onClick={() => {
                            if (alert.leadId) setSelectedLeadId(alert.leadId);
                            setShowAlerts(false);
                          }}
                          className="w-full rounded-lg border border-white/5 bg-surface/70 p-2 text-left text-xs hover:bg-surface"
                        >
                          <p className="font-semibold text-white">{alert.title}</p>
                          <p className="mt-0.5 text-textSoft">{alert.body}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowSimModal(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-accent/50 bg-accent/15 px-3 py-2 text-xs font-semibold text-violet-200 transition hover:bg-accent/25"
            >
              <MailPlus className="h-3.5 w-3.5" />
              📨 Simulate Incoming Message
            </button>

            <button
              type="button"
              onClick={handleLogoutClick}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-surface px-3 py-2 text-xs text-textSoft transition hover:text-white"
            >
              <LogOut className="h-3.5 w-3.5" />
              Logout
            </button>
          </div>
        </header>

        <div className="mb-4 rounded-xl border border-white/5 bg-card/80 px-4 py-2 text-xs text-slate-200">
          Today: 📱 {todayStats.whatsapp} WhatsApp  📧 {todayStats.email} Email  💬 {todayStats.web} Web  |  🤖 {todayStats.aiReplies} AI Replies  ✅ {todayStats.qualified} Qualified  📅 {todayStats.booked} Booked
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-200">{error}</div>
        )}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[280px_1fr_460px]">
          <div className="min-h-[50vh]">
            <Sidebar settings={settings} agentActiveCount={activeCount} totalLeads={leads.length} />
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-white/5 bg-card/95 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-heading text-lg text-white">Conversation Controls</p>
                  <p className="text-xs text-textSoft">Quick-process selected lead or reply manually during takeover</p>
                </div>
                <TakeoverButton lead={selectedLead} onToggle={handleToggleTakeover} />
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-textSoft">Run agent on selected lead</label>
                  <div className="flex gap-2">
                    <input
                      value={incomingText}
                      onChange={(event) => setIncomingText(event.target.value)}
                      placeholder="Client says..."
                      className="w-full rounded-xl border border-white/10 bg-bg px-3 py-2 text-sm outline-none placeholder:text-textSoft/70 focus:border-accent"
                    />
                    <button
                      type="button"
                      onClick={handleQuickProcess}
                      className="rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                    >
                      Run
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs text-textSoft">Manual response</label>
                  <div className="flex gap-2">
                    <input
                      value={manualReply}
                      onChange={(event) => setManualReply(event.target.value)}
                      placeholder="Type manual reply"
                      className="w-full rounded-xl border border-white/10 bg-bg px-3 py-2 text-sm outline-none placeholder:text-textSoft/70 focus:border-accent"
                    />
                    <button
                      type="button"
                      onClick={handleManualSend}
                      className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-bg transition hover:opacity-90"
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

      {showSimModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
          <form onSubmit={handleSimulationSubmit} className="w-full max-w-lg rounded-2xl border border-white/10 bg-card p-5 shadow-glow">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-heading text-xl">Simulate Incoming Message</h2>
              <button
                type="button"
                onClick={() => setShowSimModal(false)}
                className="rounded-lg border border-white/10 p-1.5 text-textSoft hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="text-xs text-textSoft">
                Name
                <input
                  value={simForm.name}
                  onChange={(event) => setSimForm((prev) => ({ ...prev, name: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-bg px-3 py-2 text-sm text-white outline-none focus:border-accent"
                />
              </label>

              <label className="text-xs text-textSoft">
                Phone
                <input
                  value={simForm.phone}
                  onChange={(event) => setSimForm((prev) => ({ ...prev, phone: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-bg px-3 py-2 text-sm text-white outline-none focus:border-accent"
                />
              </label>

              <label className="text-xs text-textSoft md:col-span-2">
                Channel
                <select
                  value={simForm.channel}
                  onChange={(event) => setSimForm((prev) => ({ ...prev, channel: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-bg px-3 py-2 text-sm text-white outline-none focus:border-accent"
                >
                  <option value="whatsapp">whatsapp</option>
                  <option value="email">email</option>
                  <option value="web">web</option>
                  <option value="sms">sms</option>
                </select>
              </label>

              <label className="text-xs text-textSoft md:col-span-2">
                Message
                <textarea
                  rows={4}
                  value={simForm.message}
                  onChange={(event) => setSimForm((prev) => ({ ...prev, message: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-bg px-3 py-2 text-sm text-white outline-none focus:border-accent"
                />
              </label>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSimModal(false)}
                className="rounded-xl border border-white/10 bg-surface px-3 py-2 text-xs text-textSoft hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={simLoading}
                className="rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {simLoading ? 'Sending...' : 'Run Simulation'}
              </button>
            </div>
          </form>
        </div>
      )}

      {unreadAlerts > 0 && !showAlerts && (
        <button
          type="button"
          onClick={() => {
            setShowAlerts(true);
            markAlertsRead();
          }}
          className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-full border border-accent/50 bg-card px-4 py-2 text-xs text-slate-100 shadow-glow"
        >
          <CheckCircle2 className="h-4 w-4 text-accent" />
          {unreadAlerts} urgent alerts
        </button>
      )}
    </div>
  );
}
