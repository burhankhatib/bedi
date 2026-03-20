type AttendanceSession = {
  _id: string
  actorEmail?: string
  clockInAt?: string
  clockOutAt?: string
  totalMinutes?: number
}

export type StaffPayrollProfile = {
  staffId: string
  email: string
  displayName?: string
  timezone?: string
  hourlyRate?: number
  overtimeMultiplier?: number
}

export type StaffPayrollSummary = {
  staffId: string
  email: string
  displayName?: string
  sessionsCount: number
  regularMinutes: number
  overtimeMinutes: number
  regularHours: number
  overtimeHours: number
  hourlyRate: number
  overtimeMultiplier: number
  grossPay: number
}

function dateKeyInTz(date: Date, timezone: string): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return fmt.format(date)
}

function minutesClippedToRange(
  session: AttendanceSession,
  rangeStartMs: number,
  rangeEndMs: number
): number {
  const inMs = session.clockInAt ? new Date(session.clockInAt).getTime() : NaN
  const outMs = session.clockOutAt ? new Date(session.clockOutAt).getTime() : NaN
  if (!Number.isFinite(inMs) || !Number.isFinite(outMs)) return 0
  const start = Math.max(inMs, rangeStartMs)
  const end = Math.min(outMs, rangeEndMs)
  if (end <= start) return 0
  return Math.max(0, Math.round((end - start) / 60000))
}

export function calculatePayrollSummary(params: {
  staff: StaffPayrollProfile
  sessions: AttendanceSession[]
  periodStartIso: string
  periodEndIso: string
}): StaffPayrollSummary {
  const { staff, sessions, periodStartIso, periodEndIso } = params
  const rangeStartMs = new Date(periodStartIso).getTime()
  const rangeEndMs = new Date(periodEndIso).getTime()
  const timezone = staff.timezone?.trim() || 'Asia/Jerusalem'
  const hourlyRate = Number.isFinite(staff.hourlyRate) ? Math.max(0, Number(staff.hourlyRate)) : 0
  const overtimeMultiplier = Number.isFinite(staff.overtimeMultiplier)
    ? Math.max(1, Number(staff.overtimeMultiplier))
    : 1.5

  const dailyMinutes = new Map<string, number>()
  let sessionsCount = 0

  for (const s of sessions) {
    const clippedMinutes = minutesClippedToRange(s, rangeStartMs, rangeEndMs)
    if (clippedMinutes <= 0) continue
    sessionsCount++
    const key = dateKeyInTz(new Date(s.clockInAt || periodStartIso), timezone)
    dailyMinutes.set(key, (dailyMinutes.get(key) || 0) + clippedMinutes)
  }

  let regularMinutes = 0
  let overtimeMinutes = 0
  for (const m of dailyMinutes.values()) {
    const regularToday = Math.min(8 * 60, m)
    const overtimeToday = Math.max(0, m - regularToday)
    regularMinutes += regularToday
    overtimeMinutes += overtimeToday
  }

  const regularHours = regularMinutes / 60
  const overtimeHours = overtimeMinutes / 60
  const grossPay = Number((regularHours * hourlyRate + overtimeHours * hourlyRate * overtimeMultiplier).toFixed(2))

  return {
    staffId: staff.staffId,
    email: staff.email,
    displayName: staff.displayName,
    sessionsCount,
    regularMinutes,
    overtimeMinutes,
    regularHours,
    overtimeHours,
    hourlyRate,
    overtimeMultiplier,
    grossPay,
  }
}

