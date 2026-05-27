/** Validation légère côté client (complète les attributs HTML natifs). */

import { type EventType } from "@/lib/event-types"

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
  contactName: string
  email: string
  phone: string
  eventDate: string
  depositAmount: string
  balanceAmount: string
}

export function validateNewEventInput(input: NewEventFormInput): string | null {
  const eventType = input.eventType ?? "wedding"

  if (!input.eventName.trim()) return "Indiquez le nom de l'événement."

  if (eventType === "wedding") {
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
  if (!input.phone.trim()) return "Indiquez un numéro de téléphone."
  if (!input.eventDate.trim()) return "Choisissez une date."

  const dep = parseEuroInput(input.depositAmount)
  const bal = parseEuroInput(input.balanceAmount)
  if (dep === null) return "Montant d’acompte invalide (nombre positif ou zéro)."
  if (bal === null) return "Montant de solde invalide (nombre positif ou zéro)."
  return null
}

/** @deprecated Utiliser validateNewEventInput pour la création. */
export function validateNewWeddingInput(input: {
  couple: string
  contactName: string
  email: string
  phone: string
  eventDate: string
  depositAmount: string
  balanceAmount: string
  eventType?: EventType
}): string | null {
  return validateNewEventInput({
    eventType: input.eventType,
    eventName: input.couple,
    spouse1FirstName: "",
    spouse1LastName: "",
    spouse2FirstName: "",
    spouse2LastName: "",
    contactName: input.contactName,
    email: input.email,
    phone: input.phone,
    eventDate: input.eventDate,
    depositAmount: input.depositAmount,
    balanceAmount: input.balanceAmount,
  })
}

export function validateEditWeddingInput(input: {
  couple: string
  contactName: string
  email: string
  phone: string
  eventDate: string
  depositAmount: string
  balanceAmount: string
  eventType?: EventType
}): string | null {
  return validateNewWeddingInput(input)
}
