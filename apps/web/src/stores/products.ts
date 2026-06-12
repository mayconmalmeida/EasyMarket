import { defineStore } from 'pinia';
import { api } from '../lib/api';

export type Product = {
  id: string;
  barcode?: string | null;
  name: string;
  category: string;
  photoUrl?: string | null;
  costCents?: number | null;
  priceCents: number;
  stock: number;
  minStock: number;
  status: 'ACTIVE' | 'INACTIVE';
  hideOnTablet: boolean;
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
    async remove(id: string) {
      await api.delete(`/products/${id}`);
      this.items = this.items.filter((p) => p.id !== id);
    },
  },
});
