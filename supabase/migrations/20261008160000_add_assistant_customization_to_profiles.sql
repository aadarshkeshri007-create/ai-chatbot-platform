-- Assistant identity is owned by the authenticated profile. Existing RLS policies
-- on public.profiles continue to control read and update access.
alter table public.profiles
  add column if not exists business_name text not null default 'Your Business',
  add column if not exists assistant_name text not null default 'AI Support',
  add column if not exists welcome_message text not null default 'Hello! How can I assist you today?';

-- The application does not create profile rows during signup. Preserve the
-- existing profile/RLS model while ensuring every auth user has an id-matched
-- profile row for the authenticated client queries.
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;

create or replace function public.ensure_profile_for_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created_ensure_profile
  after insert on auth.users
  for each row execute procedure public.ensure_profile_for_new_user();

alter table public.profiles
  add constraint profiles_business_name_length_check
    check (char_length(business_name) between 1 and 100) not valid,
  add constraint profiles_assistant_name_length_check
    check (char_length(assistant_name) between 1 and 100) not valid,
  add constraint profiles_welcome_message_length_check
    check (char_length(welcome_message) between 1 and 500) not valid;

alter table public.profiles validate constraint profiles_business_name_length_check;
alter table public.profiles validate constraint profiles_assistant_name_length_check;
alter table public.profiles validate constraint profiles_welcome_message_length_check;
