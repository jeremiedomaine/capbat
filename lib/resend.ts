import { Resend } from "resend"
import { isReadOnlyMode, READ_ONLY_MESSAGE } from "@/lib/read-only"

let resendClient: Resend | null = null

export function getResendClient() {
  if (isReadOnlyMode()) {
    throw new Error(`${READ_ONLY_MESSAGE} Aucun e-mail n'est envoyé.`)
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error("RESEND_API_KEY manquante.")
  }

  if (!resendClient) {
    resendClient = new Resend(apiKey)
  }

  return resendClient
}
