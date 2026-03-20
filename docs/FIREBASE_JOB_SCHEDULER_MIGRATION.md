# Firebase Job Scheduler Migration

This project now supports **Firebase-backed delayed jobs** to stop idle Sanity API scans.

## What changed

- Added Firestore queue: `scheduledJobs`
- Added due-job processor endpoint: `POST /api/jobs/process-due`
- Added Firebase scheduled function scaffold in `firebase/functions/src/index.ts`
- Added event-driven scheduling/cancellation in delivery lifecycle routes
- `vercel.json` includes a **minute cron** for `GET /api/jobs/process-due` so delayed jobs run on Vercel without deploying Firebase Functions. Legacy Sanity-wide scans for unaccepted WhatsApp remain opt-in via `ENABLE_LEGACY_SANITY_SCAN_CRONS`.

## Required env vars

Set these in both Next.js deployment and Firebase Functions:

- `NEXT_PUBLIC_APP_URL` (or `APP_URL` in Firebase Functions)
- `FIREBASE_JOB_SECRET` (or reuse `CRON_SECRET`)
- Firebase Admin credentials:
  - `FIREBASE_SERVICE_ACCOUNT_PATH` **or**
  - `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`

## Deploy steps

1. **Deploy Next.js app** (Vercel or other host). Includes `/api/jobs/process-due` and scheduler wiring.

2. **Deploy Firebase scheduled function:**
   - From project root: `cd firebase/functions && npm install && npm run deploy`
   - Or: `cd firebase/functions`, then `npm install`, then `npm run deploy`
   - Requires `firebase.json` and `.firebaserc` at project root (already added).

3. **Set Firebase Function env vars** (Firebase Console → Functions → select `processDueJobs` → Environment variables):
   - `APP_URL` — your deployed Next.js URL (e.g. `https://your-app.vercel.app`)
   - `FIREBASE_JOB_SECRET` — same value as in Vercel (or reuse `CRON_SECRET`)

## Notes

- With no due jobs, scheduler reads Firestore only (no Sanity calls).
- Sanity calls now run only when actual queued work exists (order-driven), preventing idle leak.

