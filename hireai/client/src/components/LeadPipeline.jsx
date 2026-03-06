import clsx from 'clsx';

const columns = [
  { key: 'new', label: 'New', tint: 'from-slate-600/30 to-slate-800/10' },
  { key: 'qualified', label: 'Qualified', tint: 'from-violet-500/30 to-violet-900/10' },
  { key: 'booked', label: 'Booked', tint: 'from-sky-500/30 to-sky-900/10' },
  { key: 'closed', label: 'Closed', tint: 'from-emerald-500/30 to-emerald-900/10' },
];

const statusChoices = ['new', 'qualified', 'booked', 'closed', 'escalated'];

function columnKeyForLeadStatus(status) {
  if (status === 'escalated') return 'qualified';
  return status;
}

function LeadCard({ lead, selected, moved, onSelect, onMove }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(lead)}
      className={clsx(
        'w-full rounded-xl border p-3 text-left transition',
        moved && 'ring-2 ring-accent/80 animate-pulse',
        selected
          ? 'border-accent bg-accent/10 shadow-glow'
          : 'border-white/5 bg-surface/70 hover:border-accent/40'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-white">{lead.name}</p>
        {lead.status === 'escalated' && (
          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-200">Escalated</span>
        )}
      </div>
      <p className="mt-0.5 text-[11px] text-textSoft">{lead.channel} • {lead.lastMessageAt ? new Date(lead.lastMessageAt).toLocaleTimeString() : 'new'}</p>
      <p className="mt-2 line-clamp-2 text-xs text-slate-300">{lead.lastMessage || 'No messages yet'}</p>

      <label className="mt-3 block text-[11px] text-textSoft">
        Move stage
        <select
          value={lead.status}
          onChange={(event) => onMove(lead.id, event.target.value)}
          className="mt-1 w-full rounded-lg border border-white/10 bg-bg px-2 py-1 text-xs text-white outline-none"
        >
          {statusChoices.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </label>
    </button>
  );
}

export default function LeadPipeline({ leads, selectedLead, movedLeadId, onSelectLead, onMoveLead }) {
  return (
    <section className="rounded-2xl border border-white/5 bg-card/95 p-4">
      <header className="mb-3">
        <h2 className="font-heading text-lg text-white">Lead Pipeline</h2>
        <p className="text-xs text-textSoft">New → Qualified → Booked → Closed</p>
      </header>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {columns.map((column) => {
          const stageLeads = leads.filter((lead) => columnKeyForLeadStatus(lead.status) === column.key);

          return (
            <div key={column.key} className={`rounded-xl border border-white/5 bg-gradient-to-b ${column.tint} p-3`}>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">{column.label}</h3>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-textSoft">{stageLeads.length}</span>
              </div>

              <div className="space-y-2">
                {stageLeads.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-white/10 p-3 text-center text-xs text-textSoft">No leads</p>
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
