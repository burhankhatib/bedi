# Bank of Palestine (BOP) – Local Testing

**Note:** When `BOP_PAYMENTS_API_URL` is not set, the app uses the QR code flow immediately (no external API call). Payment buttons will show "Use the QR code below to pay" and scroll to the QR section. Callback and Webhook URLs are used when BOP redirects or POSTs after the customer pays via QR or their payment link.

For local development, the BOP dashboard requires **Callback URL** and **Webhook URL** that are publicly accessible. Use a tunnel (e.g. ngrok) or deploy to Vercel for testing.

## 1. Start a tunnel

```bash
# Install ngrok: 
ngrok http 3000
```

You'll get a URL like `https://abc123.ngrok-free.app`.

## 2. Configure your BOP dashboard

In the Bank of Palestine API Configuration (Test Mode), set:

| Field | Value |
|-------|-------|
| **Test Callback URL** | `https://YOUR-NGROK-URL.ngrok-free.app/api/bop/callback` |
| **Test Webhook URL** | `https://YOUR-NGROK-URL.ngrok-free.app/api/bop/webhook` |

Example:
- Callback: `https://abc123.ngrok-free.app/api/bop/callback`
- Webhook: `https://abc123.ngrok-free.app/api/bop/webhook`

## 3. Set NEXT_PUBLIC_APP_URL for local

Your app needs to build correct redirect URLs. Add to `.env.local`:

```
NEXT_PUBLIC_APP_URL=https://YOUR-NGROK-URL.ngrok-free.app
```

Use the same ngrok URL so the callback/webhook routes use the correct base.

## 4. Payment flow

1. Tenant goes to **Billing** → chooses a plan → clicks **Pay with Bank of Palestine**
2. App creates a payment (or shows QR fallback) and uses `internalReference = slug:planId`
3. After payment, BOP redirects to the **Callback URL** with `instructionId` and `internalReference`
4. BOP also POSTs to the **Webhook URL** with payment details
5. The app extends the tenant subscription and redirects to the billing page with success

## 5. Production URLs

When deployed (e.g. `https://bedi.delivery`):

- **Callback URL**: `https://bedi.delivery/api/bop/callback`
- **Webhook URL**: `https://bedi.delivery/api/bop/webhook`

Update these in your BOP dashboard when switching to production.
