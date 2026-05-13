import { defineStore } from 'pinia';
import { api } from '../lib/api';
import type { Product } from './products';
import type { StockActor } from './stock-entries';

export type StockMovementType = 'IN' | 'OUT' | 'ADJUST';
export type StockMovementSource = 'STOCK_ENTRY' | 'WITHDRAWAL' | 'MANUAL_ADJUSTMENT';

export type StockMovementItem = {
  id: string;
  product: Product;
  quantity: number;
  type: StockMovementType;
  source: StockMovementSource;
  occurredAt: string;
  actor: StockActor;
  note: string | null;
  unitCostCents: number | null;
  unitPriceCents: number | null;
  barcodeSnapshot: string | null;
};

export type ListStockMovementsQuery = {
  productId?: string;
  type?: StockMovementType;
  source?: StockMovementSource;
  from?: string;
  to?: string;
  take?: number;
};

type StockMovementsState = {
  items: StockMovementItem[];
  loading: boolean;
};

export const useStockMovementsStore = defineStore('stock-movements', {
  state: (): StockMovementsState => ({ items: [], loading: false }),
  actions: {
    async fetchAll(query: ListStockMovementsQuery = {}) {
      this.loading = true;
      try {
        const { data } = await api.get<StockMovementItem[]>('/admin/stock-movements', {
          params: query,
        });
        this.items = data;
      } finally {
        this.loading = false;
      }
    },
  },
});

