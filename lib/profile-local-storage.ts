/** Client uniquement : persistance profil (sidebar / paramètres). */

export const PROFILE_KEYS = {
  manager: "guestflow_manager_name",
  company: "guestflow_company_name",
} as const

const LEGACY_KEYS = {
  manager: "upstay_manager_name",
  company: "upstay_company_name",
} as const

export const PROFILE_EVENTS = {
  manager: "guestflow-manager-updated",
  company: "guestflow-company-updated",
} as const

export function getStoredManagerName(): string | null {
  if (typeof window === "undefined") return null
  return (
    window.localStorage.getItem(PROFILE_KEYS.manager) ??
    window.localStorage.getItem(LEGACY_KEYS.manager)
  )
}

export function getStoredCompanyName(): string | null {
  if (typeof window === "undefined") return null
  return (
    window.localStorage.getItem(PROFILE_KEYS.company) ??
    window.localStorage.getItem(LEGACY_KEYS.company)
  )
}

export function setStoredManagerName(value: string) {
  window.localStorage.setItem(PROFILE_KEYS.manager, value.trim())
  window.dispatchEvent(new Event(PROFILE_EVENTS.manager))
}

export function setStoredCompanyName(value: string) {
  window.localStorage.setItem(PROFILE_KEYS.company, value.trim())
  window.dispatchEvent(new Event(PROFILE_EVENTS.company))
}
