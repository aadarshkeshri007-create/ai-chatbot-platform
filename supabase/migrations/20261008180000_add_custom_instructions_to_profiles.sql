-- Additional business-owned behavior guidance for the support assistant.
-- Existing profile RLS policies remain unchanged.
alter table public.profiles
  add column if not exists custom_instructions text not null default '';

alter table public.profiles
  add constraint profiles_custom_instructions_length_check
    check (char_length(custom_instructions) <= 4000) not valid;

alter table public.profiles
  validate constraint profiles_custom_instructions_length_check;
