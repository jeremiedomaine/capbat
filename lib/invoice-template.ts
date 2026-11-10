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
  /** @deprecated Le design est figé ; conservé pour les anciens enregistrements. */
  primaryColor: string
  /** @deprecated Remplacé par thankYouMessage. */
  footerText: string
  legalNotice: string
  defaultDueDays: number
  defaultVatRate: number
  depositLabel: string
  balanceLabel: string
  fullLabel: string
  catalog: InvoiceCatalogItem[]
  autoGenerateOnEventCreate: boolean
  tagline: string
  thankYouMessage: string
  signature: string
  bankIban: string
  bankBic: string
  bankHolder: string
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
  legalNotice: "TVA non applicable, art. 293 B du CGI.",
  defaultDueDays: 30,
  defaultVatRate: 10,
  depositLabel: "Acompte — {{event_type}} {{couple}} — {{date}}",
  balanceLabel: "Solde — {{event_type}} {{couple}} — {{date}}",
  fullLabel: "Prestation complète — {{event_type}} {{couple}} — {{date}}",
  catalog: [],
  autoGenerateOnEventCreate: true,
  tagline: "Réception & hébergement",
  thankYouMessage: "Merci de me confier ce jour si précieux.",
  signature: "",
  bankIban: "",
  bankBic: "",
  bankHolder: "",
}

/** Anciennes suggestions préremplies — retirées, on ne les réinjecte plus. */
const LEGACY_CATALOG_IDS = new Set(["extra-salle", "extra-bar", "discount"])

export function mergeInvoiceTemplate(
  partial: Partial<InvoiceTemplate> | null | undefined
): InvoiceTemplate {
  if (!partial) return { ...DEFAULT_INVOICE_TEMPLATE, catalog: [] }
  const catalog = Array.isArray(partial.catalog)
    ? partial.catalog.filter((item) => !LEGACY_CATALOG_IDS.has(item.id))
    : []
  return {
    ...DEFAULT_INVOICE_TEMPLATE,
    ...partial,
    catalog,
    // Cap'Bat : prestations à 10 %. L'ancien défaut 20 était incorrect.
    defaultVatRate:
      typeof partial.defaultVatRate === "number" && partial.defaultVatRate !== 20
        ? partial.defaultVatRate
        : 10,
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

const OTHER_LABELS: Record<InvoiceType, string> = {
  deposit: "Acompte — {{event_name}} — {{date}}",
  balance: "Solde — {{event_name}} — {{date}}",
  full: "Prestation — {{event_name}} — {{date}}",
}

export function labelTemplateForOccasion(
  type: InvoiceType,
  template: InvoiceTemplate,
  occasion: "wedding" | "other"
): string {
  if (occasion === "other") return OTHER_LABELS[type]
  if (type === "deposit") return template.depositLabel
  if (type === "balance") return template.balanceLabel
  return template.fullLabel
}

export function buildLineItemsFromTemplate(
  type: InvoiceType,
  context: InvoiceTemplateContext,
  template: InvoiceTemplate,
  depositAmount: number | string,
  balanceAmount: number | string,
  occasion: "wedding" | "other" = context.eventType === "wedding" ? "wedding" : "other"
): InvoiceLineItem[] {
  const deposit = parseEuroAmount(depositAmount)
  const balance = parseEuroAmount(balanceAmount)

  const labelTemplate = labelTemplateForOccasion(type, template, occasion)

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
