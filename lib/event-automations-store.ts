import type { EventType } from "@/lib/event-types"
import { listAutomations, type Automation } from "@/lib/automations-store"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { listWeddings } from "@/lib/weddings-store"

const ASSIGNMENTS = process.env.SUPABASE_EVENT_AUTOMATION_ASSIGNMENTS_TABLE?.trim() || "event_automation_assignments"
const SENT_LOG = process.env.SUPABASE_AUTOMATION_SENT_LOG_TABLE?.trim() || "automation_sent_log"

export type EventAutomationView = {
  automationId: string
  name: string
  dayOffset: number
  eventTypes: EventType[]
  onlyIfBalancePending: boolean
  enabled: boolean
  sentAt: string | null
  compatible: boolean
}

export async function seedDefaultAssignmentsForEvent(
  eventId: number,
  eventType: EventType,
  activateDefaults: boolean
) {
  if (!activateDefaults) return
  const automations = await listAutomations(true)
  const compatible = automations.filter((a) => a.eventTypes.includes(eventType))
  if (!compatible.length) return

  const rows = compatible.map((a) => ({
    event_id: eventId,
    automation_id: a.id,
    enabled: true,
  }))

  const { error } = await getSupabaseAdmin().from(ASSIGNMENTS).upsert(rows, {
    onConflict: "event_id,automation_id",
  })
  if (error) throw new Error(`Assignations par défaut impossible: ${error.message}`)
}

export async function setEventAutomationEnabled(
  eventId: number,
  automationId: string,
  enabled: boolean
) {
  const { error } = await getSupabaseAdmin().from(ASSIGNMENTS).upsert(
    { event_id: eventId, automation_id: automationId, enabled },
    { onConflict: "event_id,automation_id" }
  )
  if (error) throw new Error(`Mise à jour assignation impossible: ${error.message}`)
}

export async function getEventAutomationsView(
  eventId: number,
  eventType: EventType
): Promise<EventAutomationView[]> {
  const automations = await listAutomations()
  const { data: assignments } = await getSupabaseAdmin()
    .from(ASSIGNMENTS)
    .select("automation_id, enabled")
    .eq("event_id", eventId)

  const { data: sentRows } = await getSupabaseAdmin()
    .from(SENT_LOG)
    .select("automation_id, sent_at")
    .eq("event_id", eventId)

  const assignmentMap = new Map(
    (assignments ?? []).map((r) => [r.automation_id as string, r.enabled as boolean])
  )
  const sentMap = new Map(
    (sentRows ?? []).map((r) => [r.automation_id as string, (r.sent_at as string).slice(0, 10)])
  )

  return automations
    .filter((a) => a.isActive)
    .map((a) => {
      const compatible = a.eventTypes.includes(eventType)
      return {
        automationId: a.id,
        name: a.name,
        dayOffset: a.dayOffset,
        eventTypes: a.eventTypes,
        onlyIfBalancePending: a.onlyIfBalancePending,
        enabled: compatible && (assignmentMap.get(a.id) ?? false),
        sentAt: sentMap.get(a.id) ?? null,
        compatible,
      }
    })
    .filter((v) => v.compatible)
    .sort((a, b) => a.dayOffset - b.dayOffset)
}

export async function countActiveAutomationsByEventIds(
  eventIds: number[]
): Promise<Map<number, number>> {
  const result = new Map<number, number>()
  if (!eventIds.length) return result

  const { data, error } = await getSupabaseAdmin()
    .from(ASSIGNMENTS)
    .select("event_id")
    .in("event_id", eventIds)
    .eq("enabled", true)

  if (error) {
    console.warn("[event-automations] count failed:", error.message)
    return result
  }

  for (const row of data ?? []) {
    const id = row.event_id as number
    result.set(id, (result.get(id) ?? 0) + 1)
  }
  return result
}

export async function loadEnabledAssignmentKeys(): Promise<Set<string>> {
  const { data, error } = await getSupabaseAdmin()
    .from(ASSIGNMENTS)
    .select("event_id, automation_id")
    .eq("enabled", true)

  if (error) throw new Error(`Chargement assignations impossible: ${error.message}`)

  return new Set(
    (data ?? []).map((r) => `${r.event_id}:${r.automation_id}`)
  )
}

export async function loadSentLogKeys(): Promise<Set<string>> {
  const { data, error } = await getSupabaseAdmin().from(SENT_LOG).select("event_id, automation_id")
  if (error) throw new Error(`Chargement journal envois impossible: ${error.message}`)
  return new Set((data ?? []).map((r) => `${r.event_id}:${r.automation_id}`))
}

export async function markAutomationSent(eventId: number, automationId: string) {
  const { error } = await getSupabaseAdmin().from(SENT_LOG).upsert(
    { event_id: eventId, automation_id: automationId, sent_at: new Date().toISOString() },
    { onConflict: "event_id,automation_id" }
  )
  if (error) throw new Error(`Journal envoi impossible: ${error.message}`)
}

/**
 * Active une automatisation sur les événements existants compatibles
 * (même type, date à venir, sans écraser une désactivation manuelle déjà enregistrée).
 */
export async function assignAutomationToCompatibleEvents(automation: Automation): Promise<number> {
  const weddings = await listWeddings()
  const today = new Date().toISOString().slice(0, 10)

  const candidates = weddings.filter((wedding) => {
    if (!automation.eventTypes.includes(wedding.eventType)) return false
    if (wedding.eventDate.slice(0, 10) < today) return false
    return true
  })

  if (!candidates.length) return 0

  const eventIds = candidates.map((w) => w.id)
  const { data: existing, error: existingError } = await getSupabaseAdmin()
    .from(ASSIGNMENTS)
    .select("event_id")
    .eq("automation_id", automation.id)
    .in("event_id", eventIds)

  if (existingError) {
    throw new Error(`Lecture assignations impossible: ${existingError.message}`)
  }

  const alreadyAssigned = new Set((existing ?? []).map((row) => row.event_id as number))
  const rows = candidates
    .filter((wedding) => !alreadyAssigned.has(wedding.id))
    .map((wedding) => ({
      event_id: wedding.id,
      automation_id: automation.id,
      enabled: true,
    }))

  if (!rows.length) return 0

  const { error } = await getSupabaseAdmin().from(ASSIGNMENTS).upsert(rows, {
    onConflict: "event_id,automation_id",
  })
  if (error) throw new Error(`Activation sur événements existants impossible: ${error.message}`)
  return rows.length
}

export function automationAppliesToEvent(automation: Automation, eventType: EventType) {
  return automation.eventTypes.includes(eventType)
}
