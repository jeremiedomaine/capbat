import { readFile } from "fs/promises"
import path from "path"
import fontkit from "@pdf-lib/fontkit"
import {
  PDFDocument,
  degrees,
  rgb,
  setCharacterSpacing,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  type RGB,
} from "pdf-lib"
import { formatEuroDocument, type InvoiceDocumentModel } from "@/lib/invoice-document"

/**
 * Mise en page en pixels CSS (794 × 1123, comme l'aperçu écran), convertie en points PDF.
 */
const PX = 595.28 / 794
const PAGE_W = 794
const PAGE_H = 1123
const LEFT = 64
const RIGHT = 730
const CONTENT_W = RIGHT - LEFT
const BOTTOM_PADDING = 40

const FONT_DIR = path.join(process.cwd(), "public", "fonts")
const LOGO_PATH = path.join(process.cwd(), "public", "logo-domaine.png")

const COLORS = {
  ink: hex("#3b372f"),
  inkSoft: hex("#6f685b"),
  inkMuted: hex("#9a917f"),
  gold: hex("#a8885a"),
  sand: hex("#d5c2a0"),
  sandLight: hex("#ece2cf"),
  cream: hex("#fbf8f2"),
  paper: hex("#fffdf9"),
  discount: hex("#a0523a"),
}

type Fonts = {
  serif: PDFFont
  serifMedium: PDFFont
  serifItalic: PDFFont
  light: PDFFont
  regular: PDFFont
}

type TextOptions = {
  align?: "left" | "right" | "center"
  spacing?: number
  opacity?: number
}

class Canvas {
  page!: PDFPage
  pageCount = 0

  constructor(
    private readonly doc: PDFDocument,
    readonly fonts: Fonts,
    private readonly logo: PDFImage | null
  ) {}

  addPage() {
    this.page = this.doc.addPage([PAGE_W * PX, PAGE_H * PX])
    this.pageCount += 1
    this.page.drawRectangle({ x: 0, y: 0, width: PAGE_W * PX, height: PAGE_H * PX, color: COLORS.paper })
    this.page.drawRectangle({
      x: 18 * PX,
      y: 18 * PX,
      width: (PAGE_W - 36) * PX,
      height: (PAGE_H - 36) * PX,
      borderColor: COLORS.sandLight,
      borderWidth: 1 * PX,
    })
    if (this.logo) {
      // Rotation autour du coin bas-gauche : position recalée sur le centre de l'aperçu CSS.
      this.page.drawImage(this.logo, {
        x: 507 * PX,
        y: 107 * PX,
        width: 460 * PX,
        height: 460 * PX,
        opacity: 0.07,
        rotate: degrees(12),
      })
    }
  }

  image(x: number, top: number, size: number) {
    if (!this.logo) return
    this.page.drawImage(this.logo, { x: x * PX, y: (PAGE_H - top - size) * PX, width: size * PX, height: size * PX })
  }

  width(text: string, size: number, font: PDFFont, spacing = 0) {
    const safe = sanitize(text)
    return font.widthOfTextAtSize(safe, size * PX) / PX + spacing * size * safe.length
  }

  text(text: string, x: number, baseline: number, size: number, font: PDFFont, color: RGB, options: TextOptions = {}) {
    const safe = sanitize(text)
    if (!safe) return
    const spacing = options.spacing ?? 0
    const width = this.width(safe, size, font, spacing)
    const startX = options.align === "right" ? x - width : options.align === "center" ? x - width / 2 : x
    if (spacing) this.page.pushOperators(setCharacterSpacing(spacing * size * PX))
    this.page.drawText(safe, {
      x: startX * PX,
      y: (PAGE_H - baseline) * PX,
      size: size * PX,
      font,
      color,
      opacity: options.opacity,
    })
    if (spacing) this.page.pushOperators(setCharacterSpacing(0))
  }

  hLine(x1: number, x2: number, y: number, color: RGB, dash?: number[]) {
    this.page.drawLine({
      start: { x: x1 * PX, y: (PAGE_H - y) * PX },
      end: { x: x2 * PX, y: (PAGE_H - y) * PX },
      thickness: 1 * PX,
      color,
      dashArray: dash?.map((value) => value * PX),
    })
  }

  rect(x: number, top: number, width: number, height: number, fill: RGB, border?: RGB) {
    this.page.drawRectangle({
      x: x * PX,
      y: (PAGE_H - top - height) * PX,
      width: width * PX,
      height: height * PX,
      color: fill,
      borderColor: border,
      borderWidth: border ? 1 * PX : undefined,
    })
  }

  fern(centerX: number, centerY: number, size: number) {
    const scale = (size / 24) * PX
    const paths = [
      "M12 21V5",
      "M12 8c-2-1-4-1-5.5 0M12 8c2-1 4-1 5.5 0",
      "M12 12c-2.4-1.2-4.8-1.2-6.8 0M12 12c2.4-1.2 4.8-1.2 6.8 0",
      "M12 16c-2-1-4-1-5.5 0M12 16c2-1 4-1 5.5 0",
    ]
    for (const d of paths) {
      this.page.drawSvgPath(d, {
        x: (centerX - size / 2) * PX,
        y: (PAGE_H - (centerY - size / 2)) * PX,
        scale,
        borderColor: COLORS.sand,
        borderWidth: 1.2 * (size / 24) * PX,
      })
    }
  }

  wrap(text: string, size: number, font: PDFFont, maxWidth: number): string[] {
    const lines: string[] = []
    for (const paragraph of sanitize(text).split(/\n/)) {
      const words = paragraph.split(/\s+/).filter(Boolean)
      let current = ""
      for (const word of words) {
        const candidate = current ? `${current} ${word}` : word
        if (this.width(candidate, size, font) <= maxWidth || !current) {
          current = candidate
        } else {
          lines.push(current)
          current = word
        }
      }
      lines.push(current)
    }
    return lines
  }
}

export async function buildInvoicePdf(model: InvoiceDocumentModel): Promise<Buffer> {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  doc.setTitle(`${model.title} ${model.titleAccent} ${model.number}`.replace(/\s+/g, " "))
  doc.setAuthor(model.issuer.name)

  const fonts: Fonts = {
    serif: await embedFont(doc, "CormorantGaramond-Regular.ttf"),
    serifMedium: await embedFont(doc, "CormorantGaramond-Medium.ttf"),
    serifItalic: await embedFont(doc, "CormorantGaramond-Italic.ttf"),
    light: await embedFont(doc, "Jost-Light.ttf"),
    regular: await embedFont(doc, "Jost-Regular.ttf"),
  }
  const logo = await embedLogo(doc)
  const canvas = new Canvas(doc, fonts, logo)

  canvas.addPage()
  const footerTop = drawFooter(canvas, model)
  let y = drawHeader(canvas, model)
  y = drawParties(canvas, model, y)

  let contentLimit = footerTop - 24
  const startContinuation = () => {
    canvas.addPage()
    const top = drawFooter(canvas, model)
    contentLimit = top - 24
    canvas.text(`${model.title} ${model.titleAccent}`.trim(), LEFT, 74, 20, fonts.serif, COLORS.ink)
    canvas.text(`N° ${model.number} — suite`, RIGHT, 72, 9, fonts.light, COLORS.inkMuted, {
      align: "right",
      spacing: 0.14,
    })
    canvas.hLine(LEFT, RIGHT, 92, COLORS.sandLight)
    return 120
  }

  y += 42
  y = drawTableHeader(canvas, y)
  for (const line of model.lines) {
    const rowHeight = measureRow(canvas, line)
    if (y + rowHeight > contentLimit) {
      y = drawTableHeader(canvas, startContinuation())
    }
    y = drawRow(canvas, line, y)
  }

  if (model.notes) {
    const noteLines = canvas.wrap(model.notes, 11, fonts.light, CONTENT_W)
    const height = 14 + noteLines.length * 18
    if (y + height > contentLimit) y = startContinuation()
    y += 14
    for (const noteLine of noteLines) {
      canvas.text(noteLine, LEFT, y + 12, 11, fonts.light, COLORS.inkSoft)
      y += 18
    }
  }

  const bottomHeight = measureBottom(model)
  if (y + 26 + bottomHeight > contentLimit) y = startContinuation()
  y = drawBottom(canvas, model, y + 26)

  const paymentHeight = measurePayment(canvas, model)
  if (y + paymentHeight > contentLimit) y = startContinuation()
  y = drawPayment(canvas, model, y)

  if (model.thanks.message || model.thanks.signature) {
    const thanksTop = footerTop - 32 - 92
    if (y + 40 > thanksTop) startContinuation()
    drawThanks(canvas, model, thanksTop)
  }

  const bytes = await doc.save()
  return Buffer.from(bytes)
}

function drawHeader(canvas: Canvas, model: InvoiceDocumentModel): number {
  const { fonts } = canvas
  canvas.image(LEFT, 56, 112)

  const textX = LEFT + 112 + 18
  const lineCount = model.issuer.lines.length
  const blockHeight = 30 + (model.issuer.tagline ? 15 : 0) + 10 + lineCount * 17.6
  let top = 56 + Math.max(0, (112 - blockHeight) / 2)

  canvas.text(model.issuer.name, textX, top + 23, 25, fonts.serifMedium, COLORS.ink, { spacing: 0.02 })
  top += 30
  if (model.issuer.tagline) {
    canvas.text(model.issuer.tagline.toUpperCase(), textX, top + 11, 9.5, fonts.light, COLORS.gold, { spacing: 0.28 })
    top += 15
  }
  top += 10
  for (const line of model.issuer.lines) {
    canvas.text(line, textX, top + 12, 11, fonts.light, COLORS.inkSoft)
    top += 17.6
  }

  const accent = model.titleAccent
  const titleWidth =
    canvas.width(accent ? `${model.title} ` : model.title, 38, fonts.serif) +
    (accent ? canvas.width(accent, 38, fonts.serifItalic) : 0)
  canvas.text(accent ? `${model.title} ` : model.title, RIGHT - titleWidth, 56 + 33, 38, fonts.serif, COLORS.ink)
  if (accent) canvas.text(accent, RIGHT, 56 + 33, 38, fonts.serifItalic, COLORS.gold, { align: "right" })

  const meta: Array<[string, string]> = [
    ["N°", model.number],
    ["Émise le", model.issuedLabel],
    ["Échéance", model.dueLabel],
  ]
  const valueWidth = Math.max(...meta.map(([, value]) => canvas.width(value, 11, fonts.regular)))
  let metaY = 56 + 38 + 16
  for (const [label, value] of meta) {
    canvas.text(value, RIGHT, metaY + 11, 11, fonts.regular, COLORS.ink, { align: "right" })
    canvas.text(label.toUpperCase(), RIGHT - valueWidth - 14, metaY + 10, 9, fonts.light, COLORS.inkMuted, {
      align: "right",
      spacing: 0.14,
    })
    metaY += 18
  }

  const headerBottom = Math.max(56 + 112, metaY, top)
  const ornamentY = headerBottom + 34 + 13
  canvas.hLine(LEFT + 40, 397 - 27, ornamentY, COLORS.sand)
  canvas.hLine(397 + 27, RIGHT - 40, ornamentY, COLORS.sand)
  canvas.fern(397, ornamentY, 26)
  return ornamentY + 13 + 30
}

function drawParties(canvas: Canvas, model: InvoiceDocumentModel, top: number): number {
  const { fonts } = canvas
  const columnWidth = (CONTENT_W - 28) / 2
  const rightX = LEFT + columnWidth + 28

  drawLabel(canvas, "Facturé à", LEFT, top)
  const nameLines = canvas.wrap(model.client.name, 24, fonts.serifMedium, columnWidth)
  let y = top + 21
  for (const line of nameLines) {
    canvas.text(line, LEFT, y + 21, 24, fonts.serifMedium, COLORS.ink)
    y += 28
  }
  y += 8
  for (const detail of model.client.lines) {
    for (const line of canvas.wrap(detail, 11.5, fonts.light, columnWidth)) {
      canvas.text(line, LEFT, y + 12, 11.5, fonts.light, COLORS.inkSoft)
      y += 19
    }
  }
  let bottom = y

  if (model.event) {
    const innerWidth = columnWidth - 40
    const titleLines = canvas.wrap(model.event.title, 21, fonts.serifItalic, innerWidth)
    const boxHeight = 18 + 21 + titleLines.length * 25 + 4 + 15 + 10 + 13 + 18
    canvas.rect(rightX, top, columnWidth, boxHeight, COLORS.cream, COLORS.sandLight)
    drawLabel(canvas, "Votre événement", rightX + 20, top + 18)
    let eventY = top + 18 + 21
    for (const line of titleLines) {
      canvas.text(line, rightX + 20, eventY + 19, 21, fonts.serifItalic, COLORS.ink)
      eventY += 25
    }
    eventY += 4
    canvas.text(model.event.dateLabel, rightX + 20, eventY + 12, 12, fonts.light, COLORS.inkSoft)
    eventY += 15 + 10
    canvas.text(model.event.place, rightX + 20, eventY + 10, 10.5, fonts.light, COLORS.inkMuted, { spacing: 0.04 })
    bottom = Math.max(bottom, top + boxHeight)
  }
  return bottom
}

const COLUMNS = { qty: 455, unit: 590, total: RIGHT, labelWidth: 330 }

function drawTableHeader(canvas: Canvas, top: number): number {
  const { fonts } = canvas
  const options = { spacing: 0.22 }
  canvas.text("DÉSIGNATION", LEFT, top + 9, 9, fonts.light, COLORS.inkMuted, options)
  canvas.text("QTÉ", COLUMNS.qty, top + 9, 9, fonts.light, COLORS.inkMuted, { ...options, align: "right" })
  canvas.text("PRIX UNITAIRE", COLUMNS.unit, top + 9, 9, fonts.light, COLORS.inkMuted, { ...options, align: "right" })
  canvas.text("MONTANT TTC", COLUMNS.total, top + 9, 9, fonts.light, COLORS.inkMuted, { ...options, align: "right" })
  canvas.hLine(LEFT, RIGHT, top + 22, COLORS.sand)
  return top + 23
}

function measureRow(canvas: Canvas, line: InvoiceDocumentModel["lines"][number]): number {
  const labelLines = canvas.wrap(line.label || "—", 12.5, canvas.fonts.regular, COLUMNS.labelWidth)
  const descLines = line.description
    ? canvas.wrap(line.description, 10.5, canvas.fonts.light, COLUMNS.labelWidth)
    : []
  return 13 + labelLines.length * 17 + (descLines.length ? 3 + descLines.length * 15 : 0) + 13
}

function drawRow(canvas: Canvas, line: InvoiceDocumentModel["lines"][number], top: number): number {
  const { fonts } = canvas
  const color = line.isDiscount ? COLORS.discount : COLORS.ink
  const labelLines = canvas.wrap(line.label || "—", 12.5, fonts.regular, COLUMNS.labelWidth)
  let y = top + 13
  const firstBaseline = y + 12
  for (const labelLine of labelLines) {
    canvas.text(labelLine, LEFT, y + 12, 12.5, fonts.regular, color)
    y += 17
  }
  if (line.description) {
    y += 3
    for (const descLine of canvas.wrap(line.description, 10.5, fonts.light, COLUMNS.labelWidth)) {
      canvas.text(descLine, LEFT, y + 11, 10.5, fonts.light, COLORS.inkMuted)
      y += 15
    }
  }
  const numColor = line.isDiscount ? COLORS.discount : COLORS.ink
  canvas.text(String(line.quantity), COLUMNS.qty, firstBaseline, 12.5, fonts.light, numColor, { align: "right" })
  canvas.text(formatEuroDocument(line.unitPrice), COLUMNS.unit, firstBaseline, 12.5, fonts.light, numColor, {
    align: "right",
  })
  canvas.text(formatEuroDocument(line.total), COLUMNS.total, firstBaseline, 12.5, fonts.light, numColor, {
    align: "right",
  })
  y += 13
  canvas.hLine(LEFT, RIGHT, y, COLORS.sandLight)
  return y + 1
}

function measureBottom(model: InvoiceDocumentModel): number {
  const recapHeight = model.recap ? 19 + model.recap.length * 27 : 0
  const totalsHeight = (model.vatRate > 0 ? 56 : 0) + 10 + 62
  return Math.max(recapHeight, totalsHeight)
}

function drawBottom(canvas: Canvas, model: InvoiceDocumentModel, top: number): number {
  const { fonts } = canvas
  const recapRight = RIGHT - 260 - 40
  const totalsLeft = RIGHT - 260

  if (model.recap) {
    drawLabel(canvas, "Récapitulatif de votre réservation", LEFT, top)
    let y = top + 19
    model.recap.forEach((row, index) => {
      const color = row.emphasis ? COLORS.ink : COLORS.inkSoft
      const font = row.emphasis ? fonts.regular : fonts.light
      canvas.text(row.label, LEFT, y + 6 + 11, 11.5, font, color)
      canvas.text(formatEuroDocument(row.amount), recapRight, y + 6 + 11, 11.5, font, color, { align: "right" })
      y += 27
      if (index < model.recap!.length - 1) canvas.hLine(LEFT, recapRight, y, COLORS.sand, [1, 2])
    })
  }

  let y = top
  if (model.vatRate > 0) {
    for (const [label, value] of [
      ["Total HT", model.amountHt],
      [`TVA ${model.vatRate} %`, model.vatAmount],
    ] as const) {
      canvas.text(label, totalsLeft, y + 6 + 12, 12, fonts.light, COLORS.inkSoft)
      canvas.text(formatEuroDocument(value), RIGHT, y + 6 + 12, 12, fonts.light, COLORS.inkSoft, { align: "right" })
      y += 28
    }
  }
  y += 10
  canvas.rect(totalsLeft, y, 260, 62, COLORS.ink)
  canvas.text(model.vatRate > 0 ? "TOTAL TTC" : "TOTAL", totalsLeft + 18, y + 38, 9.5, fonts.light, COLORS.sand, {
    spacing: 0.24,
  })
  canvas.text(formatEuroDocument(model.amountTtc), RIGHT - 18, y + 41, 28, fonts.serifMedium, COLORS.paper, {
    align: "right",
  })
  return top + measureBottom(model)
}

function paymentColumns(model: InvoiceDocumentModel) {
  const columnWidth = model.bank ? (CONTENT_W - 28) / 2 : CONTENT_W
  return { columnWidth, rightX: LEFT + columnWidth + 28 }
}

function measurePayment(canvas: Canvas, model: InvoiceDocumentModel): number {
  const { columnWidth } = paymentColumns(model)
  const textLines = canvas.wrap(model.paymentText, 11, canvas.fonts.light, columnWidth).length
  return 40 + 22 + 19 + Math.max(textLines, model.bank ? 2 : 0) * 18.7
}

function drawPayment(canvas: Canvas, model: InvoiceDocumentModel, top: number): number {
  const { fonts } = canvas
  const { columnWidth, rightX } = paymentColumns(model)
  const lineTop = top + 40
  canvas.hLine(LEFT, RIGHT, lineTop, COLORS.sandLight)
  const contentTop = lineTop + 22

  drawLabel(canvas, "Règlement", LEFT, contentTop)
  let y = contentTop + 19
  for (const line of canvas.wrap(model.paymentText, 11, fonts.light, columnWidth)) {
    canvas.text(line, LEFT, y + 12, 11, fonts.light, COLORS.inkSoft)
    y += 18.7
  }

  if (model.bank) {
    drawLabel(canvas, "Coordonnées bancaires", rightX, contentTop)
    canvas.text(model.bank.iban, rightX, contentTop + 19 + 12, 11, fonts.regular, COLORS.ink, { spacing: 0.06 })
    const bankLine = [model.bank.bic ? `BIC ${model.bank.bic}` : null, model.bank.holder].filter(Boolean).join(" · ")
    canvas.text(bankLine, rightX, contentTop + 19 + 18.7 + 12, 11, fonts.light, COLORS.inkSoft)
    y = Math.max(y, contentTop + 19 + 2 * 18.7)
  }
  return y
}

function drawThanks(canvas: Canvas, model: InvoiceDocumentModel, top: number) {
  const { fonts } = canvas
  const center = PAGE_W / 2
  canvas.hLine(center - 32, center + 32, top, COLORS.sand)
  let y = top + 19
  if (model.thanks.message) {
    canvas.text(model.thanks.message, center, y + 18, 19, fonts.serifItalic, COLORS.inkSoft, { align: "center" })
    y += 23 + 6
  }
  if (model.thanks.signature) {
    canvas.text(model.thanks.signature, center, y + 20, 22, fonts.serif, COLORS.gold, { align: "center" })
  }
}

/** Dessine le pied de page et renvoie sa position haute (px). */
function drawFooter(canvas: Canvas, model: InvoiceDocumentModel): number {
  const { fonts } = canvas
  const rows: Array<{ text: string; size: number; height: number }> = []
  for (const line of canvas.wrap(model.issuer.footerLine, 9, fonts.light, CONTENT_W)) {
    rows.push({ text: line, size: 9, height: 15.3 })
  }
  for (const legal of model.legalLines) {
    for (const line of canvas.wrap(legal, 8.5, fonts.light, CONTENT_W)) {
      rows.push({ text: line, size: 8.5, height: 14.5 })
    }
  }
  const totalHeight = rows.reduce((sum, row) => sum + row.height, 0)
  let y = PAGE_H - BOTTOM_PADDING - totalHeight
  const top = y
  for (const row of rows) {
    canvas.text(row.text, PAGE_W / 2, y + row.size + 2, row.size, fonts.light, COLORS.inkMuted, {
      align: "center",
      spacing: 0.04,
    })
    y += row.height
  }
  return top
}

function drawLabel(canvas: Canvas, label: string, x: number, top: number) {
  canvas.text(label.toUpperCase(), x, top + 8, 9, canvas.fonts.light, COLORS.gold, { spacing: 0.26 })
}

async function embedFont(doc: PDFDocument, file: string) {
  const bytes = await readFile(path.join(FONT_DIR, file))
  return doc.embedFont(bytes, { subset: true })
}

async function embedLogo(doc: PDFDocument) {
  try {
    return await doc.embedPng(await readFile(LOGO_PATH))
  } catch {
    return null
  }
}

function sanitize(text: string) {
  return text
    .normalize("NFC")
    .replace(/[\u202f\u2009]/g, "\u00a0")
    .replace(/[\u200b\ufeff]/g, "")
    .replace(/\t/g, " ")
}

function hex(value: string): RGB {
  const normalized = value.replace("#", "")
  return rgb(
    Number.parseInt(normalized.slice(0, 2), 16) / 255,
    Number.parseInt(normalized.slice(2, 4), 16) / 255,
    Number.parseInt(normalized.slice(4, 6), 16) / 255
  )
}
