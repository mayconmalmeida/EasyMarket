import axios from 'axios';
import { useAuthStore } from '../stores/auth';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? `${window.location.protocol}//${window.location.hostname}:3000`,
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
      const p = window.location.pathname;
      const target = p.startsWith('/admin') ? '/admin/login' : '/colaborador/login';
      if (p !== target) window.location.href = target;
    }
    return Promise.reject(error);
  },
);
