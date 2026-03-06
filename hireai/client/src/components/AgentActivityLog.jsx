import clsx from 'clsx';

const colorMap = {
  green:  'bg-emerald-50  border-emerald-100 text-emerald-700',
  blue:   'bg-sky-50      border-sky-100     text-sky-700',
  yellow: 'bg-amber-50   border-amber-100   text-amber-700',
  red:    'bg-rose-50    border-rose-100    text-rose-700',
};

const dotMap = {
  green:  'bg-emerald-400',
  blue:   'bg-sky-400',
  yellow: 'bg-amber-400',
  red:    'bg-rose-400',
};

function colorByAction(action) {
  if (action === 'booked')      return 'blue';
  if (action === 'escalated')   return 'yellow';
  if (action === 'needs_human') return 'red';
  if (action === 'followed_up') return 'red';
  return 'green';
}

export default function AgentActivityLog({ items }) {
  return (
    <section className="rounded-3xl bg-white p-5 shadow-card">
      <header className="mb-4">
        <h2 className="text-base font-semibold text-gray-900">Agent Activity</h2>
        <p className="text-xs text-gray-400">Real-time AI actions</p>
      </header>

      <div className="max-h-[28vh] space-y-2 overflow-y-auto pr-0.5">
        {items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gray-200 p-4 text-center text-xs text-gray-400">
            No activity yet
          </p>
        ) : (
          items.map((item) => {
            const color = item.color || colorByAction(item.action);
            return (
              <article
                key={item.id}
                className={clsx(
                  'slide-in-top flex gap-2.5 rounded-2xl border px-3 py-2.5 text-xs',
                  colorMap[color] || 'bg-gray-50 border-gray-100 text-gray-600'
                )}
              >
                <span className={clsx('mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full', dotMap[color] || 'bg-gray-400')} />
                <div className="min-w-0">
                  <p className="text-[10px] font-mono text-gray-400">
                    {new Date(item.timestamp || item.createdAt).toLocaleTimeString()}
                  </p>
                  <p className="mt-0.5 leading-relaxed">{item.description || item.message}</p>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
