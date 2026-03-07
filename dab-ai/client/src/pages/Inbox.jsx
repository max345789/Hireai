import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
  Send,
  Link2,
  RefreshCw,
  Lightbulb,
  Download,
  Filter,
} from 'lucide-react';
import { apiRequest } from '../lib/api';

const SMART_REPLIES_BY_STATUS = {
  new: [
    'Thanks for reaching out! What type of property are you looking for?',
    'Hi! I can help you find the perfect property. What\'s your budget range?',
    'Great to hear from you! Are you looking to buy or rent?',
  ],
  qualified: [
    'Based on your requirements, I have some great options. Would you like to schedule a viewing?',
    'I\'d love to show you some properties that match your criteria. When are you available?',
    'We have properties in your preferred area. Shall I book a viewing for you?',
  ],
  booked: [
    'Your viewing is confirmed! Is there anything else you\'d like to know about the property?',
    'See you at the viewing! Please don\'t hesitate to reach out if you have any questions.',
    'Looking forward to showing you the property. Any specific features you\'d like us to highlight?',
  ],
  escalated: [
    'I understand your concerns. Let me connect you with our senior agent immediately.',
    'I\'m sorry to hear that. I\'ll personally ensure this is resolved right away.',
    'Thank you for your patience. A specialist will contact you within the hour.',
  ],
};

function Badge({ children, className = '' }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${className}`}>
      {children}
    </span>
  );
}

function fmtTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function Inbox() {
  const [threads, setThreads] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [thread, setThread] = useState(null);
  const [integrations, setIntegrations] = useState(null);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [approveEdits, setApproveEdits] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    let mounted = true;

    async function loadInitial() {
      try {
        const [threadData, integrationData] = await Promise.all([
          apiRequest('/inbox/threads?limit=120'),
          apiRequest('/integrations').catch(() => ({ providers: null })),
        ]);

        if (!mounted) return;
        const list = threadData.threads || [];
        setThreads(list);
        setIntegrations(integrationData.providers || null);

        if (list.length > 0) {
          setSelectedId(list[0].threadId);
        }
      } catch (err) {
        if (!mounted) return;
        setError(err.message || 'Failed to load inbox');
      } finally {
        if (mounted) setLoadingThreads(false);
      }
    }

    loadInitial();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    let mounted = true;
    setLoadingThread(true);

    apiRequest(`/inbox/threads/${selectedId}`)
      .then((data) => {
        if (!mounted) return;
        const nextThread = data.thread || null;
        setThread(nextThread);

        const draftMap = {};
        (nextThread?.messages || []).forEach((item) => {
          if (item.draftState === 'pending_approval') {
            draftMap[item.id] = item.content;
          }
        });
        setApproveEdits(draftMap);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err.message || 'Failed to load thread');
      })
      .finally(() => {
        if (mounted) setLoadingThread(false);
      });

    return () => {
      mounted = false;
    };
  }, [selectedId]);

  const pendingDrafts = useMemo(
    () => (thread?.messages || []).filter((item) => item.draftState === 'pending_approval'),
    [thread]
  );

  async function refreshThreads() {
    try {
      const data = await apiRequest('/inbox/threads?limit=120');
      const list = data.threads || [];
      setThreads(list);
      if (!selectedId && list[0]) setSelectedId(list[0].threadId);
    } catch (err) {
      setError(err.message || 'Failed to refresh inbox');
    }
  }

  async function handleReply() {
    if (!selectedId || !replyText.trim()) return;
    setBusy(true);
    setError('');

    try {
      await apiRequest(`/inbox/threads/${selectedId}/reply`, {
        method: 'POST',
        body: JSON.stringify({ content: replyText.trim() }),
      });

      setReplyText('');
      await refreshThreads();
      const data = await apiRequest(`/inbox/threads/${selectedId}`);
      setThread(data.thread || null);
    } catch (err) {
      setError(err.message || 'Failed to send reply');
    } finally {
      setBusy(false);
    }
  }

  async function handleApprove(messageId) {
    if (!selectedId || !messageId) return;
    setBusy(true);
    setError('');

    try {
      await apiRequest(`/inbox/threads/${selectedId}/approve-and-send`, {
        method: 'POST',
        body: JSON.stringify({
          messageId,
          content: (approveEdits[messageId] || '').trim(),
        }),
      });

      await refreshThreads();
      const data = await apiRequest(`/inbox/threads/${selectedId}`);
      setThread(data.thread || null);
    } catch (err) {
      setError(err.message || 'Failed to approve draft');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#090B12] p-3 text-[#F4F5FC] sm:p-5">
      <div className="mx-auto w-full max-w-[2200px] space-y-4">
        <header className="rounded-3xl border border-white/[0.08] bg-[#111521] px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-heading text-xl font-bold text-white">Unified Inbox</h1>
              <p className="mt-1 font-mono text-[11px] uppercase tracking-widest text-white/30">
                WhatsApp · Email · Web · Instagram · Messenger
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={refreshThreads}
                className="inline-flex items-center gap-2 rounded-full border border-white/[0.10] bg-white/[0.05] px-3 py-1.5 text-xs text-white/70 hover:bg-white/[0.08]"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </button>

              <a
                href="/api/leads/export.csv"
                className="inline-flex items-center gap-2 rounded-full border border-white/[0.10] bg-white/[0.05] px-3 py-1.5 text-xs text-white/70 hover:bg-white/[0.08]"
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </a>

              <Link
                to="/settings"
                className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent"
              >
                <Link2 className="h-3.5 w-3.5" />
                Connect Accounts
              </Link>

              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 rounded-full border border-white/[0.10] bg-white/[0.05] px-3 py-1.5 text-xs text-white/50 hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Dashboard
              </Link>
            </div>
          </div>

          {integrations && (
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(integrations).map(([key, value]) => (
                <Badge
                  key={key}
                  className={value.connected ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/[0.05] text-white/40'}
                >
                  {key} {value.connected ? 'connected' : 'disconnected'}
                </Badge>
              ))}
            </div>
          )}
        </header>

        {error && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-300">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[340px_minmax(0,1fr)_340px]">
          <aside className="rounded-3xl border border-white/[0.08] bg-[#111521] p-4 min-w-0">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="font-heading text-base font-semibold">Threads</h2>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-xl border border-white/[0.10] bg-white/[0.04] px-2 py-1 text-[11px] text-white/60 outline-none"
              >
                <option value="all">All</option>
                <option value="new">New</option>
                <option value="qualified">Qualified</option>
                <option value="booked">Booked</option>
                <option value="escalated">Escalated</option>
              </select>
            </div>

            {loadingThreads ? (
              <p className="text-xs text-white/40">Loading threads…</p>
            ) : threads.length === 0 ? (
              <p className="text-xs text-white/40">No conversations yet</p>
            ) : (
              <div className="space-y-2 max-h-[72vh] overflow-y-auto pr-1">
                {threads.filter((t) => statusFilter === 'all' || t.leadStatus === statusFilter).map((item) => (
                  <button
                    key={item.threadId}
                    type="button"
                    onClick={() => setSelectedId(item.threadId)}
                    className={`w-full rounded-2xl border px-3 py-2 text-left transition min-w-0 ${
                      Number(selectedId) === Number(item.threadId)
                        ? 'border-accent/40 bg-accent/[0.10]'
                        : 'border-white/[0.08] bg-white/[0.03] hover:border-white/[0.16]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{item.leadName}</p>
                      <span className="shrink-0 text-[10px] text-white/35">{fmtTime(item.timestamp)}</span>
                    </div>

                    <p className="mt-1 line-clamp-2 text-xs text-white/55">{item.content || 'No messages'}</p>

                    <div className="mt-2 flex flex-wrap gap-1">
                      <Badge className="bg-white/[0.06] text-white/60">{item.leadChannel || item.channel}</Badge>
                      <Badge className="bg-white/[0.06] text-white/60">{item.leadStatus || 'new'}</Badge>
                      {item.draftState === 'pending_approval' && (
                        <Badge className="bg-amber-500/20 text-amber-300">needs approval</Badge>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </aside>

          <section className="rounded-3xl border border-white/[0.08] bg-[#111521] p-4 min-w-0">
            {!selectedId ? (
              <p className="text-sm text-white/40">Select a thread to start</p>
            ) : loadingThread ? (
              <p className="text-sm text-white/40">Loading conversation…</p>
            ) : (
              <>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="font-heading text-lg font-bold text-white">{thread?.lead?.name || 'Thread'}</h2>
                    <p className="text-xs text-white/35">{thread?.lead?.channel || 'unknown'} · {thread?.lead?.status || 'new'}</p>
                  </div>

                  {thread?.summary?.latestDecision?.confidence != null && (
                    <Badge className="bg-primary/20 text-primary">
                      confidence {(Number(thread.summary.latestDecision.confidence) * 100).toFixed(0)}%
                    </Badge>
                  )}
                </div>

                <div className="max-h-[58vh] space-y-3 overflow-y-auto pr-1">
                  {(thread?.messages || []).map((msg) => {
                    const isOut = msg.direction === 'out';
                    return (
                      <div key={msg.id} className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 border ${
                            isOut
                              ? 'bg-accent/20 border-accent/30 text-white'
                              : 'bg-white/[0.04] border-white/[0.08] text-white/85'
                          }`}
                        >
                          <div className="mb-1 flex items-center gap-2 text-[10px] text-white/40">
                            <span>{msg.channel}</span>
                            <span>•</span>
                            <span>{fmtTime(msg.timestamp)}</span>
                            {msg.sentByAI ? (
                              <Badge className="bg-primary/20 text-primary"><Bot className="mr-1 h-3 w-3" />AI</Badge>
                            ) : (
                              <Badge className="bg-white/[0.08] text-white/60"><MessageSquare className="mr-1 h-3 w-3" />Human</Badge>
                            )}
                            {msg.draftState === 'pending_approval' && (
                              <Badge className="bg-amber-500/20 text-amber-300"><AlertTriangle className="mr-1 h-3 w-3" />Review</Badge>
                            )}
                          </div>

                          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{msg.content}</p>

                          {Array.isArray(msg.riskFlags) && msg.riskFlags.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {msg.riskFlags.map((flag, i) => (
                                <Badge key={`${msg.id}-${i}`} className="bg-rose-500/20 text-rose-300">{flag}</Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3">
                  <label className="mb-1 block font-mono text-[11px] uppercase tracking-wider text-white/35">
                    Manual reply
                  </label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Type a reply..."
                      className="input-premium w-full"
                      onKeyDown={(e) => e.key === 'Enter' && handleReply()}
                    />
                    <button
                      type="button"
                      onClick={handleReply}
                      disabled={busy || !replyText.trim()}
                      className="inline-flex items-center justify-center gap-1 rounded-xl bg-accent px-3 py-2 text-xs font-bold text-[#090B12] disabled:opacity-50 sm:w-auto"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Send
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>

          <aside className="rounded-3xl border border-white/[0.08] bg-[#111521] p-4 min-w-0">
            <h2 className="mb-3 font-heading text-base font-semibold">AI Intelligence</h2>

            {/* Smart Reply Suggestions */}
            {thread?.lead && (
              <div className="mb-4 rounded-2xl border border-accent/20 bg-accent/[0.05] p-3">
                <p className="mb-2 flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-accent/70">
                  <Lightbulb className="h-3 w-3" />
                  Smart Replies
                </p>
                <div className="space-y-1.5">
                  {(SMART_REPLIES_BY_STATUS[thread.lead.status] || SMART_REPLIES_BY_STATUS.new).map((reply, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setReplyText(reply)}
                      className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-left text-[11px] text-white/70 transition hover:border-accent/30 hover:bg-accent/[0.07] hover:text-white"
                    >
                      {reply.length > 70 ? `${reply.slice(0, 70)}…` : reply}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {thread?.summary?.latestDecision ? (
              <div className="mb-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3 text-xs">
                <p className="mb-1 font-semibold text-white/80">Latest reasoning</p>
                <p className="text-white/60 break-words">
                  {thread.summary.latestDecision.reasoning || 'No reasoning available'}
                </p>
              </div>
            ) : (
              <p className="text-xs text-white/40">No AI decision yet</p>
            )}

            {thread?.summary?.intelligence ? (
              <div className="space-y-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3 text-xs">
                {Object.entries(thread.summary.intelligence).map(([key, value]) => (
                  <div key={key} className="flex items-start justify-between gap-2">
                    <span className="text-white/35">{key}</span>
                    <span className="text-right text-white/75 break-words">{String(value)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-white/40">No intelligence snapshot yet</p>
            )}

            {pendingDrafts.length > 0 && (
              <div className="mt-4 space-y-2">
                <h3 className="font-heading text-sm font-semibold text-white">Pending approvals</h3>
                {pendingDrafts.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3">
                    <textarea
                      value={approveEdits[item.id] || ''}
                      onChange={(e) => setApproveEdits((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      rows={4}
                      className="w-full rounded-xl border border-amber-500/20 bg-black/20 p-2 text-xs text-white/85 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleApprove(item.id)}
                      disabled={busy || !(approveEdits[item.id] || '').trim()}
                      className="mt-2 inline-flex items-center gap-1 rounded-xl bg-emerald-500 px-2.5 py-1.5 text-[11px] font-bold text-[#09110A] disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Approve & send
                    </button>
                  </div>
                ))}
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
