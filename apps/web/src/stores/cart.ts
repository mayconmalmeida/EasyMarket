import { defineStore } from 'pinia';
import type { Product } from './products';

export type CartItem = {
  product: Product;
  quantity: number;
};

type CartState = {
  items: CartItem[];
};

export const useCartStore = defineStore('cart', {
  state: (): CartState => ({ items: [] }),
  getters: {
    totalCents: (s) => s.items.reduce((sum, i) => sum + i.quantity * i.product.priceCents, 0),
    totalQty: (s) => s.items.reduce((sum, i) => sum + i.quantity, 0),
  },
  actions: {
    clear() {
      this.items = [];
    },
    add(product: Product) {
      const existing = this.items.find((i) => i.product.id === product.id);
      if (existing) {
        if (existing.quantity < product.stock) existing.quantity += 1;
      } else {
        if (product.stock > 0) this.items.push({ product, quantity: 1 });
      }
    },
    remove(productId: string) {
      this.items = this.items.filter((i) => i.product.id !== productId);
    },
    setQty(productId: string, qty: number) {
      const item = this.items.find((i) => i.product.id === productId);
      if (!item) return;
      const safe = Math.max(1, Math.min(qty, item.product.stock));
      item.quantity = safe;
    },
  },
});

