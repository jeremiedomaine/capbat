-- Exécuter une fois dans Supabase → SQL Editor

create table if not exists public.workspace_settings (
  id int primary key default 1,
  company_name text not null default '',
  manager_name text not null default '',
  contact_email text not null default '',
  contact_phone text not null default '',
  billing_address_line text not null default '',
  billing_postal_code text not null default '',
  billing_city text not null default '',
  billing_siret text not null default '',
  billing_vat_number text not null default '',
  billing_phone text not null default '',
  email_notifications boolean not null default true,
  payment_alerts boolean not null default true,
  weekly_summary boolean not null default false,
  dark_mode boolean not null default false,
  updated_at timestamptz default now(),
  constraint workspace_settings_singleton check (id = 1)
);
