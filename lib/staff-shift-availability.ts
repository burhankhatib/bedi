type WorkScheduleDay = {
  dayOfWeek?: number
  enabled?: boolean
  start?: string
  end?: string
}

type WorkSchedule = {
  timezone?: string
  days?: WorkScheduleDay[]
}

function parseTimeToMinutes(v?: string): number | null {
  if (!v || typeof v !== 'string') return null
  const m = v.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const hh = Number(m[1])
  const mm = Number(m[2])
  if (!Number.isInteger(hh) || !Number.isInteger(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return null
  return hh * 60 + mm
}

function getZonedParts(now: Date, timezone?: string): { dayOfWeek: number; minutes: number } {
  const tz = timezone?.trim() || 'Asia/Jerusalem'
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = formatter.formatToParts(now)
  const weekday = parts.find((p) => p.type === 'weekday')?.value || 'Sun'
  const hour = Number(parts.find((p) => p.type === 'hour')?.value || '0')
  const minute = Number(parts.find((p) => p.type === 'minute')?.value || '0')
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return { dayOfWeek: map[weekday] ?? 0, minutes: hour * 60 + minute }
}

export function isStaffOnShiftNow(schedule: WorkSchedule | null | undefined, now = new Date()): boolean {
  const days = schedule?.days
  if (!Array.isArray(days) || days.length === 0) return true
  const { dayOfWeek, minutes } = getZonedParts(now, schedule?.timezone)
  const today = days.find((d) => Number(d?.dayOfWeek) === dayOfWeek)
  if (!today) return false
  if (today.enabled === false) return false
  const start = parseTimeToMinutes(today.start)
  const end = parseTimeToMinutes(today.end)
  if (start == null || end == null) return true
  if (end === start) return true
  if (end > start) return minutes >= start && minutes <= end
  // Overnight shift (e.g. 22:00 -> 06:00)
  return minutes >= start || minutes <= end
}

