import { NextResponse } from "next/server"
import { gateInternalToolAccess } from "@/lib/auth/internal-session"
import {
  AUTOMATION_PREVIEW_DAYS_AHEAD,
  AUTOMATION_PREVIEW_SAMPLE_WEDDING,
} from "@/lib/automation-preview-sample"
import { buildAutomationVariableMap, renderTemplate } from "@/lib/email-template"
import { isValidEmail } from "@/lib/form-validation"
import { getResendClient } from "@/lib/resend"

export async function POST(request: Request) {
  const denied = await gateInternalToolAccess()
  if (denied) return denied

  const fromEmail = process.env.RESEND_FROM_EMAIL?.trim()
  if (!fromEmail) {
    return NextResponse.json(
      { error: "RESEND_FROM_EMAIL manquante sur le serveur." },
      { status: 500 }
    )
  }

  let body: {
    to?: string
    subjectTemplate?: string
    messageTemplate?: string
    daysAhead?: number
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 })
  }

  const to = typeof body.to === "string" ? body.to.trim() : ""
  if (!to || !isValidEmail(to)) {
    return NextResponse.json(
      {
        error:
          "Adresse e-mail destinataire invalide. Renseignez un e-mail de contact valide dans Paramètres.",
      },
      { status: 400 }
    )
  }

  const subjectRaw =
    typeof body.subjectTemplate === "string" ? body.subjectTemplate.trim() : ""
  const messageRaw =
    typeof body.messageTemplate === "string" ? body.messageTemplate.trim() : ""

  if (!subjectRaw) {
    return NextResponse.json({ error: "L’objet du message est vide." }, { status: 400 })
  }
  if (!messageRaw) {
    return NextResponse.json({ error: "Le corps du message est vide." }, { status: 400 })
  }

  const daysAhead =
    typeof body.daysAhead === "number" &&
    Number.isFinite(body.daysAhead) &&
    body.daysAhead >= 0 &&
    body.daysAhead <= 365
      ? Math.floor(body.daysAhead)
      : AUTOMATION_PREVIEW_DAYS_AHEAD

  const vars = buildAutomationVariableMap(AUTOMATION_PREVIEW_SAMPLE_WEDDING, daysAhead)
  const subjectRendered = renderTemplate(subjectRaw, vars)
  const textRendered = renderTemplate(messageRaw, vars)

  try {
    const resend = getResendClient()
    await resend.emails.send({
      from: fromEmail,
      to,
      subject: `[Test] ${subjectRendered}`,
      text:
        `${textRendered}\n\n---\nE-mail de test envoyé depuis la page Automatisations (variables factices d’aperçu).`,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur Resend."
    return NextResponse.json({ error: message }, { status: 502 })
  }

  return NextResponse.json({ ok: true, to })
}
