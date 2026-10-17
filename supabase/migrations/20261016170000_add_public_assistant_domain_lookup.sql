-- Return the per-assistant domain configuration without changing the
-- previously deployed get_public_assistant function signature.
create or replace function public.get_public_assistant_with_domains(
  requested_assistant_id uuid
)
returns table (
  business_name text,
  assistant_name text,
  welcome_message text,
  custom_instructions text,
  allowed_domains text[]
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
    p.allowed_domains
  from public.profiles as p
  where p.assistant_id = requested_assistant_id;
$$;

revoke execute on function public.get_public_assistant_with_domains(uuid)
  from public, anon, authenticated;

grant execute on function public.get_public_assistant_with_domains(uuid)
  to service_role;
