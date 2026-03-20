/** Allowed delay values (minutes) before auto-requesting drivers. 0 = immediately. */
export const AUTO_DELIVERY_ALLOWED_MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40] as const

export type AutoDeliveryMinutesValue = (typeof AUTO_DELIVERY_ALLOWED_MINUTES)[number]

const ALLOWED_SET = new Set<number>(AUTO_DELIVERY_ALLOWED_MINUTES)

export function isValidAutoDeliveryMinutes(m: unknown): m is number | null {
  if (m === null) return true
  return typeof m === 'number' && ALLOWED_SET.has(m)
}

export function computeAutoDeliveryScheduledAtIso(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString()
}

/** Dropdown order per product spec: 20 first, None, Immediately, then 5–40 (excluding 20). */
export const AUTO_DELIVERY_DROPDOWN_SEQUENCE: Array<number | 'none'> = [
  20,
  'none',
  0,
  5,
  10,
  15,
  25,
  30,
  35,
  40,
]

/** Pre-filled delay on new-order UI: saved tenant preference, else 20 min. */
export function initialAutoDeliveryMinutesFromTenant(prefs: {
  saveAutoDeliveryRequestPreference?: boolean
  defaultAutoDeliveryRequestMinutes?: number | null
}): number | null {
  if (!prefs.saveAutoDeliveryRequestPreference) return 20
  const d = prefs.defaultAutoDeliveryRequestMinutes
  if (d === undefined) return 20
  if (d === null) return null
  return ALLOWED_SET.has(d) ? d : 20
}
