import { isValidEmail } from "@/lib/form-validation"
import { DEFAULT_BILLING_PROFILE } from "@/lib/billing-local-storage"
import {
  DEFAULT_WORKSPACE_SETTINGS,
  type WorkspaceSettings,
} from "@/lib/workspace-settings"
import { getWorkspaceSettings } from "@/lib/workspace-settings-store"

const DEFAULT_FROM_NAME = "Cap'Bat"
const DEFAULT_REPLY_TO = "domaine.capbat@gmail.com"

export type OutboundEmailMeta = {
  from?: string
  replyTo?: string
  headers?: Record<string, string>
  footerText: string
}

function isPlaceholderSettings(settings: WorkspaceSettings) {
  return (
    settings.companyName === DEFAULT_WORKSPACE_SETTINGS.companyName ||
    settings.contactEmail === DEFAULT_WORKSPACE_SETTINGS.contactEmail ||
    settings.billing.addressLine === DEFAULT_BILLING_PROFILE.addressLine
  )
}

function extractEmailAddress(raw: string): string {
  const angled = raw.match(/<([^>]+)>/)
  if (angled?.[1]) return angled[1].trim()
  const plain = raw.match(/[^\s<>]+@[^\s<>]+/)
  return plain?.[0]?.trim() ?? raw.trim()
}

export function formatFromAddress(rawFrom: string, displayName: string): string {
  const email = extractEmailAddress(rawFrom)
  const name = displayName.replace(/[<>"]/g, "").trim() || DEFAULT_FROM_NAME
  return `${name} <${email}>`
}

/**
 * From = nom Cap'Bat (adresse venqor.app inchangée).
 * Reply-To = Gmail Capucine pour que les réponses arrivent chez elle.
 */
export async function getOutboundEmailMeta(rawFrom?: string): Promise<OutboundEmailMeta> {
  const settings = await getWorkspaceSettings()
  const envReplyTo = process.env.RESEND_REPLY_TO?.trim() || ""
  const replyToCandidate = envReplyTo || DEFAULT_REPLY_TO
  const replyTo = isValidEmail(replyToCandidate) ? replyToCandidate : DEFAULT_REPLY_TO

  const useBrand = !isPlaceholderSettings(settings)
  const displayName =
    process.env.RESEND_FROM_NAME?.trim() ||
    (useBrand ? settings.companyName.trim() : "") ||
    DEFAULT_FROM_NAME

  const fromSource = (rawFrom || process.env.RESEND_FROM_EMAIL || "").trim()
  const from = fromSource ? formatFromAddress(fromSource, displayName) : undefined

  const addressLine = useBrand
    ? [
        settings.billing.addressLine.trim(),
        [settings.billing.postalCode.trim(), settings.billing.city.trim()].filter(Boolean).join(" "),
      ]
        .filter(Boolean)
        .join(", ")
    : ""

  const company = useBrand ? settings.companyName.trim() : DEFAULT_FROM_NAME

  const footerParts = [
    "--",
    company || null,
    addressLine || null,
    replyTo
      ? `Pour ne plus recevoir ces messages, répondez à cet e-mail ou écrivez à ${replyTo}.`
      : null,
  ].filter((part): part is string => Boolean(part))

  const headers: Record<string, string> = {}
  if (replyTo) {
    headers["List-Unsubscribe"] = `<mailto:${replyTo}?subject=${encodeURIComponent("Désinscription relances")}>`
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"
  }

  return {
    from,
    replyTo,
    headers: Object.keys(headers).length ? headers : undefined,
    footerText: footerParts.join("\n"),
  }
}

export function appendOutboundFooter(body: string, footerText: string): string {
  const trimmed = body.replace(/\s+$/u, "")
  if (!footerText.trim()) return trimmed
  if (trimmed.includes(footerText.trim())) return trimmed
  return `${trimmed}\n\n${footerText}`
}
