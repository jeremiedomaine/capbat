/**
 * Paramètres espace (profil + facturation + préférences UI).
 * Migration : supabase/workspace_settings.sql
 */

import { promises as fs } from "fs"
import path from "path"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import {
  DEFAULT_WORKSPACE_SETTINGS,
  mergeWorkspaceSettings,
  type WorkspaceSettings,
} from "@/lib/workspace-settings"

const TABLE = process.env.SUPABASE_WORKSPACE_SETTINGS_TABLE?.trim() || "workspace_settings"
const DATA_FILE = path.join(process.cwd(), "data", "workspace-settings.json")

const MISSING_TABLE_HINT =
  'Table Supabase "workspace_settings" absente. Exécutez supabase/workspace_settings.sql dans le SQL Editor.'

let storageMode: "supabase" | "file" | null = null

function isProductionRuntime() {
  return Boolean(process.env.VERCEL)
}

export async function getWorkspaceSettings(): Promise<WorkspaceSettings> {
  if (await useSupabase()) {
    const { data, error } = await getSupabaseAdmin()
      .from(TABLE)
      .select("*")
      .eq("id", 1)
      .maybeSingle()

    if (error) {
      console.warn("[workspace-settings] get:", error.message)
      return { ...DEFAULT_WORKSPACE_SETTINGS, billing: { ...DEFAULT_WORKSPACE_SETTINGS.billing } }
    }

    if (!data) {
      return { ...DEFAULT_WORKSPACE_SETTINGS, billing: { ...DEFAULT_WORKSPACE_SETTINGS.billing } }
    }

    return mapDbRow(data as Record<string, unknown>)
  }

  if (isProductionRuntime()) {
    return { ...DEFAULT_WORKSPACE_SETTINGS, billing: { ...DEFAULT_WORKSPACE_SETTINGS.billing } }
  }

  return readFileStore()
}

export async function upsertWorkspaceSettings(
  input: Partial<WorkspaceSettings>
): Promise<WorkspaceSettings> {
  const current = await getWorkspaceSettings()
  const merged = mergeWorkspaceSettings({ ...current, ...input, billing: { ...current.billing, ...input.billing } })

  if (await useSupabase()) {
    const { error } = await getSupabaseAdmin().from(TABLE).upsert(toDbRow(merged), { onConflict: "id" })
    if (error) {
      if (isMissingTableError(error.message)) {
        throw new Error(MISSING_TABLE_HINT)
      }
      throw new Error(`Enregistrement paramètres impossible : ${error.message}`)
    }
    return merged
  }

  if (isProductionRuntime()) {
    throw new Error(MISSING_TABLE_HINT)
  }

  await writeFileStore(merged)
  return merged
}

async function useSupabase(): Promise<boolean> {
  if (isProductionRuntime()) {
    await assertSupabaseTableReady()
    return true
  }

  if (storageMode === "file") return false
  if (storageMode === "supabase") return true

  try {
    const { error } = await getSupabaseAdmin().from(TABLE).select("id").limit(1)
    if (!error) {
      storageMode = "supabase"
      return true
    }
    if (isMissingTableError(error.message)) {
      storageMode = "file"
      return false
    }
    storageMode = "file"
    return false
  } catch {
    storageMode = "file"
    return false
  }
}

async function assertSupabaseTableReady() {
  if (storageMode === "supabase") return
  const { error } = await getSupabaseAdmin().from(TABLE).select("id").limit(1)
  if (error) {
    if (isMissingTableError(error.message)) {
      throw new Error(MISSING_TABLE_HINT)
    }
    throw new Error(`Supabase (paramètres) : ${error.message}`)
  }
  storageMode = "supabase"
}

function isMissingTableError(message: string) {
  const lower = message.toLowerCase()
  return (
    lower.includes("does not exist") ||
    lower.includes("could not find the table") ||
    lower.includes("schema cache")
  )
}

async function readFileStore(): Promise<WorkspaceSettings> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8")
    return mergeWorkspaceSettings(JSON.parse(raw) as Partial<WorkspaceSettings>)
  } catch {
    return mergeWorkspaceSettings(null)
  }
}

async function writeFileStore(settings: WorkspaceSettings) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true })
  await fs.writeFile(DATA_FILE, JSON.stringify(settings, null, 2), "utf8")
}

function mapDbRow(row: Record<string, unknown>): WorkspaceSettings {
  return mergeWorkspaceSettings({
    companyName: String(row.company_name ?? ""),
    managerName: String(row.manager_name ?? ""),
    contactEmail: String(row.contact_email ?? ""),
    contactPhone: String(row.contact_phone ?? ""),
    billing: {
      addressLine: String(row.billing_address_line ?? ""),
      postalCode: String(row.billing_postal_code ?? ""),
      city: String(row.billing_city ?? ""),
      siret: String(row.billing_siret ?? ""),
      vatNumber: String(row.billing_vat_number ?? ""),
      phone: String(row.billing_phone ?? ""),
    },
    emailNotifications: Boolean(row.email_notifications ?? true),
    paymentAlerts: Boolean(row.payment_alerts ?? true),
    weeklySummary: Boolean(row.weekly_summary ?? false),
    darkMode: Boolean(row.dark_mode ?? false),
  })
}

function toDbRow(settings: WorkspaceSettings) {
  return {
    id: 1,
    company_name: settings.companyName.trim(),
    manager_name: settings.managerName.trim(),
    contact_email: settings.contactEmail.trim(),
    contact_phone: settings.contactPhone.trim(),
    billing_address_line: settings.billing.addressLine.trim(),
    billing_postal_code: settings.billing.postalCode.trim(),
    billing_city: settings.billing.city.trim(),
    billing_siret: settings.billing.siret.trim(),
    billing_vat_number: settings.billing.vatNumber.trim(),
    billing_phone: settings.billing.phone.trim(),
    email_notifications: settings.emailNotifications,
    payment_alerts: settings.paymentAlerts,
    weekly_summary: settings.weeklySummary,
    dark_mode: settings.darkMode,
    updated_at: new Date().toISOString(),
  }
}
