-- Dates d'arrivée / départ logement (taxe de séjour, factures, planning).
-- À exécuter une fois dans le SQL Editor Supabase (projet Cap'Bat).

alter table public.reservations
  add column if not exists stay_arrival_date date;

alter table public.reservations
  add column if not exists stay_departure_date date;
