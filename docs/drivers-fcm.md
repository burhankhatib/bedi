# Driver FCM — operational checklist

Use this when debugging **no delivery-request push**, **auto-delivery delay doing nothing**, or **tier escalation feeling “stuck”**.

## Related docs

- [FCM_NOTIFICATIONS_TABLE.md](./FCM_NOTIFICATIONS_TABLE.md) — who gets what
- [FIREBASE_FCM_SETUP.md](./FIREBASE_FCM_SETUP.md) — Firebase credentials
- [FIREBASE_JOB_SCHEDULER_MIGRATION.md](./FIREBASE_JOB_SCHEDULER_MIGRATION.md) — Firestore `scheduledJobs` + `/api/jobs/process-due`
- [AUTO_DELIVERY_REQUEST_PLAN.md](./AUTO_DELIVERY_REQUEST_PLAN.md) — auto-delivery behavior

## Core code paths

| Flow | Entry |
|------|--------|
| Fan-out to drivers (tiers, offline reminders) | `lib/notify-drivers-for-order.ts` |
| New order → notify drivers (conditional) | `app/api/orders/route.ts` (requires `supportsDriverPickup`) |
| Tenant “Request driver” / sets `deliveryRequestedAt` | `app/api/tenants/[slug]/orders/request-driver/route.ts` |
| Scheduled auto-delivery (e.g. +5 min) | `app/api/cron/auto-delivery-request/route.ts` → `lib/execute-delivery-request-broadcast.ts` |
| Tier 2/3 + retry jobs | `lib/delivery-job-scheduler.ts` → Firestore → `app/api/jobs/process-due` → `app/api/cron/delivery-tier-escalation`, `app/api/cron/retry-delivery-requests` |

## Production checklist

### 1. Firebase / FCM

- [ ] `FIREBASE_*` or service account JSON present so **`isFCMConfigured()`** is true server-side (`lib/fcm.ts`).
- [ ] Driver has a valid **FCM token** (or Web Push) on the driver doc / `userPushSubscription` (`roleContext: "driver"`).

### 2. App URL (tap targets)

- [ ] **`NEXT_PUBLIC_APP_URL`** set to the live origin (e.g. `https://bedi.delivery`). Push payloads embed links; wrong base breaks open-on-tap.

### 3. Tenant: “driver pickup” on new orders

- [ ] **`supportsDriverPickup === true`** on the tenant.  
  If this is off, **new orders do not** auto-call `notifyDriversOfDeliveryOrder` from `POST /api/orders`.  
  Manual **Request driver** still notifies (does not depend on that flag).

### 4. Crons & secrets (Vercel)

- [ ] **`CRON_SECRET`** (and/or **`FIREBASE_JOB_SECRET`**) match what invokes crons.  
  Job processor and driver crons accept **both** secrets.
- [ ] `vercel.json` crons hit at least:
  - `/api/cron/auto-delivery-request` (scheduled auto-delivery)
  - `/api/jobs/process-due` (Firestore jobs: tier 2/3, retries, WhatsApp timers, etc.)

### 5. Firestore jobs (tiers after T+60s / T+120s)

- [ ] **Firebase Admin** configured so `scheduleJob` can write **`scheduledJobs`** (`lib/delivery-job-scheduler.ts`).  
  If Admin is missing, `/api/jobs/process-due` still runs **legacy Sanity fallbacks** (including delivery tier + retry when `allowLegacy=1` is used internally).

### 6. Driver eligibility (why “no one matched”)

Online drivers must pass **`getEligibleDrivers`** in `notify-drivers-for-order.ts`, including:

- `isOnline == true`, `isVerifiedByAdmin == true`, not blocked
- Same **service area** as the business (polygon / city–country / fallback)
- Not already on another active delivery; not in `declinedByDriverIds` for that order
- **Tier logic**: nearest rings first; first wave widens if the inner ring is empty (see code comments in the same file)

### 7. Offline “go online” nudge

- [ ] Offline **verified** drivers in the same area can get a periodic reminder (rate-limited, e.g. 2h).  
  They must have push tokens; area rules mirror the online filter (polygon / city).

## Quick triage

| Symptom | Check |
|--------|--------|
| No push on **new** order | Tenant **`supportsDriverPickup`**, FCM config, driver online + in area |
| No push after **Request driver** | Same + `deliveryRequestedAt` set; Sanity token for writes |
| Auto-delivery **never fires** | `/api/cron/auto-delivery-request` auth + order has `autoDeliveryRequestScheduledAt` and **`!deliveryRequestedAt`** until fired |
| Tiers **never escalate** | Firestore jobs + `/api/jobs/process-due`, or legacy tier cron when Admin absent |
| Push “silent” on phone | Ensure notifications use **notification + data** for driver delivery (see `sendToDriverTokens` in `notify-drivers-for-order.ts`) |

## Sanity schema / Studio

Schema for orders/drivers is code-defined; no separate “schema deploy” step. After schema changes, **redeploy** the app so Studio and API match.
