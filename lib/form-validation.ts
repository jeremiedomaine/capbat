/** Validation légère côté client (complète les attributs HTML natifs). */

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

export function validateNewWeddingInput(input: {
  couple: string
  contactName: string
  email: string
  phone: string
  eventDate: string
  depositAmount: string
  balanceAmount: string
}): string | null {
  if (!input.couple.trim()) return "Indiquez le nom du couple."
  if (!input.contactName.trim()) return "Indiquez le nom du contact."
  if (!isValidEmail(input.email)) return "Adresse e-mail invalide."
  if (!input.phone.trim()) return "Indiquez un numéro de téléphone."
  if (!input.eventDate.trim()) return "Choisissez une date de mariage."
  const dep = parseEuroInput(input.depositAmount)
  const bal = parseEuroInput(input.balanceAmount)
  if (dep === null) return "Montant d’acompte invalide (nombre positif ou zéro)."
  if (bal === null) return "Montant de solde invalide (nombre positif ou zéro)."
  return null
}

export function validateEditWeddingInput(input: {
  couple: string
  contactName: string
  email: string
  phone: string
  eventDate: string
  depositAmount: string
  balanceAmount: string
}): string | null {
  return validateNewWeddingInput(input)
}
