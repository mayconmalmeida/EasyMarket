import { defineStore } from 'pinia';
import { api } from '../lib/api';

export type User = {
  id: string;
  name: string;
  code: string;
  sector?: string | null;
  sectorId?: string | null;
  role: 'ADMIN' | 'COLLABORATOR';
  status: 'ACTIVE' | 'BLOCKED';
  createdAt?: string;
};

type UsersState = {
  items: User[];
  loading: boolean;
};

export const useUsersStore = defineStore('users', {
  state: (): UsersState => ({ items: [], loading: false }),
  actions: {
    async fetchAll() {
      this.loading = true;
      try {
        const { data } = await api.get<User[]>('/users');
        this.items = data;
      } finally {
        this.loading = false;
      }
    },
    async create(input: { name: string; code: string; pin: string; sectorId?: string; role: User['role'] }) {
      const { data } = await api.post<User>('/users', input);
      this.items = [...this.items, data];
      return data;
    },
    async update(
      id: string,
      patch: Partial<{
        name: string;
        code: string;
        pin: string;
        sectorId: string | null;
        role: User['role'];
        status: User['status'];
      }>,
    ) {
      const { data } = await api.patch<User>(`/users/${id}`, patch);
      this.items = this.items.map((u) => (u.id === id ? data : u));
      return data;
    },
  },
});
