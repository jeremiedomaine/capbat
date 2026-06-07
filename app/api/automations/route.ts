import { NextResponse } from "next/server"
import { gateInternalToolAccess } from "@/lib/auth/internal-session"
import {
  countAutomations,
  createAutomation,
  listAutomations,
  type AutomationInput,
} from "@/lib/automations-store"
import { isEventType, type EventType } from "@/lib/event-types"

export async function GET() {
  const denied = await gateInternalToolAccess()
  if (denied) return denied

  try {
    const automations = await listAutomations()
    return NextResponse.json({ automations })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur interne"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const denied = await gateInternalToolAccess()
  if (denied) return denied

  try {
    const body = (await request.json()) as Partial<AutomationInput>
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Le nom est obligatoire." }, { status: 400 })
    }
    if (typeof body.dayOffset !== "number") {
      return NextResponse.json({ error: "Le délai J±N est obligatoire." }, { status: 400 })
    }
    if (!body.subjectTemplate?.trim() || !body.messageTemplate?.trim()) {
      return NextResponse.json({ error: "Objet et message sont obligatoires." }, { status: 400 })
    }
    const eventTypes = (body.eventTypes ?? []).filter((t): t is EventType => isEventType(t))
    if (!eventTypes.length) {
      return NextResponse.json({ error: "Sélectionnez au moins un type d'événement." }, { status: 400 })
    }

    const total = await countAutomations()
    const created = await createAutomation({
      name: body.name,
      dayOffset: body.dayOffset,
      subjectTemplate: body.subjectTemplate,
      messageTemplate: body.messageTemplate,
      eventTypes,
      onlyIfBalancePending: body.onlyIfBalancePending ?? false,
      isActive: body.isActive ?? true,
      isDefault: body.isDefault ?? false,
      sortOrder: body.sortOrder ?? total + 1,
    })

    return NextResponse.json({ automation: created }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur interne"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
