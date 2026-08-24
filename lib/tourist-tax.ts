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
