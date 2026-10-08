-- Suggested chat questions are owned by the authenticated profile. Existing RLS
-- policies on public.profiles continue to control read and update access, so a
-- user can only ever read or write their own list.
alter table public.profiles
  add column if not exists suggested_questions text[] not null default '{}';

-- Keep the stored list bounded the same way the settings UI bounds it: at most
-- five entries and no null elements. Per-question trimming and the 200
-- character limit are enforced by the settings form and on read.
alter table public.profiles
  add constraint profiles_suggested_questions_count_check
    check (
      coalesce(array_length(suggested_questions, 1), 0) <= 5
      and array_position(suggested_questions, null) is null
    ) not valid;

alter table public.profiles validate constraint profiles_suggested_questions_count_check;
