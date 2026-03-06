import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';

const columns = [
  {
    key: 'new',
    label: 'New',
    dot:   'bg-gray-400',
    header: 'bg-gray-50 border-gray-200',
    count:  'bg-gray-100 text-gray-600',
  },
  {
    key: 'qualified',
    label: 'Qualified',
    dot:   'bg-accent',
    header: 'bg-orange-50 border-orange-200',
    count:  'bg-orange-100 text-accent',
  },
  {
    key: 'booked',
    label: 'Booked',
    dot:   'bg-sky-400',
    header: 'bg-sky-50 border-sky-200',
    count:  'bg-sky-100 text-sky-600',
  },
  {
    key: 'closed',
    label: 'Closed',
    dot:   'bg-emerald-400',
    header: 'bg-emerald-50 border-emerald-200',
    count:  'bg-emerald-100 text-emerald-600',
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
  return 'bg-gray-300';
}

function LeadCard({ lead, selected, moved, onSelect, onMove }) {
  const channel = lead.channel || 'web';
  const channelEmoji = channel === 'whatsapp' ? '📱'
    : channel === 'email' ? '📧'
    : channel === 'instagram' ? '📸'
    : channel === 'messenger' ? '💙'
    : '💬';

  return (
    <div
      className={clsx(
        'group w-full rounded-2xl border p-3 text-left transition-all duration-200 cursor-pointer',
        moved && 'ring-2 ring-accent/50 animate-pulse',
        selected
          ? 'border-accent/40 bg-orange-50 shadow-glow-sm'
          : 'border-gray-100 bg-white hover:border-accent/25 hover:shadow-card'
      )}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(lead)}
      onKeyDown={(e) => e.key === 'Enter' && onSelect(lead)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* Sentiment indicator */}
          <div className={clsx('mt-1 h-2 w-2 flex-shrink-0 rounded-full', sentimentDot(lead.sentiment))} />
          <p className="text-sm font-semibold text-gray-900 leading-snug">{lead.name}</p>
        </div>
        {lead.status === 'escalated' && (
          <span className="flex-shrink-0 rounded-full border border-amber-100 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-600">
            ⚠ Escalated
          </span>
        )}
      </div>

      <p className="mt-1 text-[11px] text-gray-400">
        {channelEmoji} {channel} · {lead.lastMessageAt
          ? new Date(lead.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : 'new'}
      </p>

      <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-gray-500">
        {lead.lastMessage || 'No messages yet'}
      </p>

      {/* Stage mover */}
      <div className="mt-3" onClick={(e) => e.stopPropagation()} role="presentation">
        <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">
          Move stage
        </label>
        <div className="relative">
          <select
            value={lead.status}
            onChange={(e) => onMove(lead.id, e.target.value)}
            className="w-full appearance-none rounded-xl border border-gray-200 bg-gray-50 pl-3 pr-7 py-1.5 text-xs text-gray-700 outline-none transition focus:border-accent focus:bg-white"
          >
            {statusChoices.map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" />
        </div>
      </div>
    </div>
  );
}

export default function LeadPipeline({ leads, selectedLead, movedLeadId, onSelectLead, onMoveLead }) {
  return (
    <section className="rounded-3xl bg-white p-5 shadow-card">
      <header className="mb-4">
        <h2 className="text-base font-semibold text-gray-900">Lead Pipeline</h2>
        <p className="text-xs text-gray-400">New → Qualified → Booked → Closed</p>
      </header>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {columns.map((col) => {
          const stageLeads = leads.filter((l) => columnKeyForLeadStatus(l.status) === col.key);

          return (
            <div key={col.key} className="rounded-2xl border border-gray-100 bg-gray-50/50">
              {/* Column header */}
              <div className={clsx('flex items-center justify-between rounded-t-2xl border-b px-3 py-2.5', col.header)}>
                <div className="flex items-center gap-2">
                  <span className={clsx('h-2 w-2 rounded-full', col.dot)} />
                  <h3 className="text-xs font-bold text-gray-700">{col.label}</h3>
                </div>
                <span className={clsx('rounded-full px-2 py-0.5 text-[11px] font-bold', col.count)}>
                  {stageLeads.length}
                </span>
              </div>

              {/* Cards */}
              <div className="space-y-2 p-2">
                {stageLeads.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-200 p-3 text-center text-xs text-gray-400">
                    No leads
                  </div>
                ) : (
                  stageLeads.map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      moved={Number(movedLeadId) === Number(lead.id)}
                      selected={selectedLead?.id === lead.id}
                      onSelect={onSelectLead}
                      onMove={onMoveLead}
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
