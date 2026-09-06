import React, { createContext, useContext, useEffect, useState } from "react";
import { apiClient } from "../api/apiClient";
import type { ApiError, LoginResponse } from "../api/types";

interface AuthState {
  userId: string | null;
  email: string | null;
  isEmailVerified: boolean;
  roles: string[];
  displayName: string | null;
}

interface AuthContextValue extends AuthState {
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: ApiError }>;
  logout: () => void;
  resendVerification: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  markEmailVerified: () => void;
  updateDisplayName: (name: string | null) => void;
  // Always provided by AuthProvider; optional so lightweight test mocks may omit it.
  hydrate?: (u: { userId: string; email: string; isEmailVerified: boolean; displayName: string | null; roles?: string[] }) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY = "km_auth";

const EMPTY_STATE: AuthState = { userId: null, email: null, isEmailVerified: false, roles: [], displayName: null };

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AuthState;
        // Backwards-compat: old persisted state may not have roles
        return { ...EMPTY_STATE, ...parsed };
      }
    } catch {
      // ignore
    }
    return EMPTY_STATE;
  });

  // When the API layer exhausts token refresh, clear local auth state so the
  // app redirects to login rather than showing blank/broken pages.
  useEffect(() => {
    const handleExpired = () => {
      setState(EMPTY_STATE);
      localStorage.removeItem(STORAGE_KEY);
    };
    window.addEventListener("auth:expired", handleExpired);
    return () => window.removeEventListener("auth:expired", handleExpired);
  }, []);

  // On app load, proactively renew the access token once so a returning user's page
  // data calls don't all fire against an expired token and trip the refresh rotation.
  // A genuinely dead session is surfaced by the normal 401 path.
  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) {
      apiClient.refreshSession().catch(() => {});
    }
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const resp: LoginResponse = await apiClient.login({ email, password });
      const newState: AuthState = {
        userId: resp.userId,
        email: resp.email,
        isEmailVerified: resp.isEmailVerified ?? false,
        roles: resp.roles ?? [],
        displayName: resp.displayName ?? null,
      };
      setState(newState);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
      return { success: true as const };
    } catch (err: unknown) {
      return { success: false as const, error: err as ApiError };
    }
  };

  const logout = () => {
    // Fire-and-forget: revoke the server-side refresh token.
    // Local state is cleared regardless of whether the request succeeds.
    apiClient.logout().catch(() => {});
    setState(EMPTY_STATE);
    localStorage.removeItem(STORAGE_KEY);
  };

  const resendVerification = async () => {
    await apiClient.resendVerification();
  };

  const deleteAccount = async () => {
    await apiClient.deleteAccount();
    setState(EMPTY_STATE);
    localStorage.removeItem(STORAGE_KEY);
  };

  const markEmailVerified = () => {
    const newState = { ...state, isEmailVerified: true };
    setState(newState);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
  };

  const updateDisplayName = (name: string | null) => {
    const newState = { ...state, displayName: name };
    setState(newState);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
  };

  // Populate auth state from a fetched user (used after the OAuth redirect, where
  // there is no login() response). Roles default to none for fresh external sign-ins.
  const hydrate = (u: { userId: string; email: string; isEmailVerified: boolean; displayName: string | null; roles?: string[] }) => {
    const newState: AuthState = {
      userId: u.userId,
      email: u.email,
      isEmailVerified: u.isEmailVerified,
      roles: u.roles ?? [],
      displayName: u.displayName,
    };
    setState(newState);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
  };

  const value: AuthContextValue = {
    ...state,
    isAuthenticated: !!state.userId,
    isAdmin: state.roles.includes("Admin"),
    login,
    logout,
    resendVerification,
    deleteAccount,
    markEmailVerified,
    updateDisplayName,
    hydrate,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
