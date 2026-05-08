import { defineStore } from 'pinia';
import { api } from '../lib/api';

export type NotificationType = 'PAYMENT_CONFIRMED' | 'PAYMENT_RECORDED';

export type AppNotification = {
  id: string;
  recipientId: string;
  type: NotificationType;
  title: string;
  message: string;
  meta: any;
  createdAt: string;
  readAt: string | null;
};

type NotificationsState = {
  items: AppNotification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  polling: boolean;
  pollId: number | null;
};

export const useNotificationsStore = defineStore('notifications', {
  state: (): NotificationsState => ({
    items: [],
    unreadCount: 0,
    loading: false,
    error: null,
    polling: false,
    pollId: null,
  }),
  actions: {
    async fetchMine(input?: { unreadOnly?: boolean; limit?: number }) {
      this.loading = true;
      this.error = null;
      try {
        const { data } = await api.get<{ unreadCount: number; items: AppNotification[] }>('/notifications/mine', {
          params: {
            unreadOnly: input?.unreadOnly ?? false,
            limit: input?.limit ?? 20,
          },
        });
        this.unreadCount = data.unreadCount;
        this.items = data.items;
      } catch (e: any) {
        this.error = e?.response?.data?.message ?? 'Falha ao carregar notificações';
      } finally {
        this.loading = false;
      }
    },
    async markRead(id: string) {
      await api.patch(`/notifications/${id}/read`);
      this.items = this.items.map((n) => (n.id === id ? { ...n, readAt: n.readAt ?? new Date().toISOString() } : n));
      this.unreadCount = Math.max(0, this.unreadCount - 1);
    },
    async markAllRead() {
      await api.patch('/notifications/mine/mark-all-read');
      const now = new Date().toISOString();
      this.items = this.items.map((n) => ({ ...n, readAt: n.readAt ?? now }));
      this.unreadCount = 0;
    },
    startPolling(ms: number) {
      if (this.polling) return;
      this.polling = true;
      this.fetchMine({ limit: 20 }).catch(() => null);
      const id = window.setInterval(() => {
        this.fetchMine({ limit: 20 }).catch(() => null);
      }, ms);
      this.pollId = id;
    },
    stopPolling() {
      if (!this.polling) return;
      if (this.pollId) window.clearInterval(this.pollId);
      this.pollId = null;
      this.polling = false;
    },
  },
});

