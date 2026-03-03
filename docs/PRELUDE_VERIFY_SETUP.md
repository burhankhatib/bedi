# Prelude Verify: WhatsApp + SMS delivery (Israel & Palestine)

This app uses [Prelude Verify API](https://docs.prelude.so/verify/v2/documentation/introduction) for phone verification. The API call already sets **WhatsApp as preferred channel** and **SMS as fallback** in code. If verifications stay **"Pending Check"** in the Prelude dashboard with **empty Channels**, it means **no delivery channel is enabled** for your account for those countries.

## Why you see "Pending Check" but receive nothing

- Prelude **accepts** the verification request and returns `success` or `retry`.
- The OTP is **only sent** when at least one **route** (provider + channel) is enabled for the phone's country.
- If **no route** is enabled (e.g. no WhatsApp connected, no SMS provider for IL/PS), the verification stays in "Pending Check" and **no WhatsApp or SMS is sent** — so you never get the code.

## Fix: Enable channels in the Prelude Dashboard

### 1. Connect WhatsApp (priority for +972 / +970)

1. Log in to the [Prelude Dashboard](https://app.prelude.so/).
2. Go to **Verify API → Configure → Integrations → Providers**.
3. Click **Connect with Facebook** and complete Meta's Embedded Signup:
   - Use or create a **Meta Business Manager** and **WhatsApp Business Account (WABA)**.
   - Add/select a **phone number** for WhatsApp Business (or use Meta's test number).
   - Ensure **billing is set up** in [WhatsApp Billing Settings](https://business.facebook.com/billing_hub/accounts?account_type=whatsapp-business-account); messages will not send without it.
   - Click the blue **Finish** and wait for the page to finish linking (can take ~1 minute).
4. After linking, go to **Verify API → Routes**.
5. **Enable the WhatsApp channel** for the routes/countries where you want it (e.g. Israel +972, Palestine +970).

Details: [Connect your WhatsApp Business Account to Prelude](https://docs.prelude.so/verify/v2/documentation/whatsapp).

### 2. Enable SMS (fallback)

- In **Verify API → Configure** (or **Routes**), ensure an **SMS** provider/route is enabled for **Israel** and **Palestine** so that if WhatsApp is unavailable, Prelude can fall back to SMS.

### 3. Prefer WhatsApp then SMS for IL/PS

- In **Verify API → Routes**, for Israel and Palestine you can set the **Strategy** to **"Prioritize conversion"** so Prelude prefers the channel with the best delivery (typically WhatsApp when connected).
- Our app already sends `preferred_channel: "whatsapp"` and `method: "message"` so the backend explicitly asks for message delivery (WhatsApp first, then SMS if needed).

## What the app sends

In `app/api/verify-phone/request/route.ts` the backend sends:

- `options.method: "message"` — request message-based OTP (WhatsApp/SMS), not silent or voice.
- `options.preferred_channel: "whatsapp"` — prefer WhatsApp when available.
- `options.locale` — `he-IL` for +972, `ar-PS` for +970 when applicable.

Delivery still requires the above **Dashboard** setup (WhatsApp connected and Routes enabled for the relevant countries).
