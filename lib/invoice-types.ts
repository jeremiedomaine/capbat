export type InvoiceType = "deposit" | "balance" | "full"
export type InvoiceStatus = "draft" | "sent" | "paid" | "cancelled"

export type InvoiceParty = {
  name: string
  contactName?: string
  email: string
  phone?: string
  addressLine?: string
  postalCode?: string
  city?: string
  siret?: string
  vatNumber?: string
}

export type InvoiceLineItemKind = "standard" | "extra" | "discount"

export type InvoiceLineItem = {
  label: string
  quantity: number
  unitPrice: number
  kind?: InvoiceLineItemKind
}

export type Invoice = {
  id: string
  number: string
  weddingId: number
  couple: string
  type: InvoiceType
  status: InvoiceStatus
  issuedAt: string
  dueAt: string
  amountTtc: number
  vatRate: number
  lineItems: InvoiceLineItem[]
  issuer: InvoiceParty
  client: InvoiceParty
  notes?: string
  locked: boolean
  createdAt: string
  updatedAt: string
}

export type CreateInvoiceInput = {
  weddingId: number
  couple: string
  type: InvoiceType
  amountTtc: number
  lineItems: InvoiceLineItem[]
  issuer: InvoiceParty
  client: InvoiceParty
  issuedAt?: string
  dueAt?: string
  vatRate?: number
  notes?: string
  status?: InvoiceStatus
  locked?: boolean
}

export type UpdateInvoiceInput = {
  lineItems?: InvoiceLineItem[]
  amountTtc?: number
  issuedAt?: string
  dueAt?: string
  vatRate?: number
  notes?: string
  status?: InvoiceStatus
  client?: InvoiceParty
  locked?: boolean
}

export const INVOICE_TYPE_LABELS: Record<InvoiceType, string> = {
  deposit: "Facture d'acompte",
  balance: "Facture de solde",
  full: "Facture globale",
}

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Brouillon",
  sent: "Envoyée",
  paid: "Payée",
  cancelled: "Annulée",
}
