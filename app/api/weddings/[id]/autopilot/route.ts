import { NextResponse } from "next/server"
import { gateInternalToolAccess } from "@/lib/auth/internal-session"
import { updateWeddingAutopilot } from "@/lib/weddings-store"

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

  const body = (await request.json()) as { autopilot?: boolean }
  if (typeof body.autopilot !== "boolean") {
    return NextResponse.json({ error: "Valeur autopilot invalide." }, { status: 400 })
  }

  const updated = await updateWeddingAutopilot(weddingId, body.autopilot)
  if (!updated) {
    return NextResponse.json({ error: "Evenement introuvable." }, { status: 404 })
  }

  return NextResponse.json({ wedding: updated })
}
