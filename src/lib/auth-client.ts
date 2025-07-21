'use client';

// Client-side authentication utilities
export function getSessionToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('noti-session');
}

export function setSessionToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('noti-session', token);
  
  // Also set as cookie for server-side access
  document.cookie = `noti-session=${token}; path=/; max-age=${7 * 24 * 60 * 60}`; // 7 days
}

export function clearSessionToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('noti-session');
  
  // Clear cookie
  document.cookie = 'noti-session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
}

export function isAuthenticated(): boolean {
  return !!getSessionToken();
}

export function logout(): void {
  clearSessionToken();
  window.location.href = '/';
}