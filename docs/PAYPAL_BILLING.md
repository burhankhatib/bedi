# PayPal billing and subscriptions

Businesses get a **30-day free trial** from the tenant site creation date. After the trial (or after a subscription or one-time period ends), the business is **hidden from the system**—customers cannot see it. They must choose a subscription or pay to stay visible.

## Pricing (ILS)

| Plan    | Price  | Per month |
|---------|--------|-----------|
| 1 Month | 350 ILS | 350 ILS |
| 3 Months | 960 ILS | 320 ILS |
| 6 Months | 1,800 ILS | 300 ILS |
| 12 Months | 3,600 ILS | 300 ILS |

## Flow

1. New tenant creates a business → `subscriptionExpiresAt` = site creation date + 30 days (trial).
2. One week before expiry → banner appears at the top of the manage area: “Your subscription expires in less than a week…”
3. Tenant goes to **Billing**, chooses a plan, pays via PayPal (opens your PayPal link).
4. Tenant clicks **“I’ve completed payment”** and selects the plan they paid for → subscription is extended.
5. If they don’t pay and the date passes → business is hidden from the system: not listed on home, categories, or search; tenant menu URL returns 404. Only when `subscriptionExpiresAt` is in the future (or null for legacy tenants) is the business visible to customers.

## Environment variables

In `.env.local` (and production):

```bash
# Default PayPal payment link (used for all plans if per-plan links are not set)
PAYPAL_PAYMENT_LINK=https://www.paypal.com/ncp/payment/TGL6PLWW5NRBY

# Optional: separate PayPal links per plan (e.g. different amounts in PayPal dashboard)
# PAYPAL_LINK_1M=...
# PAYPAL_LINK_3M=...
# PAYPAL_LINK_6M=...
# PAYPAL_LINK_12M=...

# PayPal recurring subscription (first highlighted option on Billing)
NEXT_PUBLIC_PAYPAL_CLIENT_ID=your_paypal_client_id
NEXT_PUBLIC_PAYPAL_SUBSCRIPTION_PLAN_ID=P-7LW984279R694694UNGM7DII

# Optional: show one-time plan cards (1m, 3m, 6m, 12m). Omit or false = subscription only.
# NEXT_PUBLIC_BILLING_SHOW_ONE_TIME_PLANS=true
```

If `NEXT_PUBLIC_PAYPAL_CLIENT_ID` is set, the billing page shows **Subscribe with PayPal** as the first, highlighted option. When the tenant approves, their subscription is extended by 1 month and the subscription ID is stored for future webhook renewals. One-time plan cards are hidden unless `NEXT_PUBLIC_BILLING_SHOW_ONE_TIME_PLANS=true`.

If you use one link for all plans, make sure the tenant pays the correct amount (shown on the billing page) for the chosen plan.

## Existing tenants (before subscription feature)

Tenants created before `subscriptionExpiresAt` was added have no expiry set. They remain visible until you either:

- Set `subscriptionExpiresAt` in Sanity Studio (e.g. to “createdAt + 30 days” or any date), or  
- Run a one-time migration that sets `subscriptionExpiresAt = createdAt + 30 days` for all tenants where `subscriptionExpiresAt` is missing.

After the first payment via the Billing page, their subscription will have a normal expiry and the banner will show when it’s due.

## Going live (production deploy)

When deploying to production (e.g. Vercel) with **Live** PayPal:

1. **Environment variables on Vercel (or your host)**  
   - `NEXT_PUBLIC_PAYPAL_CLIENT_ID` = **Live** app Client ID (from [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/) → Live → Apps).  
   - `PAYPAL_CLIENT_SECRET` = **Live** app Secret (server-only; never use `NEXT_PUBLIC_`).  
   - `PAYPAL_SANDBOX` = `false` or leave **unset** so the server uses `https://api-m.paypal.com`.

2. **Subscription plan ID (monthly "Subscribe with PayPal")**  
   - Plan IDs are **environment-specific**. A Sandbox plan ID will not work with a Live client ID.  
   - In the **Live** app, create a subscription product and plan (or use "Create product & plan" once on the billing page in production, then add the returned plan ID to env).  
   - Set `NEXT_PUBLIC_PAYPAL_SUBSCRIPTION_PLAN_ID` = your **Live** plan ID (e.g. `P-...`) on Vercel.

3. **Webhooks (optional, for automatic renewal)**  
   - In PayPal Developer Dashboard → **Live** → your app → Webhooks, add a webhook.  
   - URL: `https://your-production-domain.com/api/nvp/soap/webhook` (replace with your real domain).  
   - Subscribe to the events you need (e.g. subscription renewal).  
   - Set `PAYPAL_WEBHOOK_ID` on Vercel to the **Live** webhook ID.

4. **Payment links (fallback when not using Orders API)**  
   - If you use `PAYPAL_PAYMENT_LINK` or `PAYPAL_LINK_1M` etc., keep them as **paypal.com** (Live) links.

5. **Redeploy**  
   - After changing env vars on Vercel, trigger a new deployment so the build uses the Live values.

No code changes are required; the app uses `PAYPAL_SANDBOX !== 'true'` to call the Live API.

## Optional: PayPal IPN / webhooks

For automatic extension (no “I’ve completed payment” step), integrate PayPal’s IPN or webhooks: when PayPal confirms payment, call your backend to identify the tenant and plan (e.g. from a custom invoice or memo), then call the same logic as `POST /api/tenants/[slug]/subscription/extend` with the correct `plan`.
