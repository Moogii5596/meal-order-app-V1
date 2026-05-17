/**
 * Auth context — the single source of truth for authentication state.
 *
 * Provides: token, role, userDept, userLocation, isLoadingAuth, login, logout
 *
 * Usage:
 *   const { role, login, logout } = useAuth();
 */
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  clearAuthToken,
  getMeRequest,
  getStoredToken,
  loginRequest,
  saveAuthToken,
} from '../services/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken]               = useState(null);
  const [role, setRole]                 = useState(null);
  const [userDept, setUserDept]         = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const applySession = useCallback((data) => {
    setRole(data.role);
    if (data.dept_id) {
      setUserDept({ id: String(data.dept_id), name: data.dept_name });
    }
    if (data.location) {
      setUserLocation(data.location);
    }
  }, []);

  const clearSession = useCallback(() => {
    clearAuthToken();
    setToken(null);
    setRole(null);
    setUserDept(null);
    setUserLocation(null);
  }, []);

  // ── Restore session on mount ───────────────────────────────────────────────

  useEffect(() => {
    const storedToken = getStoredToken();

    if (!storedToken) {
      setIsLoadingAuth(false);
      return;
    }

    // Validate the stored token with the server
    getMeRequest()
      .then((data) => {
        setToken(storedToken);
        applySession(data);
      })
      .catch(() => {
        clearSession();
      })
      .finally(() => {
        setIsLoadingAuth(false);
      });
  }, [applySession, clearSession]);

  // ── Login ─────────────────────────────────────────────────────────────────

  const login = useCallback(async (username, password) => {
    const data = await loginRequest(username, password);

    if (!data.success) {
      throw new Error('Нэвтрэх нэр эсвэл нууц үг буруу');
    }

    saveAuthToken(data.token);
    setToken(data.token);
    applySession(data);

    return data;
  }, [applySession]);

  // ── Logout ────────────────────────────────────────────────────────────────

  const logout = useCallback(() => {
    clearSession();
  }, [clearSession]);

  return (
    <AuthContext.Provider
      value={{ token, role, userDept, userLocation, isLoadingAuth, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
