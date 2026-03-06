import { Building2, MessageSquareText, Settings as SettingsIcon, Activity, Bot, CircleDot, BarChart2, CreditCard } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';

function ToolStatus({ label, connected }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-gray-50 px-3 py-2.5">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="flex items-center gap-1.5 text-xs font-medium">
        <CircleDot className={`h-3 w-3 ${connected ? 'text-emerald-500' : 'text-rose-400'}`} />
        <span className={connected ? 'text-emerald-600' : 'text-rose-500'}>
          {connected ? 'Connected' : 'Disconnected'}
        </span>
      </span>
    </div>
  );
}

function NavItem({ to, icon: Icon, label }) {
  const location = useLocation();
  const active = location.pathname === to;

  return (
    <Link
      to={to}
      className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all ${
        active
          ? 'bg-accent text-white shadow-glow'
          : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
      }`}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      {label}
    </Link>
  );
}

export default function Sidebar({ settings, agentActiveCount, totalLeads }) {
  return (
    <aside className="flex h-full flex-col rounded-3xl bg-white p-5 shadow-card">
      {/* Brand */}
      <div className="mb-7">
        <div className="mb-1 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent text-white">
            <Building2 className="h-4 w-4" />
          </div>
          <h1 className="font-heading text-xl font-bold text-gray-900">HireAI</h1>
        </div>
        <p className="ml-[42px] text-xs text-gray-400">AI Agent Command Center</p>
      </div>

      {/* Nav */}
      <nav className="mb-6 space-y-1">
        <NavItem to="/"          icon={MessageSquareText} label="Dashboard" />
        <NavItem to="/analytics" icon={BarChart2}         label="Analytics" />
        <NavItem to="/billing"   icon={CreditCard}        label="Billing" />
        <NavItem to="/settings"  icon={SettingsIcon}      label="Settings" />
      </nav>

      {/* Agent pulse */}
      <div className="mb-5 rounded-2xl border border-accent/20 bg-orange-50 px-4 py-3">
        <p className="text-xs font-medium text-gray-500">Agent Status</p>
        <p className="mt-1.5 flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Bot className="h-4 w-4 text-accent" />
          {agentActiveCount}/{totalLeads} Active
        </p>
      </div>

      {/* Tool connections */}
      <div className="space-y-2">
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400">
          <Activity className="h-3 w-3" />
          Connections
        </p>
        <ToolStatus label="WhatsApp"    connected={Boolean(settings?.twilioKey)} />
        <ToolStatus label="Email"       connected={Boolean(settings?.gmailConfig)} />
        <ToolStatus label="Calendar"    connected={Boolean(settings?.calendarConfig)} />
        <ToolStatus label="Listings DB" connected={Boolean(settings?.listingsData)} />
      </div>

      <div className="mt-auto pt-5">
        <ThemeToggle className="w-full justify-center" />
      </div>
    </aside>
  );
}
