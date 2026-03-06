import { useMemo, useState, useRef, useEffect } from 'react';
import { MessageSquare, Phone, Mail, Globe, Bot, User, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';

const channelMeta = {
  whatsapp: { label: 'WhatsApp', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-100', icon: Phone },
  sms:      { label: 'SMS',      color: 'text-sky-700',     bg: 'bg-sky-50 border-sky-100',         icon: MessageSquare },
  email:    { label: 'Email',    color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-100',       icon: Mail },
  web:      { label: 'Web Chat', color: 'text-violet-700',  bg: 'bg-violet-50 border-violet-100',  icon: Globe },
  webchat:  { label: 'Web Chat', color: 'text-violet-700',  bg: 'bg-violet-50 border-violet-100',  icon: Globe },
  manual:   { label: 'Manual',   color: 'text-gray-500',    bg: 'bg-gray-50 border-gray-100',      icon: User },
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
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
        meta.color,
        meta.bg
      )}
    >
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
    return (
      <div className="my-1 flex items-center gap-2">
        <div className="h-px flex-1 bg-gray-100" />
        <span className="text-[10px] italic text-gray-400">{item.content}</span>
        <div className="h-px flex-1 bg-gray-100" />
      </div>
    );
  }

  if (isOut) {
    return (
      <article
        className={clsx(
          'animate-slide-up ml-auto max-w-[84%] rounded-2xl rounded-br-md px-3.5 py-2.5',
          isAI
            ? 'bg-accent text-white shadow-glow-sm'
            : 'bg-sky-500 text-white'
        )}
      >
        <div className="mb-1.5 flex items-center justify-end gap-2">
          <span className="text-[10px] text-white/60">
            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold text-white/90">
            {isAI ? <Bot className="h-2.5 w-2.5" /> : <User className="h-2.5 w-2.5" />}
            {isAI ? 'AI' : 'Manual'}
          </span>
        </div>
        <p className="text-sm leading-relaxed">{item.content}</p>
      </article>
    );
  }

  return (
    <article className="animate-slide-up mr-auto max-w-[84%] rounded-2xl rounded-bl-md border border-gray-100 bg-white px-3.5 py-2.5 shadow-xs">
      <div className="mb-1.5 flex items-center gap-2">
        <ChannelBadge channel={item.channel} />
        <span className="text-[10px] text-gray-400">
          {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      <p className="text-sm leading-relaxed text-gray-800">{item.content}</p>
    </article>
  );
}

export default function ConversationFeed({ messages, selectedLead, onLeadSelect, needsAttentionLeadIds = [] }) {
  const [activeTab, setActiveTab] = useState('all');
  const bottomRef = useRef(null);

  const filteredMessages = useMemo(() => {
    const isNeedsAttention = (item) => needsAttentionLeadIds.includes(Number(item.leadId));
    if (activeTab === 'all')      return messages;
    if (activeTab === 'whatsapp') return messages.filter((item) => item.channel === 'whatsapp');
    if (activeTab === 'email')    return messages.filter((item) => item.channel === 'email');
    if (activeTab === 'web')      return messages.filter((item) => item.channel === 'web' || item.channel === 'webchat');
    if (activeTab === 'needs')    return messages.filter((item) => isNeedsAttention(item));
    return messages;
  }, [messages, activeTab, needsAttentionLeadIds]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [filteredMessages.length]);

  return (
    <section className="rounded-3xl bg-white p-5 shadow-card">
      <header className="mb-4">
        <h2 className="text-base font-semibold text-gray-900">
          {selectedLead ? `${selectedLead.name} — Conversation` : 'Unified Conversation Feed'}
        </h2>
        <p className="text-xs text-gray-400">WhatsApp · Email · Web chat in one live stream</p>
      </header>

      {/* Tabs */}
      <div className="mb-4 flex flex-wrap gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'rounded-full px-3 py-1 text-xs font-medium transition-all',
              activeTab === tab.id
                ? 'bg-accent text-white shadow-glow-sm'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
            )}
          >
            {tab.label}
            {tab.id === 'needs' && needsAttentionLeadIds.length > 0 && (
              <span className="ml-1.5 inline-flex items-center gap-0.5 font-bold text-amber-400">
                <AlertTriangle className="h-2.5 w-2.5" />
                {needsAttentionLeadIds.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {filteredMessages.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-400">
          No conversations in this filter yet
        </div>
      ) : (
        <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1 pb-2 scroll-smooth">
          {filteredMessages.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onLeadSelect?.(item.leadId)}
              className="w-full text-left"
            >
              {item.leadName && (
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                  {item.leadName}
                </div>
              )}
              <MessageCard item={item} />
            </button>
          ))}
          <div ref={bottomRef} />
        </div>
      )}
    </section>
  );
}
