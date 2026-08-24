export type TouristTaxStatus = "unpaid" | "paid"

export type WeddingTouristTax = {
  touristTaxStatus: TouristTaxStatus | ""
  touristTaxAmount: string
  touristTaxPaidDate: string
}

export const EMPTY_TOURIST_TAX: WeddingTouristTax = {
  touristTaxStatus: "",
  touristTaxAmount: "",
  touristTaxPaidDate: "",
}

export function parseTouristTaxStatus(raw: unknown): TouristTaxStatus | "" {
  const value = String(raw ?? "")
    .trim()
    .toLowerCase()
  if (value === "unpaid" || value === "paid") return value
  return ""
}

export const TOURIST_TAX_STATUS_LABELS: Record<TouristTaxStatus, string> = {
  unpaid: "Non versée",
  paid: "Versée",
}

export type TouristTaxEventRow = {
  id: number
  eventName: string
  couple: string
  eventType: "wedding" | "gite" | "other"
  eventDate: string
  touristTaxStatus: TouristTaxStatus | ""
  touristTaxAmount: string
  touristTaxPaidDate: string
}

export type TouristTaxMonthGroup = {
  monthKey: string
  monthLabel: string
  eventCount: number
  trackedCount: number
  paidCount: number
  unpaidCount: number
  untrackedCount: number
  paidAmount: number
  unpaidAmount: number
  totalAmount: number
  events: TouristTaxEventRow[]
}

export function isTouristTaxEventType(eventType: string): eventType is "wedding" | "gite" {
  return eventType === "wedding" || eventType === "gite"
}

export function parseTouristTaxAmount(raw: string | number | null | undefined): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.max(0, raw)
  const numeric = Number.parseFloat(
    String(raw ?? "")
      .replace(/[^\d,.-]/g, "")
      .replace(",", ".")
  )
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0
}

export function buildTouristTaxMonthGroups(
  rows: TouristTaxEventRow[],
  year: number
): TouristTaxMonthGroup[] {
  const map = new Map<string, TouristTaxEventRow[]>()

  for (const row of rows) {
    if (!isTouristTaxEventType(row.eventType)) continue
    const dateKey = row.eventDate.trim().slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) continue
    if (Number.parseInt(dateKey.slice(0, 4), 10) !== year) continue
    const monthKey = dateKey.slice(0, 7)
    const list = map.get(monthKey) ?? []
    list.push(row)
    map.set(monthKey, list)
  }

  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([monthKey, events]) => {
      const sorted = [...events].sort((a, b) => a.eventDate.localeCompare(b.eventDate))
      let paidCount = 0
      let unpaidCount = 0
      let untrackedCount = 0
      let paidAmount = 0
      let unpaidAmount = 0
      let totalAmount = 0

      for (const event of sorted) {
        const amount = parseTouristTaxAmount(event.touristTaxAmount)
        totalAmount += amount
        if (event.touristTaxStatus === "paid") {
          paidCount += 1
          paidAmount += amount
        } else if (event.touristTaxStatus === "unpaid") {
          unpaidCount += 1
          unpaidAmount += amount
        } else {
          untrackedCount += 1
        }
      }

      const [yearPart, monthPart] = monthKey.split("-").map(Number)
      const monthLabel = new Date(yearPart, monthPart - 1, 1).toLocaleDateString("fr-FR", {
        month: "long",
        year: "numeric",
      })

      return {
        monthKey,
        monthLabel: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
        eventCount: sorted.length,
        trackedCount: paidCount + unpaidCount,
        paidCount,
        unpaidCount,
        untrackedCount,
        paidAmount,
        unpaidAmount,
        totalAmount,
        events: sorted,
      }
    })
}
