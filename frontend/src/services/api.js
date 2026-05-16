const API = process.env.REACT_APP_API_URL;
function getAuthToken() {
  return localStorage.getItem('authToken');
}
export async function apiFetch(
  endpoint,
  options = {}
) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(
    `${API}${endpoint}`,
    {
      ...options,
      headers
    }
  );
  if (!res.ok) {
    let errorMessage =
      `HTTP ${res.status}: ${res.statusText}`;
    try {
      const errorData = await res.json();
      errorMessage =
        errorData.message ||
        errorData.error ||
        errorMessage;
    } catch (e) {
    }
    const error = new Error(errorMessage);
    error.status = res.status;
    throw error;
  }
  if (res.status === 204) {
    return null;
  }
  return res.json();
}
