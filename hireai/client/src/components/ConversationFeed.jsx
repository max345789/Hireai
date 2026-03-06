import { useMemo, useState } from 'react';
import { MessageSquare, Phone, Mail, Globe, Bot, User, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';

const channelMeta = {
  whatsapp: { label: 'WhatsApp', color: 'text-emerald-600', bg: 'bg-emerald-50',  icon: Phone },
  sms:      { label: 'SMS',      color: 'text-sky-600',     bg: 'bg-sky-50',      icon: MessageSquare },
  email:    { label: 'Email',    color: 'text-blue-600',    bg: 'bg-blue-50',     icon: Mail },
  web:      { label: 'Web Chat', color: 'text-violet-600',  bg: 'bg-violet-50',   icon: Globe },
  webchat:  { label: 'Web Chat', color: 'text-violet-600',  bg: 'bg-violet-50',   icon: Globe },
  manual:   { label: 'Manual',   color: 'text-gray-500',    bg: 'bg-gray-50',     icon: User },
};

const tabs = [
  { id: 'all',      label: 'All' },
  { id: 'whatsapp', label: '📱 WhatsApp' },
  { id: 'email',    label: '📧 Email' },
  { id: 'web',      label: '💬 Web' },
  { id: 'needs',    label: '⚠️ Needs Attention' },
];

function ChannelBadge({ channel }) {
  const meta = channelMeta[channel] || channelMeta.web;
  const Icon = meta.icon;

  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold', meta.color, meta.bg)}>
      <Icon className="h-2.5 w-2.5" />
      {meta.label}
    </span>
  );
}

function MessageCard({ item }) {
  const isSystem = item.direction === 'system' || item.channel === 'system';
  const isOut    = item.direction === 'out';
  const isAI     = isOut && Number(item.sentByAI) === 1;

  if (isSystem) {
    return <div className="text-center text-xs italic text-gray-400">{item.content}</div>;
  }

  return (
    <article
      className={clsx(
        'slide-in-bottom max-w-[88%] rounded-2xl p-3',
        isOut
          ? isAI
            ? 'ml-auto bg-accent text-white'
            : 'ml-auto bg-sky-500 text-white'
          : 'mr-auto border border-gray-100 bg-gray-50 text-gray-800'
      )}
    >
      <div className="mb-1.5 flex items-center justify-between gap-3">
        {!isOut && <ChannelBadge channel={item.channel} />}
        <span className={clsx('text-[10px]', isOut ? 'text-white/70' : 'text-gray-400')}>
          {new Date(item.timestamp).toLocaleTimeString()}
        </span>
        {isOut && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-white/80">
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
    if (activeTab === 'all')      return messages;
    if (activeTab === 'whatsapp') return messages.filter((item) => item.channel === 'whatsapp');
    if (activeTab === 'email')    return messages.filter((item) => item.channel === 'email');
    if (activeTab === 'web')      return messages.filter((item) => item.channel === 'web' || item.channel === 'webchat');
    if (activeTab === 'needs')    return messages.filter((item) => isNeedsAttention(item));
    return messages;
  }, [messages, activeTab, needsAttentionLeadIds]);

  return (
    <section className="rounded-3xl bg-white p-5 shadow-card">
      <header className="mb-4">
        <h2 className="text-base font-semibold text-gray-900">
          {selectedLead ? `${selectedLead.name} — Conversation` : 'Unified Conversation Feed'}
        </h2>
        <p className="text-xs text-gray-400">WhatsApp · Email · Web chat in one live stream</p>
      </header>

      {/* Tabs */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'rounded-full px-3 py-1 text-xs font-medium transition',
              activeTab === tab.id
                ? 'bg-accent text-white'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
            )}
          >
            {tab.label}
            {tab.id === 'needs' && needsAttentionLeadIds.length > 0 && (
              <span className="ml-1 inline-flex items-center gap-0.5 text-amber-500">
                <AlertTriangle className="h-2.5 w-2.5" />
                {needsAttentionLeadIds.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {!filteredMessages.length ? (
        <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">
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
              <div className="mb-1 text-[10px] font-medium text-gray-400">
                {item.leadName || `Lead #${item.leadId}`}
              </div>
              <MessageCard item={item} />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
