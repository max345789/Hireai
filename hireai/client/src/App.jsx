import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Inbox from './pages/Inbox';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Register from './pages/Register';
import Onboarding from './pages/Onboarding';
import Analytics from './pages/Analytics';
import Billing from './pages/Billing';
import LandingPage from './landing/LandingPage';
import { apiRequest, clearToken, getToken } from './lib/api';

function ProtectedRoute({ user, children }) {
  if (!user) {
    return <Navigate to="/landing" replace />;
  }

  return children;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function bootstrap() {
      const token = getToken();
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const data = await apiRequest('/auth/me');
        setUser(data.user || null);
      } catch {
        clearToken();
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    bootstrap();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="rounded-2xl bg-white px-6 py-4 text-sm text-gray-500 shadow-card">Starting HireAI…</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/inbox" replace /> : <Login onAuth={(nextUser) => setUser(nextUser)} />}
      />
      <Route
        path="/register"
        element={user ? <Navigate to="/inbox" replace /> : <Register onAuth={(nextUser) => setUser(nextUser)} />}
      />
      <Route path="/landing" element={<LandingPage />} />
      <Route
        path="/onboarding"
        element={(
          <ProtectedRoute user={user}>
            <Onboarding />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/inbox"
        element={(
          <ProtectedRoute user={user}>
            <Inbox />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/dashboard"
        element={(
          <ProtectedRoute user={user}>
            <Dashboard user={user} onLogout={() => setUser(null)} />
          </ProtectedRoute>
        )}
      />
      <Route path="/" element={<Navigate to={user ? '/inbox' : '/landing'} replace />} />
      <Route
        path="/settings"
        element={(
          <ProtectedRoute user={user}>
            <Settings />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/analytics"
        element={(
          <ProtectedRoute user={user}>
            <Analytics />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/billing"
        element={(
          <ProtectedRoute user={user}>
            <Billing />
          </ProtectedRoute>
        )}
      />
      <Route path="*" element={<Navigate to={user ? '/inbox' : '/landing'} replace />} />
    </Routes>
  );
}
