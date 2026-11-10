-- Source de réservation : direct / plateforme (Airbnb…).
-- À exécuter une fois dans le SQL Editor Supabase (projet Cap'Bat).

alter table public.reservations
  add column if not exists booking_source text
    check (booking_source is null or booking_source in ('direct', 'platform'));

-- Par défaut : flux Cap'Bat (facturation + taxe de séjour).
update public.reservations
set booking_source = 'direct'
where booking_source is null;

comment on column public.reservations.booking_source is
  'direct = Cap''Bat gère facture/TDS ; platform = Airbnb/etc, planning only';
