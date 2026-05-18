-- Exécuter une fois dans Supabase → SQL Editor (projet CAP'BAT / Guestflow)

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  wedding_id bigint not null,
  couple text not null,
  invoice_type text not null check (invoice_type in ('deposit', 'balance', 'full')),
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid', 'cancelled')),
  issued_at date not null,
  due_at date not null,
  amount_ttc numeric not null,
  vat_rate numeric not null default 20,
  line_items jsonb not null default '[]',
  issuer jsonb not null,
  client jsonb not null,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists invoices_wedding_id_idx on public.invoices (wedding_id);

-- Pas de RLS : l'API utilise la clé service_role (comme reservations).
