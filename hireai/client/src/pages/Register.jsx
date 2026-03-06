import { useState } from 'react';
import { Building2, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { apiRequest, setToken } from '../lib/api';

export default function Register({ onAuth }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ agencyName: '', email: '', password: '', confirm: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function onChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (form.password !== form.confirm) {
      setError('Passwords do not match');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ agencyName: form.agencyName, email: form.email, password: form.password }),
      });

      setToken(data.token);
      if (onAuth) onAuth(data.user);
      navigate('/onboarding');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-4">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-10%] top-[-20%] h-[500px] w-[500px] animate-float rounded-full bg-accent/20 blur-[130px]" />
        <div className="absolute bottom-[-20%] right-[-10%] h-[400px] w-[400px] rounded-full bg-cyan-500/10 blur-[110px]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-2xl border border-accent/30 bg-accent/10 px-4 py-2">
            <Building2 className="h-5 w-5 text-accent" />
            <span className="font-heading text-xl text-white">HireAI</span>
          </div>
          <h1 className="font-heading text-3xl text-white">Create your agency</h1>
          <p className="mt-2 text-sm text-textSoft">Start your 14-day free trial. No credit card required.</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-card p-6 shadow-glow">
          {error && (
            <div className="mb-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block text-xs text-textSoft">
              Agency Name
              <input
                required
                value={form.agencyName}
                onChange={(e) => onChange('agencyName', e.target.value)}
                placeholder="Dream Properties Ltd"
                className="mt-1 w-full rounded-xl border border-white/10 bg-bg px-4 py-2.5 text-sm text-white outline-none placeholder:text-textSoft/60 focus:border-accent"
              />
            </label>

            <label className="block text-xs text-textSoft">
              Email Address
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => onChange('email', e.target.value)}
                placeholder="you@agency.com"
                className="mt-1 w-full rounded-xl border border-white/10 bg-bg px-4 py-2.5 text-sm text-white outline-none placeholder:text-textSoft/60 focus:border-accent"
              />
            </label>

            <label className="block text-xs text-textSoft">
              Password
              <div className="relative mt-1">
                <input
                  required
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => onChange('password', e.target.value)}
                  placeholder="Min 8 characters"
                  className="w-full rounded-xl border border-white/10 bg-bg px-4 py-2.5 pr-10 text-sm text-white outline-none placeholder:text-textSoft/60 focus:border-accent"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-textSoft hover:text-white"
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>

            <label className="block text-xs text-textSoft">
              Confirm Password
              <input
                required
                type="password"
                value={form.confirm}
                onChange={(e) => onChange('confirm', e.target.value)}
                placeholder="Repeat password"
                className="mt-1 w-full rounded-xl border border-white/10 bg-bg px-4 py-2.5 text-sm text-white outline-none placeholder:text-textSoft/60 focus:border-accent"
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Creating account...' : (
                <>
                  Create Free Account
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-textSoft">
            Already have an account?{' '}
            <Link to="/login" className="text-accent hover:underline">Sign in</Link>
          </p>
        </div>

        <p className="mt-4 text-center text-xs text-textSoft/60">
          By registering you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
