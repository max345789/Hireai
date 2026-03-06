import { Building2, MessageSquareText, Settings as SettingsIcon, Activity, Bot, BarChart2, CreditCard } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';

function NavItem({ to, icon: Icon, label }) {
  const location = useLocation();
  const active = location.pathname === to;

  return (
    <Link
      to={to}
      className={`group flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200 ${
        active
          ? 'bg-accent text-white shadow-glow-sm'
          : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
      }`}
    >
      <Icon
        className={`h-4 w-4 flex-shrink-0 transition-transform duration-200 group-hover:scale-110 ${
          active ? 'text-white' : ''
        }`}
      />
      <span className="flex-1">{label}</span>
      {active && (
        <span className="h-1.5 w-1.5 rounded-full bg-white/60" />
      )}
    </Link>
  );
}

function ConnectionDot({ connected, label }) {
  return (
    <div
      className={`flex items-center justify-between rounded-xl px-3 py-2 transition-colors ${
        connected ? 'bg-emerald-50 hover:bg-emerald-50/70' : 'bg-gray-50 hover:bg-gray-100'
      }`}
    >
      <span className="text-xs text-gray-500">{label}</span>
      <div className="flex items-center gap-1.5">
        <div className={`relative h-2 w-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-gray-300'}`}>
          {connected && (
            <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-50" />
          )}
        </div>
        <span className={`text-[10px] font-semibold ${connected ? 'text-emerald-600' : 'text-gray-400'}`}>
          {connected ? 'Live' : 'Off'}
        </span>
      </div>
    </div>
  );
}

export default function Sidebar({ settings, agentActiveCount, totalLeads }) {
  const agentPct = totalLeads > 0 ? Math.round((agentActiveCount / totalLeads) * 100) : 0;

  return (
    <aside className="flex h-full flex-col rounded-3xl bg-white p-5 shadow-card">
      {/* Brand */}
      <div className="mb-7">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-accent text-white shadow-glow-sm">
            <Building2 className="h-[18px] w-[18px]" />
          </div>
          <div>
            <h1 className="font-heading text-[17px] font-bold leading-none text-gray-900">HireAI</h1>
            <p className="mt-0.5 text-[10px] leading-none text-gray-400">AI Command Center</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="mb-6 space-y-0.5">
        <NavItem to="/"          icon={MessageSquareText} label="Dashboard" />
        <NavItem to="/analytics" icon={BarChart2}         label="Analytics" />
        <NavItem to="/billing"   icon={CreditCard}        label="Billing" />
        <NavItem to="/settings"  icon={SettingsIcon}      label="Settings" />
      </nav>

      {/* Agent pulse card */}
      <div className="mb-5 rounded-2xl border border-accent/20 bg-gradient-to-br from-orange-50 to-amber-50/40 px-4 py-3.5">
        <div className="mb-2 flex items-center gap-1.5">
          <Bot className="h-3.5 w-3.5 text-accent" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-accent/70">Agent Status</p>
        </div>
        <p className="tabular-nums text-[22px] font-bold leading-none text-gray-900">
          {agentActiveCount}
          <span className="ml-1 text-sm font-normal text-gray-400">/ {totalLeads} active</span>
        </p>
        {/* Progress bar */}
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-orange-100">
          <div
            className="h-full rounded-full bg-accent transition-all duration-700"
            style={{ width: `${agentPct}%` }}
          />
        </div>
        <p className="mt-1.5 text-[10px] text-gray-400">{agentPct}% AI-handled</p>
      </div>

      {/* Channel connections */}
      <div className="space-y-1.5">
        <p className="mb-2.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
          <Activity className="h-3 w-3" />
          Channels
        </p>
        <ConnectionDot label="WhatsApp"    connected={Boolean(settings?.twilioKey)} />
        <ConnectionDot label="Email"       connected={Boolean(settings?.gmailConfig)} />
        <ConnectionDot label="Calendar"    connected={Boolean(settings?.calendarConfig)} />
        <ConnectionDot label="Listings DB" connected={Boolean(settings?.listingsData)} />
      </div>

      <div className="mt-auto border-t border-gray-100 pt-4">
        <ThemeToggle className="w-full justify-center" />
      </div>
    </aside>
  );
}
