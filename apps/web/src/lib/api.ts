import axios from 'axios';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { useAuthStore } from '../stores/auth';

function isNativeCapacitor() {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

async function capacitorAdapter(config: any) {
  const baseURL: string = config.baseURL ?? '';
  const rawUrl: string = config.url ?? '';
  const url = new URL(rawUrl, baseURL || undefined).toString();

  const headers: Record<string, string> = {};
  const h = config.headers ?? {};
  for (const [k, v] of Object.entries(h)) {
    if (v == null) continue;
    if (Array.isArray(v)) headers[k] = v.join(', ');
    else headers[k] = String(v);
  }

  const method = String(config.method ?? 'GET').toUpperCase();
  const resp = await CapacitorHttp.request({
    url,
    method,
    headers,
    params: config.params,
    data: config.data,
  });

  return {
    data: resp.data,
    status: resp.status,
    statusText: '',
    headers: resp.headers,
    config,
    request: null,
  };
}

export const api = axios.create({
  baseURL: (() => {
    const envUrl = String(import.meta.env.VITE_API_URL ?? '').trim();
    const fallback = `${window.location.protocol}//${window.location.hostname}:8081`;
    if (!isNativeCapacitor() && import.meta.env.DEV) return '/api';
    return envUrl || fallback;
  })(),
  adapter: isNativeCapacitor() ? capacitorAdapter : undefined,
});

api.interceptors.request.use((config) => {
  const auth = useAuthStore();
  if (auth.accessToken) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${auth.accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const status = error?.response?.status;
    const url: string = error?.config?.url ?? '';
    if (status === 401 && !url.includes('/auth/login') && !url.includes('/auth/refresh')) {
      const auth = useAuthStore();
      auth.accessToken = null;
      auth.refreshToken = null;
      auth.user = null;
      localStorage.removeItem('easymarket.accessToken');
      localStorage.removeItem('easymarket.refreshToken');
      localStorage.removeItem('easymarket.user');
      sessionStorage.removeItem('easymarket.accessToken');
      sessionStorage.removeItem('easymarket.refreshToken');
      sessionStorage.removeItem('easymarket.user');
      const p = window.location.pathname;
      const target = p.startsWith('/admin') ? '/admin/login' : '/colaborador/login';
      if (p !== target) window.location.href = target;
    }
    return Promise.reject(error);
  },
);
