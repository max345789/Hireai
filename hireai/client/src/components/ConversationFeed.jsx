import { useMemo, useState } from 'react';
import { MessageSquare, Phone, Mail, Globe, Bot, User, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';

const channelMeta = {
  whatsapp: { label: 'WhatsApp', color: 'text-emerald-300', icon: Phone },
  sms: { label: 'SMS', color: 'text-sky-300', icon: MessageSquare },
  email: { label: 'Email', color: 'text-blue-300', icon: Mail },
  web: { label: 'Web Chat', color: 'text-fuchsia-300', icon: Globe },
  webchat: { label: 'Web Chat', color: 'text-fuchsia-300', icon: Globe },
  manual: { label: 'Manual', color: 'text-slate-300', icon: User },
};

const tabs = [
  { id: 'all', label: 'All' },
  { id: 'whatsapp', label: '📱 WhatsApp' },
  { id: 'email', label: '📧 Email' },
  { id: 'web', label: '💬 Web' },
  { id: 'needs', label: '⚠️ Needs Attention' },
];

function ChannelBadge({ channel }) {
  const meta = channelMeta[channel] || channelMeta.web;
  const Icon = meta.icon;

  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${meta.color}`}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

function MessageCard({ item }) {
  const isSystem = item.direction === 'system' || item.channel === 'system';
  const isOut = item.direction === 'out';
  const isAI = isOut && Number(item.sentByAI) === 1;
  const isManual = isOut && Number(item.sentByAI) === 0;

  if (isSystem) {
    return (
      <div className="text-center text-xs italic text-textSoft">{item.content}</div>
    );
  }

  return (
    <article
      className={clsx(
        'slide-in-bottom max-w-[88%] rounded-xl border p-3',
        isOut
          ? isAI
            ? 'ml-auto border-accent/30 bg-accent/25 text-white'
            : 'ml-auto border-sky-400/30 bg-sky-500/20 text-sky-50'
          : 'mr-auto border-white/10 bg-surface/80 text-slate-100'
      )}
    >
      <div className="mb-1 flex items-start justify-between gap-3 text-[11px]">
        {!isOut && <ChannelBadge channel={item.channel} />}
        <span className="text-textSoft">{new Date(item.timestamp).toLocaleTimeString()}</span>
        {isOut && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-white/80">
            {isAI ? <Bot className="h-3 w-3" /> : <User className="h-3 w-3" />}
            {isAI ? 'AI' : 'Manual'}
          </span>
        )}
      </div>

      <p className="text-sm leading-relaxed">{item.content}</p>
    </article>
  );
}

export default function ConversationFeed({ messages, selectedLead, onLeadSelect, needsAttentionLeadIds = [] }) {
  const [activeTab, setActiveTab] = useState('all');

  const filteredMessages = useMemo(() => {
    const isNeedsAttention = (item) => needsAttentionLeadIds.includes(Number(item.leadId));

    if (activeTab === 'all') return messages;
    if (activeTab === 'whatsapp') return messages.filter((item) => item.channel === 'whatsapp');
    if (activeTab === 'email') return messages.filter((item) => item.channel === 'email');
    if (activeTab === 'web') return messages.filter((item) => item.channel === 'web' || item.channel === 'webchat');
    if (activeTab === 'needs') return messages.filter((item) => isNeedsAttention(item));

    return messages;
  }, [messages, activeTab, needsAttentionLeadIds]);

  return (
    <section className="rounded-2xl border border-white/5 bg-card/95 p-4">
      <header className="mb-3">
        <h2 className="font-heading text-xl text-white">
          {selectedLead ? `${selectedLead.name} Conversation` : 'Unified Conversation Feed'}
        </h2>
        <p className="text-xs text-textSoft">WhatsApp + Email + Web chat in one live stream</p>
      </header>

      <div className="mb-3 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'rounded-full border px-3 py-1 text-xs transition',
              activeTab === tab.id
                ? 'border-accent/70 bg-accent/20 text-white'
                : 'border-white/10 bg-surface/60 text-textSoft hover:text-white'
            )}
          >
            {tab.label}
            {tab.id === 'needs' && needsAttentionLeadIds.length > 0 && (
              <span className="ml-1 inline-flex items-center gap-1 text-amber-300">
                <AlertTriangle className="h-3 w-3" />
                {needsAttentionLeadIds.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {!filteredMessages.length ? (
        <div className="rounded-xl bg-surface/60 p-6 text-center text-sm text-textSoft">
          No conversations in this filter yet.
        </div>
      ) : (
        <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
          {filteredMessages.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onLeadSelect?.(item.leadId)}
              className="w-full text-left"
            >
              <div className="mb-1 text-[11px] text-textSoft">{item.leadName || `Lead #${item.leadId}`}</div>
              <MessageCard item={item} />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
