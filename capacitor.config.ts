import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.easymarket.tablet',
  appName: 'EasyMarket Tablet',
  webDir: 'apps/web/dist',
  bundledWebRuntime: false,
  server: {
    url: 'http://192.168.3.3:5173/tablet',
    cleartext: true,
  },
};

export default config;
