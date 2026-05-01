import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.visualengine.app',
  appName: 'VisualEngine',
  webDir: 'out',
  android: {
    backgroundColor: '#000000', // Pastikan sama dengan globals.css
  },
  server: {
    androidScheme: 'https'
  }
};

export default config;
