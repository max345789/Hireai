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

export function buildApiUrl(path) {
  return buildUrl(path);
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

export async function apiDownload(path, filename = 'download') {
  const token = getToken();
  const response = await fetch(buildUrl(path), {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Request failed with ${response.status}`);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(objectUrl);
}
