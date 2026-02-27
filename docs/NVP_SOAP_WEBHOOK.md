# BEDI NVP SOAP Webhook

Webhook endpoint that receives all events at:

**URL:** `https://bedi.delivery/api/nvp/soap/webhook`  
**Webhook ID (PayPal):** `8MK21763MD0340910`  
**Events:** All Events  
**App route:** `POST /api/nvp/soap/webhook`

---

## Environment variables

Use **server-only** variables (no `NEXT_PUBLIC_`) so secrets are never exposed to the client.

In `.env.local` and production:

```bash
# Required for custom senders: X-Bedi-Signature verification (HMAC-SHA256 of body).
BEDI_NVP_SOAP_WEBHOOK_SECRET=your_webhook_secret

# Optional: for logging or validation
BEDI_NVP_SOAP_CLIENT_ID=your_client_id

# Optional: PayPal webhook ID (e.g. 8MK21763MD0340910) for logging / future verification
PAYPAL_WEBHOOK_ID=8MK21763MD0340910
```

**Important:** Do **not** use `NEXT_PUBLIC_` for the webhook secret. Keep it server-only.

---

## Verification

When `BEDI_NVP_SOAP_WEBHOOK_SECRET` is set, the endpoint expects:

**Header:** `X-Bedi-Signature: sha256=<hex>`

Where `<hex>` is the HMAC-SHA256 of the **raw request body** using the secret:

```
HMAC-SHA256(rawBody, BEDI_NVP_SOAP_WEBHOOK_SECRET)
```

Send the result in lowercase hex. Requests without a valid signature receive `401 Invalid signature`.

---

## Payload

- **Content-Type: application/json** – parsed as JSON; `event_type` or `eventType` is used for logging.
- **Content-Type: application/x-www-form-urlencoded** – parsed as name-value pairs.

Other types are logged as raw text (truncated). The handler always returns `200` with `{ received: true, eventType }` so senders do not retry on success.

---

## PayPal events and subscription extension

When the webhook receives a **PayPal** payload (JSON with no `X-Bedi-Signature`), it is accepted and processed:

- **`PAYMENT.SALE.COMPLETED`** – The app looks up the tenant by `resource.billing_agreement_id` (or `resource.id`) matching the stored `paypalSubscriptionId`, then extends `subscriptionExpiresAt` by **1 month** and sets `subscriptionStatus` to `active`. This keeps recurring subscription payments in sync with your app.

Other event types are logged and acknowledged with `200`; you can extend the handler for more events as needed.

---

## GET (health check)

`GET /api/nvp/soap/webhook` returns a short JSON description (including `paypalWebhookId` when set) so you can confirm the URL is reachable.
