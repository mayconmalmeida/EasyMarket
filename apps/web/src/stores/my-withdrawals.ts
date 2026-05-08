import { defineStore } from 'pinia';
import { api } from '../lib/api';

export type PaymentMethod = 'CASH' | 'PIX' | 'NONE';
export type PaymentStatus = 'PAID' | 'PENDING' | 'PAYROLL_DEDUCTION';

export type WithdrawalItem = {
  id: string;
  quantity: number;
  unitPriceCents: number;
  product: { id: string; name: string };
};

export type Withdrawal = {
  id: string;
  totalCents: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  createdAt: string;
  items: WithdrawalItem[];
};

type MyWithdrawalsState = {
  mine: Withdrawal[];
  pending: Withdrawal[];
  loading: boolean;
  error: string | null;
};

export const useMyWithdrawalsStore = defineStore('my-withdrawals', {
  state: (): MyWithdrawalsState => ({
    mine: [],
    pending: [],
    loading: false,
    error: null,
  }),
  actions: {
    async fetchAll() {
      this.loading = true;
      this.error = null;
      try {
        const [a, b] = await Promise.all([
          api.get<Withdrawal[]>('/withdrawals/mine'),
          api.get<Withdrawal[]>('/withdrawals/mine/pending'),
        ]);
        this.mine = a.data;
        this.pending = b.data;
      } catch (e: any) {
        this.error = e?.response?.data?.message ?? 'Falha ao carregar';
      } finally {
        this.loading = false;
      }
    },
    async confirmPix(withdrawalId: string) {
      await api.patch(`/withdrawals/${withdrawalId}/confirm-pix`);
      await this.fetchAll();
    },
    async confirmPixAll() {
      await api.patch('/withdrawals/mine/confirm-pix');
      await this.fetchAll();
    },
  },
});

