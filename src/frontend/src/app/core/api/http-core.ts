import type { ApiError } from './types';

// Read the CSRF token from the readable cookie the server sets on login.
export function readCsrf(): string {
  const match = document.cookie.match(/km_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

// De-duplicate concurrent refreshes ("single-flight"). If several requests 401 at once,
// they all await one refresh instead of each firing its own and racing the rotating token.
let refreshInFlight: Promise<void> | null = null;

export function doRefresh(): Promise<void> {
  if (!refreshInFlight) {
    refreshInFlight = fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })
      .then((r) => {
        if (!r.ok) throw new Error('Refresh failed');
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

// Normalize any thrown value from HttpClient into the shared ApiError shape.
export function toApiError(err: unknown): ApiError {
  // HttpErrorResponse-like
  const e = err as { status?: number; error?: unknown };
  const body = (e?.error ?? null) as {
    title?: string;
    detail?: string;
    message?: string;
    errors?: Record<string, string[]>;
  } | null;
  return {
    status: e?.status ?? 0,
    title: body?.title,
    detail: body?.detail ?? body?.message,
    message: body?.message,
    errors: body?.errors,
  };
}
