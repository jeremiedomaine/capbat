import { readFile } from "fs/promises"
import path from "path"
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib"
import type { Invoice } from "@/lib/invoice-types"
import { INVOICE_TYPE_LABELS } from "@/lib/invoice-types"
import {
  computeAmountHt,
  computeVatAmount,
  formatEuroDetailed,
} from "@/lib/invoice-utils"

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const MARGIN = 50
const LOGO_PATH = path.join(process.cwd(), "public", "logo-domaine.png")
const LOGO_WIDTH = 76

const blue = rgb(0.12, 0.25, 0.69)
const brand = rgb(0.35, 0.3, 0.22)
const gray = rgb(0.22, 0.25, 0.29)
const grayLight = rgb(0.42, 0.45, 0.5)
const grayMuted = rgb(0.61, 0.64, 0.69)

export async function buildInvoicePdf(invoice: Invoice): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const regular = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])

  const issuer = invoice.issuer
  const client = invoice.client
  const amountHt = computeAmountHt(invoice.amountTtc, invoice.vatRate)
  const vatAmount = computeVatAmount(invoice.amountTtc, invoice.vatRate)

  let y = PAGE_HEIGHT - MARGIN
  let textX = MARGIN

  const logo = await embedDomainLogo(doc)
  if (logo) {
    const logoHeight = (logo.height / logo.width) * LOGO_WIDTH
    page.drawImage(logo, {
      x: MARGIN,
      y: y - logoHeight,
      width: LOGO_WIDTH,
      height: logoHeight,
    })
    textX = MARGIN + LOGO_WIDTH + 16
  }

  y = drawLine(page, issuer.name, textX, y, 20, bold, brand)
  y -= 6

  for (const line of [
    issuer.addressLine,
    [issuer.postalCode, issuer.city].filter(Boolean).join(" ") || null,
    issuer.email,
    issuer.phone,
    issuer.contactName && issuer.contactName !== issuer.name
      ? `Contact : ${issuer.contactName}`
      : null,
    issuer.siret ? `SIRET : ${issuer.siret}` : null,
    issuer.vatNumber ? `N° TVA : ${issuer.vatNumber}` : null,
  ]) {
    if (line) y = drawLine(page, line, textX, y, 10, regular, gray)
  }

  y -= 20
  const rightX = PAGE_WIDTH - MARGIN
  y = drawLineRight(page, INVOICE_TYPE_LABELS[invoice.type].toUpperCase(), rightX, y, 16, bold, gray)
  y = drawLineRight(page, `N° ${invoice.number}`, rightX, y, 10, regular, grayLight)
  y = drawLineRight(
    page,
    `Date d'émission : ${formatFrenchDate(invoice.issuedAt)}`,
    rightX,
    y,
    10,
    regular,
    grayLight
  )
  y = drawLineRight(
    page,
    `Échéance : ${formatFrenchDate(invoice.dueAt)}`,
    rightX,
    y,
    10,
    regular,
    grayLight
  )

  y -= 28
  y = drawLine(page, "Facturé à", MARGIN, y, 11, bold, gray)
  y -= 4

  for (const line of [
    client.name,
    client.contactName && client.contactName !== client.name
      ? `À l'attention de ${client.contactName}`
      : null,
    client.email,
    client.phone,
    client.addressLine,
    [client.postalCode, client.city].filter(Boolean).join(" ") || null,
  ]) {
    if (line) y = drawLine(page, line, MARGIN, y, 10, regular, gray)
  }

  y -= 24
  const tableTop = y
  page.drawRectangle({
    x: MARGIN,
    y: tableTop - 20,
    width: PAGE_WIDTH - MARGIN * 2,
    height: 22,
    color: blue,
  })

  drawText(page, "Description", MARGIN + 8, tableTop - 14, 9, bold, rgb(1, 1, 1))
  drawText(page, "Qté", 320, tableTop - 14, 9, bold, rgb(1, 1, 1))
  drawText(page, "P.U. HT", 400, tableTop - 14, 9, bold, rgb(1, 1, 1))
  drawText(page, "Total TTC", 480, tableTop - 14, 9, bold, rgb(1, 1, 1))

  let rowY = tableTop - 36
  for (const item of invoice.lineItems) {
    const lineTtc = item.quantity * item.unitPrice
    drawText(page, truncate(item.label, 52), MARGIN + 8, rowY, 9, regular, gray)
    drawText(page, String(item.quantity), 320, rowY, 9, regular, gray)
    drawText(page, formatEuroDetailed(item.unitPrice), 400, rowY, 9, regular, gray)
    drawText(page, formatEuroDetailed(lineTtc), 480, rowY, 9, regular, gray)
    rowY -= 24
  }

  let totalsY = rowY - 16
  totalsY = drawTotalsRow(page, "Total HT", formatEuroDetailed(amountHt), totalsY, regular)
  totalsY = drawTotalsRow(
    page,
    `TVA (${invoice.vatRate} %)`,
    formatEuroDetailed(vatAmount),
    totalsY,
    regular
  )
  drawTotalsRow(page, "Total TTC", formatEuroDetailed(invoice.amountTtc), totalsY, bold, 12)

  if (invoice.notes) {
    drawText(page, `Notes : ${invoice.notes}`, MARGIN, 120, 9, regular, grayMuted, 495)
  }

  drawText(
    page,
    "Document généré automatiquement par Guestflow.",
    MARGIN,
    70,
    8,
    regular,
    grayMuted,
    PAGE_WIDTH - MARGIN * 2,
    "center"
  )

  const bytes = await doc.save()
  return Buffer.from(bytes)
}

function drawLine(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  size: number,
  font: PDFFont,
  color: ReturnType<typeof rgb>
) {
  drawText(page, sanitizePdfText(text), x, y - size, size, font, color)
  return y - size - 4
}

function drawLineRight(
  page: PDFPage,
  text: string,
  rightX: number,
  y: number,
  size: number,
  font: PDFFont,
  color: ReturnType<typeof rgb>
) {
  const safe = sanitizePdfText(text)
  const width = font.widthOfTextAtSize(safe, size)
  drawText(page, safe, rightX - width, y - size, size, font, color)
  return y - size - 4
}

function drawTotalsRow(
  page: PDFPage,
  label: string,
  value: string,
  y: number,
  font: PDFFont,
  size = 10
) {
  drawText(page, label, 360, y, size, font, gray)
  const valueWidth = font.widthOfTextAtSize(sanitizePdfText(value), size)
  drawText(page, sanitizePdfText(value), PAGE_WIDTH - MARGIN - valueWidth, y, size, font, gray)
  return y - (size + 8)
}

function drawText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  size: number,
  font: PDFFont,
  color: ReturnType<typeof rgb>,
  maxWidth?: number,
  align?: "left" | "center"
) {
  const safe = sanitizePdfText(text)
  if (!maxWidth || align !== "center") {
    page.drawText(safe, { x, y, size, font, color })
    return
  }
  const width = font.widthOfTextAtSize(safe, size)
  page.drawText(safe, { x: x + (maxWidth - width) / 2, y, size, font, color })
}

/** WinAnsi (Helvetica) : remplace les caractères non supportés. */
function sanitizePdfText(text: string) {
  return text
    .normalize("NFC")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[^\x00-\xff]/g, (ch) => {
      if (ch === "\u20ac") return " EUR"
      if (ch === "\u0153") return "oe"
      if (ch === "\u0152") return "OE"
      if (ch === "\u00e6") return "ae"
      if (ch === "\u00c6") return "AE"
      return ""
    })
}

function truncate(text: string, max: number) {
  const safe = sanitizePdfText(text)
  return safe.length <= max ? safe : `${safe.slice(0, max - 1)}…`
}

async function embedDomainLogo(doc: PDFDocument) {
  try {
    const bytes = await readFile(LOGO_PATH)
    return await doc.embedPng(bytes)
  } catch {
    return null
  }
}

function formatFrenchDate(iso: string) {
  const key = iso.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return iso
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${key}T12:00:00`))
}
