/**
 * GROQ fragment: order is still in a phase where we may be requesting / escalating to drivers.
 * Must stay in sync with `app/api/cron/auto-delivery-request/route.ts` so scheduled jobs
 * (tier escalation, retries, WhatsApp) do not skip orders that auto-delivery already fired for.
 */
export const GROQ_STATUS_AWAITING_DRIVER = `status in ["new", "acknowledged", "preparing", "waiting_for_delivery"]`
