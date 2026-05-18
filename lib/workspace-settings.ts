import type { BillingProfile } from "@/lib/billing-local-storage"
import { DEFAULT_BILLING_PROFILE } from "@/lib/billing-local-storage"

export type WorkspaceSettings = {
  companyName: string
  managerName: string
  contactEmail: string
  contactPhone: string
  billing: BillingProfile
  emailNotifications: boolean
  paymentAlerts: boolean
  weeklySummary: boolean
  darkMode: boolean
}

export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  companyName: "Domaine des Roses",
  managerName: "Marie Clément",
  contactEmail: "contact@domainedesroses.fr",
  contactPhone: "",
  billing: { ...DEFAULT_BILLING_PROFILE },
  emailNotifications: true,
  paymentAlerts: true,
  weeklySummary: false,
  darkMode: false,
}

export function mergeWorkspaceSettings(
  partial: Partial<WorkspaceSettings> | null | undefined
): WorkspaceSettings {
  if (!partial) return { ...DEFAULT_WORKSPACE_SETTINGS, billing: { ...DEFAULT_BILLING_PROFILE } }
  return {
    ...DEFAULT_WORKSPACE_SETTINGS,
    ...partial,
    billing: {
      ...DEFAULT_BILLING_PROFILE,
      ...partial.billing,
    },
  }
}
