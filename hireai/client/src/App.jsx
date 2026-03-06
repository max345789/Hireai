import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Register from './pages/Register';
import Onboarding from './pages/Onboarding';
import Analytics from './pages/Analytics';
import Billing from './pages/Billing';
import { apiRequest, clearToken, getToken } from './lib/api';

function ProtectedRoute({ user, children }) {
  if (!user) {
    return <Navigate to="/login" replace />;
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
      <div className="flex min-h-screen items-center justify-center bg-bg text-white">
        <div className="rounded-xl border border-white/10 bg-card px-6 py-4">Starting HireAI...</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <Login onAuth={(nextUser) => setUser(nextUser)} />}
      />
      <Route
        path="/register"
        element={user ? <Navigate to="/" replace /> : <Register onAuth={(nextUser) => setUser(nextUser)} />}
      />
      <Route
        path="/onboarding"
        element={(
          <ProtectedRoute user={user}>
            <Onboarding />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/"
        element={(
          <ProtectedRoute user={user}>
            <Dashboard user={user} onLogout={() => setUser(null)} />
          </ProtectedRoute>
        )}
      />
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
      <Route path="*" element={<Navigate to={user ? '/' : '/login'} replace />} />
    </Routes>
  );
}
