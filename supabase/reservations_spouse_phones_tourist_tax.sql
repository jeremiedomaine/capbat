-- Colonnes additives (nullable) — sans impact sur les lignes existantes.
-- À exécuter une fois dans le SQL Editor Supabase du projet Cap'Bat.

alter table reservations add column if not exists spouse1_phone text;
alter table reservations add column if not exists spouse2_phone text;

alter table reservations add column if not exists tourist_tax_status text;
alter table reservations add column if not exists tourist_tax_amount numeric;
alter table reservations add column if not exists tourist_tax_paid_date date;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'reservations_tourist_tax_status_check'
  ) then
    alter table reservations
      add constraint reservations_tourist_tax_status_check
      check (
        tourist_tax_status is null
        or tourist_tax_status in ('unpaid', 'paid')
      );
  end if;
end $$;
