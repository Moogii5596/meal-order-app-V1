import { apiFetch } from './api';
export function fetchDepartments() {
  return apiFetch('/departments');
}
export function fetchEmployees(
  deptId,
  date,
  mealType,
  signal
) {
  return apiFetch(
    `/employees?dept_id=${deptId}&date=${date}&meal_type=${mealType}`,
    { signal }
  );
}
export function fetchMyEmployees(signal) {
  return apiFetch(
    '/my-employees',
    { signal }
  );
}
export function searchEmployees(
  query,
  signal
) {
  return apiFetch(
    `/employees/search?q=${encodeURIComponent(query)}`,
    { signal }
  );
}
export function fetchRentalEmployees(
  query = '',
  signal
) {
  const endpoint = query
    ? `/employees/rental?q=${encodeURIComponent(query)}`
    : '/employees/rental';

  return apiFetch(endpoint, { signal });
}