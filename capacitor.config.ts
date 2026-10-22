import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tryd.app',
  appName: 'Try-D',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  android: {
    path: 'android'
  }
};

export default config;
