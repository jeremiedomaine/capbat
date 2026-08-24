import { NextResponse } from "next/server"
import { gateInternalToolAccess } from "@/lib/auth/internal-session"
import { parseEventType } from "@/lib/event-types"
import { parsePaymentMethod } from "@/lib/payment-methods"
import { deleteWedding, getWeddingById, updateWedding } from "@/lib/weddings-store"

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const denied = await gateInternalToolAccess()
    if (denied) return denied

    const { id } = await context.params
    const weddingId = Number.parseInt(id, 10)
    if (!Number.isInteger(weddingId)) {
      return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 })
    }

    const wedding = await getWeddingById(weddingId)
    if (!wedding) {
      return NextResponse.json({ error: "Evenement introuvable." }, { status: 404 })
    }

    return NextResponse.json({ wedding })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur interne"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const denied = await gateInternalToolAccess()
    if (denied) return denied

    const { id } = await context.params
    const weddingId = Number.parseInt(id, 10)

    if (!Number.isInteger(weddingId)) {
      return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 })
    }

    const body = (await request.json()) as {
      eventType?: string
      couple?: string
      contactName?: string
      email?: string
      phone?: string
      eventDate?: string
      depositAmount?: string
      balanceAmount?: string
      autopilot?: boolean
      depositPaidDate?: string | null
      depositPaymentMethod?: string | null
      balancePaidDate?: string | null
      balancePaymentMethod?: string | null
    }

    const updated = await updateWedding(weddingId, {
      eventType: body.eventType ? parseEventType(body.eventType) : undefined,
      couple: body.couple,
      contactName: body.contactName,
      email: body.email,
      phone: body.phone,
      eventDate: body.eventDate,
      depositAmount: body.depositAmount,
      balanceAmount: body.balanceAmount,
      autopilot: body.autopilot,
      depositPaidDate: body.depositPaidDate === undefined ? undefined : body.depositPaidDate ?? "",
      depositPaymentMethod:
        body.depositPaymentMethod === undefined
          ? undefined
          : parsePaymentMethod(body.depositPaymentMethod),
      balancePaidDate: body.balancePaidDate === undefined ? undefined : body.balancePaidDate ?? "",
      balancePaymentMethod:
        body.balancePaymentMethod === undefined
          ? undefined
          : parsePaymentMethod(body.balancePaymentMethod),
    })
    if (!updated) {
      return NextResponse.json({ error: "Evenement introuvable." }, { status: 404 })
    }

    return NextResponse.json({ wedding: updated })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur interne"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const denied = await gateInternalToolAccess()
  if (denied) return denied

  const { id } = await context.params
  const weddingId = Number.parseInt(id, 10)

  if (!Number.isInteger(weddingId)) {
    return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 })
  }

  const deleted = await deleteWedding(weddingId)
  if (!deleted) {
    return NextResponse.json({ error: "Evenement introuvable." }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
