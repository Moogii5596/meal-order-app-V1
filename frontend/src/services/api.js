/**
 * Base API fetch wrapper.
 *
 * - Automatically attaches the Authorization header from localStorage.
 * - Throws a typed Error on non-2xx responses with status attached.
 * - Returns null for 204 No Content.
 */
import { API_URL } from '../constants';

function getAuthToken() {
  return localStorage.getItem('authToken');
}

export async function apiFetch(endpoint, options = {}) {
  const token = getAuthToken();

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let message = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const errorData = await response.json();
      message = errorData.detail || errorData.message || errorData.error || message;
    } catch {
      // body was not JSON — use the status message
    }
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}
