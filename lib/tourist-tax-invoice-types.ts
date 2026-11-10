export type TouristTaxInvoiceStatus = "draft" | "sent" | "paid" | "cancelled"

export type TouristTaxOccupancyLine = {
  /** Nombre d'adultes majeurs (max 15). */
  adults: number
  /** Nombre de nuitées pour ce palier. */
  nights: number
}

export type TouristTaxInvoice = {
  id: string
  number: string
  weddingId: number
  couple: string
  status: TouristTaxInvoiceStatus
  periodStart: string
  periodEnd: string
  issuedAt: string
  paidAt: string
  paymentMethod: string
  lines: TouristTaxOccupancyLine[]
  amountTtc: number
  rate: number
  clientName: string
  clientAddress: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export type CreateTouristTaxInvoiceInput = {
  weddingId: number
  couple: string
  periodStart: string
  periodEnd: string
  lines: TouristTaxOccupancyLine[]
  issuedAt?: string
  paidAt?: string
  paymentMethod?: string
  clientName: string
  clientAddress?: string
  notes?: string
  status?: TouristTaxInvoiceStatus
  rate?: number
}

export type UpdateTouristTaxInvoiceInput = {
  lines?: TouristTaxOccupancyLine[]
  periodStart?: string
  periodEnd?: string
  issuedAt?: string
  paidAt?: string
  paymentMethod?: string
  clientName?: string
  clientAddress?: string
  notes?: string
  status?: TouristTaxInvoiceStatus
  amountTtc?: number
}

export const TOURIST_TAX_INVOICE_STATUS_LABELS: Record<TouristTaxInvoiceStatus, string> = {
  draft: "Brouillon",
  sent: "Envoyée",
  paid: "Payée",
  cancelled: "Annulée",
}
