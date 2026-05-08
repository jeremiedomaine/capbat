import { NextResponse } from "next/server"
import { gateInternalToolAccess } from "@/lib/auth/internal-session"
import { type PaymentStatus, updateWeddingPaymentStatus } from "@/lib/weddings-store"

const validStatuses: PaymentStatus[] = ["pending", "paid", "to_collect"]

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const denied = await gateInternalToolAccess()
  if (denied) return denied

  const { id } = await context.params
  const weddingId = Number.parseInt(id, 10)

  if (!Number.isInteger(weddingId)) {
    return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 })
  }

  const body = (await request.json()) as {
    field?: "deposit" | "balance"
    status?: PaymentStatus
  }

  if (!body.field || !body.status || !validStatuses.includes(body.status)) {
    return NextResponse.json({ error: "Champ ou statut invalide." }, { status: 400 })
  }

  const updated = await updateWeddingPaymentStatus(weddingId, body.field, body.status)
  if (!updated) {
    return NextResponse.json({ error: "Evenement introuvable." }, { status: 404 })
  }

  return NextResponse.json({ wedding: updated })
}
