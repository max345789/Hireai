import { useState } from 'react';
import { Bot, Building2 } from 'lucide-react';
import { apiRequest, setToken } from '../lib/api';

export default function Login({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [agencyName, setAgencyName] = useState('');
  const [email, setEmail] = useState('admin@hireai.local');
  const [password, setPassword] = useState('password123');
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg p-4 text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[10%] top-[10%] h-72 w-72 animate-float rounded-full bg-accent/30 blur-[120px]" />
        <div className="absolute bottom-[10%] right-[12%] h-72 w-72 rounded-full bg-cyan-500/20 blur-[120px]" />
      </div>

      <form onSubmit={handleSubmit} className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-card/95 p-6 shadow-glow">
        <div className="mb-5 text-center">
          <div className="mb-2 inline-flex items-center gap-2 rounded-xl bg-accent/20 px-3 py-2 text-accent">
            <Bot className="h-4 w-4" />
            AI Agent Command Center
          </div>
          <h1 className="font-heading text-3xl">HireAI</h1>
          <p className="text-sm text-textSoft">24/7 client communication workspace</p>
        </div>

        {mode === 'register' && (
          <label className="mb-3 block text-xs text-textSoft">
            Agency Name
            <div className="relative mt-1">
              <Building2 className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-textSoft" />
              <input
                value={agencyName}
                onChange={(event) => setAgencyName(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-bg py-2 pl-9 pr-3 text-sm outline-none focus:border-accent"
                placeholder="Metro Property Group"
              />
            </div>
          </label>
        )}

        <label className="mb-3 block text-xs text-textSoft">
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 w-full rounded-xl border border-white/10 bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </label>

        <label className="mb-3 block text-xs text-textSoft">
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 w-full rounded-xl border border-white/10 bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </label>

        {error && <p className="mb-3 rounded-lg bg-rose-500/15 px-3 py-2 text-xs text-rose-200">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? 'Please wait...' : mode === 'register' ? 'Create Workspace' : 'Enter Command Center'}
        </button>

        <button
          type="button"
          onClick={() => setMode((prev) => (prev === 'login' ? 'register' : 'login'))}
          className="mt-3 w-full text-xs text-textSoft underline-offset-2 hover:text-white hover:underline"
        >
          {mode === 'login' ? 'Need an account? Register' : 'Already have an account? Login'}
        </button>
      </form>
    </div>
  );
}
