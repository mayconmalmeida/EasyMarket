import { defineStore } from 'pinia';
import { api } from '../lib/api';

export type Settings = {
  marketName: string;
  logoUrl: string | null;
  pixKey: string;
  pixQrCodeUrl: string;
  primaryColor: string;
  minStockDefault: number;
  collaboratorPortalEnabled: boolean;
};

const LS_KEY = 'easymarket.settings';

const defaultSettings: Settings = {
  marketName: 'EasyMarket',
  logoUrl: null,
  pixKey: '',
  pixQrCodeUrl: '',
  primaryColor: '#0057D9',
  minStockDefault: 5,
  collaboratorPortalEnabled: true,
};

function pickSettings(input: Partial<Settings>) {
  const out: Partial<Settings> = {};
  if (input.marketName !== undefined) out.marketName = input.marketName;
  if (input.logoUrl !== undefined) out.logoUrl = input.logoUrl;
  if (input.pixKey !== undefined) out.pixKey = input.pixKey;
  if (input.pixQrCodeUrl !== undefined) out.pixQrCodeUrl = input.pixQrCodeUrl;
  if (input.primaryColor !== undefined) out.primaryColor = input.primaryColor;
  if (input.minStockDefault !== undefined) out.minStockDefault = input.minStockDefault;
  if (input.collaboratorPortalEnabled !== undefined) out.collaboratorPortalEnabled = input.collaboratorPortalEnabled;
  return out;
}

export const useSettingsStore = defineStore('settings', {
  state: () => {
    const raw = localStorage.getItem(LS_KEY);
    const cached: Partial<Settings> = (() => {
      if (!raw) return {};
      try {
        return JSON.parse(raw) as Partial<Settings>;
      } catch {
        return {};
      }
    })();

    return {
      ...defaultSettings,
      ...cached,
      loaded: false as boolean,
      loading: false as boolean,
    };
  },
  actions: {
    persist() {
      const { loaded, loading, ...toSave } = this.$state;
      localStorage.setItem(LS_KEY, JSON.stringify(toSave));
    },
    applySettings(s: Partial<Settings>) {
      Object.assign(this, pickSettings(s));
      this.persist();
    },
    async loadPublic() {
      if (this.loading) return;
      this.loading = true;
      try {
        const { data } = await api.get('/settings/public');
        this.applySettings(data as Partial<Settings>);
        this.loaded = true;
      } finally {
        this.loading = false;
      }
    },
    async loadAdmin() {
      if (this.loading) return;
      this.loading = true;
      try {
        const { data } = await api.get('/admin/settings');
        this.applySettings(data as Partial<Settings>);
        this.loaded = true;
      } finally {
        this.loading = false;
      }
    },
    async saveAdmin(partial: Partial<Settings>) {
      const { data } = await api.patch('/admin/settings', partial);
      this.applySettings(data as Partial<Settings>);
      this.loaded = true;
      return data as Settings;
    },
    async resetAdmin() {
      const { data } = await api.patch('/admin/settings', { ...defaultSettings });
      this.applySettings(data as Partial<Settings>);
      this.loaded = true;
      return data as Settings;
    },
  },
});
