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

/**
 * Create a new draft meal.order in Odoo on behalf of a kitchen staff user.
 * NEVER overwrites existing orders — always creates a fresh draft.
 *
 * Response variants (HTTP 200 in all cases):
 *   SUCCESS   : { success: true,  managed_order_id, odoo_order_id }
 *   DUPLICATE : { success: false, reason: 'duplicate_draft', existing_id, existing_status }
 *   ERP_FAIL  : { success: false, reason: 'erp_failed', managed_order_id, message }
 *
 * @param {string}   sourceUser        - kitchen staff username (fav list template)
 * @param {string}   mealType          - 'breakfast' | 'lunch' | 'dinner' | 'night'
 * @param {string}   date              - 'YYYY-MM-DD'
 * @param {number[]} employees         - final list of employee IDs
 * @param {Array}    employeeSnapshot  - [{id, name, last_name, dept_name, job_title}]
 * @param {string}   [note]            - optional free-text note
 * @returns {Promise<object>}
 */
export function createManagedOrder(
  sourceUser,
  mealType,
  date,
  employees,
  employeeSnapshot = [],
  note = 'Camp manager managed order',
) {
  return apiFetch('/camp/create-managed-order', {
    method: 'POST',
    body: JSON.stringify({
      source_user:       sourceUser,
      meal_type:         mealType,
      date,
      employees,
      employee_snapshot: employeeSnapshot,
      note,
    }),
  });
}

/**
 * Fetch the camp manager's managed order history.
 * @param {object} params
 * @param {string}  [params.sourceUsername] - filter by kitchen staff user
 * @param {number}  [params.page]
 * @param {number}  [params.pageSize]
 * @returns {Promise<{items: Array, total: number}>}
 */
export function fetchManagedOrders({ sourceUsername, page = 1, pageSize = 20 } = {}) {
  const params = new URLSearchParams({ page, page_size: pageSize });
  if (sourceUsername) params.set('source_username', sourceUsername);
  return apiFetch(`/camp/managed-orders?${params}`);
}
