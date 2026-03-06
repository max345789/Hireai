import { useState } from 'react';
import { Bot, Building2 } from 'lucide-react';
import { apiRequest, setToken } from '../lib/api';

export default function Login({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [agencyName, setAgencyName] = useState('');
  const [email, setEmail] = useState('admin@hireai.local');
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
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="mb-6 text-center">
          <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-accent shadow-glow">
            <Bot className="h-7 w-7 text-white" />
          </div>
          <h1 className="font-heading text-2xl font-bold text-gray-900">HireAI</h1>
          <p className="mt-1 text-sm text-gray-500">AI Agent Command Center</p>
        </div>

        {/* Card */}
        <form onSubmit={handleSubmit} className="rounded-3xl bg-white p-7 shadow-card2">
          <h2 className="mb-5 text-lg font-semibold text-gray-900">
            {mode === 'login' ? 'Sign in to your workspace' : 'Create your workspace'}
          </h2>

          {mode === 'register' && (
            <label className="mb-4 block text-sm font-medium text-gray-600">
              Agency Name
              <div className="relative mt-1.5">
                <Building2 className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  value={agencyName}
                  onChange={(event) => setAgencyName(event.target.value)}
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-sm text-gray-900 outline-none transition focus:border-accent focus:bg-white"
                  placeholder="Metro Property Group"
                />
              </div>
            </label>
          )}

          <label className="mb-4 block text-sm font-medium text-gray-600">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1.5 w-full rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-accent focus:bg-white"
            />
          </label>

          <label className="mb-5 block text-sm font-medium text-gray-600">
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1.5 w-full rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-accent focus:bg-white"
            />
          </label>

          {error && (
            <p className="mb-4 rounded-2xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white shadow-glow transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Please wait...' : mode === 'register' ? 'Create Workspace' : 'Enter Command Center'}
          </button>

          <button
            type="button"
            onClick={() => setMode((prev) => (prev === 'login' ? 'register' : 'login'))}
            className="mt-4 w-full text-xs text-gray-400 underline-offset-2 transition hover:text-gray-600 hover:underline"
          >
            {mode === 'login' ? 'Need an account? Register' : 'Already have an account? Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
