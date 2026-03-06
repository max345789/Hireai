import { io } from 'socket.io-client';

let socket;

function resolveSocketUrl() {
  const explicit = (import.meta.env.VITE_WS_URL || '').trim();
  if (explicit) return explicit.replace(/\/+$/, '');

  const apiBase = (import.meta.env.VITE_API_URL || '').trim();
  if (apiBase) return apiBase.replace(/\/+$/, '');

  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  return 'http://localhost:3001';
}

export function connectSocket() {
  if (!socket) {
    socket = io(resolveSocketUrl(), {
      transports: ['websocket', 'polling'],
    });
  }

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
