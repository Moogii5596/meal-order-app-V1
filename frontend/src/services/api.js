const API = process.env.REACT_APP_API_URL;

export async function apiFetch(
  endpoint,
  options = {}
) {

  const res = await fetch(
    `${API}${endpoint}`,
    options
  );

  // ─────────────────────────────
  // CHECK STATUS CODE
  // ─────────────────────────────
  if (!res.ok) {
    let errorMessage = `HTTP ${res.status}: ${res.statusText}`;
    
    try {
      const errorData = await res.json();
      errorMessage = errorData.message || errorData.error || errorMessage;
    } catch (e) {
      // If response body is not JSON, use default message
    }

    const error = new Error(errorMessage);
    error.status = res.status;
    throw error;
  }

  return res.json();
}