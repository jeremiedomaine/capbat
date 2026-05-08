import { NextResponse } from "next/server"
import { gateInternalToolAccess } from "@/lib/auth/internal-session"
import { getAutomationSettings, upsertAutomationSettings } from "@/lib/automation-settings-store"

const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/

export async function GET() {
  const denied = await gateInternalToolAccess()
  if (denied) return denied

  try {
    const settings = await getAutomationSettings()
    return NextResponse.json({ settings })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur interne"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const denied = await gateInternalToolAccess()
  if (denied) return denied

  try {
    const body = (await request.json()) as {
      messageTemplate?: string
      subjectTemplate?: string
      sendTime?: string
    }

    if (typeof body.messageTemplate !== "string" || !body.messageTemplate.trim()) {
      return NextResponse.json({ error: "Le corps du message est obligatoire." }, { status: 400 })
    }

    const sendTime = typeof body.sendTime === "string" ? body.sendTime.trim() : ""
    if (!timeRe.test(sendTime)) {
      return NextResponse.json({ error: "Créneau invalide (format HH:mm)." }, { status: 400 })
    }

    const subjectTemplate =
      typeof body.subjectTemplate === "string" && body.subjectTemplate.trim()
        ? body.subjectTemplate.trim()
        : undefined

    await upsertAutomationSettings({
      messageTemplate: body.messageTemplate,
      subjectTemplate: subjectTemplate ?? "",
      sendTime,
    })

    const settings = await getAutomationSettings()
    return NextResponse.json({ settings })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur interne"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
