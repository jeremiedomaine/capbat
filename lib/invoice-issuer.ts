import type { InvoiceParty } from "@/lib/invoice-types"
import type { WorkspaceSettings } from "@/lib/workspace-settings"

export function buildIssuerFromSettings(settings: WorkspaceSettings): InvoiceParty {
  return {
    name: settings.companyName,
    contactName: settings.managerName || undefined,
    email: settings.contactEmail,
    phone: settings.billing.phone || settings.contactPhone || undefined,
    addressLine: settings.billing.addressLine,
    postalCode: settings.billing.postalCode,
    city: settings.billing.city,
    siret: settings.billing.siret || undefined,
    vatNumber: settings.billing.vatNumber || undefined,
  }
}
