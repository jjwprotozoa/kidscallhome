// capacitor.config.ts
// Capacitor configuration for KidsCallHome native Android app

import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kidscallhome.app',
  appName: 'Kids Call Home',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // Allow all origins in development, restrict in production
    allowNavigation: ['*'],
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#ffffff',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#3B82F6',
      sound: 'beep.wav',
    },
  },
  android: {
    buildOptions: {
      keystorePath: undefined, // Set via environment variable in CI/CD
      keystorePassword: undefined,
      keystoreAlias: undefined,
      keystoreAliasPassword: undefined,
    },
  },
};

export default config;

