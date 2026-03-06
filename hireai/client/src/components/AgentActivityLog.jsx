import clsx from 'clsx';
import { Bot, Calendar, AlertTriangle, UserCheck, MessageSquare, RotateCcw, ArrowUpRight } from 'lucide-react';

const actionMeta = {
  booked:      { icon: Calendar,      color: 'text-sky-400',     dot: 'bg-sky-400',     bg: 'bg-sky-500/10' },
  escalated:   { icon: AlertTriangle, color: 'text-amber-400',   dot: 'bg-amber-400',   bg: 'bg-amber-500/10' },
  needs_human: { icon: UserCheck,     color: 'text-rose-400',    dot: 'bg-rose-400',    bg: 'bg-rose-500/10' },
  followed_up: { icon: RotateCcw,     color: 'text-violet-400',  dot: 'bg-violet-400',  bg: 'bg-violet-500/10' },
  qualified:   { icon: ArrowUpRight,  color: 'text-emerald-400', dot: 'bg-emerald-400', bg: 'bg-emerald-500/10' },
  replied:     { icon: MessageSquare, color: 'text-accent',      dot: 'bg-accent',      bg: 'bg-accent/10' },
};

const defaultMeta = { icon: Bot, color: 'text-white/40', dot: 'bg-white/20', bg: 'bg-white/[0.05]' };

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
    <section className="rounded-3xl border border-white/[0.08] bg-[#111521] p-5 shadow-card">
      <header className="mb-4">
        <h2 className="font-heading text-base font-semibold text-white">Agent Activity</h2>
        <p className="font-mono text-[10px] uppercase tracking-widest text-white/30">Real-time AI actions timeline</p>
      </header>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/[0.08] p-6 text-center text-xs text-white/30">
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
                    !isLast && 'border-b border-white/[0.05]'
                  )}
                >
                  {/* Timeline dot */}
                  <div
                    className={clsx(
                      'absolute -left-[15px] top-3.5 flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full border border-white/[0.08]',
                      meta.bg
                    )}
                  >
                    <Icon className={clsx('h-3 w-3', meta.color)} />
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs leading-snug text-white/70">{item.description || item.message}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-white/30">{fmt(item.timestamp || item.createdAt)}</p>
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
