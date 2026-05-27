-- Informations complémentaires par événement (page détail).
-- À exécuter une fois dans le SQL Editor Supabase.

alter table reservations add column if not exists event_name text;
alter table reservations add column if not exists spouse1_first_name text;
alter table reservations add column if not exists spouse1_last_name text;
alter table reservations add column if not exists spouse2_first_name text;
alter table reservations add column if not exists spouse2_last_name text;
alter table reservations add column if not exists postal_address text;
alter table reservations add column if not exists comments text;
