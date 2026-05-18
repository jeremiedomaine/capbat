/** Client uniquement : coordonnées de facturation (émetteur). */

export const BILLING_KEYS = {
  address: "guestflow_billing_address",
  postalCode: "guestflow_billing_postal",
  city: "guestflow_billing_city",
  siret: "guestflow_billing_siret",
  vat: "guestflow_billing_vat",
  phone: "guestflow_billing_phone",
} as const

export const BILLING_EVENTS = {
  updated: "guestflow-billing-profile-updated",
} as const

export type BillingProfile = {
  addressLine: string
  postalCode: string
  city: string
  siret: string
  vatNumber: string
  phone: string
}

export const DEFAULT_BILLING_PROFILE: BillingProfile = {
  addressLine: "12 route des Vignes",
  postalCode: "75000",
  city: "Paris",
  siret: "",
  vatNumber: "",
  phone: "",
}

function read(key: string): string {
  if (typeof window === "undefined") return ""
  return window.localStorage.getItem(key)?.trim() ?? ""
}

export function getStoredBillingProfile(): BillingProfile {
  return {
    addressLine: read(BILLING_KEYS.address) || DEFAULT_BILLING_PROFILE.addressLine,
    postalCode: read(BILLING_KEYS.postalCode) || DEFAULT_BILLING_PROFILE.postalCode,
    city: read(BILLING_KEYS.city) || DEFAULT_BILLING_PROFILE.city,
    siret: read(BILLING_KEYS.siret),
    vatNumber: read(BILLING_KEYS.vat),
    phone: read(BILLING_KEYS.phone),
  }
}

export function setStoredBillingProfile(profile: BillingProfile) {
  window.localStorage.setItem(BILLING_KEYS.address, profile.addressLine.trim())
  window.localStorage.setItem(BILLING_KEYS.postalCode, profile.postalCode.trim())
  window.localStorage.setItem(BILLING_KEYS.city, profile.city.trim())
  window.localStorage.setItem(BILLING_KEYS.siret, profile.siret.trim())
  window.localStorage.setItem(BILLING_KEYS.vat, profile.vatNumber.trim())
  window.localStorage.setItem(BILLING_KEYS.phone, profile.phone.trim())
  window.dispatchEvent(new Event(BILLING_EVENTS.updated))
}
