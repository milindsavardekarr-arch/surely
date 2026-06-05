import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
  withCredentials: true,
});

// ── Request interceptor ───────────────────────────────────────────────────
api.interceptors.request.use((config) => {
  if (typeof window === 'undefined') return config;
  try {
    const token = localStorage.getItem('wrai_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;

    const businessAccountId = localStorage.getItem('wrai_biz_id');
    if (businessAccountId) {
      config.params = { ...config.params, businessAccountId };
    }
  } catch { /* ignore */ }
  return config;
});

// ── Response interceptor ──────────────────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      console.error(`❌ Backend unreachable at ${API_URL} — is it running?`);
    }

    // 401 — token invalid/expired → go to login
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/auth')) {
        try {
          localStorage.removeItem('wrai_token');
          localStorage.removeItem('wrai_biz_id');
          localStorage.removeItem('wrai-auth');
        } catch { /* ignore */ }
        window.location.href = '/auth/login';
      }
    }

    // 403 PLAN_EXPIRED — redirect to locked screen
    if (error.response?.status === 403) {
      const msg = error.response?.data?.message || '';
      if (msg === 'PLAN_EXPIRED' && typeof window !== 'undefined') {
        if (!window.location.pathname.startsWith('/plan-expired')) {
          window.location.href = '/plan-expired';
        }
      }
    }

    return Promise.reject(error);
  }
);

export const setAuthToken = (token: string, businessAccountId?: string): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('wrai_token', token);
    if (businessAccountId) localStorage.setItem('wrai_biz_id', businessAccountId);
  } catch { /* ignore */ }
};

export const clearAuthToken = (): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem('wrai_token');
    localStorage.removeItem('wrai_biz_id');
    localStorage.removeItem('wrai-auth');
  } catch { /* ignore */ }
};

export const getBusinessAccountId = (): string | null => {
  if (typeof window === 'undefined') return null;
  try { return localStorage.getItem('wrai_biz_id'); } catch { return null; }
};
