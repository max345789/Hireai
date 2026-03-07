import { Building2, MessageSquareText, Inbox as InboxIcon, Settings as SettingsIcon, Activity, Bot, BarChart2, CreditCard, Zap, Calendar, Heart } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

function NavItem({ to, icon: Icon, label }) {
  const location = useLocation();
  const active = location.pathname === to;

  return (
    <Link
      to={to}
      className={`group flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200 ${
        active
          ? 'bg-accent/20 text-accent'
          : 'text-white/50 hover:bg-white/[0.05] hover:text-white'
      }`}
    >
      <Icon
        className={`h-4 w-4 flex-shrink-0 transition-transform duration-200 group-hover:scale-110 ${
          active ? 'text-accent' : ''
        }`}
      />
      <span className="flex-1 min-w-0 truncate">{label}</span>
      {active && (
        <span className="h-1.5 w-1.5 rounded-full bg-accent/60" />
      )}
    </Link>
  );
}

function ConnectionDot({ connected, label, mode }) {
  const isDemo = mode === 'demo';
  return (
    <div
      className={`flex items-center justify-between rounded-xl px-3 py-2 transition-colors ${
        connected && !isDemo
          ? 'bg-emerald-500/10 hover:bg-emerald-500/15'
          : connected && isDemo
          ? 'bg-amber-500/10 hover:bg-amber-500/15'
          : 'bg-white/[0.03] hover:bg-white/[0.05]'
      }`}
    >
      <span className="text-xs text-white/40 truncate">{label}</span>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <div className={`relative h-2 w-2 rounded-full ${
          connected && !isDemo ? 'bg-emerald-400' :
          connected && isDemo ? 'bg-amber-400' :
          'bg-white/20'
        }`}>
          {connected && !isDemo && (
            <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-50" />
          )}
        </div>
        <span className={`text-[10px] font-semibold ${
          connected && !isDemo ? 'text-emerald-400' :
          connected && isDemo ? 'text-amber-400' :
          'text-white/25'
        }`}>
          {connected && !isDemo ? 'Live' : connected && isDemo ? 'Demo' : 'Off'}
        </span>
      </div>
    </div>
  );
}

const AGENT_META = {
  salesbot:   { Icon: Zap,      label: 'Aria', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
  bookingbot: { Icon: Calendar, label: 'Cal',  color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20' },
  nurturebot: { Icon: Heart,    label: 'Ivy',  color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
};

export default function Sidebar({ settings, channelStatus, agentActiveCount, totalLeads, activeAgent }) {
  const agentPct = totalLeads > 0 ? Math.round((agentActiveCount / totalLeads) * 100) : 0;
  const agentMeta = AGENT_META[activeAgent] || AGENT_META.salesbot;
  const AgentIcon = agentMeta.Icon;

  // Build channel list with auto-connection info
  const defaultChannels = settings?.defaultChannels || {};
  const channels = [
    { label: 'Web Widget',  connected: true,                                          mode: 'native' },
    { label: 'WhatsApp',    connected: Boolean(settings?.twilioKey) || defaultChannels.whatsapp?.connected, mode: settings?.twilioKey ? 'live' : 'demo' },
    { label: 'Email',       connected: Boolean(settings?.gmailConfig) || defaultChannels.email?.connected,  mode: settings?.gmailConfig ? 'live' : 'demo' },
    { label: 'Instagram',   connected: Boolean(channelStatus?.instagram?.configured),  mode: channelStatus?.instagram?.configured ? 'live' : 'off' },
    { label: 'Messenger',   connected: Boolean(channelStatus?.messenger?.configured),  mode: channelStatus?.messenger?.configured ? 'live' : 'off' },
    { label: 'Calendar',    connected: Boolean(settings?.calendarConfig),              mode: settings?.calendarConfig ? 'live' : 'off' },
    { label: 'Listings DB', connected: Boolean(settings?.listingsData),                mode: settings?.listingsData ? 'live' : 'off' },
  ];

  return (
    <aside className="flex h-full flex-col rounded-[28px] border border-white/[0.08] bg-[#111521] p-5 shadow-card min-w-0">
      {/* Brand */}
      <div className="mb-7">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-accent text-[#090B12] shadow-glow-sm">
            <Building2 className="h-[18px] w-[18px]" />
          </div>
          <div className="min-w-0">
            <h1 className="font-heading text-[17px] font-bold leading-none text-white break-words">DAB AI</h1>
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest leading-none text-white/30 truncate">AI Command Center</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="mb-6 space-y-0.5">
        <NavItem to="/inbox"     icon={InboxIcon}         label="Inbox" />
        <NavItem to="/dashboard" icon={MessageSquareText} label="Dashboard" />
        <NavItem to="/analytics" icon={BarChart2}         label="Analytics" />
        <NavItem to="/billing"   icon={CreditCard}        label="Billing" />
        <NavItem to="/settings"  icon={SettingsIcon}      label="Settings" />
      </nav>

      {/* Active Agent card */}
      <div className={`mb-4 rounded-2xl border ${agentMeta.border} ${agentMeta.bg} px-4 py-3`}>
        <div className="mb-1.5 flex items-center gap-1.5">
          <AgentIcon className={`h-3.5 w-3.5 ${agentMeta.color}`} />
          <p className={`font-mono text-[10px] font-bold uppercase tracking-widest ${agentMeta.color}/70`}>Active Agent</p>
        </div>
        <p className={`font-heading text-base font-bold ${agentMeta.color}`}>{agentMeta.label}</p>
        <p className="mt-0.5 font-mono text-[10px] text-white/30">
          {activeAgent === 'salesbot' ? 'Qualifying & converting leads' :
           activeAgent === 'bookingbot' ? 'Booking viewings & managing calendar' :
           'Nurturing & re-engaging leads'}
        </p>
      </div>

      {/* Agent pulse card */}
      <div className="mb-5 rounded-2xl border border-accent/20 bg-accent/[0.06] px-4 py-3.5">
        <div className="mb-2 flex items-center gap-1.5">
          <Bot className="h-3.5 w-3.5 text-accent" />
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-accent/70">Agent Status</p>
        </div>
        <p className="tabular-nums text-[22px] font-bold leading-none text-white break-words">
          {agentActiveCount}
          <span className="ml-1 text-sm font-normal text-white/40">/ {totalLeads} active</span>
        </p>
        {/* Progress bar */}
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
          <div
            className="h-full rounded-full bg-accent transition-all duration-700 shadow-glow-sm"
            style={{ width: `${agentPct}%` }}
          />
        </div>
        <p className="mt-1.5 font-mono text-[10px] text-white/30">{agentPct}% AI-handled</p>
      </div>

      {/* Channel connections */}
      <div className="space-y-1.5">
        <p className="mb-2.5 flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-white/30">
          <Activity className="h-3 w-3" />
          Channels
          <span className="ml-auto text-[9px] font-normal text-white/20">
            {channels.filter((c) => c.connected).length}/{channels.length} connected
          </span>
        </p>
        {channels.map((ch) => (
          <ConnectionDot key={ch.label} label={ch.label} connected={ch.connected} mode={ch.mode} />
        ))}
      </div>

      {/* Footer */}
      <div className="mt-auto border-t border-white/[0.06] pt-4">
        <p className="text-center font-mono text-[10px] text-white/20">v2.0 · Dark Mode</p>
      </div>
    </aside>
  );
}
