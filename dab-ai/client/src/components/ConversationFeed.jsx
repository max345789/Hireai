import { useMemo, useState, useRef, useEffect } from 'react';
import { MessageSquare, Phone, Mail, Globe, Bot, User, AlertTriangle, Instagram, Facebook } from 'lucide-react';
import clsx from 'clsx';

const channelMeta = {
  whatsapp:  { label: 'WhatsApp',  color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', icon: Phone },
  sms:       { label: 'SMS',       color: 'text-sky-400',     bg: 'bg-sky-500/10 border-sky-500/20',         icon: MessageSquare },
  email:     { label: 'Email',     color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/20',       icon: Mail },
  web:       { label: 'Web Chat',  color: 'text-violet-400',  bg: 'bg-violet-500/10 border-violet-500/20',  icon: Globe },
  webchat:   { label: 'Web Chat',  color: 'text-violet-400',  bg: 'bg-violet-500/10 border-violet-500/20',  icon: Globe },
  instagram: { label: 'Instagram', color: 'text-pink-400',    bg: 'bg-pink-500/10 border-pink-500/20',      icon: Instagram },
  messenger: { label: 'Messenger', color: 'text-sky-400',     bg: 'bg-sky-500/10 border-sky-500/20',        icon: Facebook },
  manual:    { label: 'Manual',    color: 'text-white/40',    bg: 'bg-white/[0.05] border-white/[0.08]',    icon: User },
};

const tabs = [
  { id: 'all',       label: 'All' },
  { id: 'whatsapp',  label: '📱 WhatsApp' },
  { id: 'email',     label: '📧 Email' },
  { id: 'web',       label: '💬 Web' },
  { id: 'instagram', label: '📸 Instagram' },
  { id: 'messenger', label: '💙 Messenger' },
  { id: 'needs',     label: '⚠️ Needs Attention' },
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
        <div className="h-px flex-1 bg-white/[0.06]" />
        <span className="text-[10px] italic text-white/30">{item.content}</span>
        <div className="h-px flex-1 bg-white/[0.06]" />
      </div>
    );
  }

  if (isOut) {
    return (
      <article
        className={clsx(
          'animate-slide-up ml-auto max-w-[84%] rounded-2xl rounded-br-md px-3.5 py-2.5',
          isAI
            ? 'bg-accent text-[#090B12] shadow-glow-sm'
            : 'bg-sky-500/80 text-white'
        )}
      >
        <div className="mb-1.5 flex items-center justify-end gap-2">
          <span className={clsx('text-[10px]', isAI ? 'text-[#090B12]/60' : 'text-white/60')}>
            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span className={clsx(
            'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
            isAI ? 'bg-[#090B12]/15 text-[#090B12]/80' : 'bg-white/15 text-white/90'
          )}>
            {isAI ? <Bot className="h-2.5 w-2.5" /> : <User className="h-2.5 w-2.5" />}
            {isAI ? 'AI' : 'Manual'}
          </span>
        </div>
        <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{item.content}</p>
      </article>
    );
  }

  return (
    <article className="animate-slide-up mr-auto max-w-[84%] rounded-2xl rounded-bl-md border border-white/[0.08] bg-white/[0.05] px-3.5 py-2.5">
      <div className="mb-1.5 flex items-center gap-2">
        <ChannelBadge channel={item.channel} />
        <span className="text-[10px] text-white/30">
          {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      <p className="text-sm leading-relaxed text-white/80 break-words whitespace-pre-wrap">{item.content}</p>
    </article>
  );
}

export default function ConversationFeed({ messages, selectedLead, onLeadSelect, needsAttentionLeadIds = [] }) {
  const [activeTab, setActiveTab] = useState('all');
  const bottomRef = useRef(null);

  const filteredMessages = useMemo(() => {
    const isNeedsAttention = (item) => needsAttentionLeadIds.includes(Number(item.leadId));
    if (activeTab === 'all')       return messages;
    if (activeTab === 'whatsapp')  return messages.filter((item) => item.channel === 'whatsapp');
    if (activeTab === 'email')     return messages.filter((item) => item.channel === 'email');
    if (activeTab === 'web')       return messages.filter((item) => item.channel === 'web' || item.channel === 'webchat');
    if (activeTab === 'instagram') return messages.filter((item) => item.channel === 'instagram');
    if (activeTab === 'messenger') return messages.filter((item) => item.channel === 'messenger');
    if (activeTab === 'needs')     return messages.filter((item) => isNeedsAttention(item));
    return messages;
  }, [messages, activeTab, needsAttentionLeadIds]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [filteredMessages.length]);

  return (
    <section className="rounded-3xl border border-white/[0.08] bg-[#111521] p-5 shadow-card min-w-0">
      <header className="mb-4">
        <h2 className="font-heading text-base font-semibold text-white break-words">
          {selectedLead ? `${selectedLead.name} — Conversation` : 'Unified Conversation Feed'}
        </h2>
        <p className="font-mono text-[10px] uppercase tracking-widest text-white/30">
          WhatsApp · Email · Web chat in one live stream
        </p>
      </header>

      {/* Tabs */}
      <div className="mb-4 flex flex-wrap gap-1 min-w-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'rounded-full px-3 py-1 text-xs font-medium transition-all',
              activeTab === tab.id
                ? 'bg-accent/20 text-accent border border-accent/30'
                : 'bg-white/[0.05] text-white/50 hover:bg-white/[0.08] hover:text-white/80 border border-transparent'
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
        <div className="rounded-2xl border border-dashed border-white/[0.08] p-8 text-center text-sm text-white/30">
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
                <div className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-white/30">
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
