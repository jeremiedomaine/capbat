import { NextResponse } from "next/server"
import { gateInternalToolAccess } from "@/lib/auth/internal-session"
import { getInvoice } from "@/lib/invoices-store"
import { buildInvoicePdf } from "@/lib/invoice-pdf"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: RouteContext) {
  try {
    const denied = await gateInternalToolAccess()
    if (denied) return denied

    const { id } = await context.params
    const invoice = await getInvoice(id)
    if (!invoice) {
      return NextResponse.json({ error: "Facture introuvable." }, { status: 404 })
    }

    const pdf = await buildInvoicePdf(invoice)
    const filename = `${invoice.number.replace(/\s+/g, "_")}.pdf`

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    console.error("[invoice-pdf]", error)
    const message = error instanceof Error ? error.message : "Erreur interne"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
