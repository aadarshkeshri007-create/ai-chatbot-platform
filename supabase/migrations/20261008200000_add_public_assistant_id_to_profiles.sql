-- A public, non-secret identifier for embedding an assistant later.
-- Existing profile RLS policies remain unchanged and continue to protect
-- access to profile data and all related private resources.
alter table public.profiles
  add column if not exists assistant_id uuid;

update public.profiles
set assistant_id = gen_random_uuid()
where assistant_id is null;

alter table public.profiles
  alter column assistant_id set default gen_random_uuid(),
  alter column assistant_id set not null;

create unique index if not exists profiles_assistant_id_key
  on public.profiles (assistant_id);

comment on column public.profiles.assistant_id is
  'Public non-secret assistant identifier; does not grant access to profile data or resources.';
