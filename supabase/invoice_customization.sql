-- Exécuter une fois dans Supabase → SQL Editor

alter table public.workspace_settings
  add column if not exists invoice_template jsonb not null default '{}'::jsonb;

alter table public.invoices
  add column if not exists locked boolean not null default false;

alter table public.invoices
  add column if not exists occasion text not null default 'wedding'
  check (occasion in ('wedding', 'other'));
