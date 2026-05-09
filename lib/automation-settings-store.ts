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
 *   last_deposit_reminder_paris_date date,
 *   updated_at timestamptz default now(),
 *   constraint automation_settings_singleton check (id = 1)
 * );
 *
 * Si la table existe déjà :
 *   alter table public.automation_settings
 *   add column if not exists last_deposit_reminder_paris_date date;
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
  /** Date civile (YYYY-MM-DD) du dernier run réussi côté fuseau automatisations — évite les doublons si le cron retarde. */
  lastDepositReminderParisDate?: string | null
}

export async function getAutomationSettings(): Promise<AutomationSettings> {
  try {
    const admin = getSupabaseAdmin()
    let res = await admin
      .from(TABLE)
      .select("message_template, subject_template, send_time, last_deposit_reminder_paris_date")
      .eq("id", 1)
      .maybeSingle()

    if (res.error) {
      res = await admin
        .from(TABLE)
        .select("message_template, subject_template, send_time")
        .eq("id", 1)
        .maybeSingle()
      if (res.error) throw res.error
    }

    const data = res.data

    if (!data) {
      return {
        messageTemplate: DEFAULT_AUTOMATION_MESSAGE,
        subjectTemplate: DEFAULT_AUTOMATION_SUBJECT,
        sendTime: DEFAULT_AUTOMATION_SEND_TIME,
        lastDepositReminderParisDate: null,
      }
    }

    const row = data as {
      message_template?: string | null
      subject_template?: string | null
      send_time?: string | null
      last_deposit_reminder_paris_date?: string | null
    }

    return {
      messageTemplate: row.message_template?.trim() || DEFAULT_AUTOMATION_MESSAGE,
      subjectTemplate: row.subject_template?.trim() || DEFAULT_AUTOMATION_SUBJECT,
      sendTime: row.send_time?.trim() || DEFAULT_AUTOMATION_SEND_TIME,
      lastDepositReminderParisDate: row.last_deposit_reminder_paris_date?.trim() || null,
    }
  } catch {
    return {
      messageTemplate: DEFAULT_AUTOMATION_MESSAGE,
      subjectTemplate: DEFAULT_AUTOMATION_SUBJECT,
      sendTime: DEFAULT_AUTOMATION_SEND_TIME,
      lastDepositReminderParisDate: null,
    }
  }
}

/** Enregistre la date civile (Paris / AUTOMATION_TIMEZONE) du dernier passage d’envoi pour éviter un second envoi le même jour. */
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
