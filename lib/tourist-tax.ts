/** Taxe de séjour Cap'Bat — constantes + suivi versement sur la fiche événement. */

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

/** Tarif agglo Cap'Bat (classement 3★). */
export const TOURIST_TAX_RATE_EUR = 1.52
/** Capacité max du gîte. */
export const TOURIST_TAX_MAX_ADULTS = 15

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

/** Nuitées = jours entre arrivée (incluse) et départ (exclue). */
export function countStayNights(arrivalIso: string, departureIso: string): number {
  const from = arrivalIso.trim().slice(0, 10)
  const to = departureIso.trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return 0
  const start = new Date(`${from}T12:00:00`)
  const end = new Date(`${to}T12:00:00`)
  const diff = Math.round((end.getTime() - start.getTime()) / 86_400_000)
  return Math.max(0, diff)
}

export function clampAdults(adults: number): number {
  if (!Number.isFinite(adults)) return 0
  return Math.min(TOURIST_TAX_MAX_ADULTS, Math.max(0, Math.floor(adults)))
}

export function roundEuro2(amount: number): number {
  return Math.round(amount * 100) / 100
}

export function computeTouristTaxLineTotal(adults: number, nights: number, rate = TOURIST_TAX_RATE_EUR): number {
  return roundEuro2(clampAdults(adults) * Math.max(0, nights) * rate)
}

export function formatTouristTaxRate(rate = TOURIST_TAX_RATE_EUR): string {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rate)
}
