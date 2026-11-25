import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.recreo.app',
  appName: 'Recreo',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  ios: {
    contentInset: 'never'
  },
  android: {
    allowMixedContent: false
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 700,
      backgroundColor: '#080A12',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#080A12',
      overlaysWebView: false
    },
    Geolocation: {
      // Solo ubicación mientras la app está en uso.
      permissions: ['location']
    }
  }
};

export default config;
