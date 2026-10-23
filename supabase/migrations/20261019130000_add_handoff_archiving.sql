alter table public.handoff_requests
  add column if not exists archived_at timestamptz null;

create index if not exists handoff_requests_owner_archive_idx
  on public.handoff_requests (owner_user_id, archived_at, updated_at desc);
