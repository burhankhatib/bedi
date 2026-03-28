# Native Google sign-in (Capacitor + Clerk)

The Bedi app loads your real site inside a WebView. **Google blocks OAuth in that WebView**, so the **primary** flow is:

1. **`GoogleLoginButton`** + **`useGoogleOAuthCapacitor`** — Clerk `oauth_google` with **`redirectUrl` = `<applicationId>://oauth-callback`** (same string as `appId` in `capacitor.config.ts` and as Android `applicationId` / iOS bundle ID).
2. The auth URL opens in the **system browser** (Custom Tabs / SFSafariViewController) via `@capacitor/inappbrowser`.
3. After Google + Clerk finish, the OS opens the app on that custom URL; **`CapacitorAppUrlListener`** routes to `/auth/capacitor-oauth-callback` and **`handleRedirectCallback`** completes the session.

**Clerk Dashboard:** allow-list each native redirect exactly, for example:

- Customer: `com.burhankhatib.bedi://oauth-callback`
- Driver: `com.burhankhatib.bedi.driver://oauth-callback`
- Tenant: `com.burhankhatib.bedi.tenant://oauth-callback`

**Clerk → Native applications:** the **package / bundle identifier** must match `appId` for that shell (see comments in each `capacitor/*/capacitor.config.ts`).

Optional override: set **`NEXT_PUBLIC_CAPACITOR_APP_ID`** if you must force an app id (normally **`App.getInfo().id`** from Capacitor is used on native, so `/sign-in` still resolves to the correct package).

`@clerk/nextjs` v6 does **not** export `useOAuth`; use **`useGoogleOAuthCapacitor`** (wrapper around `useSignIn` / `useSignUp` + `create({ strategy: 'oauth_google' })`).

The sections below about **`@capgo/capacitor-social-login`** and ID tokens still apply if you use or debug that path elsewhere.

## 1. Environment variables (Vercel + local)

Add to `.env.local` and to **Vercel** project settings:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID` | **Web application** OAuth client ID from Google Cloud (the long `….apps.googleusercontent.com` string). Use the **same** client whose **Client secret** you already pasted into **Clerk → Google SSO**. |

For **iOS** native builds, also set:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID` | **iOS** OAuth client ID from Google Cloud (type **iOS**, bundle ID = your Capacitor app id, e.g. `com.burhankhatib.bedi`). |

Redeploy the site after changing env vars so the WebView loads JS with the new values.

## 2. Google Cloud Console

1. **Web client** (already used by Clerk):  
   - **Authorized JavaScript origins** must include `https://www.bedi.delivery` and `https://bedi.delivery` (and localhost for dev if needed).  
   - **Authorized redirect URIs** must include the **Clerk** redirect URI (from Clerk Dashboard → Google connection).

2. **Android** – for each native app package name, create **OAuth client ID → Android** (or add multiple packages to your workflow as Google allows):

   - **Customer:** `com.burhankhatib.bedi`  
   - **Driver:** `com.burhankhatib.bedi.driver`  
   - **Tenant:** `com.burhankhatib.bedi.tenant`  

   Add the **SHA-1** (and SHA-256 if asked) of the keystore that signs the build:

   **Debug (emulator / local run):**

   ```bash
   keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
   ```

   Copy **SHA1** into the Android OAuth client in Google Cloud.  
   For Play Store builds, add the **upload key** / **app signing** SHA-1 from Play Console.

3. **iOS** – create **OAuth client ID → iOS** with the matching **Bundle ID** for each app; put that client’s ID in `NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID`.

## 3. Clerk

- **Google** must stay enabled with **custom credentials** (same Web client as above).  
- No separate “One Tap” toggle is required for this flow; the token is validated like One Tap.

### Native API + Native applications (required for mobile)

Per [Clerk’s Android quickstart](https://clerk.com/docs/android/getting-started/quickstart), you must:

1. Open **[Native applications](https://dashboard.clerk.com/~/native-applications)** for the **same Clerk instance** as your production keys (`pk_live_…`).  
2. Turn **ON** the **Native API** toggle (if it is off, Clerk can reject native / WebView flows with **authorization_invalid** even when the Google token’s `aud` is correct).  
3. Register each **Android** shell:  
   - **Customer:** `com.burhankhatib.bedi`  
   - **Driver:** `com.burhankhatib.bedi.driver`  
   - **Tenant:** `com.burhankhatib.bedi.tenant`  
4. For each app, paste the **SHA-256** fingerprint of the keystore that signs the APK you run (**debug** keystore for emulator / local installs; Play App Signing certificate for Play builds).  

Get SHA-256 from the debug keystore:

```bash
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
```

If Native API is off or the package/SHA-256 pair does not match the installed APK, you often see **“You are not authorized to perform this request”** after choosing a Google account.

### Digital Asset Links (`assetlinks.json`)

For Clerk to fully trust the native Android app (especially for features like Passkeys or advanced credential flows), your frontend API domain must host a valid `assetlinks.json` file at `/.well-known/assetlinks.json`.

**Important:** The `namespace` must be exactly `"android_app"`, not your app's display name.

Correct example for your `assetlinks.json`:
```json
[{
  "relation": ["delegate_permission/common.handle_all_urls", "delegate_permission/common.get_login_creds"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.burhankhatib.bedi",
    "sha256_cert_fingerprints": ["C1:97:8F:97:A5:89:BE:EB:2F:4A:2C:74:EA:44:1F:E9:48:06:8A:7D:1A:33:C3:AF:89:9F:EC:38:8F:17:F8:A7"]
  }
}]
```
*Note: Make sure to include the `package_name` and `sha256_cert_fingerprints` for the driver and tenant apps here as well if they also use native auth.*

You can test if your file is valid by running Google's [Statement List Generator and Tester](https://developers.google.com/digital-asset-links/tools/generator).

### Legal acceptance (`legalAccepted`)

The native Google button **sends `legalAccepted: true` on the first request by default** (many Clerk instances require it for this strategy).

To match older behavior (try **without** legal first, then retry **with** legal only after an authorization error), set:

`NEXT_PUBLIC_NATIVE_GOOGLE_SKIP_LEGAL_ACCEPTED=1`

Only change this if your lawyer/product rules require not implying terms acceptance from this button alone.

## 4. Capacitor

The `@capacitor/app` plugin **must** be installed in each shell (`capacitor/customer`, `capacitor/driver`, `capacitor/tenant`). It is required to handle deep links and return to the app via `App.addListener('appUrlOpen')`. Without it, you will see `App plugin is not implemented on Android` and the login will not complete.

After `npm install` or adding new plugins, sync native projects so Gradle/CocoaPods pick up the plugin:

```bash
npm run build:mobile
```

Or per app:

```bash
npm run build:mobile:customer
```

Open **Android Studio** → **Sync Project with Gradle Files** if needed.

## 5. What users see

On **native only**, `/sign-in` and `/sign-up` show **Continue with Google (native)** above the Clerk form. On **normal browsers** the button is hidden; use the regular Clerk Google button there.

## 6. If Google still fails after Native API + SHA-256 + legal flag

Email/password proves your **Clerk instance and keys** work; the remaining failure is almost always **Clerk’s handling of the Google One Tap / ID-token path** for your exact setup (Capacitor WebView + native ID token).

1. In **Clerk Dashboard → Logs**, find the failed request and copy the **trace / request id** for `authorization_invalid`.  
2. Open **[Clerk support](https://clerk.com/support)** (or your plan’s channel) and ask why **`authenticateWithGoogleOneTap` / `google_one_tap`** returns **authorization_invalid** for a token whose **`aud`** matches your Web client, with **Native API enabled** and the **correct Android package + SHA-256** registered. Mention **Capacitor** and that the UI loads **`https://www.bedi.delivery`** in a WebView.

We are **not** removing the native Google button; a fix may require a Clerk-side rule change, a documented alternate strategy, or a future SDK update.

## 7. Troubleshooting

- **`You CANNOT use scopes without modifying the main activity`** – The Bedi app no longer passes custom `scopes` from JS (the plugin already adds email, profile, openid). All three Android `MainActivity` classes also implement `ModifiedMainActivityForSocialLoginPlugin` as required by `@capgo/capacitor-social-login` if you add scopes later. Rebuild the Android app after pulling changes.
- **JSON error on `clerk.bedi.delivery/v1/oa…` with `authorization_invalid`** – Avoid Clerk’s in-card Google OAuth inside the WebView. On native, social buttons in `<SignIn />` are hidden; use **Continue with Google** (system browser + `appId://oauth-callback`). If you still see the in-card Google button, deploy the latest web app and hard-refresh the WebView.
- **No ID token** – Almost always **missing Android OAuth client** or **wrong SHA-1** for the package you’re running.  
- **Clerk errors after token** – Web client ID mismatch: `NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID` must match the Clerk Google **Web** client.  
- **“You are not authorized to perform this request”** after native Google succeeds – If **`aud` already matches** your Web client: turn **ON** [Native API](https://dashboard.clerk.com/~/native-applications) and register **package + SHA-256** for that APK. If **`aud` does not match**, fix `NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID` / Clerk Google Web client alignment.  
- **Debug endpoint** – Set `DIAGNOSE_GOOGLE_TOKEN_SECRET` in the environment, then `POST /api/debug/google-id-token` with header `x-debug-secret: <same>` and body `{ "idToken": "<paste>" }`. Optionally set server `GOOGLE_WEB_CLIENT_ID` (same as Web client) and comma-separated `GOOGLE_ANDROID_OAUTH_CLIENT_IDS` so the route can run `verifyIdToken` with multiple audiences.  
- **iOS** – Ensure `NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID` and the iOS OAuth client bundle ID match the Xcode target.

## 8. Customer location in the native app (Capacitor Geolocation)

The web app’s **`LocationProvider`** (`components/LocationContext.tsx`) now uses **`@capacitor/geolocation`** when `Capacitor.isNativePlatform()` is true, and falls back to `navigator.geolocation` in the browser.

After pulling changes, run `npm install` at the repo root, then `npm run build:mobile:customer` (or per-app), and rebuild the native app. Android **`ACCESS_*_LOCATION`** and iOS **usage strings** are set in each shell under `capacitor/*/android` and `capacitor/*/ios`.

Reuse **`getDeviceGeolocationPosition`** from `lib/device-geolocation.ts` anywhere you need a one-shot fix without duplicating native vs web logic.

### 9. Emulator location setup

If you run the app in an emulator and grant location permission but the app still shows "Where are you?" or says you are out of the service area:
- **Android Emulator:** The emulator does not have a real GPS. Open the emulator's **Extended Controls** (three dots in the sidebar), go to **Location**, and search for or manually place a pin inside a configured service city for your app, then click **Set Location**.
- **iOS Simulator:** In Xcode, select your scheme or go to **Features → Location** in the Simulator menu and select a **Custom Location** inside your service area.

If the emulator location is unset or resolves to `0, 0`, geofencing and Nominatim reverse-geocoding will fail to match your available cities, resulting in the manual location gate fallback.
