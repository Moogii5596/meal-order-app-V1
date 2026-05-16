import { apiFetch } from './api';

export function fetchDepartments() {
  return apiFetch('/departments');
}

export function fetchEmployees(
  deptId,
  date,
  mealType,
  token
) {
  return apiFetch(
    `/employees?dept_id=${deptId}&date=${date}&meal_type=${mealType}`,
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );
}

export function fetchMyEmployees(token) {
  return apiFetch('/my-employees', {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}