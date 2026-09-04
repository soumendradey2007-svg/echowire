const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export async function apiFetch<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const headers: Record<string, string> = { ...(options.headers as any || {}) };
  let body = options.body;

  if (method !== 'GET' && method !== 'HEAD') {
    if (!body) {
      body = '{}';
    }
    if (!headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
  } else if (body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  let res: Response;
  try {
    const url = endpoint.startsWith("http") ? endpoint : `${API_BASE}${endpoint}`;
    res = await fetch(url, {
      ...options,
      method,
      body,
      credentials: 'include',
      headers,
    });
  } catch (err: any) {
    throw new Error('Cannot connect to backend server. Make sure the server is running on port 3001.');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errorMsg =
      data.error ||
      data.message ||
      (res.status >= 500 ? 'Backend server error. Check server terminal logs.' : 'An unexpected error occurred');
    const customErr: any = new Error(errorMsg);
    customErr.status = res.status;
    customErr.data = data;
    customErr.devVerifyUrl = data.devVerifyUrl;
    throw customErr;
  }
  return data;
}
