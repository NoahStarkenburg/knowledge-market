import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { SessionEvents } from '@core/session-events';
import { doRefresh, readCsrf } from './http-core';

// Auth endpoints where a 401 is a real failure (bad credentials), not an expired token - 
// so we must NOT try to refresh-and-retry them (that would loop or mask the real error).
const AUTH_NO_REFRESH = /\/api\/auth\/(login|register|refresh|logout|forgot-password|reset-password|google)/;

// Every API request carries credentials (the HttpOnly JWT cookie) + the X-CSRF double-submit
// header; a 401 triggers a single-flight refresh and one retry, and a failed refresh emits
// SessionEvents.expired so the AuthService clears state and the UI drops to logged-out.
export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  const session = inject(SessionEvents);
  // Only touch requests to our own API. Anything else passes through untouched, so a
  // third-party service never receives our cookies or CSRF header.
  if (!req.url.startsWith('/api/')) {
    return next(req);
  }

  const withAuth = () => {
    const csrf = readCsrf();
    return req.clone({
      withCredentials: true,
      setHeaders: csrf ? { 'X-CSRF': csrf } : {},
    });
  };

  if (AUTH_NO_REFRESH.test(req.url)) {
    return next(withAuth());
  }

  return next(withAuth()).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status !== 401) return throwError(() => err);

      return from(doRefresh()).pipe(
        switchMap(() => next(withAuth())),
        catchError(() => {
          session.expired();
          return throwError(() => err);
        }),
      );
    }),
  );
};
