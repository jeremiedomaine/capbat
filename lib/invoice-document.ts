import { buildIssuerFromSettings } from "@/lib/invoice-issuer"
import { mergeInvoiceTemplate } from "@/lib/invoice-template"
import type { Invoice, InvoiceLineItem, InvoiceOccasion, InvoiceParty } from "@/lib/invoice-types"
import { parseInvoiceOccasion } from "@/lib/invoice-types"
import {
  computeAmountHt,
  computeVatAmount,
  lineItemsTotal,
} from "@/lib/invoice-utils"
import type { Wedding } from "@/lib/weddings-store"
import type { WorkspaceSettings } from "@/lib/workspace-settings"

/** Données d'une facture affichée (aperçu écran et PDF partagent ce modèle). */
export type InvoiceDocumentModel = {
  occasion: InvoiceOccasion
  title: string
  titleAccent: string
  number: string
  issuedLabel: string
  dueLabel: string
  issuer: {
    name: string
    tagline: string
    lines: string[]
    footerLine: string
  }
  client: {
    name: string
    lines: string[]
  }
  lines: Array<{
    label: string
    description?: string
    periodLabel?: string
    quantity: number
    unitPrice: number
    total: number
    isDiscount: boolean
  }>
  vatRate: number
  amountHt: number
  vatAmount: number
  amountTtc: number
  /** Texte d'échéance / référence, sans imposer un mode de paiement. */
  paymentText: string
  bank: { iban: string; bic: string; holder: string } | null
  notes: string
  thanks: { message: string; signature: string }
  legalLines: string[]
}

const OTHER_TAGLINE = "Location & événements"
const OTHER_THANKS = "Merci pour votre confiance."
const WEDDING_THANKS_FALLBACK = "Merci de me confier ce jour si précieux."

export type InvoiceDocumentWedding = Pick<
  Wedding,
  "eventType" | "eventName" | "couple" | "eventDate" | "deposit" | "balance"
>

export type InvoiceDocumentDraft = Pick<
  Invoice,
  | "type"
  | "number"
  | "status"
  | "locked"
  | "issuedAt"
  | "dueAt"
  | "vatRate"
  | "lineItems"
  | "client"
  | "issuer"
> & { notes?: string; occasion?: InvoiceOccasion }

const VAT_EXEMPT_NOTICE = "TVA non applicable, art. 293 B du CGI."

const TITLE_ACCENTS: Record<Invoice["type"], string> = {
  deposit: "d'acompte",
  balance: "de solde",
  full: "",
}

/** Brouillon non verrouillé : coordonnées de Paramètres ; sinon l'instantané enregistré. */
export function resolveInvoiceIssuer(
  invoice: Pick<Invoice, "status" | "locked" | "issuer">,
  settings: WorkspaceSettings
): InvoiceParty {
  if (invoice.status === "draft" && !invoice.locked) return buildIssuerFromSettings(settings)
  return invoice.issuer
}

export function buildInvoiceDocument(params: {
  invoice: InvoiceDocumentDraft
  wedding: InvoiceDocumentWedding | null
  settings: WorkspaceSettings
}): InvoiceDocumentModel {
  const { invoice, wedding, settings } = params
  const template = mergeInvoiceTemplate(settings.invoiceTemplate)
  const issuer = resolveInvoiceIssuer(invoice, settings)
  const issuerCity = prettifyCity(issuer.city)
  const issuerPostalCity = [issuer.postalCode, issuerCity].filter(Boolean).join(" ")

  const occasion = resolveInvoiceOccasion(invoice, wedding)
  const isOther = occasion === "other"

  const amountTtc = lineItemsTotal(invoice.lineItems)
  const vatRate = invoice.vatRate
  const lines = invoice.lineItems.map((item) => toDocumentLine(item))

  const client = invoice.client
  const clientPostalCity = [client.postalCode, prettifyCity(client.city)].filter(Boolean).join(" ")
  const clientContact = [client.email, formatPhone(client.phone)].filter(Boolean).join(" · ")

  const dueLabel = formatLongDate(invoice.dueAt)
  const bank = template.bankIban.trim()
    ? {
        iban: formatIban(template.bankIban),
        bic: template.bankBic.trim().toUpperCase(),
        holder: template.bankHolder.trim() || issuer.name,
      }
    : null

  const weddingThanks = template.thankYouMessage.trim() || WEDDING_THANKS_FALLBACK
  const tagline = isOther ? OTHER_TAGLINE : template.tagline.trim()
  const thanksMessage = isOther ? OTHER_THANKS : weddingThanks

  return {
    occasion,
    title: "Facture",
    titleAccent: TITLE_ACCENTS[invoice.type],
    number: invoice.number,
    issuedLabel: formatLongDate(invoice.issuedAt),
    dueLabel,
    issuer: {
      name: issuer.name,
      tagline,
      lines: [issuer.addressLine, issuerPostalCity, issuer.email, formatPhone(issuer.phone)].filter(
        (line): line is string => Boolean(line?.trim())
      ),
      footerLine: [
        issuer.name,
        [issuer.addressLine, issuerPostalCity].filter(Boolean).join(", "),
        issuer.siret ? `SIRET ${formatSiret(issuer.siret)}` : null,
        issuer.vatNumber ? `TVA ${issuer.vatNumber}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
    },
    client: {
      name: client.name,
      lines: [
        client.contactName && client.contactName !== client.name
          ? `À l'attention de ${client.contactName}`
          : null,
        client.addressLine,
        clientPostalCity,
        clientContact,
      ].filter((line): line is string => Boolean(line?.trim())),
    },
    lines,
    vatRate,
    amountHt: computeAmountHt(amountTtc, vatRate),
    vatAmount: computeVatAmount(amountTtc, vatRate),
    amountTtc,
    paymentText: `Échéance le ${dueLabel}. Merci d'indiquer la référence ${invoice.number}.`,
    bank,
    notes: invoice.notes?.trim() ?? "",
    thanks: {
      message: thanksMessage,
      signature: template.signature.trim() || settings.managerName.trim(),
    },
    legalLines: buildLegalLines(template.legalNotice, vatRate),
  }
}

function resolveInvoiceOccasion(
  invoice: InvoiceDocumentDraft,
  wedding: InvoiceDocumentWedding | null
): InvoiceOccasion {
  if (invoice.occasion) return parseInvoiceOccasion(invoice.occasion)
  if (wedding?.eventType && wedding.eventType !== "wedding") return "other"
  return "wedding"
}

function toDocumentLine(item: InvoiceLineItem): InvoiceDocumentModel["lines"][number] {
  const total = item.quantity * item.unitPrice
  return {
    label: item.label,
    description: item.description?.trim() || undefined,
    periodLabel: formatPeriodLabel(item.periodStart, item.periodEnd),
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    total,
    isDiscount: item.kind === "discount" || item.unitPrice < 0,
  }
}

export function formatPeriodLabel(start?: string, end?: string): string | undefined {
  const from = start?.trim().slice(0, 10)
  const to = end?.trim().slice(0, 10)
  if (!from && !to) return undefined
  if (from && to) {
    if (from === to) return `Le ${formatLongDate(from)}`
    return `Du ${formatLongDate(from)} au ${formatLongDate(to)}`
  }
  if (from) return `À partir du ${formatLongDate(from)}`
  return `Jusqu'au ${formatLongDate(to!)}`
}

function buildLegalLines(legalNotice: string, vatRate: number): string[] {
  let notice = legalNotice.trim()
  // Capucine ne veut pas ces mentions en pied de page.
  notice = notice
    .replace(/Paiement par virement bancaire[^.]*\.?/gi, "")
    .replace(/Paiement sous\s+\d+\s+jours\.?/gi, "")
    .replace(/En cas de retard de paiement[^.]*\.?/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim()
  if (vatRate > 0) {
    notice = notice.replace(/\s*TVA non applicable(?:,?\s*art\.)?[^.]*\.?/i, "").trim()
  }
  const lines = [notice]
  if (vatRate <= 0 && !/293\s*B/i.test(notice)) lines.push(VAT_EXEMPT_NOTICE)
  return lines.filter(Boolean)
}

export function formatLongDate(iso: string, withWeekday = false): string {
  const key = iso.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return iso
  const [year, month, day] = key.split("-").map(Number)
  return new Intl.DateTimeFormat("fr-FR", {
    ...(withWeekday ? { weekday: "long" as const } : {}),
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, day, 12))
}

export function formatEuroDocument(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(amount)
    .replace(/\u202f/g, "\u00a0")
}

function prettifyCity(raw?: string): string {
  const value = raw?.trim() ?? ""
  if (!value || value !== value.toUpperCase()) return value
  return value
    .toLowerCase()
    .replace(/(^|[\s-])(\p{L})/gu, (_, sep: string, letter: string) => sep + letter.toUpperCase())
}

function formatPhone(raw?: string): string {
  const value = raw?.trim() ?? ""
  const digits = value.replace(/[\s.-]/g, "")
  if (/^0\d{9}$/.test(digits)) return digits.replace(/(\d{2})(?=\d)/g, "$1 ")
  return value
}

function formatIban(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase().replace(/(.{4})/g, "$1 ").trim()
}

function formatSiret(raw: string): string {
  const digits = raw.replace(/\s+/g, "")
  if (!/^\d{14}$/.test(digits)) return raw.trim()
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`
}
