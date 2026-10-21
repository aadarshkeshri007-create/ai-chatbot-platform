-- Persist anonymous widget conversations in the existing conversations/messages model.
-- Public visitors never receive database access; only the service-role API can invoke the RPC.
-- The base table definitions are maintained outside this repository. Fail before DDL if
-- the minimum shape used by the existing application is not present and compatible.
do $preflight$
declare
  required_column record;
  actual_type text;
begin
  if pg_catalog.to_regclass('public.conversations') is null
     or pg_catalog.to_regclass('public.messages') is null
     or pg_catalog.to_regclass('public.profiles') is null then
    raise exception 'Expected public.conversations, public.messages, and public.profiles to exist before visitor persistence migration.';
  end if;

  for required_column in
    select * from (values
      ('conversations', 'id', 'uuid'),
      ('conversations', 'user_id', 'uuid'),
      ('conversations', 'title', 'text'),
      ('conversations', 'created_at', 'timestamptz'),
      ('conversations', 'updated_at', 'timestamptz'),
      ('messages', 'id', 'uuid'),
      ('messages', 'conversation_id', 'uuid'),
      ('messages', 'role', 'text'),
      ('messages', 'content', 'text'),
      ('messages', 'created_at', 'timestamptz'),
      ('profiles', 'id', 'uuid'),
      ('profiles', 'assistant_id', 'uuid')
    ) as expected(table_name, column_name, expected_type)
  loop
    select c.udt_name into actual_type
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = required_column.table_name
      and c.column_name = required_column.column_name;
    if not found then
      raise exception 'Required column public.%.% is missing.', required_column.table_name, required_column.column_name;
    end if;
    if actual_type <> required_column.expected_type then
      raise exception 'Incompatible type for public.%.%: expected %, found %.',
        required_column.table_name, required_column.column_name, required_column.expected_type, actual_type;
    end if;
  end loop;

  if not exists (
    select 1 from pg_catalog.pg_attribute a
    where a.attrelid = 'public.conversations'::regclass and a.attname = 'id'
      and a.attnum > 0 and not a.attisdropped and a.atthasdef
  ) or not exists (
    select 1 from pg_catalog.pg_attribute a
    where a.attrelid = 'public.messages'::regclass and a.attname = 'id'
      and a.attnum > 0 and not a.attisdropped and a.atthasdef
  ) then
    raise exception 'Expected UUID defaults for conversations.id and messages.id.';
  end if;
  if exists (
    select 1
    from (values
      ('conversations', 'created_at'),
      ('conversations', 'updated_at'),
      ('messages', 'created_at')
    ) as timestamp_column(table_name, column_name)
    where not exists (
      select 1 from pg_catalog.pg_attribute a
      where a.attrelid = pg_catalog.to_regclass('public.' || timestamp_column.table_name)
        and a.attname = timestamp_column.column_name
        and a.attnum > 0 and not a.attisdropped and a.atthasdef
    )
  ) then
    raise exception 'Expected defaults for conversation and message timestamps used by the current application.';
  end if;
end;
$preflight$;

alter table public.conversations alter column user_id drop not null;
alter table public.conversations add column if not exists assistant_id uuid null;
alter table public.conversations add column if not exists visitor_session_hash text null;
alter table public.messages add column if not exists client_message_id uuid null;
alter table public.messages add column if not exists sources jsonb not null default '[]'::jsonb;

-- IF NOT EXISTS alone can hide an incompatible column added outside migration history.
do $column_check$
declare
  column_info record;
begin
  for column_info in
    select * from (values
      ('conversations', 'assistant_id', 'uuid', true),
      ('conversations', 'visitor_session_hash', 'text', true),
      ('messages', 'client_message_id', 'uuid', true),
      ('messages', 'sources', 'jsonb', false)
    ) as expected(table_name, column_name, expected_type, expected_nullable)
  loop
    if not exists (
      select 1 from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = column_info.table_name
        and c.column_name = column_info.column_name
        and c.udt_name = column_info.expected_type
        and (c.is_nullable = 'YES') = column_info.expected_nullable
        and (column_info.column_name <> 'sources' or c.column_default is not null)
    ) then
      raise exception 'Incompatible or missing definition for public.%.%.', column_info.table_name, column_info.column_name;
    end if;
  end loop;
end;
$column_check$;

create unique index if not exists conversations_visitor_session_unique
  on public.conversations (assistant_id, visitor_session_hash)
  where visitor_session_hash is not null;
create unique index if not exists messages_client_request_role_unique
  on public.messages (conversation_id, client_message_id, role)
  where client_message_id is not null;
create index if not exists conversations_assistant_updated_idx
  on public.conversations (assistant_id, updated_at desc)
  where assistant_id is not null;

-- Validate the definitions, not just the names, of indexes that IF NOT EXISTS may skip.
do $index_check$
declare
  expected_index record;
  actual_definition text;
  actual_valid boolean;
begin
  for expected_index in
    select * from (values
      ('conversations_visitor_session_unique', 'public.conversations',
        '.* on public\.conversations using btree \(assistant_id, visitor_session_hash\) where \(visitor_session_hash is not null\)$', true),
      ('messages_client_request_role_unique', 'public.messages',
        '.* on public\.messages using btree \(conversation_id, client_message_id, role\) where \(client_message_id is not null\)$', true),
      ('conversations_assistant_updated_idx', 'public.conversations',
        '.* on public\.conversations using btree \(assistant_id, updated_at desc\) where \(assistant_id is not null\)$', false)
    ) as expected(index_name, table_name, definition_pattern, expected_unique)
  loop
    select pg_catalog.pg_get_indexdef(i.indexrelid), i.indisvalid
      into actual_definition, actual_valid
    from pg_catalog.pg_index i
    join pg_catalog.pg_class idx on idx.oid = i.indexrelid
    where idx.oid = pg_catalog.to_regclass('public.' || expected_index.index_name)
      and i.indrelid = pg_catalog.to_regclass(expected_index.table_name)
      and i.indisunique = expected_index.expected_unique;
    if not found or not actual_valid or actual_definition !~* expected_index.definition_pattern then
      raise exception 'Index public.% is missing or incompatible; inspect it before retrying this migration.', expected_index.index_name;
    end if;
  end loop;
end;
$index_check$;

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

drop policy if exists conversations_assistant_owner_select on public.conversations;
create policy conversations_assistant_owner_select
  on public.conversations for select to authenticated
  using (
    assistant_id is not null and exists (
      select 1 from public.profiles p
      where p.assistant_id = conversations.assistant_id and p.id = auth.uid()
    )
  );

drop policy if exists messages_assistant_owner_select on public.messages;
create policy messages_assistant_owner_select
  on public.messages for select to authenticated
  using (
    exists (
      select 1 from public.conversations c
      join public.profiles p on p.assistant_id = c.assistant_id
      where c.id = messages.conversation_id and p.id = auth.uid()
    )
  );

create or replace function public.persist_public_chat_turn(
  requested_assistant_id uuid,
  requested_session_hash text,
  requested_message_id uuid,
  visitor_message text,
  assistant_message text,
  assistant_sources jsonb,
  conversation_title text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  target_conversation_id uuid;
  visitor_row public.messages%rowtype;
  assistant_row public.messages%rowtype;
  clean_visitor_message text;
  clean_assistant_message text;
begin
  if requested_assistant_id is null
     or requested_session_hash is null
     or requested_message_id is null
     or visitor_message is null
     or assistant_message is null
     or assistant_sources is null
     or requested_session_hash !~ '^[a-f0-9]{64}$'
     or pg_catalog.char_length(pg_catalog.regexp_replace(visitor_message, '^[[:space:]]+|[[:space:]]+$', '', 'g')) not between 1 and 8000
     or pg_catalog.char_length(pg_catalog.regexp_replace(assistant_message, '^[[:space:]]+|[[:space:]]+$', '', 'g')) not between 1 and 64000
     or pg_catalog.jsonb_typeof(assistant_sources) is distinct from 'array'
     or pg_catalog.jsonb_array_length(assistant_sources) > 10
     or (conversation_title is not null and pg_catalog.char_length(conversation_title) > 120)
     or exists (
       select 1
       from pg_catalog.jsonb_array_elements(assistant_sources) as source(value)
       where pg_catalog.jsonb_typeof(source.value) is distinct from 'object'
         or source.value - array['label', 'document_id', 'chunk_id', 'chunk_index']::text[] <> '{}'::jsonb
         or pg_catalog.jsonb_typeof(source.value -> 'label') is distinct from 'string'
         or pg_catalog.char_length(pg_catalog.btrim(source.value ->> 'label')) not between 1 and 200
         or (source.value ? 'document_id' and (
           pg_catalog.jsonb_typeof(source.value -> 'document_id') is distinct from 'string'
           or pg_catalog.char_length(source.value ->> 'document_id') not between 1 and 200
         ))
         or (source.value ? 'chunk_id' and (
           pg_catalog.jsonb_typeof(source.value -> 'chunk_id') is distinct from 'string'
           or pg_catalog.char_length(source.value ->> 'chunk_id') not between 1 and 200
         ))
         or (source.value ? 'chunk_index' and (
           pg_catalog.jsonb_typeof(source.value -> 'chunk_index') is distinct from 'number'
           or (source.value ->> 'chunk_index') !~ '^[0-9]{1,10}$'
           or (pg_catalog.char_length(source.value ->> 'chunk_index') = 10
             and source.value ->> 'chunk_index' > '2147483647')
         ))
     ) then
    raise exception 'invalid chat turn';
  end if;
  clean_visitor_message := pg_catalog.regexp_replace(visitor_message, '^[[:space:]]+|[[:space:]]+$', '', 'g');
  clean_assistant_message := pg_catalog.regexp_replace(assistant_message, '^[[:space:]]+|[[:space:]]+$', '', 'g');
  if not exists (select 1 from public.profiles p where p.assistant_id = requested_assistant_id) then
    raise exception 'assistant unavailable';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    requested_assistant_id::text || ':' || requested_session_hash, 0
  ));

  insert into public.conversations (user_id, assistant_id, visitor_session_hash, title)
  values (null, requested_assistant_id, requested_session_hash, pg_catalog.left(coalesce(nullif(pg_catalog.btrim(conversation_title), ''), 'Website visitor chat'), 120))
  on conflict (assistant_id, visitor_session_hash) where visitor_session_hash is not null
  do update set updated_at = pg_catalog.now()
  returning id into target_conversation_id;

  select * into visitor_row from public.messages
    where conversation_id = target_conversation_id and client_message_id = requested_message_id and role = 'user';
  if found then
    if visitor_row.content <> clean_visitor_message then raise exception 'request identifier already used'; end if;
    select * into assistant_row from public.messages
      where conversation_id = target_conversation_id and client_message_id = requested_message_id and role = 'assistant';
    if not found then raise exception 'incomplete chat turn'; end if;
    return pg_catalog.jsonb_build_object('conversation_id', target_conversation_id,
      'visitor_message', pg_catalog.to_jsonb(visitor_row), 'assistant_message', pg_catalog.to_jsonb(assistant_row));
  end if;

  insert into public.messages (conversation_id, role, content, client_message_id, sources, created_at)
  values (target_conversation_id, 'user', clean_visitor_message, requested_message_id, '[]'::jsonb, pg_catalog.clock_timestamp())
  returning * into visitor_row;
  insert into public.messages (conversation_id, role, content, client_message_id, sources, created_at)
  values (target_conversation_id, 'assistant', clean_assistant_message, requested_message_id, assistant_sources,
    greatest(pg_catalog.clock_timestamp(), visitor_row.created_at + interval '1 microsecond'))
  returning * into assistant_row;
  update public.conversations set updated_at = pg_catalog.now() where id = target_conversation_id;
  return pg_catalog.jsonb_build_object('conversation_id', target_conversation_id,
    'visitor_message', pg_catalog.to_jsonb(visitor_row), 'assistant_message', pg_catalog.to_jsonb(assistant_row));
end;
$$;

revoke all on function public.persist_public_chat_turn(uuid, text, uuid, text, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.persist_public_chat_turn(uuid, text, uuid, text, text, jsonb, text) to service_role;

