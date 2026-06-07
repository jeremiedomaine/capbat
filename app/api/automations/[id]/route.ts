import { NextResponse } from "next/server"
import { gateInternalToolAccess } from "@/lib/auth/internal-session"
import {
  deleteAutomation,
  getAutomationById,
  updateAutomation,
} from "@/lib/automations-store"
import { isEventType, type EventType } from "@/lib/event-types"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const denied = await gateInternalToolAccess()
  if (denied) return denied

  const { id } = await context.params
  try {
    const automation = await getAutomationById(id)
    if (!automation) {
      return NextResponse.json({ error: "Automatisation introuvable." }, { status: 404 })
    }
    return NextResponse.json({ automation })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur interne"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const denied = await gateInternalToolAccess()
  if (denied) return denied

  const { id } = await context.params
  try {
    const body = (await request.json()) as {
      name?: string
      dayOffset?: number
      subjectTemplate?: string
      messageTemplate?: string
      eventTypes?: string[]
      onlyIfBalancePending?: boolean
      isActive?: boolean
      isDefault?: boolean
      sortOrder?: number
    }

    const patch: Parameters<typeof updateAutomation>[1] = {}
    if (typeof body.name === "string") patch.name = body.name
    if (typeof body.dayOffset === "number") patch.dayOffset = body.dayOffset
    if (typeof body.subjectTemplate === "string") patch.subjectTemplate = body.subjectTemplate
    if (typeof body.messageTemplate === "string") patch.messageTemplate = body.messageTemplate
    if (Array.isArray(body.eventTypes)) {
      patch.eventTypes = body.eventTypes.filter((t): t is EventType => isEventType(t))
    }
    if (typeof body.onlyIfBalancePending === "boolean") patch.onlyIfBalancePending = body.onlyIfBalancePending
    if (typeof body.isActive === "boolean") patch.isActive = body.isActive
    if (typeof body.isDefault === "boolean") patch.isDefault = body.isDefault
    if (typeof body.sortOrder === "number") patch.sortOrder = body.sortOrder

    const automation = await updateAutomation(id, patch)
    return NextResponse.json({ automation })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur interne"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const denied = await gateInternalToolAccess()
  if (denied) return denied

  const { id } = await context.params
  try {
    await deleteAutomation(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur interne"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
