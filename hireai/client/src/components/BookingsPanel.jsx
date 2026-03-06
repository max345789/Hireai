import { useState } from 'react';
import { CalendarClock, CheckCircle2, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { apiRequest } from '../lib/api';

const STATUS_STYLES = {
  scheduled: 'bg-sky-50    text-sky-600    border border-sky-100',
  confirmed: 'bg-emerald-50 text-emerald-600 border border-emerald-100',
  completed: 'bg-gray-50   text-gray-500   border border-gray-100',
  cancelled: 'bg-rose-50   text-rose-600   border border-rose-100',
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
    <section className="rounded-3xl bg-white p-5 shadow-card">
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-50">
            <CalendarClock className="h-4 w-4 text-accent" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              {showAll ? 'Upcoming Viewings' : "Today's Viewings"}
            </h2>
            <p className="text-xs text-gray-400">{displayed.length} {showAll ? 'upcoming' : 'today'}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowAll((s) => !s)}
          className="flex items-center gap-1 rounded-xl border border-gray-100 bg-gray-50 px-2.5 py-1.5 text-xs font-medium text-gray-500 transition hover:bg-gray-100"
        >
          {showAll ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {showAll ? 'Today' : 'Upcoming'}
        </button>
      </header>

      <div className="space-y-2">
        {displayed.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gray-200 p-3 text-center text-xs text-gray-400">
            {showAll ? 'No upcoming viewings' : 'No viewings scheduled for today'}
          </p>
        ) : (
          displayed.map((booking) => (
            <article key={booking.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900">{booking.leadName}</p>
                  <p className="text-xs text-gray-400">{new Date(booking.dateTime).toLocaleString()}</p>
                  {booking.property && (
                    <p className="mt-0.5 truncate text-xs text-gray-500">{booking.property}</p>
                  )}
                </div>
                <span className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold capitalize ${STATUS_STYLES[booking.status] || 'bg-gray-50 text-gray-500 border border-gray-100'}`}>
                  {booking.status}
                </span>
              </div>
              {booking.status === 'scheduled' && (
                <div className="mt-2.5 flex gap-2">
                  <button
                    type="button"
                    disabled={actionId === booking.id}
                    onClick={() => handleConfirm(booking.id)}
                    className="inline-flex items-center gap-1 rounded-xl border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-600 transition hover:bg-emerald-100 disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    Confirm
                  </button>
                  <button
                    type="button"
                    disabled={actionId === booking.id}
                    onClick={() => handleCancel(booking.id)}
                    className="inline-flex items-center gap-1 rounded-xl border border-rose-100 bg-rose-50 px-2.5 py-1 text-[11px] font-medium text-rose-600 transition hover:bg-rose-100 disabled:opacity-50"
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
