-- Migration: Add webhook delivery tracking and deduplication support.
-- Existing leads have unknown historical delivery outcomes.
-- New leads begin with a pending delivery status.
--
-- IMPORTANT:
-- Do not execute against production until reviewed and approved.

BEGIN;

-- 1. Add delivery tracking columns without defaults initially.
-- This allows existing rows to be classified before new-row defaults apply.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS webhook_delivery_status text,
  ADD COLUMN IF NOT EXISTS webhook_acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS webhook_attempts integer,
  ADD COLUMN IF NOT EXISTS webhook_last_error text,
  ADD COLUMN IF NOT EXISTS request_id text;

-- 2. Existing records have no trustworthy delivery history.
-- Preserve any delivery states that may already have been recorded.
UPDATE public.leads
SET webhook_delivery_status = 'uncertain'
WHERE webhook_delivery_status IS NULL;

-- Existing records have no recorded attempt count.
UPDATE public.leads
SET webhook_attempts = 0
WHERE webhook_attempts IS NULL;

-- 3. Set defaults for future records and enforce required fields.
ALTER TABLE public.leads
  ALTER COLUMN webhook_delivery_status SET DEFAULT 'pending',
  ALTER COLUMN webhook_delivery_status SET NOT NULL,
  ALTER COLUMN webhook_attempts SET DEFAULT 0,
  ALTER COLUMN webhook_attempts SET NOT NULL;

-- 4. Add constraints only if they do not already exist on public.leads.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.leads'::regclass
      AND conname = 'leads_webhook_delivery_status_check'
  ) THEN
    ALTER TABLE public.leads
      ADD CONSTRAINT leads_webhook_delivery_status_check
      CHECK (
        webhook_delivery_status IN (
          'pending',
          'acknowledged',
          'failed',
          'uncertain'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.leads'::regclass
      AND conname = 'leads_webhook_attempts_check'
  ) THEN
    ALTER TABLE public.leads
      ADD CONSTRAINT leads_webhook_attempts_check
      CHECK (webhook_attempts >= 0);
  END IF;
END
$$;

-- 5. Support recent-lead lookup and request-level deduplication.
CREATE INDEX IF NOT EXISTS leads_dedup_idx
  ON public.leads (assistant_id, email, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS leads_assistant_request_id_idx
  ON public.leads (assistant_id, request_id)
  WHERE request_id IS NOT NULL;

COMMIT;