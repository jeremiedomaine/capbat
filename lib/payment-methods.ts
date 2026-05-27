export type PaymentMethod = "virement" | "cheque" | "especes" | "carte" | "autre"

export const PAYMENT_METHOD_OPTIONS: PaymentMethod[] = [
  "virement",
  "cheque",
  "especes",
  "carte",
  "autre",
]

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  virement: "Virement",
  cheque: "Chèque",
  especes: "Espèces",
  carte: "Carte bancaire",
  autre: "Autre",
}

export function parsePaymentMethod(raw: unknown): PaymentMethod | "" {
  const value = String(raw ?? "")
    .trim()
    .toLowerCase()
  if (PAYMENT_METHOD_OPTIONS.includes(value as PaymentMethod)) {
    return value as PaymentMethod
  }
  return ""
}

export function formatPaymentMethodLabel(method: PaymentMethod | ""): string {
  if (!method) return "—"
  return PAYMENT_METHOD_LABELS[method]
}
