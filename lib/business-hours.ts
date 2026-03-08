/**
 * Business hours and "closed" state for tenant menu.
 * openingHours: [Sun, Mon, ..., Sat], each { open?: "HH:mm", close?: "HH:mm" }.
 * When a day has no opening and closing time set (both empty or missing), that day is closed
 * (e.g. B-Cafe Friday with no hours = closed Friday; catalog mode + banner with next open).
 * All times are evaluated in the business timezone (from business country) when provided.
 */

export type DayHours = { open?: string; close?: string; shifts?: { open?: string; close?: string }[] }

/** Map country code (e.g. IL, PS) to IANA timezone for "current time at business" and countdown. */
const COUNTRY_TIMEZONE: Record<string, string> = {
  IL: 'Asia/Jerusalem',
  PS: 'Asia/Gaza',
}

/** Resolve business country to IANA timezone. Returns undefined to use visitor's local time. */
export function getTimeZoneForCountry(countryCode: string | null | undefined): string | undefined {
  if (!countryCode || typeof countryCode !== 'string') return undefined
  const code = countryCode.trim().toUpperCase()
  return COUNTRY_TIMEZONE[code] ?? undefined
}

const DAY_NAMES_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY_NAMES_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

/** Sunday=0 .. Saturday=6 from Intl weekday (long). */
const WEEKDAY_TO_INDEX: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6,
}

export type NowInTz = { dayIndex: number; dateStr: string; nowMins: number; now: Date }

/** Get "now" in the business timezone (day of week, date YYYY-MM-DD, minutes since midnight). Exported for menu header (openingSoon/closesSoon). */
export function getNowInTimeZone(timeZone: string | undefined): NowInTz {
  const now = new Date()
  if (!timeZone) {
    return {
      dayIndex: now.getDay(),
      dateStr: now.toISOString().slice(0, 10),
      nowMins: now.getHours() * 60 + now.getMinutes(),
      now,
    }
  }
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      weekday: 'long',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    const parts = formatter.formatToParts(now)
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
    const weekday = get('weekday')
    const dayIndex = WEEKDAY_TO_INDEX[weekday] ?? now.getDay()
    const year = get('year')
    const month = get('month')
    const day = get('day')
    const dateStr = `${year}-${month}-${day}`
    const hour = parseInt(get('hour'), 10) || 0
    const minute = parseInt(get('minute'), 10) || 0
    const nowMins = hour * 60 + minute
    return { dayIndex, dateStr, nowMins, now }
  } catch {
    return {
      dayIndex: now.getDay(),
      dateStr: now.toISOString().slice(0, 10),
      nowMins: now.getHours() * 60 + now.getMinutes(),
      now,
    }
  }
}

/** Offset in ms: (time in TZ) - (time in UTC) for a given instant. So UTC + offset = TZ display. */
function getOffsetMs(date: Date, timeZone: string): number {
  try {
    const utc = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hour12: false })
    const tz = new Intl.DateTimeFormat('en-CA', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false })
    const utcParts = utc.formatToParts(date)
    const tzParts = tz.formatToParts(date)
    const getMins = (p: Intl.DateTimeFormatPart[]) => {
      const h = parseInt(p.find((x) => x.type === 'hour')?.value ?? '0', 10)
      const m = parseInt(p.find((x) => x.type === 'minute')?.value ?? '0', 10)
      return h * 60 + m
    }
    const diffMins = getMins(tzParts) - getMins(utcParts)
    return diffMins * 60 * 1000
  } catch {
    return 0
  }
}

/** Build a Date for (year, month, day, hour, minute) in the given timezone. */
function dateInTimeZone(
  year: number, month: number, day: number, hour: number, minute: number,
  timeZone: string | undefined
): Date {
  if (!timeZone) {
    return new Date(year, month - 1, day, hour, minute, 0, 0)
  }
  const utcCandidate = Date.UTC(year, month - 1, day, hour, minute, 0, 0)
  const d = new Date(utcCandidate)
  const offsetMs = getOffsetMs(d, timeZone)
  return new Date(utcCandidate - offsetMs)
}

/** Add days to YYYY-MM-DD and return { year, month, day }. */
function addDaysToDateStr(dateStr: string, days: number): { year: number; month: number; day: number } {
  const [y, m, d] = dateStr.split('-').map(Number)
  const d2 = new Date(y, m - 1, d + days)
  return { year: d2.getFullYear(), month: d2.getMonth() + 1, day: d2.getDate() }
}

function toMinutes(hm: string): number {
  if (!hm || !/^\d{1,2}:\d{2}$/.test(hm)) return -1
  const [h, m] = hm.split(':').map(Number)
  return h * 60 + m
}

export function getTodayActiveOrNextShift(todaysHours: DayHours | null, nowMins: number): { open: string; close: string } | null {
  if (!todaysHours) return null
  if (todaysHours.shifts && todaysHours.shifts.length > 0) {
    const sortedShifts = [...todaysHours.shifts]
      .filter(s => toMinutes(s.open ?? '') >= 0)
      .sort((a, b) => toMinutes(a.open ?? '') - toMinutes(b.open ?? ''))
    
    // Find currently active shift
    const activeShift = sortedShifts.find(s => isWithinShift(s.open, s.close, nowMins))
    if (activeShift) return { open: activeShift.open ?? '', close: activeShift.close ?? '' }
    
    // Or next upcoming shift today
    const nextShift = sortedShifts.find(s => toMinutes(s.open ?? '') > nowMins)
    if (nextShift) return { open: nextShift.open ?? '', close: nextShift.close ?? '' }
    return null
  }
  return { open: todaysHours.open ?? '', close: todaysHours.close ?? '' }
}

export function isWithinShift(open: string | undefined, close: string | undefined, nowMins: number): boolean {
  if (!open && !close) return false
  const openMins = toMinutes(open ?? '')
  const closeMins = toMinutes(close ?? '')
  if (openMins < 0) return false
  if (closeMins < 0) return nowMins >= openMins
  if (closeMins > openMins) return nowMins >= openMins && nowMins < closeMins
  return nowMins >= openMins || nowMins < closeMins
}

/** Get today's hours from openingHours (index 0=Sun) and optional customDateHours (date string YYYY-MM-DD). Uses business timezone when provided. */
export function getTodaysHours(
  openingHours: DayHours[] | null | undefined,
  customDateHours: Array<{ date?: string; open?: string; close?: string; shifts?: { open?: string; close?: string }[] }> | null | undefined,
  timeZone?: string
): DayHours | null {
  const { dayIndex, dateStr } = getNowInTimeZone(timeZone)
  const custom = customDateHours?.find((c) => c.date === dateStr)
  if (custom && (custom.open || custom.close || (custom.shifts && custom.shifts.length > 0))) {
    return { open: custom.open ?? '', close: custom.close ?? '', shifts: custom.shifts }
  }
  const day = openingHours?.[dayIndex]
  if (!day) return null
  const hasHours = (typeof day.open === 'string' && /^\d{1,2}:\d{2}$/.test(day.open.trim())) ||
    (typeof day.close === 'string' && /^\d{1,2}:\d{2}$/.test(day.close.trim()))
  const hasShifts = Array.isArray(day.shifts) && day.shifts.length > 0
  if (!hasHours && !hasShifts) return null
  return { open: day.open ?? '', close: day.close ?? '', shifts: day.shifts }
}

/** True if current time is within today's open/close (in business timezone when provided). Handles close after midnight (e.g. close 02:00). */
export function isWithinHours(todaysHours: DayHours | null, timeZone?: string): boolean {
  if (!todaysHours) return false
  const { nowMins } = getNowInTimeZone(timeZone)
  if (todaysHours.shifts && todaysHours.shifts.length > 0) {
    return todaysHours.shifts.some(shift => isWithinShift(shift.open, shift.close, nowMins))
  }
  return isWithinShift(todaysHours.open, todaysHours.close, nowMins)
}

/** Find next day (starting from tomorrow) that has opening hours. Returns day index 0-6 and open time. */
function getNextOpenDay(
  openingHours: DayHours[] | null | undefined,
  fromDayIndex: number,
  fromMins: number
): { dayIndex: number; open: string } | null {
  if (!openingHours || openingHours.length < 7) return null
  for (let i = 1; i <= 7; i++) {
    const dayIndex = (fromDayIndex + i) % 7
    const day = openingHours[dayIndex]
    if (day?.shifts && day.shifts.length > 0) {
      const validShift = day.shifts.find(s => s.open && /^\d{1,2}:\d{2}$/.test(s.open))
      if (validShift?.open) return { dayIndex, open: validShift.open }
    }
    if (day?.open && /^\d{1,2}:\d{2}$/.test(day.open)) return { dayIndex, open: day.open }
  }
  return null
}

export type ClosedReason = 'manual' | 'closed_today' | 'before_open' | 'after_close'

export type NextOpening = {
  closedReason: ClosedReason
  nextOpenAt: Date | null
  messageEn: string
  messageAr: string
  /** Short label for countdown e.g. "Opens Saturday at 10:00 AM" */
  nextOpenLabelEn: string
  nextOpenLabelAr: string
}

/** Compute why we're closed and when we open next. Call when business is closed (manual or schedule). Uses business timezone when provided. */
export function getNextOpening(
  isManuallyClosed: boolean,
  deactivateUntil: string | null | undefined,
  todaysHours: DayHours | null,
  openingHours: DayHours[] | null | undefined,
  lang: string,
  timeZone?: string
): NextOpening {
  const { now, dayIndex, nowMins, dateStr } = getNowInTimeZone(timeZone)
  const formatTime = (hm: string) => {
    if (!hm || !/^\d{1,2}:\d{2}$/.test(hm)) return hm
    const [h, m] = hm.split(':').map(Number)
    const h12 = h % 12 || 12
    const ampm = h < 12 ? (lang === 'ar' ? 'ص' : 'AM') : (lang === 'ar' ? 'م' : 'PM')
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
  }
  const dayName = (i: number) => (lang === 'ar' ? DAY_NAMES_AR[i] : DAY_NAMES_EN[i])
  const tomorrow = (i: number) => (i === (dayIndex + 1) % 7 ? (lang === 'ar' ? 'غداً' : 'tomorrow') : dayName(i))

  if (isManuallyClosed && deactivateUntil) {
    const d = new Date(deactivateUntil)
    const dateLabel = d.toLocaleDateString(lang === 'ar' ? 'ar' : 'en-GB', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      hour: '2-digit',
      minute: '2-digit',
    })
    return {
      closedReason: 'manual',
      nextOpenAt: d,
      messageEn: `We are closed. We will open again on ${dateLabel}.`,
      messageAr: `نحن مغلقون. سنفتح مرة أخرى في ${dateLabel}.`,
      nextOpenLabelEn: `Opens ${dateLabel}`,
      nextOpenLabelAr: `يفتح ${dateLabel}`,
    }
  }

  if (isManuallyClosed) {
    return {
      closedReason: 'manual',
      nextOpenAt: null,
      messageEn: 'We are closed. Opening time will be announced.',
      messageAr: 'نحن مغلقون. سيتم الإعلان عن وقت الافتتاح.',
      nextOpenLabelEn: 'Closed',
      nextOpenLabelAr: 'مغلق',
    }
  }

  if (!todaysHours) {
    const next = getNextOpenDay(openingHours, dayIndex, nowMins)
    if (!next) {
      return {
        closedReason: 'closed_today',
        nextOpenAt: null,
        messageEn: `Today is ${dayName(dayIndex)} and we're closed. Check back later.`,
        messageAr: `اليوم ${dayName(dayIndex)} ونحن مغلقون. تحقق لاحقاً.`,
        nextOpenLabelEn: 'Closed today',
        nextOpenLabelAr: 'مغلق اليوم',
      }
    }
    let daysToAdd = (next.dayIndex - dayIndex + 7) % 7
    if (daysToAdd === 0) daysToAdd = 7
    const { year, month, day } = addDaysToDateStr(dateStr, daysToAdd)
    const [h, m] = next.open.split(':').map(Number)
    const nextOpenAt = dateInTimeZone(year, month, day, h, m, timeZone)
    const timeStr = formatTime(next.open)
    const nextDayLabel = tomorrow(next.dayIndex)
    return {
      closedReason: 'closed_today',
      nextOpenAt,
      messageEn: `Today is ${dayName(dayIndex)} and we're closed. We open again ${nextDayLabel} at ${timeStr}.`,
      messageAr: `اليوم ${dayName(dayIndex)} ونحن مغلقون. نفتح مرة أخرى ${nextDayLabel} الساعة ${timeStr}.`,
      nextOpenLabelEn: `Opens ${nextDayLabel} at ${timeStr}`,
      nextOpenLabelAr: `يفتح ${nextDayLabel} الساعة ${timeStr}`,
    }
  }

  let nextOpenStr = ''
  if (todaysHours?.shifts && todaysHours.shifts.length > 0) {
    const sortedShifts = [...todaysHours.shifts]
      .filter(s => toMinutes(s.open ?? '') >= 0)
      .sort((a, b) => toMinutes(a.open ?? '') - toMinutes(b.open ?? ''))
    const nextShift = sortedShifts.find(s => toMinutes(s.open ?? '') > nowMins)
    if (nextShift) nextOpenStr = nextShift.open ?? ''
  } else if (todaysHours?.open) {
    const openMins = toMinutes(todaysHours.open)
    if (openMins >= 0 && nowMins < openMins) {
      nextOpenStr = todaysHours.open
    }
  }

  if (nextOpenStr) {
    const openF = formatTime(nextOpenStr)
    const [y, mo, d] = dateStr.split('-').map(Number)
    const [h, m] = nextOpenStr.split(':').map(Number)
    const nextOpenAt = dateInTimeZone(y, mo, d, h, m, timeZone)
    return {
      closedReason: 'before_open',
      nextOpenAt,
      messageEn: `We're closed. We open today at ${openF}.`,
      messageAr: `نحن مغلقون. نفتح اليوم الساعة ${openF}.`,
      nextOpenLabelEn: `Opens today at ${openF}`,
      nextOpenLabelAr: `يفتح اليوم الساعة ${openF}`,
    }
  }

  const next = getNextOpenDay(openingHours, dayIndex, nowMins)
  if (!next) {
    const fallbackOpenF = formatTime(todaysHours?.open || '')
    return {
      closedReason: 'after_close',
      nextOpenAt: null,
      messageEn: `We're closed. We open again tomorrow${fallbackOpenF ? ` at ${fallbackOpenF}` : ''}.`,
      messageAr: `نحن مغلقون. نفتح غداً${fallbackOpenF ? ` الساعة ${fallbackOpenF}` : ''}.`,
      nextOpenLabelEn: `Opens tomorrow${fallbackOpenF ? ` at ${fallbackOpenF}` : ''}`,
      nextOpenLabelAr: `يفتح غداً${fallbackOpenF ? ` الساعة ${fallbackOpenF}` : ''}`,
    }
  }
  let daysToAdd = (next.dayIndex - dayIndex + 7) % 7
  if (daysToAdd === 0) daysToAdd = 7
  const { year, month, day } = addDaysToDateStr(dateStr, daysToAdd)
  const [h, m] = next.open.split(':').map(Number)
  const nextOpenAt = dateInTimeZone(year, month, day, h, m, timeZone)
  const timeStr = formatTime(next.open)
  const nextDayLabel = tomorrow(next.dayIndex)
  return {
    closedReason: 'after_close',
    nextOpenAt,
    messageEn: `We're closed. We open again ${nextDayLabel} at ${timeStr}.`,
    messageAr: `نحن مغلقون. نفتح مرة أخرى ${nextDayLabel} الساعة ${timeStr}.`,
    nextOpenLabelEn: `Opens ${nextDayLabel} at ${timeStr}`,
    nextOpenLabelAr: `يفتح ${nextDayLabel} الساعة ${timeStr}`,
  }
}

/** Format remaining time for countdown (e.g. "2h 15m" or "Opens in 2 hours"). */
export function formatCountdown(until: Date, lang: string): string {
  const now = new Date()
  const ms = until.getTime() - now.getTime()
  if (ms <= 0) return lang === 'ar' ? 'يفتح قريباً' : 'Opening soon'
  const totalMins = Math.floor(ms / 60000)
  const hours = Math.floor(totalMins / 60)
  const mins = totalMins % 60
  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    return lang === 'ar' ? `بعد ${days} يوم` : `${days}d`
  }
  if (hours > 0 && mins > 0) return lang === 'ar' ? `${hours} س ${mins} د` : `${hours}h ${mins}m`
  if (hours > 0) return lang === 'ar' ? `${hours} ساعة` : `${hours}h`
  return lang === 'ar' ? `${mins} دقيقة` : `${mins}m`
}
