import { useState } from 'react';
import { Bot, Building2, Zap } from 'lucide-react';
import { apiRequest, setToken } from '../lib/api';

export default function Login({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [agencyName, setAgencyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload = mode === 'register'
        ? { agencyName: agencyName || 'My Realty Agency', email, password }
        : { email, password };

      const endpoint = mode === 'register' ? '/auth/register' : '/auth/login';
      const data = await apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setToken(data.token);
      onAuth(data.user);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#090B12] p-4 overflow-hidden">
      {/* Noise overlay */}
      <div className="noise-overlay" />

      {/* Background glow orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-accent/[0.04] blur-3xl" />
        <div className="absolute bottom-0 left-1/4 h-64 w-64 rounded-full bg-accent/[0.03] blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Brand */}
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-accent shadow-glow">
            <Bot className="h-8 w-8 text-[#090B12]" />
          </div>
          <h1 className="font-heading text-2xl font-bold text-white">HireAI</h1>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-widest text-white/30">
            AI Agent Command Center
          </p>
        </div>

        {/* Card */}
        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-white/[0.08] bg-[#111521] p-7 shadow-card2"
        >
          <h2 className="mb-6 font-heading text-lg font-semibold text-white">
            {mode === 'login' ? 'Sign in to your workspace' : 'Create your workspace'}
          </h2>

          {mode === 'register' && (
            <label className="mb-4 block text-sm font-medium text-white/50">
              Agency Name
              <div className="relative mt-1.5">
                <Building2 className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-white/30" />
                <input
                  value={agencyName}
                  onChange={(event) => setAgencyName(event.target.value)}
                  className="input-premium pl-9"
                  placeholder="Metro Property Group"
                />
              </div>
            </label>
          )}

          <label className="mb-4 block text-sm font-medium text-white/50">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="input-premium mt-1.5"
              placeholder="you@example.com"
            />
          </label>

          <label className="mb-6 block text-sm font-medium text-white/50">
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="input-premium mt-1.5"
              placeholder="••••••••"
            />
          </label>

          {error && (
            <p className="mb-5 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-3 py-2.5 text-xs text-rose-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-3 text-sm font-bold text-[#090B12] shadow-glow transition hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <Zap className="h-4 w-4 animate-pulse" />
                Please wait...
              </>
            ) : (
              mode === 'register' ? 'Create Workspace' : 'Enter Command Center'
            )}
          </button>

          <button
            type="button"
            onClick={() => setMode((prev) => (prev === 'login' ? 'register' : 'login'))}
            className="mt-4 w-full text-xs text-white/25 underline-offset-2 transition hover:text-white/50 hover:underline"
          >
            {mode === 'login' ? 'Need an account? Register' : 'Already have an account? Login'}
          </button>
        </form>

        {/* Footer */}
        <p className="mt-6 text-center font-mono text-[10px] uppercase tracking-widest text-white/15">
          Powered by Claude AI · Real Estate Automation
        </p>
      </div>
    </div>
  );
}
