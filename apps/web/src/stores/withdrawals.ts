import { defineStore } from 'pinia';
import { api } from '../lib/api';

export type Withdrawal = {
  id: string;
  totalCents: number;
  paymentMethod: 'CASH' | 'PIX' | 'NONE';
  paymentStatus: 'PAID' | 'PENDING' | 'PAYROLL_DEDUCTION';
  createdAt: string;
  user: {
    id: string;
    name: string;
    code: string;
    sector?: string | null;
  };
  items: Array<{
    id: string;
    quantity: number;
    unitPriceCents: number;
    product: { id: string; name: string; category: string };
  }>;
};

type WithdrawalsState = {
  items: Withdrawal[];
  loading: boolean;
};

export const useWithdrawalsStore = defineStore('withdrawals', {
  state: (): WithdrawalsState => ({ items: [], loading: false }),
  actions: {
    async fetchAllAdmin() {
      this.loading = true;
      try {
        const { data } = await api.get<Withdrawal[]>('/admin/withdrawals');
        this.items = data;
      } finally {
        this.loading = false;
      }
    },
    async markPaid(id: string) {
      await api.patch(`/admin/withdrawals/${id}/mark-paid`);
      await this.fetchAllAdmin();
    },
  },
});
