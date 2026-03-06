const API_PREFIX = '/api';

export function getToken() {
  return localStorage.getItem('hireai_token');
}

export function setToken(token) {
  localStorage.setItem('hireai_token', token);
}

export function clearToken() {
  localStorage.removeItem('hireai_token');
}

export async function apiRequest(path, options = {}) {
  const token = getToken();

  const response = await fetch(`${API_PREFIX}${path}`, {
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
