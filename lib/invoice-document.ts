import { EVENT_TYPE_LABELS } from "@/lib/event-types"
import { buildIssuerFromSettings } from "@/lib/invoice-issuer"
import { mergeInvoiceTemplate } from "@/lib/invoice-template"
import type { Invoice, InvoiceLineItem, InvoiceParty } from "@/lib/invoice-types"
import {
  computeAmountHt,
  computeVatAmount,
  lineItemsTotal,
  parseEuroAmount,
} from "@/lib/invoice-utils"
import type { Wedding } from "@/lib/weddings-store"
import type { WorkspaceSettings } from "@/lib/workspace-settings"

/** Données d'une facture affichée (aperçu écran et PDF partagent ce modèle). */
export type InvoiceDocumentModel = {
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
  event: { title: string; dateLabel: string; place: string } | null
  lines: Array<{
    label: string
    description?: string
    quantity: number
    unitPrice: number
    total: number
    isDiscount: boolean
  }>
  vatRate: number
  amountHt: number
  vatAmount: number
  amountTtc: number
  recap: Array<{ label: string; amount: number; emphasis?: boolean }> | null
  paymentText: string
  bank: { iban: string; bic: string; holder: string } | null
  notes: string
  thanks: { message: string; signature: string }
  legalLines: string[]
}

export type InvoiceDocumentWedding = Pick<
  Wedding,
  "eventType" | "eventName" | "couple" | "eventDate" | "deposit" | "balance"
>

export type InvoiceDocumentDraft = Pick<
  Invoice,
  "type" | "number" | "status" | "locked" | "issuedAt" | "dueAt" | "vatRate" | "lineItems" | "client" | "issuer"
> & { notes?: string }

const VAT_EXEMPT_NOTICE = "TVA non applicable, art. 293 B du CGI."
const LATE_PAYMENT_NOTICE =
  "En cas de retard de paiement, pénalités au taux légal en vigueur et indemnité forfaitaire de 40 € pour frais de recouvrement."

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

  return {
    title: "Facture",
    titleAccent: TITLE_ACCENTS[invoice.type],
    number: invoice.number,
    issuedLabel: formatLongDate(invoice.issuedAt),
    dueLabel,
    issuer: {
      name: issuer.name,
      tagline: template.tagline.trim(),
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
    event: wedding ? buildEvent(wedding, issuer.name, issuerCity) : null,
    lines,
    vatRate,
    amountHt: computeAmountHt(amountTtc, vatRate),
    vatAmount: computeVatAmount(amountTtc, vatRate),
    amountTtc,
    recap: wedding ? buildRecap(invoice.type, wedding, amountTtc) : null,
    paymentText: bank
      ? `Par virement bancaire avant le ${dueLabel}, en indiquant la référence ${invoice.number}.`
      : `Règlement avant le ${dueLabel}, en indiquant la référence ${invoice.number}.`,
    bank,
    notes: invoice.notes?.trim() ?? "",
    thanks: {
      message: template.thankYouMessage.trim(),
      signature: template.signature.trim() || settings.managerName.trim(),
    },
    legalLines: buildLegalLines(template.legalNotice, vatRate),
  }
}

function toDocumentLine(item: InvoiceLineItem): InvoiceDocumentModel["lines"][number] {
  const total = item.quantity * item.unitPrice
  return {
    label: item.label,
    description: item.description?.trim() || undefined,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    total,
    isDiscount: item.kind === "discount" || item.unitPrice < 0,
  }
}

function buildEvent(
  wedding: InvoiceDocumentWedding,
  issuerName: string,
  issuerCity: string
): InvoiceDocumentModel["event"] {
  const typeLabel = EVENT_TYPE_LABELS[wedding.eventType] ?? "Événement"
  const title =
    wedding.eventName?.trim() ||
    (wedding.eventType === "gite" ? `Séjour au gîte — ${wedding.couple}` : `${typeLabel} de ${wedding.couple}`)
  return {
    title,
    dateLabel: capitalize(formatLongDate(wedding.eventDate, true)),
    place: [issuerName, issuerCity].filter(Boolean).join(" · "),
  }
}

function buildRecap(
  type: Invoice["type"],
  wedding: InvoiceDocumentWedding,
  amountTtc: number
): InvoiceDocumentModel["recap"] {
  if (type === "full") return null
  const deposit = parseEuroAmount(wedding.deposit.amount)
  const balance = parseEuroAmount(wedding.balance.amount)
  const total = deposit + balance
  if (total <= 0) return null

  const planned = type === "deposit" ? deposit : balance
  const adjustments = Math.round((amountTtc - planned) * 100) / 100
  const adjustmentRow =
    Math.abs(adjustments) >= 0.01
      ? [{ label: "Extras et ajustements (cette facture)", amount: adjustments }]
      : []

  if (type === "deposit") {
    return [
      { label: "Montant total de la prestation", amount: total },
      { label: "Acompte (cette facture)", amount: deposit },
      ...adjustmentRow,
      { label: "Solde restant à régler", amount: balance, emphasis: true },
    ]
  }
  return [
    { label: "Montant total de la prestation", amount: total },
    { label: wedding.deposit.status === "paid" ? "Acompte réglé" : "Acompte", amount: deposit },
    ...adjustmentRow,
    { label: "Solde à régler (cette facture)", amount: amountTtc, emphasis: true },
  ]
}

function buildLegalLines(legalNotice: string, vatRate: number): string[] {
  let notice = legalNotice.trim()
  if (vatRate > 0) {
    notice = notice.replace(/\s*TVA non applicable(?:,?\s*art\.)?[^.]*\.?/i, "").trim()
  }
  const lines = [notice]
  if (vatRate <= 0 && !/293\s*B/i.test(notice)) lines.push(VAT_EXEMPT_NOTICE)
  lines.push(LATE_PAYMENT_NOTICE)
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

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
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
