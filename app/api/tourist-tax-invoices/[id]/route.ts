import { NextResponse } from "next/server"
import { gateInternalToolAccess } from "@/lib/auth/internal-session"
import type { UpdateTouristTaxInvoiceInput } from "@/lib/tourist-tax-invoice-types"
import {
  deleteTouristTaxInvoice,
  getTouristTaxInvoice,
  updateTouristTaxInvoice,
} from "@/lib/tourist-tax-invoices-store"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: RouteContext) {
  try {
    const denied = await gateInternalToolAccess()
    if (denied) return denied
    const { id } = await context.params
    const invoice = await getTouristTaxInvoice(id)
    if (!invoice) {
      return NextResponse.json({ error: "Facture de taxe introuvable." }, { status: 404 })
    }
    return NextResponse.json({ invoice })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur interne"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const denied = await gateInternalToolAccess()
    if (denied) return denied
    const { id } = await context.params
    const body = (await request.json()) as UpdateTouristTaxInvoiceInput

    if (!body || Object.keys(body).length === 0) {
      return NextResponse.json({ error: "Aucune modification fournie." }, { status: 400 })
    }

    const invoice = await updateTouristTaxInvoice(id, body)
    if (!invoice) {
      return NextResponse.json({ error: "Facture de taxe introuvable." }, { status: 404 })
    }
    return NextResponse.json({ invoice })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur interne"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const denied = await gateInternalToolAccess()
    if (denied) return denied
    const { id } = await context.params
    const ok = await deleteTouristTaxInvoice(id)
    if (!ok) {
      return NextResponse.json({ error: "Facture de taxe introuvable." }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur interne"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
