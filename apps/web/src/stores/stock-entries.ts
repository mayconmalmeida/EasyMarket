import { defineStore } from 'pinia';
import { api } from '../lib/api';
import type { Product } from './products';

export type StockActor = { id: string; name: string; code: string };

export type StockEntry = {
  id: string;
  product: Product;
  quantity: number;
  type: 'IN';
  source: 'STOCK_ENTRY';
  unitCostCents?: number | null;
  unitPriceCents?: number | null;
  barcodeSnapshot?: string | null;
  occurredAt: string;
  note?: string | null;
  actor: StockActor;
};

export type CreateStockEntryInput = {
  barcode: string;
  productId?: string;
  product?: { name: string; category: string };
  quantity: number;
  costCents?: number;
  priceCents: number;
  occurredAt: string;
  note?: string;
};

type StockEntriesState = {
  items: StockEntry[];
  loading: boolean;
};

export const useStockEntriesStore = defineStore('stock-entries', {
  state: (): StockEntriesState => ({ items: [], loading: false }),
  actions: {
    async fetchAll(take = 200) {
      this.loading = true;
      try {
        const { data } = await api.get<StockEntry[]>('/admin/stock-entries', {
          params: { take },
        });
        this.items = data;
      } finally {
        this.loading = false;
      }
    },
    async create(input: CreateStockEntryInput) {
      const { data } = await api.post<StockEntry>('/admin/stock-entries', input);
      this.items = [data, ...this.items];
      return data;
    },
  },
});

