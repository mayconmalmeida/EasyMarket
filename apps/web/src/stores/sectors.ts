import { defineStore } from 'pinia';
import { api } from '../lib/api';

export type Sector = {
  id: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
};

type SectorsState = {
  items: Sector[];
  loading: boolean;
  error: string | null;
};

export const useSectorsStore = defineStore('sectors', {
  state: (): SectorsState => ({
    items: [],
    loading: false,
    error: null,
  }),
  actions: {
    async fetchAll() {
      this.loading = true;
      this.error = null;
      try {
        const { data } = await api.get<Sector[]>('/admin/sectors');
        this.items = data;
      } catch (e: any) {
        this.error = e?.response?.data?.message ?? 'Falha ao carregar setores';
      } finally {
        this.loading = false;
      }
    },
    async create(input: { name: string; status?: Sector['status'] }) {
      const { data } = await api.post<Sector>('/admin/sectors', input);
      this.items = [...this.items, data].sort((a, b) => a.name.localeCompare(b.name));
      return data;
    },
    async update(id: string, patch: Partial<{ name: string; status: Sector['status'] }>) {
      const { data } = await api.patch<Sector>(`/admin/sectors/${id}`, patch);
      this.items = this.items.map((s) => (s.id === id ? data : s)).sort((a, b) => a.name.localeCompare(b.name));
      return data;
    },
  },
});

