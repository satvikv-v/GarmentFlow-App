/**
 * Authentication utilities.
 *
 * - Token and user stored in localStorage (internal tool, no strict security
 *   requirements beyond "keep JWT off the URL").
 * - useAuth() hook exposes user, login(), logout(), isAuthenticated.
 */

import { useState, useCallback, createContext, useContext, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from './api';
import type { User, TokenResponse } from '../types';

// ---- Token / user helpers ---------------------------------------------------

const TOKEN_KEY = 'gf_token';
const USER_KEY  = 'gf_user';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): User | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as User; }
  catch { return null; }
}

function storeAuth(token: string, user: User): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// ---- Context ----------------------------------------------------------------

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(getStoredUser);
  const navigate = useNavigate();

  const login = useCallback(async (username: string, password: string) => {
    // 1. Obtain token
    const tokenRes = await apiClient.post<TokenResponse>('/auth/login', {
      username,
      password,
    });
    const token = tokenRes.data.access_token;

    // 2. Fetch the logged-in user's profile
    const meRes = await apiClient.get<User>('/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const me = meRes.data;

    // 3. Persist and update state
    storeAuth(token, me);
    setUser(me);
    navigate('/dashboard', { replace: true });
  }, [navigate]);

  const logout = useCallback(() => {
    clearAuth();
    setUser(null);
    navigate('/login', { replace: true });
  }, [navigate]);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
