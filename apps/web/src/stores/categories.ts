import { defineStore } from 'pinia';
import { api } from '../lib/api';

export type Category = {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  status: 'ACTIVE' | 'INACTIVE';
};

type CategoriesState = {
  items: Category[];
  loaded: boolean;
  loading: boolean;
};

export const useCategoriesStore = defineStore('categories', {
  state: (): CategoriesState => ({
    items: [],
    loaded: false,
    loading: false,
  }),
  getters: {
    active: (s) => s.items.filter((c) => c.status === 'ACTIVE'),
  },
  actions: {
    async fetch() {
      if (this.loading) return;
      this.loading = true;
      try {
        const { data } = await api.get('/admin/categories');
        this.items = (data as Category[]).slice().sort((a, b) => a.name.localeCompare(b.name));
        this.loaded = true;
      } finally {
        this.loading = false;
      }
    },
    async bootstrapFromNames(names: string[]) {
      const { data } = await api.post('/admin/categories/bootstrap', { names });
      this.items = (data as Category[]).slice().sort((a, b) => a.name.localeCompare(b.name));
      this.loaded = true;
      return this.items;
    },
    async create(input: Omit<Category, 'id'>) {
      const { data } = await api.post('/admin/categories', input);
      const item = data as Category;
      this.items = [...this.items, item].sort((a, b) => a.name.localeCompare(b.name));
      this.loaded = true;
      return item;
    },
    async update(id: string, patch: Partial<Omit<Category, 'id'>>) {
      const { data } = await api.patch(`/admin/categories/${id}`, patch);
      const updated = data as Category;
      this.items = this.items.map((c) => (c.id === id ? updated : c)).sort((a, b) => a.name.localeCompare(b.name));
      this.loaded = true;
      return updated;
    },
    async toggleStatus(id: string) {
      const item = this.items.find((c) => c.id === id);
      if (!item) return null;
      const status = item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      return this.update(id, { status });
    },
  },
});
