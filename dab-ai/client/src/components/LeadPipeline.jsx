import { useState } from 'react';
import clsx from 'clsx';
import { ChevronDown, Trash2, Download, CheckSquare, Square } from 'lucide-react';
import { apiRequest } from '../lib/api';

const columns = [
  {
    key: 'new',
    label: 'New',
    dot:    'bg-white/40',
    header: 'bg-white/[0.04] border-white/[0.08]',
    count:  'bg-white/[0.08] text-white/50',
  },
  {
    key: 'qualified',
    label: 'Qualified',
    dot:    'bg-accent',
    header: 'bg-accent/[0.07] border-accent/20',
    count:  'bg-accent/10 text-accent',
  },
  {
    key: 'booked',
    label: 'Booked',
    dot:    'bg-sky-400',
    header: 'bg-sky-500/[0.07] border-sky-500/20',
    count:  'bg-sky-500/10 text-sky-400',
  },
  {
    key: 'closed',
    label: 'Closed',
    dot:    'bg-emerald-400',
    header: 'bg-emerald-500/[0.07] border-emerald-500/20',
    count:  'bg-emerald-500/10 text-emerald-400',
  },
];

const statusChoices = ['new', 'qualified', 'booked', 'closed', 'escalated'];

function columnKeyForLeadStatus(status) {
  if (status === 'escalated') return 'qualified';
  return status;
}

function sentimentDot(sentiment) {
  if (sentiment === 'positive') return 'bg-emerald-400';
  if (sentiment === 'negative') return 'bg-rose-400';
  return 'bg-white/20';
}

function ScoreBadge({ score }) {
  if (score == null) return null;
  const color = score >= 75 ? 'bg-red-500/20 text-red-400 border-red-500/30'
    : score >= 50 ? 'bg-orange-500/20 text-orange-400 border-orange-500/30'
    : score >= 25 ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    : 'bg-white/[0.06] text-white/40 border-white/[0.10]';
  const label = score >= 75 ? '🔥' : score >= 50 ? '♨' : score >= 25 ? '❄' : '·';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${color}`}>
      {label} {score}
    </span>
  );
}

function LeadCard({ lead, selected, moved, onSelect, onMove, checked, onCheck }) {
  const channel = lead.channel || 'web';
  const channelEmoji = channel === 'whatsapp' ? '📱'
    : channel === 'email' ? '📧'
    : channel === 'instagram' ? '📸'
    : channel === 'messenger' ? '💙'
    : '💬';

  return (
    <div
      className={clsx(
        'group w-full rounded-2xl border p-3 text-left transition-all duration-200 cursor-pointer min-w-0',
        moved && 'ring-2 ring-accent/50 animate-pulse',
        selected
          ? 'border-accent/30 bg-accent/[0.07] shadow-glow-sm'
          : 'border-white/[0.07] bg-white/[0.03] hover:border-accent/20 hover:bg-white/[0.05]'
      )}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(lead)}
      onKeyDown={(e) => e.key === 'Enter' && onSelect(lead)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {/* Checkbox for bulk selection */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onCheck(lead.id); }}
            className="flex-shrink-0 text-white/30 hover:text-accent transition-colors"
          >
            {checked ? <CheckSquare className="h-3.5 w-3.5 text-accent" /> : <Square className="h-3.5 w-3.5" />}
          </button>
          {/* Sentiment indicator */}
          <div className={clsx('mt-0.5 h-2 w-2 flex-shrink-0 rounded-full', sentimentDot(lead.sentiment))} />
          <p className="text-sm font-semibold text-white leading-snug truncate">{lead.name}</p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1.5">
          <ScoreBadge score={lead.leadScore} />
          {lead.status === 'escalated' && (
            <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400">
              ⚠
            </span>
          )}
        </div>
      </div>

      <p className="mt-1 text-[11px] text-white/40">
        {channelEmoji} {channel} · {lead.lastMessageAt
          ? new Date(lead.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : 'new'}
      </p>

      <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-white/50">
        {lead.lastMessage || 'No messages yet'}
      </p>

      {/* Stage mover */}
      <div className="mt-3" onClick={(e) => e.stopPropagation()} role="presentation">
        <label className="block font-mono text-[10px] font-semibold uppercase tracking-wider text-white/30 mb-1">
          Move stage
        </label>
        <div className="relative">
          <select
            value={lead.status}
            onChange={(e) => onMove(lead.id, e.target.value)}
            className="w-full appearance-none rounded-xl border border-white/[0.08] bg-white/[0.05] pl-3 pr-7 py-1.5 text-xs text-white/70 outline-none transition focus:border-accent/50 focus:bg-white/[0.08]"
          >
            {statusChoices.map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-white/30" />
        </div>
      </div>
    </div>
  );
}

export default function LeadPipeline({ leads, selectedLead, movedLeadId, onSelectLead, onMoveLead }) {
  const [checkedIds, setCheckedIds] = useState(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkError, setBulkError] = useState('');

  function toggleCheck(id) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearChecked() { setCheckedIds(new Set()); }

  async function handleBulkAction(action) {
    if (checkedIds.size === 0) return;
    setBulkLoading(true);
    setBulkError('');
    try {
      await apiRequest('/leads/bulk', {
        method: 'POST',
        body: JSON.stringify({ action, leadIds: Array.from(checkedIds) }),
      });
      clearChecked();
      // Let parent refresh by triggering a status move on first lead (workaround)
      // In a full implementation we'd call a refresh prop
    } catch (err) {
      setBulkError(err.message || 'Bulk action failed');
    } finally {
      setBulkLoading(false);
    }
  }

  const hasChecked = checkedIds.size > 0;

  return (
    <section className="rounded-3xl border border-white/[0.08] bg-[#111521] p-5 shadow-card min-w-0">
      <header className="mb-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="font-heading text-base font-semibold text-white">Lead Pipeline</h2>
            <p className="font-mono text-[10px] uppercase tracking-widest text-white/30">
              New → Qualified → Booked → Closed
            </p>
          </div>
          <a
            href="/api/leads/export.csv"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.10] bg-white/[0.04] px-2.5 py-1.5 text-[11px] text-white/50 transition hover:bg-white/[0.08] hover:text-white"
          >
            <Download className="h-3 w-3" />
            Export
          </a>
        </div>

        {/* Bulk action bar */}
        {hasChecked && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-accent/20 bg-accent/[0.06] px-3 py-2">
            <span className="font-mono text-[11px] text-accent">{checkedIds.size} selected</span>
            <div className="flex flex-wrap gap-1.5 ml-auto">
              {['qualified', 'booked', 'closed'].map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={bulkLoading}
                  onClick={() => handleBulkAction(s)}
                  className="rounded-xl border border-white/[0.10] bg-white/[0.05] px-2.5 py-1 text-[11px] font-semibold text-white/70 transition hover:bg-white/[0.10] disabled:opacity-50"
                >
                  → {s}
                </button>
              ))}
              <button
                type="button"
                disabled={bulkLoading}
                onClick={() => handleBulkAction('archive')}
                className="inline-flex items-center gap-1 rounded-xl border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold text-rose-400 transition hover:bg-rose-500/20 disabled:opacity-50"
              >
                <Trash2 className="h-3 w-3" />
                Archive
              </button>
              <button
                type="button"
                onClick={clearChecked}
                className="rounded-xl border border-white/[0.08] bg-transparent px-2.5 py-1 text-[11px] text-white/40 transition hover:text-white"
              >
                Clear
              </button>
            </div>
            {bulkError && <p className="w-full text-[11px] text-rose-400">{bulkError}</p>}
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {columns.map((col) => {
          const stageLeads = leads.filter((l) => columnKeyForLeadStatus(l.status) === col.key);

          return (
            <div key={col.key} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] min-w-0">
              {/* Column header */}
              <div className={clsx('flex items-center justify-between rounded-t-2xl border-b px-3 py-2.5', col.header)}>
                <div className="flex items-center gap-2">
                  <span className={clsx('h-2 w-2 rounded-full', col.dot)} />
                  <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-white/70">{col.label}</h3>
                </div>
                <span className={clsx('rounded-full px-2 py-0.5 text-[11px] font-bold', col.count)}>
                  {stageLeads.length}
                </span>
              </div>

              {/* Cards */}
              <div className="space-y-2 p-2">
                {stageLeads.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/[0.06] p-3 text-center text-xs text-white/25">
                    No leads
                  </div>
                ) : (
                  stageLeads.map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      moved={Number(movedLeadId) === Number(lead.id)}
                      selected={selectedLead?.id === lead.id}
                      checked={checkedIds.has(lead.id)}
                      onSelect={onSelectLead}
                      onMove={onMoveLead}
                      onCheck={toggleCheck}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
