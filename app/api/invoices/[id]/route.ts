import { NextResponse } from "next/server"
import { gateInternalToolAccess } from "@/lib/auth/internal-session"
import { deleteInvoice, getInvoice, updateInvoice } from "@/lib/invoices-store"
import type { InvoiceStatus, UpdateInvoiceInput } from "@/lib/invoice-types"

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
    const body = (await request.json()) as UpdateInvoiceInput & { status?: InvoiceStatus }

    if (!body || Object.keys(body).length === 0) {
      return NextResponse.json({ error: "Aucune modification fournie." }, { status: 400 })
    }

    const invoice = await updateInvoice(id, body)
    if (!invoice) {
      return NextResponse.json({ error: "Facture introuvable." }, { status: 404 })
    }
    return NextResponse.json({ invoice })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur interne"
    const status = message.includes("verrouillée") ? 423 : 500
    return NextResponse.json({ error: message }, { status })
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
