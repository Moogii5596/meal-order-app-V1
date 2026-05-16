const API = process.env.REACT_APP_API_URL;

export async function login(username, password) {
  const res = await fetch(`${API}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });

  return res.json();
}

export async function getMe(token) {
  const res = await fetch(`${API}/me`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return res.json();
}

export function saveAuth(data) {
  localStorage.setItem('authToken', data.token);

  if (data.dept_id) {
    localStorage.setItem('authDeptId', String(data.dept_id));
    localStorage.setItem('authDeptName', data.dept_name);
  }

  if (data.location) {
    localStorage.setItem('authLocation', data.location);
  }
}

export function clearAuth() {
  localStorage.removeItem('authToken');
  localStorage.removeItem('authRole');
  localStorage.removeItem('authDeptId');
  localStorage.removeItem('authDeptName');
  localStorage.removeItem('authLocation');
}