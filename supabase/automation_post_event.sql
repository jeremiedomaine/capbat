-- 2e automatisation (message J+3 après mariage) + suivi d'envoi par événement.
-- À exécuter une fois dans le SQL Editor Supabase.

alter table automation_settings
  add column if not exists post_event_subject_template text;

alter table automation_settings
  add column if not exists post_event_message_template text;

alter table automation_settings
  add column if not exists last_post_event_reminder_paris_date date;

alter table reservations
  add column if not exists post_event_reminder_sent_date date;
