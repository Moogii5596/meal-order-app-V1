const API = process.env.REACT_APP_API_URL;

async function parseJsonResponse(res) {
  let data = null;

  try {
    data = await res.json();
  } catch (e) {
    // ignore invalid JSON body
  }

  if (!res.ok) {
    const message =
      data?.message ||
      data?.error ||
      `HTTP ${res.status}: ${res.statusText}`;
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }

  return data;
}

export async function login(username, password) {
  const res = await fetch(`${API}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });

  return parseJsonResponse(res);
}

export async function getMe(token) {
  const res = await fetch(`${API}/me`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return parseJsonResponse(res);
}

export async function refreshToken(refreshToken) {
  const res = await fetch(`${API}/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken })
  });

  return parseJsonResponse(res);
}

export function saveAuth(data) {
  if (data.token) {
    localStorage.setItem('authToken', data.token);
  }

  if (data.refresh_token) {
    localStorage.setItem('authRefreshToken', data.refresh_token);
  }

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
  localStorage.removeItem('authRefreshToken');
  localStorage.removeItem('authDeptId');
  localStorage.removeItem('authDeptName');
  localStorage.removeItem('authLocation');
}
