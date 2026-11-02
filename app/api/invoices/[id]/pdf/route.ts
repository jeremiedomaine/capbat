import { NextResponse } from "next/server"
import { gateInternalToolAccess } from "@/lib/auth/internal-session"
import { buildInvoiceDocument, type InvoiceDocumentDraft } from "@/lib/invoice-document"
import { buildInvoicePdf } from "@/lib/invoice-pdf"
import type { Invoice, UpdateInvoiceInput } from "@/lib/invoice-types"
import { getInvoice } from "@/lib/invoices-store"
import { getWeddingById } from "@/lib/weddings-store"
import { getWorkspaceSettings } from "@/lib/workspace-settings-store"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ id: string }> }

/** PDF de la facture enregistrée (téléchargement). */
export async function GET(_request: Request, context: RouteContext) {
  return handle(context, null, "attachment")
}

/** PDF de l'état en cours d'édition, sans l'enregistrer. */
export async function POST(request: Request, context: RouteContext) {
  const draft = (await request.json().catch(() => null)) as UpdateInvoiceInput | null
  return handle(context, draft, "inline")
}

async function handle(
  context: RouteContext,
  draft: UpdateInvoiceInput | null,
  disposition: "attachment" | "inline"
) {
  try {
    const denied = await gateInternalToolAccess()
    if (denied) return denied

    const { id } = await context.params
    const invoice = await getInvoice(id)
    if (!invoice) {
      return NextResponse.json({ error: "Facture introuvable." }, { status: 404 })
    }

    const [settings, wedding] = await Promise.all([
      getWorkspaceSettings(),
      getWeddingById(invoice.weddingId).catch(() => null),
    ])

    const model = buildInvoiceDocument({
      invoice: applyDraft(invoice, draft),
      wedding,
      settings,
    })
    const pdf = await buildInvoicePdf(model)
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
    console.error("[invoice-pdf]", error)
    const message = error instanceof Error ? error.message : "Erreur interne"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function applyDraft(invoice: Invoice, draft: UpdateInvoiceInput | null): InvoiceDocumentDraft {
  if (!draft) return invoice
  return {
    ...invoice,
    lineItems: Array.isArray(draft.lineItems) ? draft.lineItems : invoice.lineItems,
    issuedAt: draft.issuedAt ?? invoice.issuedAt,
    dueAt: draft.dueAt ?? invoice.dueAt,
    vatRate: typeof draft.vatRate === "number" ? draft.vatRate : invoice.vatRate,
    notes: draft.notes ?? invoice.notes,
    client: draft.client ?? invoice.client,
    status: draft.status ?? invoice.status,
  }
}
