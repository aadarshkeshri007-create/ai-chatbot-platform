create table if not exists public.handoff_requests (
  id uuid not null default gen_random_uuid(),
  assistant_id uuid not null,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid null references public.conversations(id) on delete set null,
  customer_name text null,
  customer_email text null,
  reason text not null,
  latest_message text null,
  transcript jsonb not null default '[]'::jsonb,
  status text not null default 'open',
  public_token_hash text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint handoff_requests_reason_length check (char_length(trim(reason)) between 1 and 2000),
  constraint handoff_requests_name_length check (customer_name is null or char_length(trim(customer_name)) between 1 and 120),
  constraint handoff_requests_email_length check (customer_email is null or char_length(customer_email) between 3 and 254),
  constraint handoff_requests_latest_message_length check (latest_message is null or char_length(latest_message) between 1 and 8000),
  constraint handoff_requests_status_check check (status in ('open', 'in_progress', 'waiting_for_customer', 'resolved'))
);

create index if not exists handoff_requests_owner_idx
  on public.handoff_requests (owner_user_id, updated_at desc);
create index if not exists handoff_requests_assistant_idx
  on public.handoff_requests (assistant_id, updated_at desc);

create table if not exists public.handoff_messages (
  id uuid not null default gen_random_uuid(),
  handoff_id uuid not null references public.handoff_requests(id) on delete cascade,
  role text not null,
  content text not null,
  created_at timestamptz not null default now(),
  constraint handoff_messages_role_check check (role in ('customer', 'human')),
  constraint handoff_messages_content_length check (char_length(trim(content)) between 1 and 8000)
);

create index if not exists handoff_messages_handoff_idx
  on public.handoff_messages (handoff_id, created_at);

alter table public.handoff_requests enable row level security;
alter table public.handoff_messages enable row level security;

revoke all on table public.handoff_requests from public, anon, authenticated;
revoke all on table public.handoff_messages from public, anon, authenticated;

grant select, update on table public.handoff_requests to authenticated;
grant select, insert on table public.handoff_messages to authenticated;
grant all on table public.handoff_requests, public.handoff_messages to service_role;

create policy handoff_requests_owner_select
  on public.handoff_requests for select to authenticated
  using (owner_user_id = auth.uid());

create policy handoff_requests_owner_update
  on public.handoff_requests for update to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

create policy handoff_messages_owner_select
  on public.handoff_messages for select to authenticated
  using (
    exists (
      select 1
      from public.handoff_requests h
      where h.id = handoff_id
        and h.owner_user_id = auth.uid()
    )
  );

create policy handoff_messages_owner_insert
  on public.handoff_messages for insert to authenticated
  with check (
    role = 'human'
    and exists (
      select 1
      from public.handoff_requests h
      where h.id = handoff_id
        and h.owner_user_id = auth.uid()
    )
  );
