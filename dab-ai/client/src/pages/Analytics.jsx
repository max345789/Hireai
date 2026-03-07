import { useEffect, useState } from 'react';
import {
  ArrowLeft, TrendingUp, MessageSquare, Users, Calendar,
  Clock, Zap, DollarSign, Download, BarChart2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../lib/api';

const RANGES = [
  { label: 'Today',   days: 1 },
  { label: '7 Days',  days: 7 },
  { label: '30 Days', days: 30 },
  { label: '90 Days', days: 90 },
];

const METRIC_CONFIG = [
  { key: 'messages.total',      label: 'Total Messages',    icon: MessageSquare, color: 'text-accent',      bg: 'bg-orange-50',   border: 'border-orange-100' },
  { key: 'messages.aiReplies',  label: 'AI Replies',        icon: Zap,           color: 'text-violet-600',  bg: 'bg-violet-50',   border: 'border-violet-100' },
  { key: 'leads.total',         label: 'Total Leads',       icon: Users,         color: 'text-sky-600',     bg: 'bg-sky-50',      border: 'border-sky-100' },
  { key: 'leads.qualified',     label: 'Qualified',         icon: TrendingUp,    color: 'text-emerald-600', bg: 'bg-emerald-50',  border: 'border-emerald-100' },
  { key: 'bookings.total',      label: 'Viewings Booked',   icon: Calendar,      color: 'text-amber-600',   bg: 'bg-amber-50',    border: 'border-amber-100' },
  { key: 'avgResponseMinutes',  label: 'Avg Response',      icon: Clock,         color: 'text-rose-600',    bg: 'bg-rose-50',     border: 'border-rose-100' },
];

function getNestedValue(obj, keyPath) {
  return keyPath.split('.').reduce((acc, k) => (acc ? acc[k] : undefined), obj);
}

function MetricCard({ icon: Icon, label, value, sub, color, bg, border }) {
  return (
    <div className={`rounded-2xl border ${border} ${bg} p-4`}>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500">{label}</span>
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg bg-white shadow-xs`}>
          <Icon className={`h-3.5 w-3.5 ${color}`} />
        </div>
      </div>
      <p className={`tabular-nums text-2xl font-bold leading-none ${color}`}>{value ?? '—'}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

function HeatmapBar({ hour, count, max }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  const label = hour === 0 ? '12am' : hour < 12 ? `${hour}am` : hour === 12 ? '12pm' : `${hour - 12}pm`;
  const opacity = pct === 0 ? 'bg-gray-100' : pct < 25 ? 'bg-accent/20' : pct < 60 ? 'bg-accent/50' : 'bg-accent';

  return (
    <div className="flex flex-col items-center gap-1" title={`${label}: ${count} messages`}>
      <div className="flex h-14 w-full items-end">
        <div
          className={`w-full rounded-t transition-all ${opacity}`}
          style={{ height: `${Math.max(pct, 3)}%` }}
        />
      </div>
      <span className="text-[9px] text-gray-400">{hour % 4 === 0 ? label : ''}</span>
    </div>
  );
}

function FunnelBar({ label, value, total, color }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 text-right text-xs text-gray-500">{label}</span>
      <div className="flex-1 overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-2.5 rounded-full ${color} transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 tabular-nums text-right text-xs font-semibold text-gray-900">{value}</span>
      <span className="w-9 tabular-nums text-right text-[10px] text-gray-400">{pct}%</span>
    </div>
  );
}

function SparkLine({ data }) {
  if (!data || data.length < 2) {
    return <p className="flex h-16 items-center justify-center text-xs text-gray-400">Not enough data</p>;
  }
  const max = Math.max(...data.map((d) => d.count), 1);
  const W = 300; const H = 60;
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - (d.count / max) * (H - 4);
    return `${x},${y}`;
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 64 }}>
      {/* Fill gradient */}
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E8604C" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#E8604C" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${H} ${pts.join(' ')} ${W},${H}`}
        fill="url(#spark-fill)"
      />
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke="#E8604C"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function Analytics() {
  const [rangeIdx, setRangeIdx] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    const days = RANGES[rangeIdx].days;
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const to   = new Date().toISOString();

    apiRequest(`/analytics/range?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .then((d) => setData(d))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [rangeIdx]);

  const heatmapMax = data ? Math.max(...(data.heatmap || []).map((h) => h.count), 1) : 1;
  const totalLeads = data?.leads?.total || 0;

  function exportCSV() {
    if (!data) return;
    const rows = [
      ['Metric', 'Value'],
      ['Total Messages', data.messages?.total],
      ['AI Replies', data.messages?.aiReplies],
      ['Total Leads', data.leads?.total],
      ['Qualified', data.leads?.qualified],
      ['Booked', data.leads?.booked],
      ['Closed', data.leads?.closed],
      ['Hours Saved', data.hoursSaved],
      ['Value Saved ($)', data.valueSaved],
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dab-ai-analytics-${RANGES[rangeIdx].label.replace(' ', '')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-[#F7F6F2] p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-5">

        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-white px-5 py-4 shadow-card">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50">
              <BarChart2 className="h-4.5 w-4.5 text-accent" />
            </div>
            <div>
              <h1 className="font-heading text-xl font-bold text-gray-900">Analytics</h1>
              <p className="text-xs text-gray-400">Track your AI agent's performance and ROI</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Range selector */}
            <div className="flex rounded-2xl border border-gray-200 bg-gray-50 p-1">
              {RANGES.map((r, i) => (
                <button
                  key={r.label}
                  type="button"
                  onClick={() => setRangeIdx(i)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                    rangeIdx === i
                      ? 'bg-white text-gray-900 shadow-xs'
                      : 'text-gray-400 hover:text-gray-700'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={exportCSV}
              className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-500 transition hover:bg-gray-50 hover:text-gray-700"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </button>

            <Link
              to="/inbox"
              className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-500 transition hover:bg-gray-50 hover:text-gray-700"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Dashboard
            </Link>
          </div>
        </header>

        {error && (
          <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div>
        )}

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="flex items-center gap-3 rounded-2xl bg-white px-6 py-4 shadow-card text-sm text-gray-500">
              <Zap className="h-4 w-4 animate-pulse text-accent" />
              Loading analytics...
            </div>
          </div>
        ) : data && (
          <>
            {/* Key Metrics */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {METRIC_CONFIG.map(({ key, label, icon, color, bg, border }) => {
                let val = getNestedValue(data, key);
                let sub;
                if (key === 'leads.qualified' && totalLeads > 0) {
                  sub = `${Math.round((val / totalLeads) * 100)}% conversion`;
                }
                if (key === 'avgResponseMinutes') {
                  val = val != null ? `${val}m` : '< 1m';
                  sub = 'Agent reply time';
                } else {
                  val = val?.toLocaleString?.() ?? val;
                }
                if (key === 'messages.aiReplies') sub = 'Automated responses';
                return (
                  <MetricCard
                    key={key}
                    icon={icon}
                    label={label}
                    value={val}
                    sub={sub}
                    color={color}
                    bg={bg}
                    border={border}
                  />
                );
              })}
            </div>

            {/* ROI + Funnel */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* ROI Card */}
              <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50/40 p-5">
                <div className="mb-4 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white shadow-xs">
                    <DollarSign className="h-4 w-4 text-emerald-600" />
                  </div>
                  <h3 className="font-heading text-base font-bold text-gray-900">Value Delivered</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="tabular-nums text-3xl font-bold text-gray-900">{data.hoursSaved}h</p>
                    <p className="mt-0.5 text-xs text-gray-500">Staff time saved</p>
                  </div>
                  <div>
                    <p className="tabular-nums text-3xl font-bold text-emerald-600">${data.valueSaved?.toLocaleString()}</p>
                    <p className="mt-0.5 text-xs text-gray-500">Est. value (@$20/hr)</p>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-gray-500">
                  Your AI agent handled {data.messages?.aiReplies?.toLocaleString()} conversations automatically,
                  saving ~{data.hoursSaved}h of staff time this period.
                </p>
              </div>

              {/* Lead Funnel */}
              <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card">
                <h3 className="mb-4 font-heading text-base font-bold text-gray-900">Lead Pipeline Funnel</h3>
                <div className="space-y-3">
                  <FunnelBar label="New"       value={data.leads?.new_leads || 0} total={totalLeads} color="bg-sky-400" />
                  <FunnelBar label="Qualified" value={data.leads?.qualified || 0}  total={totalLeads} color="bg-accent" />
                  <FunnelBar label="Booked"    value={data.leads?.booked || 0}     total={totalLeads} color="bg-emerald-500" />
                  <FunnelBar label="Closed"    value={data.leads?.closed || 0}     total={totalLeads} color="bg-gray-400" />
                  <FunnelBar label="Escalated" value={data.leads?.escalated || 0}  total={totalLeads} color="bg-rose-400" />
                </div>
              </div>
            </div>

            {/* Heatmap */}
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-heading text-base font-bold text-gray-900">Busiest Hours</h3>
                <span className="text-xs text-gray-400">Message volume by hour of day</span>
              </div>
              <div
                className="gap-0.5"
                style={{ display: 'grid', gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}
              >
                {(data.heatmap || []).map((h) => (
                  <HeatmapBar key={h.hour} hour={h.hour} count={h.count} max={heatmapMax} />
                ))}
              </div>
            </div>

            {/* Channel Breakdown + Daily Trend */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Channel Breakdown */}
              <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card">
                <h3 className="mb-4 font-heading text-base font-bold text-gray-900">Channel Breakdown</h3>
                {(data.channelBreakdown || []).length === 0 ? (
                  <p className="text-xs text-gray-400">No data for this period</p>
                ) : (
                  <div className="space-y-4">
                    {data.channelBreakdown.map((ch) => {
                      const total = data.channelBreakdown.reduce((sum, c) => sum + c.count, 0);
                      const pct = total > 0 ? Math.round((ch.count / total) * 100) : 0;
                      const emoji = ch.channel === 'whatsapp' ? '📱' : ch.channel === 'email' ? '📧' : '💬';
                      const bar = ch.channel === 'whatsapp' ? 'bg-emerald-400' : ch.channel === 'email' ? 'bg-blue-400' : 'bg-violet-400';

                      return (
                        <div key={ch.channel}>
                          <div className="mb-1.5 flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1.5 font-medium capitalize text-gray-700">
                              <span>{emoji}</span> {ch.channel}
                            </span>
                            <span className="tabular-nums text-gray-400">{ch.count} · {pct}%</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                            <div className={`h-full rounded-full ${bar} transition-all duration-700`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Daily New Leads */}
              <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card">
                <h3 className="mb-1 font-heading text-base font-bold text-gray-900">Daily New Leads</h3>
                {data.dailyLeads?.length > 0 && (
                  <p className="mb-3 text-xs text-gray-400">
                    {data.dailyLeads[0]?.day} → {data.dailyLeads[data.dailyLeads.length - 1]?.day}
                  </p>
                )}
                <SparkLine data={data.dailyLeads} />
                {data.dailyLeads?.length > 0 && (
                  <div className="mt-2 flex justify-between text-xs text-gray-400">
                    <span>{data.dailyLeads[0]?.day}</span>
                    <span>{data.dailyLeads[data.dailyLeads.length - 1]?.day}</span>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
