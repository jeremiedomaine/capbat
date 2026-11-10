import { NextResponse } from "next/server"
import { gateInternalToolAccess } from "@/lib/auth/internal-session"
import type { CreateTouristTaxInvoiceInput } from "@/lib/tourist-tax-invoice-types"
import {
  createTouristTaxInvoice,
  listTouristTaxInvoices,
} from "@/lib/tourist-tax-invoices-store"
import { countStayNights } from "@/lib/tourist-tax"

export async function GET() {
  try {
    const denied = await gateInternalToolAccess()
    if (denied) return denied
    const invoices = await listTouristTaxInvoices()
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

    const body = (await request.json()) as Partial<CreateTouristTaxInvoiceInput>
    if (!body.weddingId || !body.couple || !body.clientName || !body.periodStart || !body.periodEnd) {
      return NextResponse.json(
        { error: "Champs obligatoires manquants (événement, client, période)." },
        { status: 400 }
      )
    }

    const nights = countStayNights(body.periodStart, body.periodEnd)
    if (nights <= 0) {
      return NextResponse.json(
        { error: "La période de séjour est invalide (arrivée / départ)." },
        { status: 400 }
      )
    }

    if (!body.lines?.length) {
      return NextResponse.json(
        { error: "Ajoutez au moins une ligne d'occupation." },
        { status: 400 }
      )
    }

    const invoice = await createTouristTaxInvoice({
      weddingId: Number(body.weddingId),
      couple: body.couple,
      periodStart: body.periodStart,
      periodEnd: body.periodEnd,
      lines: body.lines,
      issuedAt: body.issuedAt,
      paidAt: body.paidAt,
      paymentMethod: body.paymentMethod,
      clientName: body.clientName,
      clientAddress: body.clientAddress,
      notes: body.notes,
      status: body.status,
      rate: body.rate,
    })

    return NextResponse.json({ invoice }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur interne"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
