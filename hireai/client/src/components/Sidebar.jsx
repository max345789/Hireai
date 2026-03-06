import { Building2, MessageSquareText, Settings as SettingsIcon, Activity, Bot, CircleDot, BarChart2, CreditCard } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';

function ToolStatus({ label, connected }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-surface/60 px-3 py-2">
      <span className="text-sm text-textSoft">{label}</span>
      <span className="flex items-center gap-2 text-xs">
        <CircleDot className={`h-3 w-3 ${connected ? 'text-emerald-400' : 'text-rose-400'}`} />
        {connected ? 'Connected' : 'Disconnected'}
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
      className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
        active
          ? 'bg-accent text-white shadow-glow'
          : 'bg-surface/50 text-textSoft hover:bg-surface hover:text-white'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}

export default function Sidebar({ settings, agentActiveCount, totalLeads }) {
  return (
    <aside className="h-full rounded-2xl border border-white/5 bg-card/95 p-4 shadow-glow backdrop-blur">
      <div className="mb-6">
        <div className="mb-1 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-accent" />
          <h1 className="font-heading text-xl font-bold text-white">HireAI</h1>
        </div>
        <p className="text-xs text-textSoft">AI Agent Command Center</p>
      </div>

      <div className="mb-6 space-y-2">
        <NavItem to="/" icon={MessageSquareText} label="Dashboard" />
        <NavItem to="/analytics" icon={BarChart2} label="Analytics" />
        <NavItem to="/billing" icon={CreditCard} label="Billing" />
        <NavItem to="/settings" icon={SettingsIcon} label="Settings" />
      </div>

      <div className="mb-4 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2">
        <p className="text-xs text-textSoft">Agent Status</p>
        <p className="mt-1 flex items-center gap-2 font-mono text-sm text-white">
          <Bot className="h-4 w-4 text-emerald-400" />
          <span>{agentActiveCount}/{totalLeads} Conversations Active</span>
        </p>
      </div>

      <div className="space-y-2">
        <p className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-textSoft">
          <Activity className="h-3.5 w-3.5" />
          Tool Connections
        </p>

        <ToolStatus label="WhatsApp (Twilio)" connected={Boolean(settings?.twilioKey)} />
        <ToolStatus label="Email (Gmail)" connected={Boolean(settings?.gmailConfig)} />
        <ToolStatus label="Calendar" connected={Boolean(settings?.calendarConfig)} />
        <ToolStatus label="Listings DB" connected={Boolean(settings?.listingsData)} />
      </div>

      <div className="mt-4">
        <ThemeToggle className="w-full justify-center" />
      </div>
    </aside>
  );
}
