import type { CapacitorConfig } from '@capacitor/cli';

/**
 * `appId` must match Android `applicationId`, iOS bundle identifier, and Clerk → Native applications.
 * OAuth return URL: `com.burhankhatib.bedi://oauth-callback` (allow-list in Clerk + intent / URL type in native projects).
 */
const config: CapacitorConfig = {
  appId: 'com.burhankhatib.bedi',
  appName: 'Bedi Delivery',
  webDir: 'out',
  server: {
    url: 'https://www.bedi.delivery',
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
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    }
  }
};

export default config;
