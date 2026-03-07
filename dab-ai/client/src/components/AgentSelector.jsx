import { useEffect, useState } from 'react';
import { Zap, Calendar, Heart, X, CheckCircle2, ArrowRight } from 'lucide-react';
import { apiRequest } from '../lib/api';

const AGENT_ICONS = {
  salesbot: Zap,
  bookingbot: Calendar,
  nurturebot: Heart,
};

const AGENT_COLORS = {
  salesbot: { accent: '#f97316', bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400', glow: 'shadow-[0_0_24px_rgba(249,115,22,0.25)]' },
  bookingbot: { accent: '#3b82f6', bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', glow: 'shadow-[0_0_24px_rgba(59,130,246,0.25)]' },
  nurturebot: { accent: '#8b5cf6', bg: 'bg-violet-500/10', border: 'border-violet-500/30', text: 'text-violet-400', glow: 'shadow-[0_0_24px_rgba(139,92,246,0.25)]' },
};

function AgentCard({ agent, selected, onSelect }) {
  const Icon = AGENT_ICONS[agent.id] || Zap;
  const colors = AGENT_COLORS[agent.id] || AGENT_COLORS.salesbot;
  const isSelected = selected === agent.id;

  return (
    <button
      type="button"
      onClick={() => onSelect(agent.id)}
      className={`relative w-full rounded-3xl border p-5 text-left transition-all duration-300 ${
        isSelected
          ? `${colors.bg} ${colors.border} ${colors.glow}`
          : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.18] hover:bg-white/[0.05]'
      }`}
    >
      {isSelected && (
        <span className="absolute right-4 top-4">
          <CheckCircle2 className={`h-5 w-5 ${colors.text}`} />
        </span>
      )}

      <div className="mb-4 flex items-center gap-3">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-2xl ${colors.bg} border ${colors.border}`}
        >
          <Icon className={`h-5 w-5 ${colors.text}`} />
        </div>
        <div>
          <p className="font-heading text-base font-bold text-white">{agent.name}</p>
          <p className={`text-xs font-medium ${colors.text}`}>{agent.tagline}</p>
        </div>
      </div>

      <p className="mb-4 text-xs leading-relaxed text-white/55">{agent.description}</p>

      <div className="space-y-1.5">
        {(agent.strengths || []).map((strength) => (
          <div key={strength} className="flex items-center gap-2">
            <div className={`h-1.5 w-1.5 rounded-full ${isSelected ? colors.text.replace('text-', 'bg-') : 'bg-white/20'}`} />
            <span className="text-xs text-white/50">{strength}</span>
          </div>
        ))}
      </div>
    </button>
  );
}

export default function AgentSelector({ onAgentSelected, initialAgent }) {
  const [agents, setAgents] = useState([]);
  const [selected, setSelected] = useState(initialAgent || null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest('/agent-selector')
      .then((data) => {
        setAgents(data.agents || []);
        if (!selected) setSelected(data.current || 'salesbot');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleStart() {
    if (!selected) return;
    setSaving(true);
    setError('');
    try {
      const data = await apiRequest('/agent-selector', {
        method: 'POST',
        body: JSON.stringify({ agentId: selected }),
      });
      onAgentSelected(data.agent || { id: selected });
    } catch (err) {
      setError(err.message || 'Failed to select agent');
    } finally {
      setSaving(false);
    }
  }

  const colors = AGENT_COLORS[selected] || AGENT_COLORS.salesbot;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
      <div className="w-full max-w-3xl animate-scale-in rounded-[32px] border border-white/[0.10] bg-[#0d1117] p-6 shadow-[0_32px_80px_rgba(0,0,0,0.7)]">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-accent">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            AI Agent Selection
          </div>
          <h2 className="font-heading text-2xl font-bold text-white">Choose your AI Agent</h2>
          <p className="mt-1.5 text-sm text-white/40">
            Select the agent that best fits your workflow. You can change this anytime in Settings.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent/20 border-t-accent" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {agents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                selected={selected}
                onSelect={setSelected}
              />
            ))}
          </div>
        )}

        <div className="mt-6 flex items-center justify-between">
          <p className="text-xs text-white/30">
            Your agent handles all inbound conversations automatically.
          </p>
          <button
            type="button"
            onClick={handleStart}
            disabled={!selected || saving}
            className={`inline-flex items-center gap-2 rounded-2xl px-6 py-2.5 text-sm font-bold text-[#090B12] transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${
              selected ? `${colors.bg.replace('bg-', 'bg-').replace('/10', '')} ` : ''
            }`}
            style={{ backgroundColor: selected ? (AGENT_COLORS[selected]?.accent || '#f97316') : '#f97316' }}
          >
            {saving ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#090B12]/30 border-t-[#090B12]" />
                Starting...
              </>
            ) : (
              <>
                Start with {agents.find((a) => a.id === selected)?.name || 'Agent'}
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
