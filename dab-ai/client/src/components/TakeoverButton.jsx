import { Hand, Bot } from 'lucide-react';

export default function TakeoverButton({ lead, onToggle }) {
  if (!lead) {
    return (
      <button
        type="button"
        disabled
        className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-textSoft"
      >
        <Hand className="h-4 w-4" />
        Select a lead to manage takeover
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onToggle(lead)}
      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
        lead.aiPaused
          ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25'
          : 'border-amber-400/50 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25'
      }`}
    >
      {lead.aiPaused ? <Bot className="h-4 w-4" /> : <Hand className="h-4 w-4" />}
      {lead.aiPaused ? 'Hand Back To AI' : 'Take Over'}
    </button>
  );
}
