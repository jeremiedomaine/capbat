/**
 * Stockage des réglages « Automatisations » (modèle d’e-mail, objet, créneau).
 *
 * À créer une fois dans Supabase (SQL Editor) :
 *
 * create table public.automation_settings (
 *   id int primary key default 1,
 *   message_template text not null,
 *   subject_template text,
 *   send_time text not null default '09:00',
 *   updated_at timestamptz default now(),
 *   constraint automation_settings_singleton check (id = 1)
 * );
 */

import { getSupabaseAdmin } from "@/lib/supabase/admin"
import {
  DEFAULT_AUTOMATION_MESSAGE,
  DEFAULT_AUTOMATION_SEND_TIME,
  DEFAULT_AUTOMATION_SUBJECT,
} from "@/lib/automation-defaults"

const TABLE = process.env.SUPABASE_AUTOMATION_SETTINGS_TABLE?.trim() || "automation_settings"

export type AutomationSettings = {
  messageTemplate: string
  subjectTemplate: string
  sendTime: string
}

export async function getAutomationSettings(): Promise<AutomationSettings> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from(TABLE)
      .select("message_template, subject_template, send_time")
      .eq("id", 1)
      .maybeSingle()

    if (error) throw error

    if (!data) {
      return {
        messageTemplate: DEFAULT_AUTOMATION_MESSAGE,
        subjectTemplate: DEFAULT_AUTOMATION_SUBJECT,
        sendTime: DEFAULT_AUTOMATION_SEND_TIME,
      }
    }

    const row = data as {
      message_template?: string | null
      subject_template?: string | null
      send_time?: string | null
    }

    return {
      messageTemplate: row.message_template?.trim() || DEFAULT_AUTOMATION_MESSAGE,
      subjectTemplate: row.subject_template?.trim() || DEFAULT_AUTOMATION_SUBJECT,
      sendTime: row.send_time?.trim() || DEFAULT_AUTOMATION_SEND_TIME,
    }
  } catch {
    return {
      messageTemplate: DEFAULT_AUTOMATION_MESSAGE,
      subjectTemplate: DEFAULT_AUTOMATION_SUBJECT,
      sendTime: DEFAULT_AUTOMATION_SEND_TIME,
    }
  }
}

export async function upsertAutomationSettings(input: {
  messageTemplate: string
  subjectTemplate: string
  sendTime: string
}) {
  const { error } = await getSupabaseAdmin()
    .from(TABLE)
    .upsert(
      {
        id: 1,
        message_template: input.messageTemplate.trim(),
        subject_template: input.subjectTemplate.trim() || DEFAULT_AUTOMATION_SUBJECT,
        send_time: input.sendTime.trim(),
      },
      { onConflict: "id" }
    )

  if (error) {
    throw new Error(`Enregistrement automatisations impossible: ${error.message}`)
  }
}
