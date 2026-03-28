import type { CapacitorConfig } from '@capacitor/cli';

/** Same `appId` as Android/iOS package and Clerk Native app. OAuth: `com.burhankhatib.bedi.tenant://oauth-callback` */
const config: CapacitorConfig = {
  appId: 'com.burhankhatib.bedi.tenant',
  appName: 'Bedi Tenant',
  webDir: 'out',
  server: {
    url: 'https://www.bedi.delivery/dashboard',
    cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#ffffff",
      showSpinner: false,
      androidSpinnerStyle: "small",
      iosSpinnerStyle: "small",
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
    },
    SystemBars: {
      insetsHandling: "css",
      style: "DARK",
      hidden: false,
      animation: "NONE"
    }
  }
};

export default config;
