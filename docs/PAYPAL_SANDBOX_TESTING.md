# Testing PayPal locally with Sandbox

Use **Sandbox** credentials in `.env.local` so local runs hit `sandbox.paypal.com`. Keep **Live** credentials in Vercel so production is unchanged.

**If something doesn’t work on localhost** (e.g. subscription popup closes, one-time goes to Live), see **[PAYPAL_LOCALHOST_SANDBOX.md](./PAYPAL_LOCALHOST_SANDBOX.md)** for step-by-step fixes.

---

## 1. What works in Sandbox (no code changes)

### Subscribe with PayPal (recurring)

- Put your **Sandbox** credentials in `.env.local`:
  - `NEXT_PUBLIC_PAYPAL_CLIENT_ID` = Sandbox Client ID (from [Developer Dashboard](https://developer.paypal.com/dashboard/) → Sandbox → Apps → your app).
  - `NEXT_PUBLIC_PAYPAL_SUBSCRIPTION_PLAN_ID` = a **Sandbox** subscription plan ID (see below).
- The PayPal JS SDK uses the **client ID** to choose the environment: Sandbox ID → sandbox, Live ID → live. Same script URL, no code change.
- The “Subscribe with PayPal” button will open **sandbox.paypal.com** and create Sandbox subscriptions.

**Create a Sandbox subscription plan**

1. Go to [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/).
2. Switch to **Sandbox** (top toggle or environment selector).
3. **Products** (or **Subscriptions** / **Plans**) → create a product (e.g. “Monthly subscription”).
4. Add a **Plan** to that product (billing cycle, price). Copy the **Plan ID** (starts with `P-`).
5. Set in `.env.local`:
   ```bash
   NEXT_PUBLIC_PAYPAL_SUBSCRIPTION_PLAN_ID=P-xxxxxxxx  # your Sandbox plan ID
   ```

---

## 2. One-time plans (1m, 3m, 6m, 12m) – two modes

### Option A: Orders API (Sandbox + Live)

When **`PAYPAL_CLIENT_SECRET`** is set (server-only, never `NEXT_PUBLIC_`), the billing page uses the PayPal **Orders v2** API:

1. User clicks “Pay with PayPal” → app calls `POST /api/tenants/[slug]/subscription/create-order` with `{ planId }`.
2. Server creates a checkout order (amount from plan, `custom_id` = planId) and returns the approval URL.
3. User is redirected to PayPal (Sandbox or Live depending on `PAYPAL_SANDBOX`).
4. After approval, PayPal redirects back to the billing page with `?paypal_return=1&token=ORDER_ID`.
5. The page calls `POST .../capture-order` with `{ orderId }`; server captures the payment and extends the subscription by the plan.

To use **Sandbox** for one-time payments, set in `.env.local`:

- `NEXT_PUBLIC_PAYPAL_CLIENT_ID` = Sandbox Client ID  
- `PAYPAL_CLIENT_SECRET` = Sandbox Client Secret  
- `PAYPAL_SANDBOX=true`  

With `PAYPAL_SANDBOX=true`, the server uses `https://api-m.sandbox.paypal.com` for token, create order, and capture. The “Pay with PayPal” buttons then go to **sandbox.paypal.com** and can be tested with Sandbox personal accounts.

### Option B: Payment links (Live only)

If `PAYPAL_CLIENT_SECRET` is **not** set, one-time “Pay with PayPal” uses the static link from `PAYPAL_PAYMENT_LINK` or `PAYPAL_LINK_1M` etc. Those are **paypal.com** (Live) links; there is no Sandbox equivalent for shareable payment links.

**Summary:** For Sandbox one-time testing, set `PAYPAL_CLIENT_SECRET` and `PAYPAL_SANDBOX=true`. For production, use Live credentials and do **not** set `PAYPAL_SANDBOX` (or set it to `false`).

---

## 3. Optional env (no code change)

- **`PAYPAL_WEBHOOK_ID`**  
  In Sandbox, create a webhook in the Developer Dashboard (Sandbox) and point it to a **public** URL (e.g. ngrok/tunnel to your local `/api/nvp/soap/webhook`). Set `PAYPAL_WEBHOOK_ID` to that Sandbox webhook ID in `.env.local` if you want to test subscription renewal webhooks locally.

- **Client secret and Sandbox**  
  For **one-time** plans, if you set **server-only** `PAYPAL_CLIENT_SECRET`, the app uses the Orders API (create order → redirect → capture). Set `PAYPAL_SANDBOX=true` in Sandbox so the server calls `api-m.sandbox.paypal.com`. Never expose the secret via `NEXT_PUBLIC_*`.

---

## 4. Quick local Sandbox checklist

| Item | Where | Value for local Sandbox |
|------|--------|--------------------------|
| Client ID | `.env.local` | Sandbox app Client ID |
| Client secret (one-time) | `.env.local` | Sandbox app Secret (enables Orders API flow) |
| `PAYPAL_SANDBOX` | `.env.local` | `true` so one-time orders use sandbox.paypal.com |
| Subscription plan ID | `.env.local` | Sandbox plan ID (`P-...`) from Products/Plans |
| Webhook ID (optional) | `.env.local` | Sandbox webhook ID if testing webhooks |
| One-time links | Not needed when secret set | When `PAYPAL_CLIENT_SECRET` is set, one-time uses Orders API; links are ignored |

Vercel stays on **Live** credentials; local uses **Sandbox** via `.env.local` only.

---

## 5. Create subscription from this app (product + plan)

You can create the PayPal **catalog product** and **subscription plan** from the app instead of the PayPal dashboard:

1. Set **PAYPAL_CLIENT_ID** and **PAYPAL_CLIENT_SECRET** (and **PAYPAL_SANDBOX=true** for Sandbox).
2. Go to **Billing** for your business. If `NEXT_PUBLIC_PAYPAL_SUBSCRIPTION_PLAN_ID` is not set, a **“Create subscription plan”** card appears.
3. Click **“Create product & plan”**. The app calls the [Catalog Products API](https://developer.paypal.com/docs/api/catalog-products/v1/) to create a product, then the [Subscriptions API](https://developer.paypal.com/docs/api/subscriptions/v1/) to create a monthly 300 ILS plan.
4. Copy the returned **Plan ID** and add to `.env`:  
   `NEXT_PUBLIC_PAYPAL_SUBSCRIPTION_PLAN_ID=P-...`
5. Restart the dev server. The **Subscribe with PayPal** button will use this plan.

API used directly: `POST /api/tenants/[slug]/subscription/setup-plan` (tenant auth required).
