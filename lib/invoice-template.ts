import type { EventType } from "@/lib/event-types"
import { EVENT_TYPE_LABELS } from "@/lib/event-types"
import type { InvoiceLineItem, InvoiceType } from "@/lib/invoice-types"
import { parseEuroAmount } from "@/lib/invoice-utils"

export type InvoiceCatalogKind = "extra" | "discount"

export type InvoiceCatalogItem = {
  id: string
  label: string
  unitPrice: number
  kind: InvoiceCatalogKind
}

export type InvoiceTemplate = {
  primaryColor: string
  footerText: string
  legalNotice: string
  defaultDueDays: number
  defaultVatRate: number
  depositLabel: string
  balanceLabel: string
  fullLabel: string
  catalog: InvoiceCatalogItem[]
  autoGenerateOnEventCreate: boolean
}

export type InvoiceTemplateContext = {
  couple: string
  eventDate: string
  eventType: EventType
  eventName?: string
}

export const DEFAULT_INVOICE_TEMPLATE: InvoiceTemplate = {
  primaryColor: "#1e40af",
  footerText: "",
  legalNotice: "Paiement par virement bancaire sous 30 jours. TVA non applicable, art. 293 B du CGI.",
  defaultDueDays: 30,
  defaultVatRate: 20,
  depositLabel: "Acompte — {{event_type}} {{couple}} — {{date}}",
  balanceLabel: "Solde — {{event_type}} {{couple}} — {{date}}",
  fullLabel: "Prestation complète — {{event_type}} {{couple}} — {{date}}",
  catalog: [
    { id: "extra-salle", label: "Location salle supplémentaire", unitPrice: 500, kind: "extra" },
    { id: "extra-bar", label: "Bar à vin", unitPrice: 800, kind: "extra" },
    { id: "discount", label: "Remise commerciale", unitPrice: -200, kind: "discount" },
  ],
  autoGenerateOnEventCreate: true,
}

export function mergeInvoiceTemplate(
  partial: Partial<InvoiceTemplate> | null | undefined
): InvoiceTemplate {
  if (!partial) return { ...DEFAULT_INVOICE_TEMPLATE, catalog: [...DEFAULT_INVOICE_TEMPLATE.catalog] }
  return {
    ...DEFAULT_INVOICE_TEMPLATE,
    ...partial,
    catalog: partial.catalog?.length ? partial.catalog : [...DEFAULT_INVOICE_TEMPLATE.catalog],
  }
}

export function applyInvoiceTemplateVars(
  template: string,
  context: InvoiceTemplateContext
): string {
  const eventTypeLabel = EVENT_TYPE_LABELS[context.eventType] ?? context.eventType
  const dateLabel = formatEventDateLabel(context.eventDate)
  return template
    .replaceAll("{{couple}}", context.couple)
    .replaceAll("{{date}}", dateLabel)
    .replaceAll("{{event_type}}", eventTypeLabel.toLowerCase())
    .replaceAll("{{event_name}}", context.eventName?.trim() || context.couple)
}

export function buildLineItemsFromTemplate(
  type: InvoiceType,
  context: InvoiceTemplateContext,
  template: InvoiceTemplate,
  depositAmount: number | string,
  balanceAmount: number | string
): InvoiceLineItem[] {
  const deposit = parseEuroAmount(depositAmount)
  const balance = parseEuroAmount(balanceAmount)

  const labelTemplate =
    type === "deposit"
      ? template.depositLabel
      : type === "balance"
        ? template.balanceLabel
        : template.fullLabel

  const amount =
    type === "deposit" ? deposit : type === "balance" ? balance : deposit + balance

  return [
    {
      label: applyInvoiceTemplateVars(labelTemplate, context),
      quantity: 1,
      unitPrice: amount,
      kind: "standard",
    },
  ]
}

function formatEventDateLabel(value: string) {
  const key = value.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return value
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${key}T12:00:00`))
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.trim().replace("#", "")
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16) / 255,
    g: Number.parseInt(normalized.slice(2, 4), 16) / 255,
    b: Number.parseInt(normalized.slice(4, 6), 16) / 255,
  }
}
