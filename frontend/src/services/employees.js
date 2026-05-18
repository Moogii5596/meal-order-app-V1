/**
 * Employee service.
 *
 * All employee-related API calls live here.
 * Components and hooks should never call apiFetch directly for employee data.
 */
import { apiFetch } from './api';

// ── Departments ───────────────────────────────────────────────────────────────

export function fetchDepartments() {
  return apiFetch('/departments');
}

// ── Employees ─────────────────────────────────────────────────────────────────

export function fetchEmployees(deptId, date, mealType, signal) {
  return apiFetch(
    `/employees?dept_id=${deptId}&date=${date}&meal_type=${mealType}`,
    { signal },
  );
}

export function searchEmployees(query, signal) {
  return apiFetch(
    `/employees/search?q=${encodeURIComponent(query)}`,
    { signal },
  );
}

export function fetchRentalEmployees(query = '', signal) {
  const endpoint = query
    ? `/employees/rental?q=${encodeURIComponent(query)}`
    : '/employees/rental';
  return apiFetch(endpoint, { signal });
}

// ── My employees (favorites / extra / hidden) ─────────────────────────────────

export function fetchMyEmployees(signal) {
  return apiFetch('/my-employees', { signal });
}

export function saveFavorite(employeeId) {
  return apiFetch('/my-employees/save', {
    method: 'POST',
    body: JSON.stringify({ employee_id: employeeId }),
  });
}

export function removeFavorite(employeeId) {
  return apiFetch('/my-employees/remove', {
    method: 'DELETE',
    body: JSON.stringify({ employee_id: employeeId }),
  });
}

export function clearAllMyEmployees() {
  return apiFetch('/my-employees/clear-all', { method: 'DELETE' });
}

export function saveExtraEmployee(emp, extraType) {
  return apiFetch('/my-extra-employees/save', {
    method: 'POST',
    body: JSON.stringify({
      employee_id: emp.id,
      extra_type: extraType,
      name: emp.name,
      last_name: emp.last_name,
      dept_name: emp.dept_name,
      job_title: emp.job_title,
      location: emp.location,
    }),
  });
}

export function removeExtraEmployee(employeeId) {
  return apiFetch('/my-extra-employees/remove', {
    method: 'DELETE',
    body: JSON.stringify({ employee_id: employeeId }),
  });
}

export function hideEmployee(employeeId) {
  return apiFetch('/my-hidden/save', {
    method: 'POST',
    body: JSON.stringify({ employee_id: employeeId }),
  });
}

export function unhideEmployee(employeeId) {
  return apiFetch('/my-hidden/remove', {
    method: 'DELETE',
    body: JSON.stringify({ employee_id: employeeId }),
  });
}

/**
 * Resolve a list of employee IDs to full employee objects.
 * Used by the camp manager to display names for favorite employee IDs.
 * @param {number[]} employeeIds
 * @returns {Promise<Array>}
 */
export function fetchEmployeesByIds(employeeIds) {
  return apiFetch('/employees/by-ids', {
    method: 'POST',
    body: JSON.stringify({ employee_ids: employeeIds }),
  });
}
