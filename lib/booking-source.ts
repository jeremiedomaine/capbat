/** Canal d'origine de la réservation (Capucine : remplissage vs facturation Cap'Bat). */

export type BookingSource = "direct" | "platform"

export const BOOKING_SOURCES: BookingSource[] = ["direct", "platform"]

export const BOOKING_SOURCE_LABELS: Record<BookingSource, string> = {
  direct: "Direct / organique",
  platform: "Plateforme (Airbnb…)",
}

export const BOOKING_SOURCE_HINTS: Record<BookingSource, string> = {
  direct: "Facturation et taxe de séjour gérées dans Cap'Bat.",
  platform:
    "Comptée dans le planning / remplissage uniquement. Pas de facture ni de taxe de séjour ici (gérées par la plateforme).",
}

export function parseBookingSource(raw: unknown): BookingSource {
  const value = String(raw ?? "")
    .trim()
    .toLowerCase()
  if (
    value === "platform" ||
    value === "plateforme" ||
    value === "airbnb" ||
    value === "booking" ||
    value === "third_party" ||
    value === "tiers"
  ) {
    return "platform"
  }
  return "direct"
}

export function isBookingSource(value: string): value is BookingSource {
  return BOOKING_SOURCES.includes(value as BookingSource)
}

/** Réservation gérée hors Cap'Bat (Airbnb, etc.). */
export function isPlatformBooking(source: BookingSource | "" | null | undefined): boolean {
  return parseBookingSource(source) === "platform"
}

/** Factures + taxe de séjour Cap'Bat applicables. */
export function supportsCapBatBilling(source: BookingSource | "" | null | undefined): boolean {
  return !isPlatformBooking(source)
}

export function getBookingSourceBadgeClass(source: BookingSource): string {
  return source === "platform"
    ? "border-violet-200 bg-violet-50 text-violet-700"
    : "border-emerald-200 bg-emerald-50 text-emerald-700"
}
