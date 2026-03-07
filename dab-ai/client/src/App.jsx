import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Analytics from './pages/Analytics';
import Inbox from './pages/Inbox';
import Settings from './pages/Settings';
import { apiRequest, clearToken, getToken, setToken } from './lib/api';

const AUTO_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || 'admin@dabai.app';
const AUTO_PASS  = import.meta.env.VITE_ADMIN_PASS  || 'DabAI2024SecurePass!';
const AUTO_AGENCY = 'DAB AI';

export default function App() {
  const [user, setUser]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function bootstrap() {
      // 1. Try existing token
      const token = getToken();
      if (token) {
        try {
          const data = await apiRequest('/auth/me');
          setUser(data.user || null);
          setLoading(false);
          return;
        } catch {
          clearToken();
        }
      }

      // 2. Try auto-login
      try {
        const res = await apiRequest('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email: AUTO_EMAIL, password: AUTO_PASS }),
        });
        setToken(res.token);
        setUser(res.user);
        setLoading(false);
        return;
      } catch {
        // Login failed — register first
      }

      // 3. Auto-register then login
      try {
        await apiRequest('/auth/register', {
          method: 'POST',
          body: JSON.stringify({ email: AUTO_EMAIL, password: AUTO_PASS, agencyName: AUTO_AGENCY }),
        });
        const res = await apiRequest('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email: AUTO_EMAIL, password: AUTO_PASS }),
        });
        setToken(res.token);
        setUser(res.user);
      } catch (err) {
        // Could not auto-auth — show minimal error state
        console.error('Auto-auth failed:', err.message);
      } finally {
        setLoading(false);
      }
    }

    bootstrap();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-oat">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-coral flex items-center justify-center shadow-card">
            <span className="text-white font-heading font-bold text-lg">D</span>
          </div>
          <p className="text-sm text-muted font-medium animate-pulse-soft">Starting DAB AI…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-oat">
        <div className="bento-card p-8 text-center max-w-sm w-full mx-4">
          <div className="h-12 w-12 rounded-2xl bg-coral mx-auto mb-4 flex items-center justify-center">
            <span className="text-white font-heading font-bold text-xl">D</span>
          </div>
          <h1 className="font-heading font-bold text-ink text-xl mb-2">Could not connect</h1>
          <p className="text-muted text-sm mb-4">Unable to reach the server. Make sure the backend is running.</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full rounded-xl bg-coral text-white font-semibold py-2.5 text-sm hover:opacity-90 transition-opacity"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/dashboard" element={<Dashboard user={user} onLogout={() => { clearToken(); setUser(null); }} />} />
      <Route path="/inbox"     element={<Inbox />} />
      <Route path="/analytics" element={<Analytics />} />
      <Route path="/settings"  element={<Settings />} />
      <Route path="*"          element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
