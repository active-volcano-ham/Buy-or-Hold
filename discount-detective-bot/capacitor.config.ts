import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.028ede363c814753804619d949410bf1',
  appName: 'Buy or Hold',
  webDir: 'dist',
  server: {
    url: 'https://028ede36-3c81-4753-8046-19d949410bf1.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  ios: {
    contentInset: 'always',
    scheme: 'BuyOrHolding',
  },
};

export default config;
