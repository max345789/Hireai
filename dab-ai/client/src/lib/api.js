const RAW_API_BASE = (import.meta.env.VITE_API_URL || '').trim();
const API_BASE = RAW_API_BASE.replace(/\/+$/, '');

function buildUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (!API_BASE) {
    return `/api${normalizedPath}`;
  }

  if (API_BASE.endsWith('/api')) {
    return `${API_BASE}${normalizedPath}`;
  }

  return `${API_BASE}/api${normalizedPath}`;
}

export function getToken() {
  return localStorage.getItem('dab-ai_token');
}

export function setToken(token) {
  localStorage.setItem('dab-ai_token', token);
}

export function clearToken() {
  localStorage.removeItem('dab-ai_token');
}

export async function apiRequest(path, options = {}) {
  const token = getToken();

  const response = await fetch(buildUrl(path), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data.error || `Request failed with ${response.status}`;
    throw new Error(message);
  }

  return data;
}
