# Firebase Cloud Messaging (FCM) – Step-by-step setup for Bedi Delivery

Follow these steps in order. At the end you’ll have everything needed to add to the app (env vars and optional file).

**Your Firebase config (add to `.env.local`):**
```bash
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyBsApHmB-pF0F3MrG3W7F7ns8BM3ZugABM
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=bedi-delivery.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=bedi-delivery
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=bedi-delivery.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=16229698269
NEXT_PUBLIC_FIREBASE_APP_ID=1:16229698269:web:daa8f75fdb94c738832934
```
You still need to add **NEXT_PUBLIC_FIREBASE_VAPID_KEY** (Step 2) and the **service account** vars (Step 3) for push to work.

---

## Step 1: Get your Web app config (Firebase config)

1. Open [Firebase Console](https://console.firebase.google.com/) and select your project.
2. Click the **gear** next to “Project overview” → **Project settings**.
3. Scroll to **“Your apps”**.
4. If you don’t have a **Web** app yet:
   - Click **“Add app”** → choose **Web** `</>`.
   - App nickname: e.g. **“Bedi Delivery”**.
   - Optional: Firebase Hosting can be unchecked.
   - Click **“Register app”**.
5. You’ll see a **`firebaseConfig`** object. Copy it. It looks like:

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef..."
};
```

**What to give the dev:**  
The 6 values: `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`  
(they will go into env as `NEXT_PUBLIC_FIREBASE_*`).

---

## Step 2: Web Push certificates (VAPID key for FCM Web)

1. In **Project settings**, open the **“Cloud Messaging”** tab.
2. Scroll to **“Web configuration”**.
3. Under **“Web Push certificates”**, click **“Generate key pair”** (if you haven’t already).
4. Copy the **key pair** that appears (a long base64 string).

**What to give the dev:**  
This single string is the **public VAPID key** for the web client.  
(env: `NEXT_PUBLIC_FIREBASE_VAPID_KEY` or similar.)

---

## Step 3: Service account (for server: sending notifications)

1. In **Project settings**, open the **“Service accounts”** tab.
2. Click **“Generate new private key”** → **“Generate key”**.
3. A JSON file will download. **Keep it secret** (do not commit to git).

**What to give the dev (choose one):**

- **Option A – Env vars (recommended)**  
  From the JSON file, copy:
  - `project_id`
  - `client_email`
  - `private_key` (the full string, including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`; newlines can be kept or replaced with `\n` in the env value)

  They will be used as:
  - `FIREBASE_PROJECT_ID`
  - `FIREBASE_CLIENT_EMAIL`
  - `FIREBASE_PRIVATE_KEY`

- **Option B – JSON file in project root (local dev)**  
  Put the JSON file in the **project root** as `bedi-delivery-firebase-adminsdk-fbsvc-9161982d29.json`. The app will use it automatically. This file is in `.gitignore`. For production (e.g. Vercel), use Option A env vars instead.

---

## Step 4: Enable Firebase Cloud Messaging API

1. Open [Google Cloud Console](https://console.cloud.google.com/) and select the **same project** as in Firebase.
2. Go to **“APIs & Services”** → **“Library”**.
3. Search for **“Firebase Cloud Messaging API”**.
4. Open it and click **“Enable”** if it’s not already enabled.

No need to send anything from this step; it’s required for sending from the server.

---

## Step 5: (Optional) Allowed domains for web

1. In Firebase **Project settings** → **General**.
2. Scroll to **“Your apps”** and select your Web app.
3. In **“App check”** / **“Authorized domains”** (or under **“Hosting”** if you use it), ensure your production domain (e.g. `bedi.delivery`, `your-app.vercel.app`) is listed.

---

## Checklist – What to provide for implementation

Fill this and send to the dev (or paste into the app’s env / config):

| Item | Where to get it | Example env name |
|------|-----------------|-------------------|
| Web app API Key | Step 1 – `firebaseConfig.apiKey` | `NEXT_PUBLIC_FIREBASE_API_KEY` |
| Auth domain | Step 1 – `firebaseConfig.authDomain` | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` |
| Project ID | Step 1 – `firebaseConfig.projectId` | `NEXT_PUBLIC_FIREBASE_PROJECT_ID` |
| Storage bucket | Step 1 – `firebaseConfig.storageBucket` | `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` |
| Messaging sender ID | Step 1 – `firebaseConfig.messagingSenderId` | `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` |
| App ID | Step 1 – `firebaseConfig.appId` | `NEXT_PUBLIC_FIREBASE_APP_ID` |
| Web Push (VAPID) key | Step 2 – Web Push certificates key pair | `NEXT_PUBLIC_FIREBASE_VAPID_KEY` |
| Service account project_id | Step 3 – JSON `project_id` | `FIREBASE_PROJECT_ID` |
| Service account client_email | Step 3 – JSON `client_email` | `FIREBASE_CLIENT_EMAIL` |
| Service account private_key | Step 3 – JSON `private_key` | `FIREBASE_PRIVATE_KEY` |

**Security:**

- Do **not** commit the service account JSON or put `FIREBASE_PRIVATE_KEY` in client-side code.
- Only `NEXT_PUBLIC_*` and the VAPID key are used in the browser; the rest are server-only.

Once you have these, the codebase can be updated to use FCM for tenant and driver push notifications (request permission, get FCM token, save it, and send via Firebase Admin from the server).
