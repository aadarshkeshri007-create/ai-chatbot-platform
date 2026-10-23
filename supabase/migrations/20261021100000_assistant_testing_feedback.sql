-- Keep owner testing traffic separate from real visitor conversations and store
-- answer feedback and owner-reviewed FAQ drafts against the existing model.
do $preflight$
declare
  required_column record;
begin
  if pg_catalog.to_regclass('public.conversations') is null
     or pg_catalog.to_regclass('public.messages') is null
     or pg_catalog.to_regclass('public.profiles') is null
     or pg_catalog.to_regclass('public.documents') is null then
    raise exception 'Apply the existing conversation, profile, and document schema before this migration.';
  end if;
  for required_column in
    select * from (values
      ('conversations','id','uuid'), ('conversations','user_id','uuid'), ('conversations','assistant_id','uuid'),
      ('conversations','visitor_session_hash','text'), ('messages','id','uuid'), ('messages','conversation_id','uuid'),
      ('messages','role','text'), ('messages','content','text'), ('messages','sources','jsonb'),
      ('profiles','id','uuid'), ('profiles','assistant_id','uuid'),
      ('documents','id','uuid'), ('documents','user_id','uuid'), ('documents','file_name','text'),
      ('documents','file_path','text'), ('documents','file_type','text'), ('documents','status','text')
    ) as expected(table_name, column_name, expected_type)
  loop
    if not exists (
      select 1 from information_schema.columns c where c.table_schema='public'
        and c.table_name=required_column.table_name and c.column_name=required_column.column_name
        and c.udt_name=required_column.expected_type
    ) then
      raise exception 'Missing or incompatible public.%.% column.', required_column.table_name, required_column.column_name;
    end if;
  end loop;
  if not exists (select 1 from information_schema.columns where table_schema='public'
    and table_name='documents' and column_name='file_size' and udt_name in ('int2','int4','int8','numeric')) then
    raise exception 'Expected a numeric public.documents.file_size column.';
  end if;
end;
$preflight$;

alter table public.conversations add column if not exists is_test boolean not null default false;
do $column_check$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public'
    and table_name='conversations' and column_name='is_test' and udt_name='bool'
    and is_nullable='NO' and column_default in ('false','false::boolean')) then
    raise exception 'public.conversations.is_test has an incompatible definition.';
  end if;
end;
$column_check$;

-- Existing authenticated dashboard chats are tests; anonymous widget records
-- have user_id NULL and remain visitor conversations.
update public.conversations set is_test = true where user_id is not null;
create index if not exists conversations_owner_test_updated_idx
  on public.conversations (user_id, is_test, updated_at desc);

create table public.assistant_answer_feedback (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  assistant_id uuid not null,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_message_id uuid not null references public.messages(id) on delete cascade,
  assistant_message_id uuid not null unique references public.messages(id) on delete cascade,
  request_id uuid not null,
  feedback_type text not null check (feedback_type in ('helpful','not_helpful','report_issue')),
  category text null check (category is null or category in ('missing_knowledge','incorrect_answer','irrelevant_sources','formatting_clarity','other')),
  comment text null check (comment is null or char_length(comment) <= 2000),
  source_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(source_refs) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, request_id)
);
create index assistant_answer_feedback_owner_created_idx
  on public.assistant_answer_feedback (owner_user_id, created_at desc);

create table public.assistant_faq_drafts (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null unique references public.assistant_answer_feedback(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  assistant_id uuid not null,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  original_question text not null check (char_length(original_question) between 1 and 8000),
  original_answer text not null check (char_length(original_answer) between 1 and 64000),
  draft_question text not null check (char_length(draft_question) between 1 and 8000),
  draft_answer text not null default '' check (char_length(draft_answer) <= 8000),
  reason text not null default '' check (char_length(reason) <= 2000),
  source_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(source_refs) = 'array'),
  status text not null default 'pending_review' check (status in ('pending_review','approved','processing','processed','failed')),
  document_id uuid null references public.documents(id) on delete set null,
  processing_error text null check (processing_error is null or char_length(processing_error) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index assistant_faq_drafts_owner_created_idx
  on public.assistant_faq_drafts (owner_user_id, created_at desc);

alter table public.assistant_answer_feedback enable row level security;
alter table public.assistant_faq_drafts enable row level security;
revoke all on public.assistant_answer_feedback, public.assistant_faq_drafts from public, anon, authenticated;
grant select on public.assistant_answer_feedback to authenticated;
grant select on public.assistant_faq_drafts to authenticated;
grant update (draft_question, draft_answer, reason, updated_at) on public.assistant_faq_drafts to authenticated;
grant all on public.assistant_answer_feedback, public.assistant_faq_drafts to service_role;

create policy assistant_answer_feedback_owner_select on public.assistant_answer_feedback
  for select to authenticated using (owner_user_id = auth.uid() and exists (
    select 1 from public.conversations c join public.profiles p on p.id = c.user_id
    where c.id = assistant_answer_feedback.conversation_id and c.user_id = auth.uid() and c.is_test
      and c.assistant_id = assistant_answer_feedback.assistant_id and p.assistant_id = assistant_answer_feedback.assistant_id
  ));
create policy assistant_answer_feedback_owner_insert on public.assistant_answer_feedback
  for insert to authenticated with check (owner_user_id = auth.uid() and exists (
    select 1 from public.conversations c join public.profiles p on p.id = c.user_id
    where c.id = assistant_answer_feedback.conversation_id and c.user_id = auth.uid() and c.is_test
      and c.assistant_id = assistant_answer_feedback.assistant_id and p.assistant_id = assistant_answer_feedback.assistant_id
  ));

create policy assistant_faq_drafts_owner_select on public.assistant_faq_drafts
  for select to authenticated using (owner_user_id = auth.uid() and exists (
    select 1 from public.conversations c join public.profiles p on p.id = c.user_id
    where c.id = assistant_faq_drafts.conversation_id and c.user_id = auth.uid() and c.is_test
      and c.assistant_id = assistant_faq_drafts.assistant_id and p.assistant_id = assistant_faq_drafts.assistant_id
  ) and exists (
    select 1 from public.assistant_answer_feedback f where f.id = assistant_faq_drafts.feedback_id
      and f.owner_user_id = auth.uid() and f.assistant_id = assistant_faq_drafts.assistant_id
  ));
create policy assistant_faq_drafts_owner_insert on public.assistant_faq_drafts
  for insert to authenticated with check (owner_user_id = auth.uid() and exists (
    select 1 from public.conversations c join public.profiles p on p.id = c.user_id
    where c.id = assistant_faq_drafts.conversation_id and c.user_id = auth.uid() and c.is_test
      and c.assistant_id = assistant_faq_drafts.assistant_id and p.assistant_id = assistant_faq_drafts.assistant_id
  ) and exists (
    select 1 from public.assistant_answer_feedback f where f.id = assistant_faq_drafts.feedback_id
      and f.owner_user_id = auth.uid() and f.assistant_id = assistant_faq_drafts.assistant_id
  ));
create policy assistant_faq_drafts_owner_update on public.assistant_faq_drafts
  for update to authenticated using (owner_user_id = auth.uid() and exists (
    select 1 from public.conversations c join public.profiles p on p.id = c.user_id
    where c.id = assistant_faq_drafts.conversation_id and c.user_id = auth.uid() and c.is_test
      and c.assistant_id = assistant_faq_drafts.assistant_id and p.assistant_id = assistant_faq_drafts.assistant_id
  ) and exists (
    select 1 from public.assistant_answer_feedback f where f.id = assistant_faq_drafts.feedback_id
      and f.owner_user_id = auth.uid() and f.assistant_id = assistant_faq_drafts.assistant_id
  )) with check (owner_user_id = auth.uid() and exists (
    select 1 from public.conversations c join public.profiles p on p.id = c.user_id
    where c.id = assistant_faq_drafts.conversation_id and c.user_id = auth.uid() and c.is_test
      and c.assistant_id = assistant_faq_drafts.assistant_id and p.assistant_id = assistant_faq_drafts.assistant_id
  ) and exists (
    select 1 from public.assistant_answer_feedback f where f.id = assistant_faq_drafts.feedback_id
      and f.owner_user_id = auth.uid() and f.assistant_id = assistant_faq_drafts.assistant_id
  ));
