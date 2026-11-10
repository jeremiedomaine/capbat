import { readFile } from "fs/promises"
import path from "path"
import fontkit from "@pdf-lib/fontkit"
import {
  PDFDocument,
  rgb,
  type PDFFont,
  type PDFPage,
  type RGB,
} from "pdf-lib"
import {
  buildTouristTaxBodyRows,
  formatTouristTaxEuro,
  TOURIST_TAX_LAYOUT,
  type TouristTaxDocumentModel,
} from "@/lib/tourist-tax-document"

const L = TOURIST_TAX_LAYOUT
const PX = 595.28 / L.pageW
const PAGE_W = L.pageW
const PAGE_H = L.pageH

const FONT_DIR = path.join(process.cwd(), "public", "fonts")

const COLORS = {
  ink: hex("#1a1a1a"),
  muted: hex("#333333"),
  line: hex("#2f6b45"),
  lineSoft: hex("#5a9a6e"),
  fill: hex("#e8f3eb"),
  paper: hex("#fffef9"),
  white: hex("#ffffff"),
  struck: hex("#888888"),
  legal: hex("#555555"),
}

type Fonts = {
  serif: PDFFont
  serifBold: PDFFont
  mono: PDFFont
  monoBold: PDFFont
}

class Canvas {
  page!: PDFPage

  constructor(
    private readonly doc: PDFDocument,
    readonly fonts: Fonts
  ) {}

  addPage() {
    this.page = this.doc.addPage([PAGE_W * PX, PAGE_H * PX])
    this.page.drawRectangle({
      x: 0,
      y: 0,
      width: PAGE_W * PX,
      height: PAGE_H * PX,
      color: COLORS.paper,
    })
  }

  width(text: string, size: number, font: PDFFont) {
    return font.widthOfTextAtSize(sanitize(text), size * PX) / PX
  }

  /** `baseline` = distance from top of page to text baseline (CSS px). */
  text(
    text: string,
    x: number,
    baseline: number,
    size: number,
    font: PDFFont,
    color: RGB,
    options: { align?: "left" | "right" | "center" } = {}
  ) {
    const safe = sanitize(text)
    if (!safe) return
    const w = this.width(safe, size, font)
    const startX =
      options.align === "right" ? x - w : options.align === "center" ? x - w / 2 : x
    this.page.drawText(safe, {
      x: startX * PX,
      y: (PAGE_H - baseline) * PX,
      size: size * PX,
      font,
      color,
    })
  }

  /** Center text vertically inside a band from `top` with height `h`. */
  textInBand(
    text: string,
    x: number,
    top: number,
    h: number,
    size: number,
    font: PDFFont,
    color: RGB,
    options: { align?: "left" | "right" | "center" } = {}
  ) {
    const baseline = top + h / 2 + size * 0.35
    this.text(text, x, baseline, size, font, color, options)
  }

  rect(
    x: number,
    top: number,
    width: number,
    height: number,
    fill?: RGB,
    border?: RGB,
    borderWidth = 2
  ) {
    this.page.drawRectangle({
      x: x * PX,
      y: (PAGE_H - top - height) * PX,
      width: width * PX,
      height: height * PX,
      color: fill,
      borderColor: border,
      borderWidth: border ? borderWidth * PX : undefined,
    })
  }

  hLine(x1: number, x2: number, y: number, color: RGB, thickness = 1.5) {
    this.page.drawLine({
      start: { x: x1 * PX, y: (PAGE_H - y) * PX },
      end: { x: x2 * PX, y: (PAGE_H - y) * PX },
      thickness: thickness * PX,
      color,
    })
  }

  vLine(x: number, y1: number, y2: number, color: RGB, thickness = 1.5) {
    this.page.drawLine({
      start: { x: x * PX, y: (PAGE_H - y1) * PX },
      end: { x: x * PX, y: (PAGE_H - y2) * PX },
      thickness: thickness * PX,
      color,
    })
  }
}

export async function buildTouristTaxPdf(model: TouristTaxDocumentModel): Promise<Buffer> {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  doc.setTitle(`Taxe de séjour ${model.number}`)
  doc.setAuthor(model.issuer.name)

  const fonts: Fonts = {
    serif: await embedFont(doc, "CormorantGaramond-Regular.ttf"),
    serifBold: await embedFont(doc, "CormorantGaramond-Medium.ttf"),
    mono: await embedFont(doc, "Jost-Light.ttf"),
    monoBold: await embedFont(doc, "Jost-Regular.ttf"),
  }

  const canvas = new Canvas(doc, fonts)
  canvas.addPage()

  const left = L.padX
  const right = PAGE_W - L.padX
  const top = L.padTop
  const frameW = right - left
  const frameH = PAGE_H - L.padTop - L.padBottom
  const bottom = top + frameH
  const midX = left + frameW * L.leftFrac

  const headerBottom = top + L.headerH
  const dateBottom = headerBottom + L.dateH
  const footerTop = bottom - L.footerH
  const tableTop = dateBottom
  const tableBottom = footerTop

  // Outer frame
  canvas.rect(left, top, frameW, frameH, undefined, COLORS.line, L.border)

  // Header divider + vertical split
  canvas.hLine(left, right, headerBottom, COLORS.line, 2)
  canvas.vLine(midX, top, headerBottom, COLORS.line, 2)

  // Issuer (left)
  let y = top + 14
  canvas.text(model.issuer.name, left + 16, y + 16, 18, fonts.serifBold, COLORS.ink)
  y += 28
  for (const line of model.issuer.addressLines) {
    canvas.text(line, left + 16, y + 11, 12, fonts.mono, COLORS.muted)
    y += 16
  }
  if (model.issuer.contactLine) {
    canvas.text(model.issuer.contactLine, left + 16, y + 11, 12, fonts.mono, COLORS.muted)
    y += 16
  }
  if (model.issuer.vatLine) {
    canvas.text(model.issuer.vatLine, left + 16, y + 11, 12, fonts.mono, COLORS.muted)
  }

  // Number block (right top)
  const numH = L.numberH
  const numSplit = midX + (right - midX) * 0.62
  canvas.rect(midX, top, numSplit - midX, numH, COLORS.fill)
  canvas.hLine(midX, right, top + numH, COLORS.line, 2)
  canvas.vLine(numSplit, top, top + numH, COLORS.line, 2)
  canvas.textInBand(
    "FACTURE N°",
    midX + (numSplit - midX) / 2,
    top,
    numH,
    15,
    fonts.serifBold,
    COLORS.ink,
    { align: "center" }
  )
  canvas.textInBand(
    model.number,
    numSplit + (right - numSplit) / 2,
    top,
    numH,
    16,
    fonts.monoBold,
    COLORS.ink,
    { align: "center" }
  )

  // Client box
  const clientTop = top + numH
  const clientPadX = 14
  canvas.text("CLIENT", midX + clientPadX, clientTop + 18, 11, fonts.monoBold, COLORS.line)
  const boxTop = clientTop + 26
  const boxH = headerBottom - boxTop - 12
  canvas.rect(
    midX + clientPadX,
    boxTop,
    right - midX - clientPadX * 2,
    boxH,
    COLORS.white,
    COLORS.lineSoft,
    1.5
  )
  canvas.textInBand(
    model.clientName,
    midX + clientPadX + 12,
    boxTop,
    boxH,
    15,
    fonts.serifBold,
    COLORS.ink
  )

  // Date row
  canvas.hLine(left, right, dateBottom, COLORS.line, 2)
  canvas.textInBand(`LE  ${model.dateLabel}`, left + 16, headerBottom, L.dateH, 14, fonts.monoBold, COLORS.ink)

  // Table columns
  const [f1, f2, f3] = L.colFracs
  const col1 = left
  const col2 = left + frameW * f1
  const col3 = col2 + frameW * f2
  const col4 = col3 + frameW * f3

  // Table header
  canvas.rect(left, tableTop, frameW, L.thH, COLORS.fill)
  canvas.hLine(left, right, tableTop + L.thH, COLORS.line, 2)
  canvas.vLine(col2, tableTop, tableBottom, COLORS.line, 1.5)
  canvas.vLine(col3, tableTop, tableBottom, COLORS.line, 1.5)
  canvas.vLine(col4, tableTop, tableBottom, COLORS.line, 1.5)

  canvas.textInBand("Désignation", col1 + 12, tableTop, L.thH, 12, fonts.serifBold, COLORS.ink)
  canvas.textInBand("Quantité", (col2 + col3) / 2, tableTop, L.thH, 12, fonts.serifBold, COLORS.ink, {
    align: "center",
  })
  canvas.textInBand(
    "Prix unitaire H.T.",
    (col3 + col4) / 2,
    tableTop,
    L.thH,
    11,
    fonts.serifBold,
    COLORS.ink,
    { align: "center" }
  )
  canvas.textInBand("Total H.T.", (col4 + right) / 2, tableTop, L.thH, 12, fonts.serifBold, COLORS.ink, {
    align: "center",
  })

  // Body rows — same list as UI
  const bodyRows = buildTouristTaxBodyRows(model)
  const bodyTop = tableTop + L.thH
  const available = tableBottom - bodyTop
  const rowCount = Math.max(bodyRows.length, Math.floor(available / L.rowH))
  const rowH = available / rowCount

  for (let i = 0; i < rowCount; i++) {
    const rowTop = bodyTop + i * rowH
    const rowBottom = rowTop + rowH
    canvas.hLine(left, right, rowBottom, COLORS.line, 1.5)

    const row = bodyRows[i]
    if (!row || row.kind === "empty") continue

    if (row.kind === "title") {
      canvas.textInBand(row.text, col1 + 12, rowTop, rowH, 14, fonts.serifBold, COLORS.ink)
    } else if (row.kind === "period") {
      canvas.textInBand(row.text, col1 + 12, rowTop, rowH, 12.5, fonts.mono, COLORS.muted)
    } else {
      canvas.textInBand(row.label, col1 + 12, rowTop, rowH, 13, fonts.mono, COLORS.ink)
      canvas.textInBand(
        row.quantityLabel,
        (col2 + col3) / 2,
        rowTop,
        rowH,
        13,
        fonts.mono,
        COLORS.ink,
        { align: "center" }
      )
      canvas.textInBand("—", (col3 + col4) / 2, rowTop, rowH, 13, fonts.mono, COLORS.struck, {
        align: "center",
      })
      canvas.textInBand(
        formatTouristTaxEuro(row.total),
        right - 12,
        rowTop,
        rowH,
        13,
        fonts.monoBold,
        COLORS.ink,
        { align: "right" }
      )
    }
  }
  canvas.hLine(left, right, tableBottom, COLORS.line, 2)

  // Footer
  canvas.vLine(midX, footerTop, bottom, COLORS.line, 2)

  canvas.text("Règlement", left + 16, footerTop + 24, 12, fonts.serifBold, COLORS.line)
  canvas.text("Date de règlement :", left + 16, footerTop + 52, 12, fonts.mono, COLORS.muted)
  canvas.text(
    model.paymentDateLabel || "……………",
    left + 156,
    footerTop + 52,
    13,
    fonts.monoBold,
    COLORS.ink
  )
  canvas.hLine(left + 156, midX - 16, footerTop + 56, COLORS.lineSoft, 1)
  canvas.text("Mode de règlement :", left + 16, footerTop + 82, 12, fonts.mono, COLORS.muted)
  canvas.text(
    model.paymentMethod || "……………",
    left + 156,
    footerTop + 82,
    13,
    fonts.monoBold,
    COLORS.ink
  )
  canvas.hLine(left + 156, midX - 16, footerTop + 86, COLORS.lineSoft, 1)

  const totH = L.totalRowH
  const totMid = midX + (right - midX) / 2

  // TOTAL HT
  canvas.rect(midX, footerTop, totMid - midX, totH, COLORS.fill)
  canvas.vLine(totMid, footerTop, footerTop + totH, COLORS.line, 1.5)
  canvas.hLine(midX, right, footerTop + totH, COLORS.line, 1.5)
  canvas.textInBand("TOTAL H.T.", midX + 12, footerTop, totH, 12, fonts.serifBold, COLORS.ink)
  canvas.textInBand("—", (totMid + right) / 2, footerTop, totH, 14, fonts.mono, COLORS.struck, {
    align: "center",
  })
  // strike through
  {
    const cy = footerTop + totH / 2
    const cx = (totMid + right) / 2
    canvas.hLine(cx - 10, cx + 10, cy, COLORS.struck, 1)
  }

  // TVA
  const tvaTop = footerTop + totH
  canvas.rect(midX, tvaTop, totMid - midX, totH, COLORS.fill)
  canvas.vLine(totMid, tvaTop, tvaTop + totH, COLORS.line, 1.5)
  canvas.hLine(midX, right, tvaTop + totH, COLORS.line, 1.5)
  canvas.textInBand("T.V.A.", midX + 12, tvaTop, totH, 12, fonts.serifBold, COLORS.ink)
  canvas.textInBand("—", (totMid + right) / 2, tvaTop, totH, 14, fonts.mono, COLORS.struck, {
    align: "center",
  })
  {
    const cy = tvaTop + totH / 2
    const cx = (totMid + right) / 2
    canvas.hLine(cx - 10, cx + 10, cy, COLORS.struck, 1)
  }

  // TTC
  const ttcTop = tvaTop + totH
  canvas.rect(midX, ttcTop, totMid - midX, totH, COLORS.line)
  canvas.vLine(totMid, ttcTop, bottom, COLORS.line, 1.5)
  canvas.textInBand("TOTAL T.T.C.", midX + 12, ttcTop, totH, 12, fonts.serifBold, COLORS.white)
  canvas.textInBand(
    formatTouristTaxEuro(model.amountTtc),
    right - 14,
    ttcTop,
    totH,
    16,
    fonts.monoBold,
    COLORS.ink,
    { align: "right" }
  )

  // Legal under frame
  const legalLines = wrapText(model.legalNotice, canvas, fonts.mono, 9, frameW)
  let ly = bottom + 12
  for (const line of legalLines) {
    canvas.text(line, left, ly + 9, 9, fonts.mono, COLORS.legal)
    ly += 12
  }

  const bytes = await doc.save()
  return Buffer.from(bytes)
}

async function embedFont(doc: PDFDocument, fileName: string) {
  const bytes = await readFile(path.join(FONT_DIR, fileName))
  return doc.embedFont(bytes, { subset: true })
}

function hex(value: string): RGB {
  const raw = value.replace("#", "")
  return rgb(
    Number.parseInt(raw.slice(0, 2), 16) / 255,
    Number.parseInt(raw.slice(2, 4), 16) / 255,
    Number.parseInt(raw.slice(4, 6), 16) / 255
  )
}

function sanitize(text: string) {
  return text.replace(/\u202f/g, " ").replace(/\u00a0/g, " ").replace(/×/g, "x")
}

function wrapText(
  text: string,
  canvas: Canvas,
  font: PDFFont,
  size: number,
  maxWidth: number
): string[] {
  const words = sanitize(text).split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ""
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (canvas.width(next, size, font) > maxWidth && current) {
      lines.push(current)
      current = word
    } else {
      current = next
    }
  }
  if (current) lines.push(current)
  return lines
}
