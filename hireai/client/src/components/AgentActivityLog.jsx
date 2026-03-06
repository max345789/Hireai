import clsx from 'clsx';

const colorMap = {
  green: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200',
  blue: 'border-sky-400/30 bg-sky-500/10 text-sky-200',
  yellow: 'border-amber-400/30 bg-amber-500/10 text-amber-200',
  red: 'border-rose-400/30 bg-rose-500/10 text-rose-200',
};

function colorByAction(action) {
  if (action === 'booked') return 'blue';
  if (action === 'escalated') return 'yellow';
  if (action === 'needs_human') return 'red';
  if (action === 'followed_up') return 'red';
  return 'green';
}

export default function AgentActivityLog({ items }) {
  return (
    <section className="rounded-2xl border border-white/5 bg-card/95 p-4">
      <header className="mb-3">
        <h2 className="font-heading text-lg text-white">Agent Activity Log</h2>
        <p className="font-mono text-[11px] text-textSoft">Real-time AI actions</p>
      </header>

      <div className="max-h-[28vh] space-y-2 overflow-y-auto pr-1">
        {items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-white/10 p-4 text-center text-xs text-textSoft">No activity yet</p>
        ) : (
          items.map((item) => (
            <article
              key={item.id}
              className={clsx(
                'slide-in-top rounded-lg border px-3 py-2 text-xs',
                colorMap[item.color || colorByAction(item.action)] || 'border-white/10 bg-white/5 text-slate-200'
              )}
            >
              <p className="font-mono text-[11px] opacity-90">[{new Date(item.timestamp || item.createdAt).toLocaleTimeString()}]</p>
              <p className="mt-0.5">{item.description || item.message}</p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
