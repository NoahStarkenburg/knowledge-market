import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiService } from '@core/api/api.service';
import type { ApiError, LoginResponse } from '@core/api/types';
import { SessionEvents } from './session-events';

interface AuthState {
  userId: string | null;
  email: string | null;
  isEmailVerified: boolean;
  roles: string[];
  displayName: string | null;
}

const STORAGE_KEY = 'km_auth';
const EMPTY_STATE: AuthState = { userId: null, email: null, isEmailVerified: false, roles: [], displayName: null };

// Signal-backed auth state persisted to localStorage, cleared when SessionEvents reports an
// expired session, with a proactive token refresh on app load for returning users.
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionEvents);
  private readonly state = signal<AuthState>(this.load());

  readonly userId = computed(() => this.state().userId);
  readonly email = computed(() => this.state().email);
  readonly displayName = computed(() => this.state().displayName);
  readonly isEmailVerified = computed(() => this.state().isEmailVerified);
  readonly roles = computed(() => this.state().roles);
  readonly isAuthenticated = computed(() => !!this.state().userId);
  readonly isAdmin = computed(() => this.state().roles.includes('Admin'));

  constructor() {
    this.session.expired$.subscribe(() => this.clear());

    // On load, proactively renew the access token once so a returning user's data calls
    // don't all fire against an expired token and trip the refresh rotation.
    if (localStorage.getItem(STORAGE_KEY)) {
      this.api.refreshSession().catch(() => {
        // Best effort. If it fails, the interceptor's 401 handling ends the session on the next call.
      });
    }
  }

  async login(email: string, password: string): Promise<{ success: boolean; error?: ApiError }> {
    try {
      const resp: LoginResponse = await this.api.login({ email, password });
      this.set({
        userId: resp.userId,
        email: resp.email,
        isEmailVerified: resp.isEmailVerified ?? false,
        roles: resp.roles ?? [],
        displayName: resp.displayName ?? null,
      });
      return { success: true };
    } catch (err) {
      return { success: false, error: err as ApiError };
    }
  }

  logout(): void {
    // Fire-and-forget: revoke the server-side refresh token; local state clears regardless.
    this.api.logout().catch(() => {
      // Nothing to recover: the local session is cleared below either way.
    });
    this.clear();
  }

  async resendVerification(): Promise<void> {
    await this.api.resendVerification();
  }

  async deleteAccount(): Promise<void> {
    await this.api.deleteAccount();
    this.clear();
  }

  markEmailVerified(): void {
    this.set({ ...this.state(), isEmailVerified: true });
  }

  updateDisplayName(name: string | null): void {
    this.set({ ...this.state(), displayName: name });
  }

  // Populate auth state from a fetched user (used after the OAuth redirect, where there is
  // no login() response).
  hydrate(u: { userId: string; email: string; isEmailVerified: boolean; displayName: string | null; roles?: string[] }): void {
    this.set({
      userId: u.userId,
      email: u.email,
      isEmailVerified: u.isEmailVerified,
      roles: u.roles ?? [],
      displayName: u.displayName,
    });
  }

  private set(next: AuthState): void {
    this.state.set(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore quota/availability errors
    }
  }

  private clear(): void {
    this.state.set(EMPTY_STATE);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  private load(): AuthState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...EMPTY_STATE, ...(JSON.parse(raw) as AuthState) };
    } catch {
      // ignore
    }
    return EMPTY_STATE;
  }
}
