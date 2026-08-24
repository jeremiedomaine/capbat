import { getResendClient } from "@/lib/resend"

export type ResendEmailPayload = {
  from: string
  to: string | string[]
  subject: string
  text?: string
  html?: string
}

export async function sendResendEmail(payload: ResendEmailPayload): Promise<{ id: string }> {
  const resend = getResendClient()
  const { data, error } = await resend.emails.send({
    from: payload.from,
    to: payload.to,
    subject: payload.subject,
    ...(payload.html ? { html: payload.html } : {}),
    ...(payload.text ? { text: payload.text } : {}),
  } as Parameters<typeof resend.emails.send>[0])

  if (error) {
    throw new Error(error.message || "Erreur Resend.")
  }
  if (!data?.id) {
    throw new Error("Resend n'a pas renvoyé d'identifiant d'envoi.")
  }

  return { id: data.id }
}
