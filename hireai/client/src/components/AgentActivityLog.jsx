import clsx from 'clsx';
import { Bot, Calendar, AlertTriangle, UserCheck, MessageSquare, RotateCcw, ArrowUpRight } from 'lucide-react';

const actionMeta = {
  booked:      { icon: Calendar,      color: 'text-sky-600',     dot: 'bg-sky-400',     bg: 'bg-sky-50' },
  escalated:   { icon: AlertTriangle, color: 'text-amber-600',   dot: 'bg-amber-400',   bg: 'bg-amber-50' },
  needs_human: { icon: UserCheck,     color: 'text-rose-600',    dot: 'bg-rose-400',    bg: 'bg-rose-50' },
  followed_up: { icon: RotateCcw,     color: 'text-violet-600',  dot: 'bg-violet-400',  bg: 'bg-violet-50' },
  qualified:   { icon: ArrowUpRight,  color: 'text-emerald-600', dot: 'bg-emerald-400', bg: 'bg-emerald-50' },
  replied:     { icon: MessageSquare, color: 'text-accent',      dot: 'bg-accent',      bg: 'bg-orange-50' },
};

const defaultMeta = { icon: Bot, color: 'text-gray-500', dot: 'bg-gray-300', bg: 'bg-gray-50' };

function getActionMeta(action) {
  return actionMeta[action] || defaultMeta;
}

function fmt(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function AgentActivityLog({ items }) {
  return (
    <section className="rounded-3xl bg-white p-5 shadow-card">
      <header className="mb-4">
        <h2 className="text-base font-semibold text-gray-900">Agent Activity</h2>
        <p className="text-xs text-gray-400">Real-time AI actions timeline</p>
      </header>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-center text-xs text-gray-400">
          No activity yet — waiting for AI actions
        </div>
      ) : (
        <div className="relative max-h-[28vh] overflow-y-auto pr-0.5">
          {/* Vertical timeline line */}
          <div className="timeline-line" />

          <div className="space-y-0 pl-6">
            {items.map((item, idx) => {
              const meta = getActionMeta(item.action);
              const Icon = meta.icon;
              const isLast = idx === items.length - 1;

              return (
                <div
                  key={item.id}
                  className={clsx(
                    'animate-fade-in relative flex gap-3 py-2.5',
                    !isLast && 'border-b border-gray-50'
                  )}
                >
                  {/* Timeline dot */}
                  <div
                    className={clsx(
                      'absolute -left-[15px] top-3.5 flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full border-2 border-white shadow-xs',
                      meta.bg
                    )}
                  >
                    <Icon className={clsx('h-3 w-3', meta.color)} />
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs leading-snug text-gray-700">{item.description || item.message}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-gray-400">{fmt(item.timestamp || item.createdAt)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
