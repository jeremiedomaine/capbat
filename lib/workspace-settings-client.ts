/** Client : charge / enregistre les paramètres (Supabase) + cache localStorage. */

import {
  BILLING_EVENTS,
  getStoredBillingProfile,
  setStoredBillingProfile,
  type BillingProfile,
} from "@/lib/billing-local-storage"
import {
  getStoredCompanyName,
  getStoredContactEmail,
  getStoredContactPhone,
  getStoredManagerName,
  setStoredCompanyName,
  setStoredContactEmail,
  setStoredContactPhone,
  setStoredManagerName,
  PROFILE_EVENTS,
} from "@/lib/profile-local-storage"
import {
  DEFAULT_WORKSPACE_SETTINGS,
  mergeWorkspaceSettings,
  type WorkspaceSettings,
} from "@/lib/workspace-settings"

const SYNC_FLAG = "guestflow_workspace_settings_synced"

export async function loadWorkspaceSettings(): Promise<WorkspaceSettings> {
  const local = readSettingsFromLocalStorage()

  try {
    const response = await fetch("/api/settings", { credentials: "same-origin" })
    const payload = (await response.json()) as { settings?: WorkspaceSettings; error?: string }

    if (!response.ok) {
      return local
    }

    const remote = mergeWorkspaceSettings(payload.settings)

    if (shouldMigrateLocalToRemote(local, remote)) {
      const migrated = await persistWorkspaceSettings(local, { silent: true })
      return migrated
    }

    cacheSettingsToLocalStorage(remote)
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SYNC_FLAG, "1")
    }
    return remote
  } catch {
    return local
  }
}

export async function persistWorkspaceSettings(
  settings: Partial<WorkspaceSettings>,
  options?: { silent?: boolean }
): Promise<WorkspaceSettings> {
  const current = readSettingsFromLocalStorage()
  const merged = mergeWorkspaceSettings({ ...current, ...settings, billing: { ...current.billing, ...settings.billing } })

  try {
    const response = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(merged),
    })
    const payload = (await response.json()) as { settings?: WorkspaceSettings; error?: string }

    if (!response.ok) {
      throw new Error(payload.error ?? "Enregistrement impossible.")
    }

    const saved = mergeWorkspaceSettings(payload.settings ?? merged)
    cacheSettingsToLocalStorage(saved)
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SYNC_FLAG, "1")
    }
    return saved
  } catch (error) {
    if (!options?.silent) throw error
    cacheSettingsToLocalStorage(merged)
    return merged
  }
}

export async function persistBillingProfile(billing: BillingProfile) {
  return persistWorkspaceSettings({ billing })
}

export function readSettingsFromLocalStorage(): WorkspaceSettings {
  return mergeWorkspaceSettings({
    companyName: getStoredCompanyName() ?? undefined,
    managerName: getStoredManagerName() ?? undefined,
    contactEmail: getStoredContactEmail() ?? undefined,
    contactPhone: getStoredContactPhone() ?? undefined,
    billing: getStoredBillingProfile(),
  })
}

export function cacheSettingsToLocalStorage(settings: WorkspaceSettings) {
  if (typeof window === "undefined") return
  setStoredCompanyName(settings.companyName)
  setStoredManagerName(settings.managerName)
  setStoredContactEmail(settings.contactEmail)
  setStoredContactPhone(settings.contactPhone)
  setStoredBillingProfile(settings.billing)
  window.dispatchEvent(new Event(PROFILE_EVENTS.company))
  window.dispatchEvent(new Event(PROFILE_EVENTS.manager))
  window.dispatchEvent(new Event(PROFILE_EVENTS.contactEmail))
  window.dispatchEvent(new Event(PROFILE_EVENTS.contactPhone))
  window.dispatchEvent(new Event(BILLING_EVENTS.updated))
}

function shouldMigrateLocalToRemote(local: WorkspaceSettings, remote: WorkspaceSettings) {
  if (typeof window === "undefined") return false
  if (window.localStorage.getItem(SYNC_FLAG) === "1") return false

  const localCustomized =
    Boolean(getStoredCompanyName()?.trim()) ||
    Boolean(getStoredManagerName()?.trim()) ||
    Boolean(getStoredContactEmail()?.trim()) ||
    Boolean(getStoredContactPhone()?.trim()) ||
    Boolean(getStoredBillingProfile().siret?.trim()) ||
    Boolean(getStoredBillingProfile().vatNumber?.trim())

  if (!localCustomized) return false

  const remoteIsDefault =
    remote.companyName === DEFAULT_WORKSPACE_SETTINGS.companyName &&
    remote.managerName === DEFAULT_WORKSPACE_SETTINGS.managerName &&
    remote.contactEmail === DEFAULT_WORKSPACE_SETTINGS.contactEmail

  return remoteIsDefault
}
