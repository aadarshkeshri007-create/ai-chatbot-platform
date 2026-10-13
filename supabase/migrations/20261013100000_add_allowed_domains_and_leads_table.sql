-- Migration: Add allowed_domains to profiles and create leads table
-- Description:
-- 1. Adds allowed_domains to public.profiles.
-- 2. Validates and promotes the existing profiles_assistant_id_key unique index
--    to a formal UNIQUE constraint on public.profiles(assistant_id).
-- 3. Creates public.leads with named constraints and ON DELETE CASCADE referencing profiles(assistant_id).
-- 4. Enables RLS on public.leads without client-facing policies.
-- 5. Revokes privileges from public, anon, and authenticated roles, granting required privileges to service_role.

-- 1. Add allowed_domains to public.profiles
alter table public.profiles
  add column if not exists allowed_domains text[] not null default '{}';

-- 2. Ensure profiles.assistant_id has a formal UNIQUE constraint backed by the existing unique index.
-- Migration 20261008200000 created the non-partial unique index profiles_assistant_id_key on (assistant_id).
-- This block validates index integrity and promotes it to a constraint without index duplication.
-- It fails clearly if the index/constraint state is invalid or unexpected.
do $$
declare
  v_attnum smallint;
  v_contype "char";
  v_conkey smallint[];
  v_indisunique boolean;
  v_indisvalid boolean;
  v_is_partial boolean;
  v_indnatts smallint;
  v_indnkeyatts smallint;
  v_indcol smallint;
begin
  -- Resolve attribute number for profiles.assistant_id
  select attnum
  into v_attnum
  from pg_catalog.pg_attribute
  where attrelid = 'public.profiles'::regclass
    and attname = 'assistant_id'
    and not attisdropped;

  if v_attnum is null then
    raise exception 'Column public.profiles.assistant_id does not exist.';
  end if;

  -- Check if a constraint named profiles_assistant_id_key already exists
  select contype, conkey
  into v_contype, v_conkey
  from pg_catalog.pg_constraint
  where conrelid = 'public.profiles'::regclass
    and conname = 'profiles_assistant_id_key';

  if found then
    -- Fail if existing constraint is not a UNIQUE constraint on exactly assistant_id
    if v_contype <> 'u' or array_length(v_conkey, 1) <> 1 or v_conkey[1] <> v_attnum then
      raise exception 'Constraint profiles_assistant_id_key exists on public.profiles but is not a UNIQUE constraint on exactly assistant_id (contype=%, conkey=%).', v_contype, v_conkey;
    end if;
    -- Already a valid UNIQUE constraint on assistant_id; nothing to promote
    return;
  end if;

  -- Validate existing index before promoting it
  select
    ix.indisunique,
    ix.indisvalid,
    (ix.indpred is not null),
    ix.indnatts,
    ix.indnkeyatts,
    (ix.indkey::smallint[])[0]
  into
    v_indisunique,
    v_indisvalid,
    v_is_partial,
    v_indnatts,
    v_indnkeyatts,
    v_indcol
  from pg_catalog.pg_class c
  join pg_catalog.pg_index ix on ix.indexrelid = c.oid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'profiles_assistant_id_key'
    and ix.indrelid = 'public.profiles'::regclass;

  if not found then
    raise exception 'Expected unique index profiles_assistant_id_key on public.profiles does not exist.';
  end if;

  if not v_indisunique then
    raise exception 'Index profiles_assistant_id_key on public.profiles is not a UNIQUE index.';
  end if;

  if not v_indisvalid then
    raise exception 'Index profiles_assistant_id_key on public.profiles is not a valid index.';
  end if;

  if v_is_partial then
    raise exception 'Index profiles_assistant_id_key on public.profiles is a partial index.';
  end if;

  if v_indnatts <> 1 or v_indnkeyatts <> 1 or v_indcol <> v_attnum then
    raise exception 'Index profiles_assistant_id_key on public.profiles does not index exactly assistant_id (indnatts=%, indnkeyatts=%, col=%, expected_col=%).', v_indnatts, v_indnkeyatts, v_indcol, v_attnum;
  end if;

  -- Promote the existing unique index to a formal UNIQUE constraint
  alter table public.profiles
    add constraint profiles_assistant_id_key
    unique using index profiles_assistant_id_key;
end $$;

-- 3. Create public.leads table
-- Note: This is a one-time table creation. CREATE TABLE IF NOT EXISTS avoids
-- errors on identical reruns, but does not reconcile schema drift if an incompatible
-- leads table already exists.
create table if not exists public.leads (
  id uuid not null default gen_random_uuid(),
  assistant_id uuid not null,
  name text not null,
  email text not null,
  question text not null,
  created_at timestamptz not null default now(),

  constraint leads_pkey
    primary key (id),

  constraint leads_assistant_id_fkey
    foreign key (assistant_id)
    references public.profiles (assistant_id)
    on delete cascade,

  constraint leads_name_length_check
    check (char_length(trim(name)) between 1 and 120),

  constraint leads_email_length_check
    check (char_length(email) between 3 and 254),

  constraint leads_question_length_check
    check (char_length(trim(question)) between 1 and 5000)
);

-- Index for foreign key lookups and cascade deletes
create index if not exists leads_assistant_id_idx
  on public.leads (assistant_id);

-- 4. Enable Row Level Security (RLS) on public.leads
alter table public.leads enable row level security;

-- 5. Manage table privileges following Supabase conventions
-- Revoke all table privileges from public, anon, and authenticated roles
revoke all on table public.leads from public, anon, authenticated;

-- Grant required table privileges to service_role for backend API operations
grant all on table public.leads to service_role;
