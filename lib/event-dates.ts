export function parseEventDate(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number)
    return new Date(year, month - 1, day)
  }
  return new Date(value)
}

/** YYYY-MM-DD au calendrier local. */
export function getTodayCalendarIsoKey(reference = new Date()): string {
  const d = new Date(reference)
  d.setHours(12, 0, 0, 0)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function resolveEventDateKey(raw: string): string | null {
  const trimmed = raw.trim()
  const head = trimmed.slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(head)) return head
  const d = parseEventDate(trimmed)
  if (Number.isNaN(d.getTime())) return null
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function getEventYear(raw: string): number | null {
  const key = resolveEventDateKey(raw)
  if (!key) return null
  return Number.parseInt(key.slice(0, 4), 10)
}

export function extractEventYears(rows: { eventDate: string }[]): number[] {
  const years = new Set<number>()
  for (const row of rows) {
    const year = getEventYear(row.eventDate)
    if (year !== null) years.add(year)
  }
  return [...years].sort((a, b) => b - a)
}

export function pickDefaultSeasonYear(
  years: number[],
  referenceYear = new Date().getFullYear()
): number {
  if (years.length === 0) return referenceYear
  const sorted = [...years].sort((a, b) => a - b)
  if (sorted.includes(referenceYear)) return referenceYear
  const next = sorted.find((year) => year >= referenceYear)
  if (next !== undefined) return next
  return sorted[sorted.length - 1]!
}

export function isUpcomingEvent(
  eventDate: string,
  todayKey = getTodayCalendarIsoKey()
): boolean {
  const key = resolveEventDateKey(eventDate)
  return key !== null && key >= todayKey
}

export function formatEventDateFr(value: string): string {
  const key = resolveEventDateKey(value)
  if (!key) return value
  const [year, month, day] = key.split("-").map(Number)
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, day))
}

/** Clé YYYY-MM pour regrouper la liste par mois. */
export function getEventMonthKey(raw: string): string | null {
  const key = resolveEventDateKey(raw)
  if (!key) return null
  return key.slice(0, 7)
}

export function formatEventMonthFr(monthKey: string): string {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) return monthKey
  const [year, month] = monthKey.split("-").map(Number)
  const label = new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1))
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export type EventMonthGroup<T extends { eventDate: string }> = {
  monthKey: string
  monthLabel: string
  events: T[]
}

export function groupEventsByMonth<T extends { eventDate: string }>(
  rows: T[]
): EventMonthGroup<T>[] {
  const map = new Map<string, T[]>()
  for (const row of rows) {
    const key = getEventMonthKey(row.eventDate) ?? "sans-date"
    const bucket = map.get(key)
    if (bucket) bucket.push(row)
    else map.set(key, [row])
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, events]) => ({
      monthKey,
      monthLabel: monthKey === "sans-date" ? "Sans date" : formatEventMonthFr(monthKey),
      events,
    }))
}
