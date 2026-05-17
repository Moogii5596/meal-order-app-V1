/**
 * Auth service.
 *
 * Handles login/logout API calls and localStorage token persistence.
 * AuthContext is the only consumer of this module.
 */
import { apiFetch } from './api';

// ── API calls ─────────────────────────────────────────────────────────────────

export function loginRequest(username, password) {
  return apiFetch('/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function getMeRequest() {
  return apiFetch('/me');
}

// ── Token storage ─────────────────────────────────────────────────────────────

export function saveAuthToken(token) {
  localStorage.setItem('authToken', token);
}

export function clearAuthToken() {
  localStorage.removeItem('authToken');
}

export function getStoredToken() {
  return localStorage.getItem('authToken');
}
