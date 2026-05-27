-- Dates et moyens de paiement (acompte / solde) pour la fiche événement.
-- À exécuter une fois dans le SQL Editor Supabase.

alter table reservations add column if not exists deposit_paid_date date;
alter table reservations add column if not exists deposit_payment_method text;
alter table reservations add column if not exists balance_paid_date date;
alter table reservations add column if not exists balance_payment_method text;
