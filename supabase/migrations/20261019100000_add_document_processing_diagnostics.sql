-- Persist useful, bounded processing diagnostics without changing existing
-- document content or removing any customer data.
alter table public.documents
  add column if not exists chunk_count integer not null default 0,
  add column if not exists processed_at timestamptz,
  add column if not exists extraction_preview text,
  add column if not exists processing_error text;

-- Backfill counts from the canonical chunk table. A document previously
-- labelled processed with no stored chunks is not usable by retrieval.
update public.documents as document
set chunk_count = (
  select count(*)::integer
  from public.document_chunks as chunk
  where chunk.document_id = document.id
)
where document.status = 'processed';

update public.documents as document
set status = 'failed',
    processing_error = 'No stored chunks were found for this document. Please process it again.'
where document.status = 'processed'
  and document.chunk_count = 0;

alter table public.documents
  add constraint documents_chunk_count_nonnegative_check
    check (chunk_count >= 0) not valid,
  add constraint documents_extraction_preview_length_check
    check (extraction_preview is null or char_length(extraction_preview) <= 2000) not valid,
  add constraint documents_processing_error_length_check
    check (processing_error is null or char_length(processing_error) <= 500) not valid;

alter table public.documents
  validate constraint documents_chunk_count_nonnegative_check;
alter table public.documents
  validate constraint documents_extraction_preview_length_check;
alter table public.documents
  validate constraint documents_processing_error_length_check;
