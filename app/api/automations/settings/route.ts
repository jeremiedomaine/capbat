import { NextResponse } from "next/server"
import { gateInternalToolAccess } from "@/lib/auth/internal-session"
import {
  DEFAULT_AUTOMATION_SUBJECT,
  DEFAULT_POST_EVENT_AUTOMATION_SUBJECT,
} from "@/lib/automation-defaults"
import { getAutomationSettings, upsertAutomationSettings } from "@/lib/automation-settings-store"

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
      postEventMessageTemplate?: string
      postEventSubjectTemplate?: string
    }

    if (typeof body.messageTemplate !== "string" || !body.messageTemplate.trim()) {
      return NextResponse.json({ error: "Le corps du message J-30 est obligatoire." }, { status: 400 })
    }
    if (
      typeof body.postEventMessageTemplate !== "string" ||
      !body.postEventMessageTemplate.trim()
    ) {
      return NextResponse.json(
        { error: "Le corps du message J+3 est obligatoire." },
        { status: 400 }
      )
    }

    await upsertAutomationSettings({
      messageTemplate: body.messageTemplate,
      subjectTemplate:
        typeof body.subjectTemplate === "string" && body.subjectTemplate.trim()
          ? body.subjectTemplate.trim()
          : DEFAULT_AUTOMATION_SUBJECT,
      postEventMessageTemplate: body.postEventMessageTemplate,
      postEventSubjectTemplate:
        typeof body.postEventSubjectTemplate === "string" && body.postEventSubjectTemplate.trim()
          ? body.postEventSubjectTemplate.trim()
          : DEFAULT_POST_EVENT_AUTOMATION_SUBJECT,
    })

    const settings = await getAutomationSettings()
    return NextResponse.json({ settings })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur interne"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
