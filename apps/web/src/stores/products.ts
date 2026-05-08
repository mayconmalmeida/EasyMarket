import { defineStore } from 'pinia';
import { api } from '../lib/api';

export type Product = {
  id: string;
  name: string;
  category: string;
  photoUrl?: string | null;
  priceCents: number;
  stock: number;
  minStock: number;
  status: 'ACTIVE' | 'INACTIVE';
};

type ProductsState = {
  items: Product[];
  loading: boolean;
};

export const useProductsStore = defineStore('products', {
  state: (): ProductsState => ({ items: [], loading: false }),
  getters: {
    activeItems: (s) => s.items.filter((p) => p.status === 'ACTIVE'),
    categories: (s) => Array.from(new Set(s.items.map((p) => p.category))).sort(),
    lowStockItems: (s) => s.items.filter((p) => p.status === 'ACTIVE' && p.stock <= p.minStock),
  },
  actions: {
    async fetchAll() {
      this.loading = true;
      try {
        const { data } = await api.get<Product[]>('/products');
        this.items = data;
      } finally {
        this.loading = false;
      }
    },
    async create(input: Omit<Product, 'id'>) {
      const { data } = await api.post<Product>('/products', input);
      this.items = [...this.items, data];
      return data;
    },
    async update(id: string, patch: Partial<Omit<Product, 'id'>>) {
      const { data } = await api.patch<Product>(`/products/${id}`, patch);
      this.items = this.items.map((p) => (p.id === id ? data : p));
      return data;
    },
  },
});
