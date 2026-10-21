-- One persisted color drives the embedded widget launcher and panel.
alter table public.profiles
  add column if not exists brand_color text not null default '#236b5b',
  add column if not exists response_style text not null default 'balanced',
  add column if not exists response_length text not null default 'balanced';

alter table public.profiles
  add constraint profiles_brand_color_hex_check
    check (brand_color ~ '^#[0-9A-Fa-f]{6}$') not valid;

alter table public.profiles
  validate constraint profiles_brand_color_hex_check;

alter table public.profiles
  add constraint profiles_response_style_check
    check (response_style in ('formal', 'balanced', 'friendly')) not valid,
  add constraint profiles_response_length_check
    check (response_length in ('short', 'balanced', 'detailed')) not valid;

alter table public.profiles
  validate constraint profiles_response_style_check;
alter table public.profiles
  validate constraint profiles_response_length_check;

-- Extend public assistant behavior without changing the existing function's
-- deployed return signature.
create or replace function public.get_public_assistant_for_chat(
  requested_assistant_id uuid
)
returns table (
  business_name text,
  assistant_name text,
  welcome_message text,
  custom_instructions text,
  allowed_domains text[],
  response_style text,
  response_length text
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    p.business_name,
    p.assistant_name,
    p.welcome_message,
    p.custom_instructions,
    p.allowed_domains,
    p.response_style,
    p.response_length
  from public.profiles as p
  where p.assistant_id = requested_assistant_id;
$$;

revoke execute on function public.get_public_assistant_for_chat(uuid)
  from public, anon, authenticated;
grant execute on function public.get_public_assistant_for_chat(uuid)
  to service_role;

-- A short-lived challenge can confirm that the real widget script loaded from
-- the expected website origin. The token is single-use and never logged.
create table if not exists public.widget_installation_checks (
  id uuid primary key default gen_random_uuid(),
  assistant_id uuid not null references public.profiles(assistant_id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  expected_origin text not null,
  token_hash text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'verified', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  verified_at timestamptz
);

create index if not exists widget_installation_checks_owner_idx
  on public.widget_installation_checks (owner_user_id, assistant_id, created_at desc);

alter table public.widget_installation_checks enable row level security;
revoke all on table public.widget_installation_checks from public, anon, authenticated;
grant all on table public.widget_installation_checks to service_role;
