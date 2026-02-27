# PayPal Sandbox on localhost – troubleshooting

Use this when **subscription popup closes immediately** or **one-time payment opens Live instead of Sandbox**.

---

## 1. One-time payment opens Live (paypal.com) instead of Sandbox

**Cause:** The server uses the **Live** API when `PAYPAL_SANDBOX` is not set.

**Fix:**

1. Open `.env.local`.
2. Add or set:
   ```bash
   PAYPAL_SANDBOX=true
   ```
3. Restart the Next.js dev server (`npm run dev` or `yarn dev`).

With this, create-order and capture use `https://api-m.sandbox.paypal.com`, and the approval URL points to **sandbox.paypal.com**. You must also have:

- `NEXT_PUBLIC_PAYPAL_CLIENT_ID` = **Sandbox** Client ID  
- `PAYPAL_CLIENT_SECRET` = **Sandbox** Client Secret  

---

## 2. Subscription button: popup appears then closes after ~1 second

**Cause:** Usually a **plan ID / environment mismatch**: the plan ID is from **Live** but the client ID is **Sandbox** (or the other way around). PayPal rejects it and the window closes.

**Fix:**

### A. Use a Sandbox plan ID

Your **Subscription plan ID** must be created in **Sandbox** when you use a **Sandbox** client ID.

**Option 1 – Create plan from the app (recommended)**

1. In `.env.local` set:
   ```bash
   NEXT_PUBLIC_PAYPAL_CLIENT_ID=<your-sandbox-client-id>
   PAYPAL_CLIENT_SECRET=<your-sandbox-client-secret>
   PAYPAL_SANDBOX=true
   ```
2. Restart the dev server.
3. Go to **Billing** for your business.
4. If the **“Create subscription plan”** card is visible, click **“Create product & plan”**.  
   If it’s not visible, remove `NEXT_PUBLIC_PAYPAL_SUBSCRIPTION_PLAN_ID` from `.env.local` (or leave it unset), restart, and reload the billing page.
5. Copy the returned **Plan ID** (e.g. `P-1AB2CD3EF...`).
6. Add to `.env.local`:
   ```bash
   NEXT_PUBLIC_PAYPAL_SUBSCRIPTION_PLAN_ID=P-xxxxxxxx
   ```
7. Restart the dev server and try **Subscribe with PayPal** again.

**Option 2 – Create plan in PayPal Developer Dashboard**

1. Go to [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/).
2. Switch to **Sandbox** (top toggle).
3. Open **Products** (or **Subscriptions** / **Plans**), create a product, then add a **Plan** (e.g. monthly 300 ILS).
4. Copy the **Plan ID** (starts with `P-`).
5. Set in `.env.local`:
   ```bash
   NEXT_PUBLIC_PAYPAL_SUBSCRIPTION_PLAN_ID=P-xxxxxxxx
   ```
6. Restart the dev server.

### B. Check the error message

After the change in the app, subscription errors are shown on the page and in the browser console. If the popup still closes:

1. Open **Developer tools** (F12) → **Console**.
2. Click **Subscribe with PayPal** again.
3. Look for a red `[PayPal subscription]` error. It often says the plan is invalid or doesn’t match the client – that confirms you need a **Sandbox** plan ID when using a Sandbox client ID.

---

## 3. Quick localhost Sandbox checklist

| Variable | Value | Purpose |
|----------|--------|--------|
| `NEXT_PUBLIC_PAYPAL_CLIENT_ID` | Sandbox Client ID | SDK and one-time use Sandbox |
| `PAYPAL_CLIENT_SECRET` | Sandbox Secret | One-time create-order/capture + optional setup-plan |
| `PAYPAL_SANDBOX` | `true` | One-time uses api-m.sandbox.paypal.com |
| `NEXT_PUBLIC_PAYPAL_SUBSCRIPTION_PLAN_ID` | Sandbox Plan ID (`P-...`) | Subscribe button; must be from Sandbox when client is Sandbox |

Restart the dev server after any `.env.local` change.

---

## 4. Test One-Time payment (1m, 3m, 6m, 12m) on localhost

One-time plans use the **Orders API** (create order → redirect to PayPal → capture). To test them in **Sandbox**:

1. **Set in `.env.local`:**
   ```bash
   NEXT_PUBLIC_PAYPAL_CLIENT_ID=<your-sandbox-client-id>
   PAYPAL_CLIENT_SECRET=<your-sandbox-client-secret>
   PAYPAL_SANDBOX=true
   ```
2. **Restart** the dev server.
3. Go to **Billing** for your business (`/t/[your-slug]/manage/billing`).
4. In the **One-time plans** section, click **Pay with PayPal** on any plan (e.g. 1 Month — 350 ILS).
5. You are redirected to **sandbox.paypal.com**. Log in with a [Sandbox personal account](https://developer.paypal.com/dashboard/accounts) (or use the test card if the flow supports it).
6. Approve the payment. You are redirected back to the billing page with `?paypal_return=1&token=...`.
7. The app captures the order and extends your subscription by the plan (e.g. 1 month). The page shows the new expiry and refreshes.

**If one-time opens Live (paypal.com) instead of Sandbox:** ensure `PAYPAL_SANDBOX=true` is set and restart the server. The server uses this to call `api-m.sandbox.paypal.com` and the approval URL points to sandbox.

**If you don’t have PAYPAL_CLIENT_SECRET set:** one-time buttons use the static payment link from env (Live only). Set the secret and `PAYPAL_SANDBOX=true` to test one-time in Sandbox.
