/**
 * Stockage des réglages « Automatisations » (modèles d’e-mail, créneau).
 *
 * Voir supabase/automation_post_event.sql pour la 2e automatisation J+3.
 */

import { getSupabaseAdmin } from "@/lib/supabase/admin"
import {
  DEFAULT_AUTOMATION_MESSAGE,
  DEFAULT_AUTOMATION_SUBJECT,
  DEFAULT_POST_EVENT_AUTOMATION_MESSAGE,
  DEFAULT_POST_EVENT_AUTOMATION_SUBJECT,
  FIXED_AUTOMATION_SEND_TIME,
} from "@/lib/automation-defaults"

const TABLE = process.env.SUPABASE_AUTOMATION_SETTINGS_TABLE?.trim() || "automation_settings"

export type AutomationSettings = {
  messageTemplate: string
  subjectTemplate: string
  postEventMessageTemplate: string
  postEventSubjectTemplate: string
  sendTime: string
  lastDepositReminderParisDate?: string | null
  lastPostEventReminderParisDate?: string | null
}

const BASE_SELECT =
  "message_template, subject_template, send_time, last_deposit_reminder_paris_date, post_event_subject_template, post_event_message_template, last_post_event_reminder_paris_date"

export async function getAutomationSettings(): Promise<AutomationSettings> {
  try {
    const admin = getSupabaseAdmin()
    let res = await admin.from(TABLE).select(BASE_SELECT).eq("id", 1).maybeSingle()

    if (res.error) {
      res = await admin
        .from(TABLE)
        .select("message_template, subject_template, send_time, last_deposit_reminder_paris_date")
        .eq("id", 1)
        .maybeSingle()
      if (res.error) throw res.error
    }

    const data = res.data

    if (!data) {
      return defaultAutomationSettings()
    }

    const row = data as {
      message_template?: string | null
      subject_template?: string | null
      send_time?: string | null
      last_deposit_reminder_paris_date?: string | null
      post_event_subject_template?: string | null
      post_event_message_template?: string | null
      last_post_event_reminder_paris_date?: string | null
    }

    return {
      messageTemplate: row.message_template?.trim() || DEFAULT_AUTOMATION_MESSAGE,
      subjectTemplate: row.subject_template?.trim() || DEFAULT_AUTOMATION_SUBJECT,
      postEventMessageTemplate:
        row.post_event_message_template?.trim() || DEFAULT_POST_EVENT_AUTOMATION_MESSAGE,
      postEventSubjectTemplate:
        row.post_event_subject_template?.trim() || DEFAULT_POST_EVENT_AUTOMATION_SUBJECT,
      sendTime: FIXED_AUTOMATION_SEND_TIME,
      lastDepositReminderParisDate: row.last_deposit_reminder_paris_date?.trim() || null,
      lastPostEventReminderParisDate: row.last_post_event_reminder_paris_date?.trim() || null,
    }
  } catch {
    return defaultAutomationSettings()
  }
}

function defaultAutomationSettings(): AutomationSettings {
  return {
    messageTemplate: DEFAULT_AUTOMATION_MESSAGE,
    subjectTemplate: DEFAULT_AUTOMATION_SUBJECT,
    postEventMessageTemplate: DEFAULT_POST_EVENT_AUTOMATION_MESSAGE,
    postEventSubjectTemplate: DEFAULT_POST_EVENT_AUTOMATION_SUBJECT,
    sendTime: FIXED_AUTOMATION_SEND_TIME,
    lastDepositReminderParisDate: null,
    lastPostEventReminderParisDate: null,
  }
}

export async function markDepositReminderParisDate(isoCalendarDate: string) {
  const day = isoCalendarDate.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return

  const { error } = await getSupabaseAdmin()
    .from(TABLE)
    .update({ last_deposit_reminder_paris_date: day })
    .eq("id", 1)

  if (error) {
    console.warn("[automation] markDepositReminderParisDate:", error.message)
  }
}

export async function markPostEventReminderParisDate(isoCalendarDate: string) {
  const day = isoCalendarDate.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return

  const { error } = await getSupabaseAdmin()
    .from(TABLE)
    .update({ last_post_event_reminder_paris_date: day })
    .eq("id", 1)

  if (error) {
    console.warn("[automation] markPostEventReminderParisDate:", error.message)
  }
}

export async function upsertAutomationSettings(input: {
  messageTemplate: string
  subjectTemplate: string
  postEventMessageTemplate: string
  postEventSubjectTemplate: string
}) {
  const { error } = await getSupabaseAdmin()
    .from(TABLE)
    .upsert(
      {
        id: 1,
        message_template: input.messageTemplate.trim(),
        subject_template: input.subjectTemplate.trim() || DEFAULT_AUTOMATION_SUBJECT,
        post_event_message_template:
          input.postEventMessageTemplate.trim() || DEFAULT_POST_EVENT_AUTOMATION_MESSAGE,
        post_event_subject_template:
          input.postEventSubjectTemplate.trim() || DEFAULT_POST_EVENT_AUTOMATION_SUBJECT,
        send_time: FIXED_AUTOMATION_SEND_TIME,
      },
      { onConflict: "id" }
    )

  if (error) {
    throw new Error(`Enregistrement automatisations impossible: ${error.message}`)
  }
}
