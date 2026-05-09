/** Fenêtre d’exécution du cron Vercel (minutes) — doit correspondre à `vercel.json`. */
export const AUTOMATION_CRON_POLL_MINUTES = 10

export function getAutomationTimezone() {
  return process.env.AUTOMATION_TIMEZONE?.trim() || "Europe/Paris"
}

export function getZonedCalendarDateAndMinutes(timeZone: string, instant = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
  const parts = fmt.formatToParts(instant)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? ""
  const calendarDate = `${get("year")}-${get("month")}-${get("day")}`
  const minutesFromMidnight = Number(get("hour")) * 60 + Number(get("minute"))
  return { calendarDate, minutesFromMidnight }
}

export function parseSendTimeMinutes(sendTime: string): number | null {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(sendTime.trim())
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

/** Vrai si l’instant courant est dans [sendTime, sendTime + pollWindowMinutes) selon le fuseau. */
export function shouldRunScheduledSend(
  sendTime: string,
  opts: { timeZone: string; pollWindowMinutes: number; instant?: Date }
): { run: boolean; calendarDate: string; targetMinutes: number; nowMinutes: number } {
  const { calendarDate, minutesFromMidnight: nowMinutes } = getZonedCalendarDateAndMinutes(
    opts.timeZone,
    opts.instant
  )
  const targetMinutes = parseSendTimeMinutes(sendTime)
  if (targetMinutes === null) {
    return { run: false, calendarDate, targetMinutes: 0, nowMinutes }
  }
  const w = opts.pollWindowMinutes
  const run = nowMinutes >= targetMinutes && nowMinutes < targetMinutes + w
  return { run, calendarDate, targetMinutes, nowMinutes }
}

/**
 * Ajoute des jours civils dans un fuseau (ex. J+30 pour la date cible des relances).
 */
export function addCalendarDaysInTimeZone(timeZone: string, dayDelta: number, instant = new Date()): string {
  if (dayDelta === 0) {
    return getZonedCalendarDateAndMinutes(timeZone, instant).calendarDate
  }
  const sign = dayDelta > 0 ? 1 : -1
  let n = Math.abs(dayDelta)
  let t = instant.getTime()
  let prevCal = getZonedCalendarDateAndMinutes(timeZone, new Date(t)).calendarDate
  while (n > 0) {
    t += sign * 86_400_000
    const cur = getZonedCalendarDateAndMinutes(timeZone, new Date(t)).calendarDate
    if (cur !== prevCal) {
      n -= 1
      prevCal = cur
    }
  }
  return getZonedCalendarDateAndMinutes(timeZone, new Date(t)).calendarDate
}
