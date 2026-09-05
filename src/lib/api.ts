const API_BASE = (
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')
    ? 'https://echowire-2pw0.onrender.com'
    : '')
).replace(/\/$/, '');

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem('echowire_token') || sessionStorage.getItem('echowire_token');
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null, rememberMe = true) {
  try {
    if (token) {
      if (rememberMe) {
        localStorage.setItem('echowire_token', token);
        localStorage.setItem('echowire_remember', 'true');
        sessionStorage.removeItem('echowire_token');
      } else {
        sessionStorage.setItem('echowire_token', token);
        localStorage.removeItem('echowire_token');
        localStorage.setItem('echowire_remember', 'false');
      }
    } else {
      localStorage.removeItem('echowire_token');
      localStorage.removeItem('echowire_remember');
      sessionStorage.removeItem('echowire_token');
    }
  } catch {}
}

let activeRequestsCount = 0;
let watchdogTimer: any = null;
const loadingListeners = new Set<(isLoading: boolean, activeCount: number) => void>();

export function onNetworkLoading(listener: (isLoading: boolean, activeCount: number) => void): () => void {
  loadingListeners.add(listener);
  listener(activeRequestsCount > 0, activeRequestsCount);
  return () => {
    loadingListeners.delete(listener);
  };
}

function updateWatchdog() {
  if (activeRequestsCount > 0) {
    if (!watchdogTimer) {
      watchdogTimer = setTimeout(() => {
        if (activeRequestsCount > 0) {
          activeRequestsCount = 0;
          notifyLoadingListeners();
        }
        watchdogTimer = null;
      }, 15000);
    }
  } else {
    if (watchdogTimer) {
      clearTimeout(watchdogTimer);
      watchdogTimer = null;
    }
  }
}

function notifyLoadingListeners() {
  updateWatchdog();
  const isLoading = activeRequestsCount > 0;
  for (const listener of loadingListeners) {
    try {
      listener(isLoading, activeRequestsCount);
    } catch {}
  }
}

export interface ApiFetchOptions extends RequestInit {
  silent?: boolean;
}

export async function apiFetch<T = any>(endpoint: string, options: ApiFetchOptions = {}): Promise<T> {
  const isSilent = options.silent === true;
  if (!isSilent) {
    activeRequestsCount++;
    notifyLoadingListeners();
  }

  try {
    const method = (options.method || 'GET').toUpperCase();
    const headers: Record<string, string> = { ...(options.headers as any || {}) };
    let body = options.body;

    // Automatically attach Bearer auth token if stored
    const token = getAuthToken();
    if (token && !headers['Authorization'] && !headers['authorization']) {
      headers['Authorization'] = `Bearer ${token}`;
    }

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

    // If backend returned a new session token, store it appropriately
    if (data && typeof data === 'object' && data.token) {
      const isGuest = endpoint.includes('/guest') || data.user?.isGuest;
      const shouldRemember = !isGuest && (data.rememberMe !== undefined ? Boolean(data.rememberMe) : (localStorage.getItem('echowire_remember') !== 'false'));
      setAuthToken(data.token, shouldRemember);
    }

    if (!res.ok) {
      if (res.status === 401 && endpoint.includes('/api/auth/me')) {
        setAuthToken(null);
      }
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
  } finally {
    if (!isSilent) {
      activeRequestsCount = Math.max(0, activeRequestsCount - 1);
      notifyLoadingListeners();
    }
  }
}

