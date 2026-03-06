import { useEffect, useState } from 'react';
import { ArrowLeft, TrendingUp, MessageSquare, Users, Calendar, Clock, Zap, DollarSign, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../lib/api';

const RANGES = [
  { label: 'Today', days: 1 },
  { label: '7 Days', days: 7 },
  { label: '30 Days', days: 30 },
  { label: '90 Days', days: 90 },
];

function MetricCard({ icon: Icon, label, value, sub, color = 'accent' }) {
  const colors = {
    accent: 'border-accent/30 bg-accent/10 text-accent',
    emerald: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-400',
    cyan: 'border-cyan-400/30 bg-cyan-500/10 text-cyan-400',
    violet: 'border-violet-400/30 bg-violet-500/10 text-violet-400',
    rose: 'border-rose-400/30 bg-rose-500/10 text-rose-400',
    amber: 'border-amber-400/30 bg-amber-500/10 text-amber-400',
  };

  return (
    <div className={`rounded-2xl border ${colors[color]} p-4`}>
      <div className="mb-2 flex items-center gap-2">
        <Icon className={`h-4 w-4`} />
        <span className="text-xs text-textSoft">{label}</span>
      </div>
      <p className="font-heading text-3xl text-white">{value ?? '—'}</p>
      {sub && <p className="mt-1 text-xs text-textSoft">{sub}</p>}
    </div>
  );
}

function HeatmapBar({ hour, count, max }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  const label = hour === 0 ? '12am' : hour < 12 ? `${hour}am` : hour === 12 ? '12pm' : `${hour - 12}pm`;

  return (
    <div className="flex flex-col items-center gap-1" title={`${label}: ${count} messages`}>
      <div className="flex h-16 w-full items-end">
        <div
          className="w-full rounded-t bg-accent/70 transition-all"
          style={{ height: `${Math.max(pct, 2)}%` }}
        />
      </div>
      <span className="text-[9px] text-textSoft">{hour % 4 === 0 ? label : ''}</span>
    </div>
  );
}

function FunnelBar({ label, value, total, color }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 text-right text-xs text-textSoft">{label}</span>
      <div className="flex-1 rounded-full bg-surface">
        <div className={`h-3 rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 text-xs text-white">{value}</span>
      <span className="w-8 text-xs text-textSoft">{pct}%</span>
    </div>
  );
}

function SparkLine({ data }) {
  if (!data || data.length === 0) return <p className="text-xs text-textSoft">No data</p>;

  const max = Math.max(...data.map((d) => d.count), 1);
  const w = 300;
  const h = 60;
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - (d.count / max) * h;
    return `${x},${y}`;
  });

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: 60 }}>
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke="#6C63FF"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Analytics() {
  const [rangeIdx, setRangeIdx] = useState(1); // default 7 days
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');

    const days = RANGES[rangeIdx].days;
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const to = new Date().toISOString();

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
    a.download = `hireai-analytics-${RANGES[rangeIdx].label.replace(' ', '')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-bg p-4 text-white sm:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/5 bg-card/95 px-4 py-3">
          <div>
            <h1 className="font-heading text-2xl">Analytics</h1>
            <p className="text-xs text-textSoft">Track your AI agent's performance and ROI</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl border border-white/10 bg-surface p-1">
              {RANGES.map((r, i) => (
                <button
                  key={r.label}
                  type="button"
                  onClick={() => setRangeIdx(i)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    rangeIdx === i ? 'bg-accent text-white' : 'text-textSoft hover:text-white'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={exportCSV}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-surface px-3 py-2 text-xs text-textSoft hover:text-white"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </button>
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-surface px-3 py-2 text-xs text-textSoft hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Dashboard
            </Link>
          </div>
        </header>

        {error && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-200">{error}</div>
        )}

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="rounded-xl border border-white/10 bg-card px-6 py-4 text-sm text-textSoft">Loading analytics...</div>
          </div>
        ) : data && (
          <>
            {/* Key Metrics */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <MetricCard icon={MessageSquare} label="Total Messages" value={data.messages?.total?.toLocaleString()} color="accent" />
              <MetricCard icon={Zap} label="AI Replies" value={data.messages?.aiReplies?.toLocaleString()} sub="Automated responses" color="violet" />
              <MetricCard icon={Users} label="Total Leads" value={data.leads?.total?.toLocaleString()} color="cyan" />
              <MetricCard icon={TrendingUp} label="Qualified" value={data.leads?.qualified?.toLocaleString()} sub={`${totalLeads > 0 ? Math.round((data.leads.qualified / totalLeads) * 100) : 0}% conversion`} color="emerald" />
              <MetricCard icon={Calendar} label="Viewings Booked" value={data.bookings?.total?.toLocaleString()} color="amber" />
              <MetricCard icon={Clock} label="Avg Response" value={data.avgResponseMinutes != null ? `${data.avgResponseMinutes}m` : '< 1m'} sub="Agent reply time" color="rose" />
            </div>

            {/* ROI Card */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="h-5 w-5 text-emerald-400" />
                  <h3 className="font-heading text-lg text-white">Value Delivered</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-3xl font-heading text-white">{data.hoursSaved}h</p>
                    <p className="text-xs text-textSoft">Staff time saved</p>
                  </div>
                  <div>
                    <p className="text-3xl font-heading text-emerald-300">${data.valueSaved?.toLocaleString()}</p>
                    <p className="text-xs text-textSoft">Estimated value (@$20/hr)</p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-textSoft/70">
                  Your AI agent handled {data.messages?.aiReplies?.toLocaleString()} conversations automatically,
                  saving approximately {data.hoursSaved} hours of staff time this period.
                </p>
              </div>

              {/* Lead Funnel */}
              <div className="rounded-2xl border border-white/5 bg-card/95 p-5">
                <h3 className="mb-4 font-heading text-lg text-white">Lead Pipeline Funnel</h3>
                <div className="space-y-3">
                  <FunnelBar label="New" value={data.leads?.new_leads || 0} total={totalLeads} color="bg-blue-500" />
                  <FunnelBar label="Qualified" value={data.leads?.qualified || 0} total={totalLeads} color="bg-accent" />
                  <FunnelBar label="Booked" value={data.leads?.booked || 0} total={totalLeads} color="bg-emerald-500" />
                  <FunnelBar label="Closed" value={data.leads?.closed || 0} total={totalLeads} color="bg-textSoft" />
                  <FunnelBar label="Escalated" value={data.leads?.escalated || 0} total={totalLeads} color="bg-rose-500" />
                </div>
              </div>
            </div>

            {/* Heatmap */}
            <div className="rounded-2xl border border-white/5 bg-card/95 p-5">
              <h3 className="mb-4 font-heading text-lg text-white">Busiest Hours</h3>
              <div className="grid grid-cols-24 gap-0.5" style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>
                {(data.heatmap || []).map((h) => (
                  <HeatmapBar key={h.hour} hour={h.hour} count={h.count} max={heatmapMax} />
                ))}
              </div>
              <p className="mt-2 text-xs text-textSoft">Message volume by hour of day (UTC)</p>
            </div>

            {/* Channel Breakdown + Daily Trend */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/5 bg-card/95 p-5">
                <h3 className="mb-4 font-heading text-lg text-white">Channel Breakdown</h3>
                {(data.channelBreakdown || []).length === 0 ? (
                  <p className="text-xs text-textSoft">No data for this period</p>
                ) : (
                  <div className="space-y-3">
                    {data.channelBreakdown.map((ch) => {
                      const total = data.channelBreakdown.reduce((sum, c) => sum + c.count, 0);
                      const pct = total > 0 ? Math.round((ch.count / total) * 100) : 0;
                      const icon = ch.channel === 'whatsapp' ? '📱' : ch.channel === 'email' ? '📧' : '💬';
                      return (
                        <div key={ch.channel} className="flex items-center gap-3">
                          <span className="text-lg">{icon}</span>
                          <div className="flex-1">
                            <div className="mb-1 flex justify-between text-xs">
                              <span className="capitalize text-white">{ch.channel}</span>
                              <span className="text-textSoft">{ch.count} ({pct}%)</span>
                            </div>
                            <div className="h-2 rounded-full bg-surface">
                              <div className="h-2 rounded-full bg-accent" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-white/5 bg-card/95 p-5">
                <h3 className="mb-4 font-heading text-lg text-white">Daily New Leads</h3>
                <SparkLine data={data.dailyLeads} />
                {data.dailyLeads?.length > 0 && (
                  <div className="mt-2 flex justify-between text-xs text-textSoft">
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
