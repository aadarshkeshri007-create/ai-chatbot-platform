-- Behavior belongs to the profile's unique assistant_id in the current
-- one-profile/one-assistant model. Existing profile RLS keeps writes owner-only.
alter table public.profiles
  add column if not exists response_tone text not null default 'professional',
  add column if not exists response_language text not null default 'auto',
  add column if not exists unknown_answer_behavior text not null default 'contact_support',
  add column if not exists unknown_answer_message text not null default 'I’m sorry, but the knowledge base doesn’t contain enough information to answer that. Please contact the support team for help.',
  add column if not exists handoff_enabled boolean not null default true,
  add column if not exists handoff_intro text not null default 'You can send a request to the support team. A reply may not be immediate.';

update public.profiles
set response_tone = case response_style
  when 'formal' then 'professional'
  when 'friendly' then 'friendly'
  else 'professional'
end;

alter table public.profiles
  add constraint profiles_response_tone_check
    check (response_tone in ('professional', 'friendly', 'concise', 'empathetic')) not valid,
  add constraint profiles_response_language_check
    check (response_language in ('auto', 'en', 'es', 'fr', 'de', 'pt', 'hi', 'ja', 'zh', 'ar')) not valid,
  add constraint profiles_unknown_answer_behavior_check
    check (unknown_answer_behavior in ('contact_support', 'offer_handoff', 'custom_message')) not valid,
  add constraint profiles_unknown_answer_message_length_check
    check (char_length(unknown_answer_message) between 1 and 500) not valid,
  add constraint profiles_handoff_intro_length_check
    check (char_length(handoff_intro) between 1 and 500) not valid;

alter table public.profiles validate constraint profiles_response_tone_check;
alter table public.profiles validate constraint profiles_response_language_check;
alter table public.profiles validate constraint profiles_unknown_answer_behavior_check;
alter table public.profiles validate constraint profiles_unknown_answer_message_length_check;
alter table public.profiles validate constraint profiles_handoff_intro_length_check;

-- PostgreSQL cannot change a table-returning function's row shape in place.
-- The old function is service-role-only; restore that restriction after recreate.
drop function public.get_public_assistant_for_chat(uuid);
create function public.get_public_assistant_for_chat(requested_assistant_id uuid)
returns table (
  business_name text,
  assistant_name text,
  welcome_message text,
  custom_instructions text,
  allowed_domains text[],
  response_style text,
  response_length text,
  response_tone text,
  response_language text,
  unknown_answer_behavior text,
  unknown_answer_message text,
  handoff_enabled boolean,
  handoff_intro text
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
    p.response_length,
    p.response_tone,
    p.response_language,
    p.unknown_answer_behavior,
    p.unknown_answer_message,
    p.handoff_enabled,
    p.handoff_intro
  from public.profiles as p
  where p.assistant_id = requested_assistant_id;
$$;

revoke execute on function public.get_public_assistant_for_chat(uuid)
  from public, anon, authenticated;
grant execute on function public.get_public_assistant_for_chat(uuid)
  to service_role;
