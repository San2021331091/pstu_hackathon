'use client';

// Minimal client-side auth store. Token in localStorage; fine for a closed
// demo. In production you'd prefer httpOnly cookies + refresh tokens.
export interface SessionUser {
  id: string;
  name: string;
  phone: string;
}

const TOKEN_KEY = 'mm_token';
const USER_KEY = 'mm_user';

export function saveSession(token: string, user: SessionUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): SessionUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as SessionUser) : null;
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
