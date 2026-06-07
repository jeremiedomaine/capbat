-- Automatisations custom : catalogue, assignations par événement, journal d'envoi.

create table if not exists public.automations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  day_offset integer not null,
  subject_template text not null,
  message_template text not null,
  event_types text[] not null default '{}',
  only_if_balance_pending boolean not null default false,
  is_active boolean not null default true,
  is_default boolean not null default false,
  sort_order integer not null default 0,
  last_run_paris_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint automations_day_offset_range check (
    day_offset >= -365 and day_offset <= 365 and day_offset <> 0
  ),
  constraint automations_event_types_check check (
    event_types <@ array['wedding', 'gite', 'other']::text[]
    and cardinality(event_types) >= 1
  )
);

create table if not exists public.event_automation_assignments (
  event_id bigint not null references public.reservations (id) on delete cascade,
  automation_id uuid not null references public.automations (id) on delete cascade,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (event_id, automation_id)
);

create table if not exists public.automation_sent_log (
  id uuid primary key default gen_random_uuid(),
  event_id bigint not null references public.reservations (id) on delete cascade,
  automation_id uuid not null references public.automations (id) on delete cascade,
  sent_at timestamptz not null default now(),
  unique (event_id, automation_id)
);

create index if not exists event_automation_assignments_event_id_idx
  on public.event_automation_assignments (event_id);

create index if not exists automation_sent_log_event_id_idx
  on public.automation_sent_log (event_id);

create index if not exists automations_sort_order_idx
  on public.automations (sort_order);

alter table public.automations enable row level security;
alter table public.event_automation_assignments enable row level security;
alter table public.automation_sent_log enable row level security;
