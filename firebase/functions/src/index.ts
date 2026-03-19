import { onSchedule } from 'firebase-functions/v2/scheduler'

const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || ''
const secret = process.env.FIREBASE_JOB_SECRET || process.env.CRON_SECRET || ''

async function run(path: string): Promise<void> {
  if (!appUrl) return
  const url = `${appUrl.replace(/\/$/, '')}${path}`
  await fetch(url, {
    method: 'POST',
    headers: {
      ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
    },
  })
}

/**
 * Runs every minute and processes due jobs from Firestore queue.
 * This avoids Sanity polling/scanning when there are no due jobs.
 */
export const processDueJobs = onSchedule('every 1 minutes', async () => {
  await run('/api/jobs/process-due')
})

