import type { InvoiceType } from "@/lib/invoice-types"

export function parseEuroAmount(value: string | number | null | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, value)
  if (value === null || value === undefined) return 0
  const numeric = Number.parseFloat(
    String(value).replace(/[^\d,.-]/g, "").replace(",", ".")
  )
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0
}

export function formatEuro(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatEuroDetailed(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function computeAmountHt(amountTtc: number, vatRate: number): number {
  if (vatRate <= 0) return amountTtc
  return amountTtc / (1 + vatRate / 100)
}

export function computeVatAmount(amountTtc: number, vatRate: number): number {
  if (vatRate <= 0) return 0
  return amountTtc - computeAmountHt(amountTtc, vatRate)
}

export function addCalendarDays(isoDate: string, days: number): string {
  const base = new Date(`${isoDate.slice(0, 10)}T12:00:00`)
  base.setDate(base.getDate() + days)
  return base.toISOString().slice(0, 10)
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

export function buildInvoiceNumber(existingNumbers: string[], year = new Date().getFullYear()): string {
  const prefix = `FAC-${year}-`
  const maxSeq = existingNumbers.reduce((max, num) => {
    if (!num.startsWith(prefix)) return max
    const seq = Number.parseInt(num.slice(prefix.length), 10)
    return Number.isFinite(seq) ? Math.max(max, seq) : max
  }, 0)
  return `${prefix}${String(maxSeq + 1).padStart(3, "0")}`
}

export function buildLineItemsForType(
  type: InvoiceType,
  couple: string,
  eventDate: string,
  depositAmount: number,
  balanceAmount: number
) {
  const eventLabel = eventDate ? ` — ${formatEventDate(eventDate)}` : ""
  if (type === "deposit") {
    return [
      {
        label: `Acompte — location pour mariage ${couple}${eventLabel}`,
        quantity: 1,
        unitPrice: depositAmount,
      },
    ]
  }
  if (type === "balance") {
    return [
      {
        label: `Solde — location pour mariage ${couple}${eventLabel}`,
        quantity: 1,
        unitPrice: balanceAmount,
      },
    ]
  }
  return [
    {
      label: `Prestation complète — mariage ${couple}${eventLabel}`,
      quantity: 1,
      unitPrice: depositAmount + balanceAmount,
    },
  ]
}

function formatEventDate(value: string) {
  const key = value.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return value
  const date = new Date(`${key}T12:00:00`)
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date)
}

export function lineItemsTotal(lineItems: { quantity: number; unitPrice: number }[]): number {
  return lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
}
