const SESSION_EXPIRED_EVENT = 'branchbrew:session-expired';

let notified = false;

export function notifySessionExpired(): void {
  if (typeof window === 'undefined') return;
  if (window.location.pathname === '/login') return;
  if (notified) return;
  notified = true;
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
}

export function resetSessionExpiredNotice(): void {
  notified = false;
}

export function onSessionExpired(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(SESSION_EXPIRED_EVENT, handler);
  if (notified) handler();
  return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handler);
}

export function buildLoginUrlWithReturnPath(pathname: string, search = ''): string {
  const target = `${pathname}${search}`;
  if (!pathname.startsWith('/') || pathname === '/login') return '/login';
  return `/login?next=${encodeURIComponent(target)}`;
}

export function resolveReturnPath(next: string | null | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith('/') || next.startsWith('//')) return null;
  if (next.startsWith('/login')) return null;
  return next;
}
