import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.steirische.simulator',
  appName: 'Steirische Simulator',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
