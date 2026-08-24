/** Validation légère côté client (complète les attributs HTML natifs). */

import { isWeddingEventType, requiresContactName, type EventType } from "@/lib/event-types"

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(value: string): boolean {
  const t = value.trim()
  return t.length > 0 && EMAIL_REGEX.test(t)
}

/** Montant saisi type formulaire (€, virgule). Retourne null si invalide. */
export function parseEuroInput(raw: string): number | null {
  const cleaned = raw.replace(/[^\d,.-]/g, "").replace(",", ".")
  const n = Number.parseFloat(cleaned)
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

export type NewEventFormInput = {
  eventType?: EventType
  eventName: string
  spouse1FirstName: string
  spouse1LastName: string
  spouse2FirstName: string
  spouse2LastName: string
  spouse1Phone?: string
  spouse2Phone?: string
  contactName: string
  email: string
  phone: string
  eventDate: string
  depositAmount: string
  balanceAmount: string
  depositAlreadyPaid?: boolean
  depositPaidDate?: string
}

export function validateNewEventInput(input: NewEventFormInput): string | null {
  const eventType = input.eventType ?? "wedding"

  if (!input.eventName.trim()) return "Indiquez le nom de l'événement."

  if (isWeddingEventType(eventType)) {
    if (!input.spouse1FirstName.trim() || !input.spouse1LastName.trim()) {
      return "Indiquez le prénom et le nom du premier marié."
    }
    if (!input.spouse2FirstName.trim() || !input.spouse2LastName.trim()) {
      return "Indiquez le prénom et le nom du second marié."
    }
  } else if (!input.contactName.trim()) {
    return "Indiquez le nom du contact."
  }

  if (!isValidEmail(input.email)) return "Adresse e-mail invalide."
  const hasPhone =
    input.phone.trim() ||
    (input.spouse1Phone ?? "").trim() ||
    (input.spouse2Phone ?? "").trim()
  if (!hasPhone) return "Indiquez au moins un numéro de téléphone."
  if (!input.eventDate.trim()) return "Choisissez une date."

  if (input.depositAlreadyPaid && !(input.depositPaidDate ?? "").trim()) {
    return "Indiquez la date de versement de l'acompte."
  }

  const dep = parseEuroInput(input.depositAmount)
  const bal = parseEuroInput(input.balanceAmount)
  if (dep === null) return "Montant d’acompte invalide (nombre positif ou zéro)."
  if (bal === null) return "Montant de solde invalide (nombre positif ou zéro)."
  return null
}

export type EditEventFormInput = {
  couple: string
  contactName: string
  email: string
  phone: string
  eventDate: string
  depositAmount: string
  balanceAmount: string
  eventType?: EventType
}

/** Validation du dialogue « Modifier l'événement » (liste / tableau). */
export function validateEditWeddingInput(input: EditEventFormInput): string | null {
  const eventType = input.eventType ?? "wedding"

  if (!input.couple.trim()) {
    return isWeddingEventType(eventType)
      ? "Indiquez le nom du couple."
      : "Indiquez le nom de l'événement."
  }

  if (requiresContactName(eventType) && !input.contactName.trim()) {
    return "Indiquez le nom du contact."
  }

  if (!isValidEmail(input.email)) return "Adresse e-mail invalide."
  if (!input.phone.trim()) return "Indiquez un numéro de téléphone."
  if (!input.eventDate.trim()) return "Choisissez une date."

  const dep = parseEuroInput(input.depositAmount)
  const bal = parseEuroInput(input.balanceAmount)
  if (dep === null) return "Montant d’acompte invalide (nombre positif ou zéro)."
  if (bal === null) return "Montant de solde invalide (nombre positif ou zéro)."
  return null
}

/** @deprecated Utiliser validateNewEventInput pour la création. */
export function validateNewWeddingInput(input: EditEventFormInput): string | null {
  return validateEditWeddingInput(input)
}
