import { getResendClient } from "@/lib/resend"
import {
  appendOutboundFooter,
  getOutboundEmailMeta,
} from "@/lib/outbound-email"

export type ResendEmailPayload = {
  from: string
  to: string | string[]
  subject: string
  text?: string
  html?: string
  /** Si false, n’ajoute pas Reply-To / footer / List-Unsubscribe. */
  applyDeliverabilityDefaults?: boolean
}

export async function sendResendEmail(payload: ResendEmailPayload): Promise<{ id: string }> {
  const resend = getResendClient()
  const applyDefaults = payload.applyDeliverabilityDefaults !== false

  let text = payload.text
  let replyTo: string | undefined
  let headers: Record<string, string> | undefined

  if (applyDefaults) {
    const meta = await getOutboundEmailMeta(payload.from)
    replyTo = meta.replyTo
    headers = meta.headers
    if (text) {
      text = appendOutboundFooter(text, meta.footerText)
    }
    if (meta.from) {
      payload = { ...payload, from: meta.from }
    }
  }

  const { data, error } = await resend.emails.send({
    from: payload.from,
    to: payload.to,
    subject: payload.subject,
    ...(text ? { text } : {}),
    ...(payload.html ? { html: payload.html } : {}),
    ...(replyTo ? { replyTo } : {}),
    ...(headers ? { headers } : {}),
  } as Parameters<typeof resend.emails.send>[0])

  if (error) {
    throw new Error(error.message || "Erreur Resend.")
  }
  if (!data?.id) {
    throw new Error("Resend n'a pas renvoyé d'identifiant d'envoi.")
  }

  return { id: data.id }
}
