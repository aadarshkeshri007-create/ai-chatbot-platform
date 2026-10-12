-- Public assistant lookup and retrieval functions.
-- These functions are executable only by the trusted server-side
-- implementation using SUPABASE_SERVICE_ROLE_KEY.
--
-- pgvector is installed in the extensions schema.

CREATE OR REPLACE FUNCTION public.get_public_assistant(
  requested_assistant_id uuid
)
RETURNS TABLE (
  business_name text,
  assistant_name text,
  welcome_message text,
  custom_instructions text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT
    p.business_name,
    p.assistant_name,
    p.welcome_message,
    p.custom_instructions
  FROM public.profiles AS p
  WHERE p.assistant_id = requested_assistant_id;
$$;


CREATE OR REPLACE FUNCTION public.match_public_assistant_chunks(
  requested_assistant_id uuid,
  query_embedding extensions.vector(768),
  match_count integer,
  match_threshold real
)
RETURNS TABLE (
  id uuid,
  file_name text,
  content text,
  chunk_index integer,
  similarity real
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT
    c.id,
    d.file_name,
    c.content,
    c.chunk_index,
    (
      1 - (c.embedding OPERATOR(extensions.<=>) query_embedding)
    )::real AS similarity
  FROM public.document_chunks AS c
  JOIN public.documents AS d
    ON d.id = c.document_id
  JOIN public.profiles AS p
    ON p.id = d.user_id
  WHERE p.assistant_id = requested_assistant_id
    AND d.status = 'processed'
    AND 1 - (c.embedding OPERATOR(extensions.<=>) query_embedding)
        >= match_threshold
  ORDER BY c.embedding OPERATOR(extensions.<=>) query_embedding
  LIMIT GREATEST(0, LEAST(match_count, 20));
$$;


CREATE OR REPLACE FUNCTION public.keyword_search_public_assistant_chunks(
  requested_assistant_id uuid,
  search_query text,
  match_count integer
)
RETURNS TABLE (
  id uuid,
  file_name text,
  content text,
  chunk_index integer,
  rank real
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT
    c.id,
    d.file_name,
    c.content,
    c.chunk_index,
    pg_catalog.ts_rank_cd(
      pg_catalog.to_tsvector('simple', c.content),
      pg_catalog.plainto_tsquery('simple', search_query)
    )::real AS rank
  FROM public.document_chunks AS c
  JOIN public.documents AS d
    ON d.id = c.document_id
  JOIN public.profiles AS p
    ON p.id = d.user_id
  WHERE p.assistant_id = requested_assistant_id
    AND d.status = 'processed'
    AND pg_catalog.to_tsvector('simple', c.content)
        @@ pg_catalog.plainto_tsquery('simple', search_query)
  ORDER BY rank DESC
  LIMIT GREATEST(0, LEAST(match_count, 20));
$$;


-- Remove execution privileges from browser-facing roles.

REVOKE EXECUTE ON FUNCTION public.get_public_assistant(uuid)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.match_public_assistant_chunks(
  uuid,
  extensions.vector(768),
  integer,
  real
) FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.keyword_search_public_assistant_chunks(
  uuid,
  text,
  integer
) FROM PUBLIC, anon, authenticated;


-- Only the trusted server-side service role may execute these functions.

GRANT EXECUTE ON FUNCTION public.get_public_assistant(uuid)
  TO service_role;

GRANT EXECUTE ON FUNCTION public.match_public_assistant_chunks(
  uuid,
  extensions.vector(768),
  integer,
  real
) TO service_role;

GRANT EXECUTE ON FUNCTION public.keyword_search_public_assistant_chunks(
  uuid,
  text,
  integer
) TO service_role;