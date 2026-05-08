import { NextResponse } from "next/server"
import { gateInternalToolAccess } from "@/lib/auth/internal-session"
import { deleteWedding, updateWedding } from "@/lib/weddings-store"

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
      couple?: string
      contactName?: string
      email?: string
      phone?: string
      eventDate?: string
      depositAmount?: string
      balanceAmount?: string
      autopilot?: boolean
    }

    const updated = await updateWedding(weddingId, body)
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
