const BASE = '/api';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

const getToken = () => {
  try {
    return localStorage.getItem('gf.token');
  } catch {
    return null;
  }
};

export const setToken = (token) => {
  try {
    if (token) localStorage.setItem('gf.token', token);
    else localStorage.removeItem('gf.token');
  } catch {
    /* storage blocked */
  }
};

async function request(path, { method = 'GET', body, signal } = {}) {
  const headers = { Accept: 'application/json' };
  if (body) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  let payload = null;
  const text = await res.text();
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!res.ok) {
    if (res.status === 401 && getToken()) {
      setToken(null);
      if (!window.location.pathname.startsWith('/signin')) {
        window.dispatchEvent(new CustomEvent('gf:unauthorized'));
      }
    }
    throw new ApiError(payload?.message || `Request failed (${res.status})`, res.status);
  }
  return payload;
}

export const api = {
  get: (path, signal) => request(path, { signal }),
  post: (path, body, signal) => request(path, { method: 'POST', body, signal }),
  put: (path, body, signal) => request(path, { method: 'PUT', body, signal }),
  del: (path, signal) => request(path, { method: 'DELETE', signal }),
  qs: (path, params = {}) => {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '' && v !== 'all') search.append(k, v);
    });
    const q = search.toString();
    return `${path}${q ? `?${q}` : ''}`;
  },
};

export default api;
