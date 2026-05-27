-- Type d'événement (mariage ou autre usage du domaine).
-- À exécuter une fois dans le SQL Editor Supabase si la colonne n'existe pas encore.

alter table reservations
  add column if not exists event_type text not null default 'wedding';

alter table reservations
  drop constraint if exists reservations_event_type_check;

alter table reservations
  add constraint reservations_event_type_check
  check (event_type in ('wedding', 'other'));
