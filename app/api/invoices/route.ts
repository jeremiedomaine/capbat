import { NextResponse } from "next/server"
import { gateInternalToolAccess } from "@/lib/auth/internal-session"
import { createInvoice, listInvoices } from "@/lib/invoices-store"
import type { CreateInvoiceInput } from "@/lib/invoice-types"
import { lineItemsTotal } from "@/lib/invoice-utils"

export async function GET() {
  try {
    const denied = await gateInternalToolAccess()
    if (denied) return denied
    const invoices = await listInvoices()
    return NextResponse.json({ invoices })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur interne"
    return NextResponse.json({ error: message, invoices: [] }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const denied = await gateInternalToolAccess()
    if (denied) return denied

    const body = (await request.json()) as Partial<CreateInvoiceInput>
    if (
      !body.weddingId ||
      !body.couple ||
      !body.type ||
      !body.issuer ||
      !body.client ||
      !body.lineItems?.length
    ) {
      return NextResponse.json(
        { error: "Champs obligatoires manquants pour créer une facture." },
        { status: 400 }
      )
    }

    const invoice = await createInvoice({
      weddingId: Number(body.weddingId),
      couple: body.couple,
      type: body.type,
      amountTtc: body.amountTtc ?? lineItemsTotal(body.lineItems),
      lineItems: body.lineItems,
      issuer: body.issuer,
      client: body.client,
      issuedAt: body.issuedAt,
      dueAt: body.dueAt,
      vatRate: body.vatRate,
      notes: body.notes,
      status: body.status,
    })

    return NextResponse.json({ invoice }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur interne"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
