import { useState } from 'react';
import { CalendarClock, CheckCircle2, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { apiRequest } from '../lib/api';

const STATUS_STYLES = {
  scheduled: 'bg-blue-500/20 text-blue-300',
  confirmed: 'bg-emerald-500/20 text-emerald-300',
  completed: 'bg-white/10 text-textSoft',
  cancelled: 'bg-rose-500/20 text-rose-300',
};

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
    <section className="rounded-2xl border border-white/5 bg-card/95 p-4">
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-accent" />
          <div>
            <h2 className="font-heading text-lg text-white">{showAll ? 'Upcoming Viewings' : "Today's Viewings"}</h2>
            <p className="text-xs text-textSoft">{displayed.length} {showAll ? 'upcoming' : 'today'}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowAll((s) => !s)}
          className="flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-xs text-textSoft hover:text-white"
        >
          {showAll ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {showAll ? 'Today' : 'Upcoming'}
        </button>
      </header>

      <div className="space-y-2">
        {displayed.length === 0 ? (
          <p className="rounded-lg border border-dashed border-white/10 p-3 text-center text-xs text-textSoft">
            {showAll ? 'No upcoming viewings' : 'No viewings scheduled for today'}
          </p>
        ) : (
          displayed.map((booking) => (
            <article key={booking.id} className="rounded-lg border border-white/10 bg-surface/70 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{booking.leadName}</p>
                  <p className="text-xs text-textSoft">{new Date(booking.dateTime).toLocaleString()}</p>
                  {booking.property && <p className="mt-0.5 truncate text-xs text-slate-300">{booking.property}</p>}
                </div>
                <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${STATUS_STYLES[booking.status] || 'bg-surface text-textSoft'}`}>
                  {booking.status}
                </span>
              </div>
              {booking.status === 'scheduled' && (
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    disabled={actionId === booking.id}
                    onClick={() => handleConfirm(booking.id)}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2 py-1 text-[10px] text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    Confirm
                  </button>
                  <button
                    type="button"
                    disabled={actionId === booking.id}
                    onClick={() => handleCancel(booking.id)}
                    className="inline-flex items-center gap-1 rounded-lg bg-rose-500/15 px-2 py-1 text-[10px] text-rose-300 hover:bg-rose-500/25 disabled:opacity-50"
                  >
                    <XCircle className="h-3 w-3" />
                    Cancel
                  </button>
                </div>
              )}
            </article>
          ))
        )}
      </div>
    </section>
  );
}
