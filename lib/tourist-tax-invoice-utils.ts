import {
  clampAdults,
  computeTouristTaxLineTotal,
  formatTouristTaxRate,
  TOURIST_TAX_RATE_EUR,
} from "@/lib/tourist-tax"
import type { TouristTaxOccupancyLine } from "@/lib/tourist-tax-invoice-types"

export { clampAdults, computeTouristTaxLineTotal, formatTouristTaxRate, TOURIST_TAX_RATE_EUR }
export type { TouristTaxOccupancyLine }

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

export function formatEuroDetailed(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatLongFrDate(iso: string): string {
  const value = iso.trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return ""
  const date = new Date(`${value}T12:00:00`)
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date)
}

export function formatPeriodLabel(start: string, end: string): string {
  const from = formatLongFrDate(start)
  const to = formatLongFrDate(end)
  if (!from || !to) return ""
  return `Du ${from} au ${to}`
}

export function normalizeOccupancyLines(lines: TouristTaxOccupancyLine[]): TouristTaxOccupancyLine[] {
  return lines
    .map((line) => ({
      adults: clampAdults(Number(line.adults) || 0),
      nights: Math.max(0, Math.floor(Number(line.nights) || 0)),
    }))
    .filter((line) => line.adults > 0 && line.nights > 0)
}

export function occupancyLinesTotal(
  lines: TouristTaxOccupancyLine[],
  rate = TOURIST_TAX_RATE_EUR
): number {
  return normalizeOccupancyLines(lines).reduce(
    (sum, line) => sum + computeTouristTaxLineTotal(line.adults, line.nights, rate),
    0
  )
}

export function occupancyLineLabel(adults: number, rate = TOURIST_TAX_RATE_EUR): string {
  const n = clampAdults(adults)
  const noun = n > 1 ? "adultes" : "adulte"
  return `${n} ${noun} × ${formatTouristTaxRate(rate)} €`
}

export function occupancyUnitPrice(adults: number, rate = TOURIST_TAX_RATE_EUR): number {
  return computeTouristTaxLineTotal(adults, 1, rate)
}

export function buildTouristTaxInvoiceNumber(
  existingNumbers: string[],
  year = new Date().getFullYear()
): string {
  const prefix = `TDS-${year}-`
  const maxSeq = existingNumbers.reduce((max, num) => {
    if (!num.startsWith(prefix)) return max
    const seq = Number.parseInt(num.slice(prefix.length), 10)
    return Number.isFinite(seq) ? Math.max(max, seq) : max
  }, 0)
  return `${prefix}${String(maxSeq + 1).padStart(3, "0")}`
}
