const API = process.env.REACT_APP_API_URL;

export async function apiFetch(
  endpoint,
  options = {}
) {

  const res = await fetch(
    `${API}${endpoint}`,
    options
  );

  return res.json();
}