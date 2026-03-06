import { useState } from 'react';
import { CalendarClock, CheckCircle2, XCircle, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { apiRequest } from '../lib/api';

const STATUS_META = {
  scheduled: { label: 'Scheduled', classes: 'bg-sky-500/10 text-sky-400 border border-sky-500/20' },
  confirmed: { label: 'Confirmed', classes: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' },
  completed: { label: 'Completed', classes: 'bg-white/[0.05] text-white/30 border border-white/[0.08]' },
  cancelled: { label: 'Cancelled', classes: 'bg-rose-500/10 text-rose-400 border border-rose-500/20' },
};

function formatDateTime(dt) {
  if (!dt) return { date: '—', time: '' };
  const d = new Date(dt);
  const date = d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return { date, time };
}

export default function BookingsPanel({ bookings: propBookings }) {
  const [bookings, setBookings] = useState(propBookings);
  const [showAll, setShowAll] = useState(false);
  const [actionId, setActionId] = useState(null);

  const today = new Date().toISOString().slice(0, 10);
  const todayList = bookings.filter((b) => b.dateTime?.slice(0, 10) === today && b.status !== 'cancelled');
  const upcomingList = bookings
    .filter((b) => b.dateTime > new Date().toISOString() && b.status !== 'cancelled')
    .slice(0, 6);
  const displayed = showAll ? upcomingList : todayList;

  async function handleConfirm(id) {
    setActionId(id);
    try {
      const data = await apiRequest(`/bookings/${id}/confirm`, { method: 'POST' });
      setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, ...data.booking } : b)));
    } catch { /* ignore */ } finally {
      setActionId(null);
    }
  }

  async function handleCancel(id) {
    if (!window.confirm('Cancel this viewing?')) return;
    setActionId(id);
    try {
      const data = await apiRequest(`/bookings/${id}/cancel`, { method: 'POST' });
      setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, ...data.booking } : b)));
    } catch { /* ignore */ } finally {
      setActionId(null);
    }
  }

  return (
    <section className="rounded-3xl border border-white/[0.08] bg-[#111521] p-5 shadow-card">
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/10 border border-accent/20">
            <CalendarClock className="h-4 w-4 text-accent" />
          </div>
          <div>
            <h2 className="font-heading text-base font-semibold text-white">
              {showAll ? 'Upcoming Viewings' : "Today's Viewings"}
            </h2>
            <p className="font-mono text-[10px] uppercase tracking-widest text-white/30">
              {displayed.length} {showAll ? 'upcoming' : 'today'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowAll((s) => !s)}
          className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-xs font-medium text-white/50 transition hover:bg-white/[0.07] hover:text-white/80"
        >
          {showAll ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {showAll ? 'Today' : 'All'}
        </button>
      </header>

      <div className="space-y-2">
        {displayed.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/[0.08] p-5 text-center text-xs text-white/30">
            {showAll ? 'No upcoming viewings scheduled' : 'No viewings for today'}
          </div>
        ) : (
          displayed.map((booking) => {
            const { date, time } = formatDateTime(booking.dateTime);
            const statusMeta = STATUS_META[booking.status] || STATUS_META.scheduled;
            const busy = actionId === booking.id;

            return (
              <article
                key={booking.id}
                className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3 transition hover:border-white/[0.10] hover:bg-white/[0.05]"
              >
                <div className="flex items-start gap-3">
                  {/* Date badge */}
                  <div className="flex w-11 flex-shrink-0 flex-col items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.06] py-1.5 text-center">
                    <span className="font-mono text-[15px] font-bold leading-none text-white tabular-nums">
                      {new Date(booking.dateTime).getDate()}
                    </span>
                    <span className="mt-0.5 font-mono text-[8px] font-semibold uppercase tracking-wider text-white/40">
                      {new Date(booking.dateTime).toLocaleString('default', { month: 'short' })}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-white">{booking.leadName}</p>
                      <span
                        className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${statusMeta.classes}`}
                      >
                        {statusMeta.label}
                      </span>
                    </div>

                    <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/40">
                      <Clock className="h-3 w-3" />
                      {time}
                      {booking.property && (
                        <>
                          <span className="text-white/20">·</span>
                          <span className="truncate">{booking.property}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {booking.status === 'scheduled' && (
                  <div className="mt-2.5 flex gap-2 pl-[56px]">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleConfirm(booking.id)}
                      className="inline-flex items-center gap-1 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-400 transition hover:bg-emerald-500/20 disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      Confirm
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleCancel(booking.id)}
                      className="inline-flex items-center gap-1 rounded-xl border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold text-rose-400 transition hover:bg-rose-500/20 disabled:opacity-50"
                    >
                      <XCircle className="h-3 w-3" />
                      Cancel
                    </button>
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
