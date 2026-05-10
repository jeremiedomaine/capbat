import type { Wedding } from "@/lib/weddings-store"

/** Fictif, aligné sur l’aperçu des automatisations (variables). */
export const AUTOMATION_PREVIEW_SAMPLE_WEDDING: Wedding = {
  id: 0,
  couple: "Camille & Jordan",
  contactName: "Camille Dupont",
  email: "client@exemple.fr",
  phone: "06 12 34 56 78",
  eventDate: "2026-09-15",
  deposit: { amount: "500 €", status: "paid" },
  balance: { amount: "2 450 €", status: "pending" },
  autopilot: true,
  lastActivity: "",
}

export const AUTOMATION_PREVIEW_DAYS_AHEAD = 30
