import type { EventType } from "@/lib/event-types"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import {
  DEFAULT_AUTOMATION_MESSAGE,
  DEFAULT_AUTOMATION_SUBJECT,
  DEFAULT_GITE_ARRIVAL_MESSAGE,
  DEFAULT_GITE_ARRIVAL_SUBJECT,
  DEFAULT_POST_EVENT_AUTOMATION_MESSAGE,
  DEFAULT_POST_EVENT_AUTOMATION_SUBJECT,
  MAX_AUTOMATIONS,
} from "@/lib/automation-defaults"

const TABLE = process.env.SUPABASE_AUTOMATIONS_TABLE?.trim() || "automations"

export type Automation = {
  id: string
  name: string
  dayOffset: number
  subjectTemplate: string
  messageTemplate: string
  eventTypes: EventType[]
  onlyIfBalancePending: boolean
  isActive: boolean
  isDefault: boolean
  sortOrder: number
  lastRunParisDate: string | null
}

export type AutomationInput = {
  name: string
  dayOffset: number
  subjectTemplate: string
  messageTemplate: string
  eventTypes: EventType[]
  onlyIfBalancePending?: boolean
  isActive?: boolean
  isDefault?: boolean
  sortOrder?: number
}

const SELECT =
  "id, name, day_offset, subject_template, message_template, event_types, only_if_balance_pending, is_active, is_default, sort_order, last_run_paris_date"

function mapRow(row: {
  id: string
  name: string
  day_offset: number
  subject_template: string
  message_template: string
  event_types: string[] | null
  only_if_balance_pending: boolean
  is_active: boolean
  is_default: boolean
  sort_order: number
  last_run_paris_date: string | null
}): Automation {
  return {
    id: row.id,
    name: row.name,
    dayOffset: row.day_offset,
    subjectTemplate: row.subject_template,
    messageTemplate: row.message_template,
    eventTypes: (row.event_types ?? []) as EventType[],
    onlyIfBalancePending: row.only_if_balance_pending,
    isActive: row.is_active,
    isDefault: row.is_default,
    sortOrder: row.sort_order,
    lastRunParisDate: row.last_run_paris_date?.slice(0, 10) ?? null,
  }
}

export async function listAutomations(activeOnly = false): Promise<Automation[]> {
  let query = getSupabaseAdmin().from(TABLE).select(SELECT).order("sort_order", { ascending: true })
  if (activeOnly) query = query.eq("is_active", true)
  const { data, error } = await query
  if (error) throw new Error(`Liste automatisations impossible: ${error.message}`)
  return (data ?? []).map(mapRow)
}

export async function getAutomationById(id: string): Promise<Automation | null> {
  const { data, error } = await getSupabaseAdmin().from(TABLE).select(SELECT).eq("id", id).maybeSingle()
  if (error) throw new Error(`Automatisation introuvable: ${error.message}`)
  return data ? mapRow(data) : null
}

export async function countAutomations(): Promise<number> {
  const { count, error } = await getSupabaseAdmin().from(TABLE).select("id", { count: "exact", head: true })
  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function createAutomation(input: AutomationInput): Promise<Automation> {
  const total = await countAutomations()
  if (total >= MAX_AUTOMATIONS) {
    throw new Error(`Maximum ${MAX_AUTOMATIONS} automatisations.`)
  }
  if (!input.eventTypes.length) {
    throw new Error("Sélectionnez au moins un type d'événement.")
  }
  if (input.dayOffset === 0 || input.dayOffset < -365 || input.dayOffset > 365) {
    throw new Error("Le délai J±N doit être entre -365 et 365 (hors 0).")
  }

  const { data, error } = await getSupabaseAdmin()
    .from(TABLE)
    .insert({
      name: input.name.trim(),
      day_offset: input.dayOffset,
      subject_template: input.subjectTemplate.trim(),
      message_template: input.messageTemplate.trim(),
      event_types: input.eventTypes,
      only_if_balance_pending: input.onlyIfBalancePending ?? false,
      is_active: input.isActive ?? true,
      is_default: input.isDefault ?? false,
      sort_order: input.sortOrder ?? total + 1,
    })
    .select(SELECT)
    .single()

  if (error) throw new Error(`Création impossible: ${error.message}`)
  return mapRow(data)
}

export async function updateAutomation(id: string, input: Partial<AutomationInput>): Promise<Automation> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof input.name === "string") patch.name = input.name.trim()
  if (typeof input.dayOffset === "number") patch.day_offset = input.dayOffset
  if (typeof input.subjectTemplate === "string") patch.subject_template = input.subjectTemplate.trim()
  if (typeof input.messageTemplate === "string") patch.message_template = input.messageTemplate.trim()
  if (Array.isArray(input.eventTypes)) patch.event_types = input.eventTypes
  if (typeof input.onlyIfBalancePending === "boolean") patch.only_if_balance_pending = input.onlyIfBalancePending
  if (typeof input.isActive === "boolean") patch.is_active = input.isActive
  if (typeof input.isDefault === "boolean") patch.is_default = input.isDefault
  if (typeof input.sortOrder === "number") patch.sort_order = input.sortOrder

  const { data, error } = await getSupabaseAdmin()
    .from(TABLE)
    .update(patch)
    .eq("id", id)
    .select(SELECT)
    .single()

  if (error) throw new Error(`Mise à jour impossible: ${error.message}`)
  return mapRow(data)
}

export async function deleteAutomation(id: string): Promise<void> {
  const { error } = await getSupabaseAdmin().from(TABLE).delete().eq("id", id)
  if (error) throw new Error(`Suppression impossible: ${error.message}`)
}

export async function markAutomationRunDate(automationId: string, isoCalendarDate: string) {
  const day = isoCalendarDate.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return
  const { error } = await getSupabaseAdmin()
    .from(TABLE)
    .update({ last_run_paris_date: day, updated_at: new Date().toISOString() })
    .eq("id", automationId)
  if (error) console.warn("[automations] markAutomationRunDate:", error.message)
}

export function defaultAutomationSeeds(): AutomationInput[] {
  return [
    {
      name: "Relance solde",
      dayOffset: -30,
      subjectTemplate: DEFAULT_AUTOMATION_SUBJECT,
      messageTemplate: DEFAULT_AUTOMATION_MESSAGE,
      eventTypes: ["wedding", "gite"],
      onlyIfBalancePending: true,
      isDefault: true,
      sortOrder: 1,
    },
    {
      name: "Après mariage",
      dayOffset: 3,
      subjectTemplate: DEFAULT_POST_EVENT_AUTOMATION_SUBJECT,
      messageTemplate: DEFAULT_POST_EVENT_AUTOMATION_MESSAGE,
      eventTypes: ["wedding"],
      isDefault: true,
      sortOrder: 2,
    },
    {
      name: "Rappel arrivée gîte",
      dayOffset: -7,
      subjectTemplate: DEFAULT_GITE_ARRIVAL_SUBJECT,
      messageTemplate: DEFAULT_GITE_ARRIVAL_MESSAGE,
      eventTypes: ["gite"],
      isDefault: true,
      sortOrder: 3,
    },
  ]
}
