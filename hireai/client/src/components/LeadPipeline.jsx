import clsx from 'clsx';

const columns = [
  { key: 'new',       label: 'New',       dot: 'bg-gray-400',    ring: 'border-gray-100 bg-gray-50' },
  { key: 'qualified', label: 'Qualified', dot: 'bg-accent',      ring: 'border-orange-100 bg-orange-50' },
  { key: 'booked',    label: 'Booked',    dot: 'bg-sky-400',     ring: 'border-sky-100 bg-sky-50' },
  { key: 'closed',    label: 'Closed',    dot: 'bg-emerald-400', ring: 'border-emerald-100 bg-emerald-50' },
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
        'w-full rounded-2xl border p-3 text-left transition',
        moved && 'ring-2 ring-accent/60 animate-pulse',
        selected
          ? 'border-accent/40 bg-orange-50 shadow-glow'
          : 'border-gray-100 bg-white hover:border-accent/30 hover:shadow-card'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-gray-900">{lead.name}</p>
        {lead.status === 'escalated' && (
          <span className="rounded-full border border-amber-100 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
            Escalated
          </span>
        )}
      </div>
      <p className="mt-0.5 text-[11px] text-gray-400">
        {lead.channel} · {lead.lastMessageAt ? new Date(lead.lastMessageAt).toLocaleTimeString() : 'new'}
      </p>
      <p className="mt-1.5 line-clamp-2 text-xs text-gray-500">{lead.lastMessage || 'No messages yet'}</p>

      <label className="mt-3 block text-[11px] text-gray-400">
        Move stage
        <select
          value={lead.status}
          onChange={(event) => onMove(lead.id, event.target.value)}
          className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700 outline-none focus:border-accent"
        >
          {statusChoices.map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
      </label>
    </button>
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
        {columns.map((column) => {
          const stageLeads = leads.filter((lead) => columnKeyForLeadStatus(lead.status) === column.key);

          return (
            <div key={column.key} className={clsx('rounded-2xl border p-3', column.ring)}>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={clsx('h-2 w-2 rounded-full', column.dot)} />
                  <h3 className="text-sm font-semibold text-gray-700">{column.label}</h3>
                </div>
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-gray-500 shadow-sm">
                  {stageLeads.length}
                </span>
              </div>

              <div className="space-y-2">
                {stageLeads.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-gray-200 p-3 text-center text-xs text-gray-400">
                    No leads
                  </p>
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
