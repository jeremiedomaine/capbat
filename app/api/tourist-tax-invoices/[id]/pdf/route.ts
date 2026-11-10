import { NextResponse } from "next/server"
import { gateInternalToolAccess } from "@/lib/auth/internal-session"
import { buildTouristTaxDocument, type TouristTaxDocumentDraft } from "@/lib/tourist-tax-document"
import { buildTouristTaxPdf } from "@/lib/tourist-tax-pdf"
import type { TouristTaxInvoice, UpdateTouristTaxInvoiceInput } from "@/lib/tourist-tax-invoice-types"
import { getTouristTaxInvoice } from "@/lib/tourist-tax-invoices-store"
import { getWorkspaceSettings } from "@/lib/workspace-settings-store"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: RouteContext) {
  return handle(context, null, "attachment")
}

export async function POST(request: Request, context: RouteContext) {
  const draft = (await request.json().catch(() => null)) as UpdateTouristTaxInvoiceInput | null
  return handle(context, draft, "inline")
}

async function handle(
  context: RouteContext,
  draft: UpdateTouristTaxInvoiceInput | null,
  disposition: "attachment" | "inline"
) {
  try {
    const denied = await gateInternalToolAccess()
    if (denied) return denied

    const { id } = await context.params
    const invoice = await getTouristTaxInvoice(id)
    if (!invoice) {
      return NextResponse.json({ error: "Facture de taxe introuvable." }, { status: 404 })
    }

    const settings = await getWorkspaceSettings()
    const model = buildTouristTaxDocument({
      invoice: applyDraft(invoice, draft),
      settings,
    })
    const pdf = await buildTouristTaxPdf(model)
    const filename = `${invoice.number.replace(/\s+/g, "_")}.pdf`

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    console.error("[tourist-tax-pdf]", error)
    const message = error instanceof Error ? error.message : "Erreur interne"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function applyDraft(
  invoice: TouristTaxInvoice,
  draft: UpdateTouristTaxInvoiceInput | null
): TouristTaxDocumentDraft {
  if (!draft) {
    return {
      number: invoice.number,
      periodStart: invoice.periodStart,
      periodEnd: invoice.periodEnd,
      issuedAt: invoice.issuedAt,
      paidAt: invoice.paidAt,
      paymentMethod: invoice.paymentMethod,
      lines: invoice.lines,
      rate: invoice.rate,
      clientName: invoice.clientName,
      amountTtc: invoice.amountTtc,
    }
  }
  return {
    number: invoice.number,
    periodStart: draft.periodStart ?? invoice.periodStart,
    periodEnd: draft.periodEnd ?? invoice.periodEnd,
    issuedAt: draft.issuedAt ?? invoice.issuedAt,
    paidAt: draft.paidAt ?? invoice.paidAt,
    paymentMethod: draft.paymentMethod ?? invoice.paymentMethod,
    lines: Array.isArray(draft.lines) ? draft.lines : invoice.lines,
    rate: invoice.rate,
    clientName: draft.clientName ?? invoice.clientName,
    amountTtc: invoice.amountTtc,
  }
}
