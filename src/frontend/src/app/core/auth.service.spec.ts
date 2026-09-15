import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { ApiService } from '@core/api/api.service';
import type { LoginResponse } from '@core/api/types';

describe('AuthService', () => {
  let apiMock: { login: ReturnType<typeof vi.fn>; logout: ReturnType<typeof vi.fn>; refreshSession: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    localStorage.clear();
    apiMock = {
      login: vi.fn(),
      logout: vi.fn().mockResolvedValue(undefined),
      refreshSession: vi.fn().mockResolvedValue(undefined),
    };
    TestBed.configureTestingModule({
      providers: [AuthService, { provide: ApiService, useValue: apiMock }],
    });
  });

  it('starts unauthenticated', () => {
    const auth = TestBed.inject(AuthService);
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.isAdmin()).toBe(false);
  });

  it('authenticates and detects admin after login', async () => {
    const resp: LoginResponse = { userId: 'u1', email: 'a@b.co', csrf: 'x', isEmailVerified: true, roles: ['Admin'], displayName: 'A' };
    apiMock.login.mockResolvedValue(resp);
    const auth = TestBed.inject(AuthService);

    const result = await auth.login('a@b.co', 'pw');

    expect(result.success).toBe(true);
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.isAdmin()).toBe(true);
    expect(auth.email()).toBe('a@b.co');
  });

  it('returns the error on failed login', async () => {
    apiMock.login.mockRejectedValue({ status: 401 });
    const auth = TestBed.inject(AuthService);

    const result = await auth.login('a@b.co', 'bad');

    expect(result.success).toBe(false);
    expect(result.error?.status).toBe(401);
    expect(auth.isAuthenticated()).toBe(false);
  });

  it('clears state on logout', async () => {
    apiMock.login.mockResolvedValue({ userId: 'u1', email: 'a@b.co', csrf: 'x', isEmailVerified: true, roles: [], displayName: null });
    const auth = TestBed.inject(AuthService);
    await auth.login('a@b.co', 'pw');

    auth.logout();

    expect(auth.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('km_auth')).toBeNull();
  });
});
