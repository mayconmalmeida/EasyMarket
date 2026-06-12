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

function readStored(key: string) {
  return localStorage.getItem(key) ?? sessionStorage.getItem(key);
}

function clearStored(key: string) {
  localStorage.removeItem(key);
  sessionStorage.removeItem(key);
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    accessToken: readStored(LS_ACCESS),
    refreshToken: readStored(LS_REFRESH),
    user: (() => {
      const raw = readStored(LS_USER);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    })(),
  }),
  getters: {
    isAuthenticated: (s) => !!s.accessToken,
    isAdmin: (s) => s.user?.role === 'ADMIN',
  },
  actions: {
    async login(code: string, pin: string, remember = true) {
      const { data } = await api.post('/auth/login', { code, pin });
      this.accessToken = data.accessToken;
      this.refreshToken = data.refreshToken;
      this.user = data.user;
      clearStored(LS_ACCESS);
      clearStored(LS_REFRESH);
      clearStored(LS_USER);
      const storage = remember ? localStorage : sessionStorage;
      storage.setItem(LS_ACCESS, this.accessToken ?? '');
      storage.setItem(LS_REFRESH, this.refreshToken ?? '');
      storage.setItem(LS_USER, JSON.stringify(this.user));
    },
    async logout() {
      try {
        await api.post('/auth/logout');
      } finally {
        this.accessToken = null;
        this.refreshToken = null;
        this.user = null;
        clearStored(LS_ACCESS);
        clearStored(LS_REFRESH);
        clearStored(LS_USER);
      }
    },
  },
});
