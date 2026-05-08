import type { Wedding } from "@/lib/weddings-store"

export function formatEventDateFr(eventDate: string) {
  const date = new Date(eventDate)
  if (Number.isNaN(date.getTime())) return eventDate
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(date)
}

/** Remplace {{cle}} par la valeur ; espaces autorisés dans les accolades. Clé inconnue → laisse le placeholder. */
export function renderTemplate(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key]! : `{{${key}}}`
  )
}

export function buildAutomationVariableMap(wedding: Wedding, daysAhead: number): Record<string, string> {
  const contact = (wedding.contactName || wedding.couple).trim()
  const prenom = contact.split(/\s+/)[0] || contact

  return {
    prenom,
    date_mariage: formatEventDateFr(wedding.eventDate),
    solde_restant: wedding.balance.amount,
    couple: wedding.couple,
    contact: wedding.contactName,
    acompte: wedding.deposit.amount,
    telephone: wedding.phone,
    j_moins: String(daysAhead),
  }
}
