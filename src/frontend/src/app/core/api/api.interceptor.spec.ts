import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SessionEvents } from '@core/session-events';
import { apiInterceptor } from './api.interceptor';

describe('apiInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let refresh: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([apiInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);

    // The token refresh is a bare fetch, so it is stubbed separately from HttpClient.
    refresh = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', refresh);
    document.cookie = 'km_csrf=csrf-123';
  });

  afterEach(() => {
    backend.verify();
    vi.unstubAllGlobals();
    document.cookie = 'km_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  });

  it('sends cookies and the CSRF header on API requests', () => {
    http.post('/api/courses', {}).subscribe();

    const req = backend.expectOne('/api/courses');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.headers.get('X-CSRF')).toBe('csrf-123');
    req.flush({});
  });

  it('leaves requests to other origins untouched', () => {
    http.get('https://storage.example/file').subscribe();

    const req = backend.expectOne('https://storage.example/file');
    expect(req.request.withCredentials).toBe(false);
    expect(req.request.headers.has('X-CSRF')).toBe(false);
    req.flush({});
  });

  it('refreshes once and retries when a request is rejected with 401', async () => {
    let body: unknown;
    http.get('/api/users/me').subscribe((b) => (body = b));

    backend.expectOne('/api/users/me').flush(null, { status: 401, statusText: 'Unauthorized' });

    const retry = await vi.waitFor(() => backend.expectOne('/api/users/me'));
    retry.flush({ email: 'a@b.co' });

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledWith('/api/auth/refresh', expect.objectContaining({ method: 'POST' }));
    expect(body).toEqual({ email: 'a@b.co' });
  });

  it('shares one refresh between requests that expire at the same time', async () => {
    http.get('/api/orders').subscribe();
    http.get('/api/courses/purchased').subscribe();

    backend.expectOne('/api/orders').flush(null, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne('/api/courses/purchased').flush(null, { status: 401, statusText: 'Unauthorized' });

    (await vi.waitFor(() => backend.expectOne('/api/orders'))).flush({});
    (await vi.waitFor(() => backend.expectOne('/api/courses/purchased'))).flush({});

    // Refresh tokens rotate: two parallel refreshes would revoke each other and log the user out.
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('ends the session when the refresh fails', async () => {
    refresh.mockResolvedValue({ ok: false });
    const expired = vi.spyOn(TestBed.inject(SessionEvents), 'expired');
    let status: number | undefined;
    http.get('/api/users/me').subscribe({ error: (e) => (status = e.status) });

    backend.expectOne('/api/users/me').flush(null, { status: 401, statusText: 'Unauthorized' });

    await vi.waitFor(() => expect(expired).toHaveBeenCalledTimes(1));
    expect(status).toBe(401);
  });

  it('does not refresh when a sign-in request is rejected', () => {
    let status: number | undefined;
    http.post('/api/auth/login', {}).subscribe({ error: (e) => (status = e.status) });

    backend.expectOne('/api/auth/login').flush(null, { status: 401, statusText: 'Unauthorized' });

    // A 401 from login means wrong credentials, not an expired token.
    expect(refresh).not.toHaveBeenCalled();
    expect(status).toBe(401);
  });
});
