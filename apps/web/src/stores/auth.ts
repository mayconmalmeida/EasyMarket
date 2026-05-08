import { defineStore } from 'pinia';
import { api } from '../lib/api';

type UserRole = 'ADMIN' | 'COLLABORATOR';

type AuthUser = {
  id: string;
  name: string;
  code: string;
  role: UserRole;
  sector?: string | null;
  sectorId?: string | null;
};

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
};

const LS_ACCESS = 'easymarket.accessToken';
const LS_REFRESH = 'easymarket.refreshToken';
const LS_USER = 'easymarket.user';

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    accessToken: localStorage.getItem(LS_ACCESS),
    refreshToken: localStorage.getItem(LS_REFRESH),
    user: (() => {
      const raw = localStorage.getItem(LS_USER);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    })(),
  }),
  getters: {
    isAuthenticated: (s) => !!s.accessToken,
    isAdmin: (s) => s.user?.role === 'ADMIN',
  },
  actions: {
    async login(code: string, pin: string) {
      const { data } = await api.post('/auth/login', { code, pin });
      this.accessToken = data.accessToken;
      this.refreshToken = data.refreshToken;
      this.user = data.user;
      localStorage.setItem(LS_ACCESS, this.accessToken ?? '');
      localStorage.setItem(LS_REFRESH, this.refreshToken ?? '');
      localStorage.setItem(LS_USER, JSON.stringify(this.user));
    },
    async logout() {
      try {
        await api.post('/auth/logout');
      } finally {
        this.accessToken = null;
        this.refreshToken = null;
        this.user = null;
        localStorage.removeItem(LS_ACCESS);
        localStorage.removeItem(LS_REFRESH);
        localStorage.removeItem(LS_USER);
      }
    },
  },
});
