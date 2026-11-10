import { buildIssuerFromSettings } from "@/lib/invoice-issuer"
import type { TouristTaxInvoice } from "@/lib/tourist-tax-invoice-types"
import {
  formatEuroDetailed,
  formatLongFrDate,
  formatPeriodLabel,
  occupancyLineLabel,
} from "@/lib/tourist-tax-invoice-utils"
import type { WorkspaceSettings } from "@/lib/workspace-settings"

/** Modèle calqué sur le carnet papier « taxe de séjour » (commune), pas une facture client. */
export type TouristTaxDocumentModel = {
  number: string
  dateLabel: string
  issuer: {
    name: string
    addressLines: string[]
    contactLine: string
    vatLine: string
  }
  clientName: string
  /** Lignes de désignation : titre, période, puis paliers d'occupation. */
  designationLines: string[]
  occupancyRows: Array<{
    label: string
    quantityLabel: string
    total: number
  }>
  amountTtc: number
  paymentDateLabel: string
  paymentMethod: string
  legalNotice: string
}

export type TouristTaxDocumentDraft = Pick<
  TouristTaxInvoice,
  | "number"
  | "periodStart"
  | "periodEnd"
  | "issuedAt"
  | "paidAt"
  | "paymentMethod"
  | "lines"
  | "rate"
  | "clientName"
  | "amountTtc"
>

function formatShortFrDate(iso: string): string {
  const value = iso.trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return ""
  const [y, m, d] = value.split("-")
  return `${d}/${m}/${y}`
}

export function buildTouristTaxDocument(params: {
  invoice: TouristTaxDocumentDraft
  settings: WorkspaceSettings
}): TouristTaxDocumentModel {
  const { invoice, settings } = params
  const issuer = buildIssuerFromSettings(settings)
  const postalCity = [issuer.postalCode, issuer.city].filter(Boolean).join(" ")
  const addressLines = [issuer.addressLine, postalCity].map((l) => (l ?? "").trim()).filter(Boolean)
  const contactParts = [issuer.email, issuer.phone].map((l) => (l ?? "").trim()).filter(Boolean)
  const vat = (issuer.vatNumber || issuer.siret || "").trim()

  const period = formatPeriodLabel(invoice.periodStart, invoice.periodEnd)
  const designationLines = ["Taxe de séjour", period].filter(Boolean)

  const occupancyRows = invoice.lines.map((line) => {
    const total = Math.round(line.adults * invoice.rate * line.nights * 100) / 100
    const nightsLabel = line.nights > 1 ? `${line.nights} nuitées` : `${line.nights} nuitée`
    return {
      label: occupancyLineLabel(line.adults, invoice.rate).replace("×", "x"),
      quantityLabel: nightsLabel,
      total,
    }
  })

  const amount =
    occupancyRows.reduce((sum, row) => sum + row.total, 0) || invoice.amountTtc

  return {
    number: invoice.number,
    dateLabel: formatShortFrDate(invoice.issuedAt) || formatLongFrDate(invoice.issuedAt),
    issuer: {
      name: issuer.name || "Le Domaine de Cap'bat",
      addressLines,
      contactLine: contactParts.join(" / "),
      vatLine: vat ? (vat.toUpperCase().startsWith("FR") ? vat : `FR ${vat}`) : "",
    },
    clientName: invoice.clientName.trim() || "Client",
    designationLines,
    occupancyRows,
    amountTtc: Math.round(amount * 100) / 100,
    paymentDateLabel: invoice.paidAt ? formatShortFrDate(invoice.paidAt) : "",
    paymentMethod: invoice.paymentMethod.trim(),
    legalNotice:
      "En cas de retard de paiement, une pénalité égale à 3 fois le taux d'intérêt légal sera exigible (Art. L441-10 et D441-5 du Code de commerce), ainsi qu'une indemnité forfaitaire pour frais de recouvrement de 40 €.",
  }
}

export function formatTouristTaxEuro(amount: number): string {
  return formatEuroDetailed(amount)
}

/** Dimensions partagées aperçu HTML ↔ PDF (px CSS, page 794×1123). */
export const TOURIST_TAX_LAYOUT = {
  pageW: 794,
  pageH: 1123,
  padTop: 36,
  padX: 40,
  padBottom: 48,
  border: 2.5,
  /** Colonne gauche / droite du header et du footer (1.15fr / 0.85fr). */
  leftFrac: 1.15 / 2,
  numberH: 56,
  headerH: 148,
  dateH: 38,
  thH: 36,
  rowH: 36,
  totalRowH: 42,
  footerH: 42 * 3,
  minBodyRows: 18,
  /** Largeurs colonnes tableau. */
  colFracs: [0.46, 0.18, 0.18, 0.18] as const,
} as const

export type TouristTaxBodyRow =
  | { kind: "title"; text: string }
  | { kind: "period"; text: string }
  | { kind: "occupancy"; label: string; quantityLabel: string; total: number }
  | { kind: "empty" }

export function buildTouristTaxBodyRows(model: TouristTaxDocumentModel): TouristTaxBodyRow[] {
  const rows: TouristTaxBodyRow[] = []
  if (model.designationLines[0]) {
    rows.push({ kind: "title", text: model.designationLines[0] })
  }
  if (model.designationLines[1]) {
    rows.push({ kind: "period", text: model.designationLines[1] })
  }
  for (const row of model.occupancyRows) {
    rows.push({
      kind: "occupancy",
      label: row.label,
      quantityLabel: row.quantityLabel,
      total: row.total,
    })
  }
  while (rows.length < TOURIST_TAX_LAYOUT.minBodyRows) {
    rows.push({ kind: "empty" })
  }
  return rows
}

