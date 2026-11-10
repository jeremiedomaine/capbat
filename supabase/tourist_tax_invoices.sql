-- Factures de taxe de séjour Cap'Bat (numérotation TDS-YYYY-NNN).
-- Exécuter une fois dans Supabase → SQL Editor.

create table if not exists public.tourist_tax_invoices (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  wedding_id bigint not null,
  couple text not null,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'paid', 'cancelled')),
  period_start date not null,
  period_end date not null,
  issued_at date not null,
  paid_at date,
  payment_method text,
  lines jsonb not null default '[]',
  amount_ttc numeric not null,
  rate numeric not null default 1.52,
  client_name text not null,
  client_address text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists tourist_tax_invoices_wedding_id_idx
  on public.tourist_tax_invoices (wedding_id);

create index if not exists tourist_tax_invoices_issued_at_idx
  on public.tourist_tax_invoices (issued_at);

-- Pas de RLS : l'API utilise la clé service_role.
