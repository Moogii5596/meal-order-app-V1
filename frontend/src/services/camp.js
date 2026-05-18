/**
 * Camp manager service.
 *
 * All /camp/* API calls live here.
 * CampFavView and CampOrdersView use this instead of raw fetch().
 */
import { apiFetch } from './api';

// ── Users ─────────────────────────────────────────────────────────────────────

export function fetchCampUsers() {
  return apiFetch('/camp/users');
}

// ── User data (fav / extra / hidden) ─────────────────────────────────────────

export function fetchUserData(username) {
  return apiFetch(`/camp/user-data/${encodeURIComponent(username)}`);
}

export function addUserFavorite(username, employeeId) {
  return apiFetch(`/camp/user-data/${encodeURIComponent(username)}/fav/save`, {
    method: 'POST',
    body: JSON.stringify({ employee_id: employeeId }),
  });
}

export function removeUserFavorite(username, employeeId) {
  return apiFetch(`/camp/user-data/${encodeURIComponent(username)}/fav/remove`, {
    method: 'DELETE',
    body: JSON.stringify({ employee_id: employeeId }),
  });
}

export function addUserExtra(username, emp) {
  return apiFetch(`/camp/user-data/${encodeURIComponent(username)}/extra/save`, {
    method: 'POST',
    body: JSON.stringify({
      employee_id: emp.id,
      extra_type: 'rental',
      name: emp.name,
      last_name: emp.last_name,
      dept_name: emp.dept_name,
      job_title: emp.job_title,
      location: emp.location,
    }),
  });
}

export function removeUserExtra(username, employeeId) {
  return apiFetch(`/camp/user-data/${encodeURIComponent(username)}/extra/remove`, {
    method: 'DELETE',
    body: JSON.stringify({ employee_id: employeeId }),
  });
}

export function clearUserData(username) {
  return apiFetch(`/camp/user-data/${encodeURIComponent(username)}/clear`, {
    method: 'DELETE',
  });
}
