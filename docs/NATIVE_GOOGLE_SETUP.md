# Native Google sign-in (Capacitor + Clerk)

The Bedi app loads your real site inside a WebView. **Google blocks OAuth in that WebView**, so we use the device’s Google account via **`@capgo/capacitor-social-login`**, get a **Google ID token**, and finish the session with **Clerk** using `authenticateWithGoogleOneTap` (same token shape as Google One Tap).

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

### Native applications (required for production mobile)

Clerk’s production checklist expects each **Android** shell to be registered:

1. Dashboard → **Native applications** → add one entry per app: `com.burhankhatib.bedi` (customer), `com.burhankhatib.bedi.driver` (driver), `com.burhankhatib.bedi.tenant` (tenant).  
2. Provide the **SHA-256** fingerprint of the keystore that signs the build (debug keystore for local runs; Play signing key for store builds).  

If these entries are missing, you can get a generic **“You are not authorized to perform this request”** / `authorization_invalid` **after** Google returns a token.

### Optional: legal acceptance (sign-in and sign-up)

If your Clerk instance **requires** terms/privacy acceptance for OAuth-style sign-in, native Google One Tap can return **authorization_invalid** until Clerk receives `legalAccepted`. Set on Vercel / `.env.local`:

`NEXT_PUBLIC_NATIVE_GOOGLE_LEGAL_ACCEPTED=1`

Only enable this if it matches your legal UX (e.g. user already accepted terms in-app).

## 4. Capacitor

After `npm install`, sync native projects so Gradle/CocoaPods pick up the plugin:

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

## 6. Troubleshooting

- **`You CANNOT use scopes without modifying the main activity`** – The Bedi app no longer passes custom `scopes` from JS (the plugin already adds email, profile, openid). All three Android `MainActivity` classes also implement `ModifiedMainActivityForSocialLoginPlugin` as required by `@capgo/capacitor-social-login` if you add scopes later. Rebuild the Android app after pulling changes.
- **JSON error on `clerk.bedi.delivery/v1/oa…` with `authorization_invalid`** – You opened **Clerk’s Google button inside the sign-in card** (redirect OAuth). That path breaks in the app WebView. In the Bedi app build, those buttons are **hidden on native**; use **Continue with Google** at the top only. If you still see the in-card Google button, deploy the latest web app and hard-refresh the WebView.
- **No ID token** – Almost always **missing Android OAuth client** or **wrong SHA-1** for the package you’re running.  
- **Clerk errors after token** – Web client ID mismatch: `NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID` must match the Clerk Google **Web** client.  
- **“You are not authorized to perform this request”** after native Google succeeds – Most often: **Native applications** not registered (package + SHA-256), or the ID token **`aud`** does not match the **Web** client Clerk uses. Decode the JWT (e.g. [jwt.io](https://jwt.io)) and compare `aud` to the Web client ID in Clerk → Google.  
- **Debug endpoint** – Set `DIAGNOSE_GOOGLE_TOKEN_SECRET` in the environment, then `POST /api/debug/google-id-token` with header `x-debug-secret: <same>` and body `{ "idToken": "<paste>" }`. Optionally set server `GOOGLE_WEB_CLIENT_ID` (same as Web client) and comma-separated `GOOGLE_ANDROID_OAUTH_CLIENT_IDS` so the route can run `verifyIdToken` with multiple audiences.  
- **iOS** – Ensure `NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID` and the iOS OAuth client bundle ID match the Xcode target.
