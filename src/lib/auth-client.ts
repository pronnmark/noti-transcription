'use client';

// Client-side authentication utilities
export function getSessionToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth-token');
}

export function setSessionToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('auth-token', token);

  // Also set as cookie for server-side access
  document.cookie = `auth-token=${token}; path=/; max-age=${7 * 24 * 60 * 60}`; // 7 days
}

export function clearSessionToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('auth-token');

  // Clear cookie
  document.cookie =
    'auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
}

export function isAuthenticated(): boolean {
  return !!getSessionToken();
}

export function logout(): void {
  clearSessionToken();
  window.location.href = '/';
}
