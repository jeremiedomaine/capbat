import type { BillingProfile } from "@/lib/billing-local-storage"
import { DEFAULT_BILLING_PROFILE } from "@/lib/billing-local-storage"
import {
  DEFAULT_INVOICE_TEMPLATE,
  mergeInvoiceTemplate,
  type InvoiceTemplate,
} from "@/lib/invoice-template"

export type WorkspaceSettings = {
  companyName: string
  managerName: string
  contactEmail: string
  contactPhone: string
  billing: BillingProfile
  invoiceTemplate: InvoiceTemplate
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
  invoiceTemplate: { ...DEFAULT_INVOICE_TEMPLATE, catalog: [...DEFAULT_INVOICE_TEMPLATE.catalog] },
  emailNotifications: true,
  paymentAlerts: true,
  weeklySummary: false,
  darkMode: false,
}

export function mergeWorkspaceSettings(
  partial: Partial<WorkspaceSettings> | null | undefined
): WorkspaceSettings {
  if (!partial) {
    return {
      ...DEFAULT_WORKSPACE_SETTINGS,
      billing: { ...DEFAULT_BILLING_PROFILE },
      invoiceTemplate: mergeInvoiceTemplate(null),
    }
  }
  return {
    ...DEFAULT_WORKSPACE_SETTINGS,
    ...partial,
    billing: {
      ...DEFAULT_BILLING_PROFILE,
      ...partial.billing,
    },
    invoiceTemplate: mergeInvoiceTemplate(partial.invoiceTemplate),
  }
}
