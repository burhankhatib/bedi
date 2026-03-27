# Native Push Notifications (Capacitor FCM)

This application uses Firebase Cloud Messaging (FCM) for push notifications. Because we use a hybrid app architecture (Next.js web app wrapped in Capacitor), we need to handle push notification tokens differently depending on the platform.

## Architecture

1. **Web / PWA:** Uses the standard Firebase JS SDK to get a web push token via a Service Worker (`getFCMToken` in `lib/firebase.ts`).
2. **Native (Android/iOS):** Uses the `@capacitor/push-notifications` plugin to request an APNs or FCM token directly from the OS (`getDevicePushToken` in `lib/push-token.ts`).

Both platforms ultimately send their tokens to our standard `/api/.../push-subscription` endpoints. The server-side code (`lib/fcm.ts`) remains exactly the same because the native Android token and the Web token are both valid FCM registration tokens.

## Configuration Requirements per Native App

For native push notifications to work, you **must** configure Firebase in the native projects. The web Firebase config (`NEXT_PUBLIC_FIREBASE_...`) is **not** enough for native shells.

### Android Setup

1. Go to the Firebase Console.
2. Add a new Android App for your shell's package name (e.g., `com.burhankhatib.bedi` for Customer, `com.burhankhatib.bedi.driver` for Driver).
3. Download the `google-services.json` file.
4. Place the file inside the shell's app directory:
   - `capacitor/customer/android/app/google-services.json`
   - `capacitor/driver/android/app/google-services.json`
   - `capacitor/tenant/android/app/google-services.json`
5. The Android build scripts are configured to automatically apply the `com.google.gms.google-services` plugin if this file is present. **If this file is missing, native push notifications will fail silently or throw a registration error.**

### iOS Setup
*(If using `@capacitor/push-notifications`, iOS setup involves enabling Push capabilities in Xcode and uploading an APNs auth key to Firebase. Note that the official plugin sometimes returns an APNs token instead of an FCM token on iOS, which may require further adaptation on the server to send directly to APNs or use a community plugin like `@capawesome/capacitor-firebase-messaging` for FCM parity).*

## Rebuilding vs. Vercel Updates

Because our Capacitor apps point to a remote URL (e.g., `server.url` in `capacitor.config.ts`), you can update the UI and most logic just by deploying to Vercel.

However, **Push Notifications require native code and configurations**. 

You **MUST rebuild and reinstall the APK/AAB** (or iOS app) whenever you:
- Add or change the `google-services.json` file.
- Update `@capacitor/push-notifications` or other Capacitor plugins.
- Change Android permissions or manifest configurations related to notifications.

If you only deploy to Vercel, the web code will try to call the native Push plugin, but the native OS will reject it if the `google-services.json` wasn't bundled into the APK at build time.
