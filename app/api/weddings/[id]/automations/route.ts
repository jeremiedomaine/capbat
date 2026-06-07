import { NextResponse } from "next/server"
import { gateInternalToolAccess } from "@/lib/auth/internal-session"
import {
  getEventAutomationsView,
  setEventAutomationEnabled,
} from "@/lib/event-automations-store"
import { parseEventType } from "@/lib/event-types"
import { getWeddingById } from "@/lib/weddings-store"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const denied = await gateInternalToolAccess()
  if (denied) return denied

  const { id } = await context.params
  const eventId = Number.parseInt(id, 10)
  if (!Number.isInteger(eventId)) {
    return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 })
  }

  try {
    const wedding = await getWeddingById(eventId)
    if (!wedding) {
      return NextResponse.json({ error: "Événement introuvable." }, { status: 404 })
    }
    const automations = await getEventAutomationsView(eventId, wedding.eventType)
    const activeCount = automations.filter((a) => a.enabled).length
    return NextResponse.json({ automations, activeCount })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur interne"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const denied = await gateInternalToolAccess()
  if (denied) return denied

  const { id } = await context.params
  const eventId = Number.parseInt(id, 10)
  if (!Number.isInteger(eventId)) {
    return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 })
  }

  try {
    const body = (await request.json()) as {
      automationId?: string
      enabled?: boolean
      eventType?: string
    }

    if (!body.automationId || typeof body.enabled !== "boolean") {
      return NextResponse.json({ error: "automationId et enabled requis." }, { status: 400 })
    }

    const wedding = await getWeddingById(eventId)
    if (!wedding) {
      return NextResponse.json({ error: "Événement introuvable." }, { status: 404 })
    }

    const eventType = body.eventType ? parseEventType(body.eventType) : wedding.eventType
    const views = await getEventAutomationsView(eventId, eventType)
    const target = views.find((v) => v.automationId === body.automationId)
    if (!target?.compatible) {
      return NextResponse.json({ error: "Automatisation incompatible avec ce type." }, { status: 400 })
    }

    await setEventAutomationEnabled(eventId, body.automationId, body.enabled)
    const automations = await getEventAutomationsView(eventId, eventType)
    const activeCount = automations.filter((a) => a.enabled).length
    return NextResponse.json({ automations, activeCount })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur interne"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
