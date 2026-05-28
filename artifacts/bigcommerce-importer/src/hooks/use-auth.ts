import { useState, useEffect, useCallback } from "react";

export interface AuthState {
  token: string | null;
  userId: string | null;
  expiresAt: string | null;
}

const STORAGE_KEY = "bc_auth";

function loadAuth(): AuthState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { token: null, userId: null, expiresAt: null };
    return JSON.parse(raw) as AuthState;
  } catch {
    return { token: null, userId: null, expiresAt: null };
  }
}

function saveAuth(state: AuthState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function clearAuth() {
  localStorage.removeItem(STORAGE_KEY);
}

export function useAuth() {
  const [auth, setAuth] = useState<AuthState>(loadAuth);

  const login = useCallback((token: string, userId: string, expiresAt: string) => {
    const state: AuthState = { token, userId, expiresAt };
    saveAuth(state);
    setAuth(state);
  }, []);

  const logout = useCallback(async () => {
    const current = loadAuth();
    if (current.token) {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: { "X-Session-Token": current.token },
        });
      } catch {
        // best-effort
      }
    }
    clearAuth();
    setAuth({ token: null, userId: null, expiresAt: null });
  }, []);

  const isAuthenticated = !!auth.token && !!auth.expiresAt && new Date(auth.expiresAt) > new Date();

  // Auto-logout when timer expires
  useEffect(() => {
    if (!auth.expiresAt) return;
    const remaining = new Date(auth.expiresAt).getTime() - Date.now();
    if (remaining <= 0) {
      clearAuth();
      setAuth({ token: null, userId: null, expiresAt: null });
      return;
    }
    const t = setTimeout(() => {
      clearAuth();
      setAuth({ token: null, userId: null, expiresAt: null });
    }, remaining);
    return () => clearTimeout(t);
  }, [auth.expiresAt]);

  return { auth, login, logout, isAuthenticated };
}
