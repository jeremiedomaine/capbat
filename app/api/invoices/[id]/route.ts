import { NextResponse } from "next/server"
import { gateInternalToolAccess } from "@/lib/auth/internal-session"
import { deleteInvoice, getInvoice, updateInvoiceStatus } from "@/lib/invoices-store"
import type { InvoiceStatus } from "@/lib/invoice-types"

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
    const body = (await request.json()) as { status?: InvoiceStatus }
    if (!body.status) {
      return NextResponse.json({ error: "Statut manquant." }, { status: 400 })
    }
    const invoice = await updateInvoiceStatus(id, body.status)
    if (!invoice) {
      return NextResponse.json({ error: "Facture introuvable." }, { status: 404 })
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
    const ok = await deleteInvoice(id)
    if (!ok) {
      return NextResponse.json({ error: "Facture introuvable." }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur interne"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
