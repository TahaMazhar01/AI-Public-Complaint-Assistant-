-- ============================================================
-- MIGRATION 002 — function fixes
-- Run this in the Supabase SQL editor if you applied schema.sql
-- before 2026-09-03. Safe to run more than once.
--
-- 1. make_tracking_id was declared STABLE. PostgREST executes
--    STABLE functions inside a READ ONLY transaction, and this
--    one calls nextval(), so every RPC call failed with
--    "cannot execute nextval() in a read-only transaction".
-- 2. bump_complaint_seq is new — the seed script uses it to push
--    the sequence past the demo corpus.
-- ============================================================

create or replace function make_tracking_id(city_code text default 'LHR')
returns text language sql volatile as $$
  select 'AWZ-' || city_code || '-'
         || to_char(now(), 'YYMM') || '-'
         || lpad(nextval('complaint_seq')::text, 4, '0');
$$;

create or replace function bump_complaint_seq(to_value bigint)
returns bigint language sql volatile as $$
  select setval(
    'complaint_seq',
    greatest(to_value, (select last_value from complaint_seq))
  );
$$;
