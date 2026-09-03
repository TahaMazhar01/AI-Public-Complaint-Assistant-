-- ============================================================
-- AWAAZ — SUPABASE SCHEMA
-- Run this whole file once in the Supabase SQL editor.
-- Safe to re-run: everything is IF NOT EXISTS / OR REPLACE.
-- ============================================================

create extension if not exists vector;
create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- TRACKING NUMBERS
-- A real sequence, so IDs are sequential and look official:
--   AWZ-LHR-2609-0043
-- ------------------------------------------------------------
create sequence if not exists complaint_seq start 1;

-- VOLATILE, not STABLE: PostgREST runs STABLE functions inside a
-- read-only transaction, and this one calls nextval().
create or replace function make_tracking_id(city_code text default 'LHR')
returns text language sql volatile as $$
  select 'AWZ-' || city_code || '-'
         || to_char(now(), 'YYMM') || '-'
         || lpad(nextval('complaint_seq')::text, 4, '0');
$$;

-- ------------------------------------------------------------
-- COMPLAINTS
-- Embedding is vector(1024). Providers differ in dimension
-- (Qwen v3 = 1024, Gemini = 768) so the app right-pads with
-- zeros. Cosine distance is unaffected as long as every row
-- comes from the same provider — do not mix providers mid-demo.
-- ------------------------------------------------------------
create table if not exists complaints (
  id                uuid primary key default gen_random_uuid(),
  tracking_id       text unique not null default make_tracking_id(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- raw intake
  raw_text          text not null,
  intake_mode       text not null default 'text'
                      check (intake_mode in ('text','voice','photo')),
  detected_language text not null default 'en'
                      check (detected_language in ('en','ur','ur-latn','mixed')),
  audio_url         text,
  photo_urls        text[] not null default '{}',

  -- where
  lat               double precision,
  lng               double precision,
  address_text      text,
  neighbourhood     text,
  city              text not null default 'Lahore',

  -- model output
  title             text not null,
  summary           text not null,
  category          text not null,
  department_id     text not null,
  priority          text not null check (priority in ('P1','P2','P3','P4')),
  priority_reason   text not null default '',
  hazard_flags      text[] not null default '{}',
  formal_text       text not null default '',
  confidence        real not null default 0.5,

  -- lifecycle
  status            text not null default 'submitted'
                      check (status in ('submitted','routed','acknowledged',
                                        'in_progress','resolved','rejected')),
  sla_hours         int  not null default 72,
  due_at            timestamptz not null default now() + interval '72 hours',
  resolved_at       timestamptz,
  assigned_officer  text,

  -- duplicate clustering
  cluster_id        uuid,
  is_cluster_parent boolean not null default true,
  duplicate_count   int not null default 0,

  -- reporter (deliberately minimal — no accounts in v1)
  citizen_name      text,
  citizen_phone     text,

  embedding         vector(1024)
);

create index if not exists complaints_created_idx   on complaints (created_at desc);
create index if not exists complaints_status_idx    on complaints (status);
create index if not exists complaints_dept_idx      on complaints (department_id);
create index if not exists complaints_priority_idx  on complaints (priority);
create index if not exists complaints_cluster_idx   on complaints (cluster_id);
create index if not exists complaints_geo_idx       on complaints (lat, lng);
create index if not exists complaints_embed_idx
  on complaints using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- keep updated_at honest
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists complaints_touch on complaints;
create trigger complaints_touch before update on complaints
  for each row execute function touch_updated_at();

-- ------------------------------------------------------------
-- EVENTS — append-only audit trail.
-- This is what the citizen timeline and the officer log render.
-- ------------------------------------------------------------
create table if not exists complaint_events (
  id           uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references complaints(id) on delete cascade,
  created_at   timestamptz not null default now(),
  kind         text not null check (kind in ('received','analysed','routed','merged',
                                             'escalated','status_changed','note','resolved')),
  actor        text not null check (actor in ('citizen','awaaz_ai','officer','system')),
  message      text not null,
  meta         jsonb
);

create index if not exists events_complaint_idx on complaint_events (complaint_id, created_at);

-- ------------------------------------------------------------
-- DUPLICATE DETECTION
-- Semantic similarity AND physical proximity AND same category.
-- All three must agree before we merge — a pothole in Gulberg is
-- not the same case as a pothole in Johar Town, however similarly
-- it is described.
-- ------------------------------------------------------------
create or replace function match_duplicates(
  query_embedding vector(1024),
  query_lat       double precision,
  query_lng       double precision,
  query_category  text,
  radius_m        int   default 300,
  min_similarity  real  default 0.82,
  max_age_days    int   default 30
)
returns table (
  complaint_id uuid,
  tracking_id  text,
  similarity   real,
  distance_m   int,
  created_at   timestamptz
)
language sql stable as $$
  select
    c.id,
    c.tracking_id,
    (1 - (c.embedding <=> query_embedding))::real as similarity,
    (6371000 * 2 * asin(sqrt(
        power(sin(radians(c.lat - query_lat) / 2), 2) +
        cos(radians(query_lat)) * cos(radians(c.lat)) *
        power(sin(radians(c.lng - query_lng) / 2), 2)
    )))::int as distance_m,
    c.created_at
  from complaints c
  where c.embedding is not null
    and c.category = query_category
    and c.status <> 'resolved'
    and c.created_at > now() - (max_age_days || ' days')::interval
    and c.lat is not null and c.lng is not null
    and (1 - (c.embedding <=> query_embedding)) >= min_similarity
    and (6371000 * 2 * asin(sqrt(
          power(sin(radians(c.lat - query_lat) / 2), 2) +
          cos(radians(query_lat)) * cos(radians(c.lat)) *
          power(sin(radians(c.lng - query_lng) / 2), 2)
        ))) <= radius_m
  order by similarity desc
  limit 5;
$$;

-- ------------------------------------------------------------
-- LIVE DASHBOARD FEED
-- ------------------------------------------------------------
alter publication supabase_realtime add table complaints;

-- ------------------------------------------------------------
-- RLS
-- HACKATHON POSTURE: anyone may file and read; only the service
-- role may change status. Real deployment would put officers
-- behind auth — say this out loud in the pitch, do not pretend
-- otherwise if a judge asks.
-- ------------------------------------------------------------
alter table complaints        enable row level security;
alter table complaint_events  enable row level security;

drop policy if exists complaints_read   on complaints;
drop policy if exists complaints_insert on complaints;
drop policy if exists events_read       on complaint_events;
drop policy if exists events_insert     on complaint_events;

create policy complaints_read   on complaints       for select using (true);
create policy complaints_insert on complaints       for insert with check (true);
create policy events_read       on complaint_events for select using (true);
create policy events_insert     on complaint_events for insert with check (true);

-- ------------------------------------------------------------
-- SEQUENCE BUMP
-- After loading the demo corpus, push the sequence past the
-- seeded numbers so newly filed complaints sort after them
-- rather than restarting at 0001.
-- ------------------------------------------------------------
create or replace function bump_complaint_seq(to_value bigint)
returns bigint language sql as $$
  select setval(
    'complaint_seq',
    greatest(to_value, (select last_value from complaint_seq))
  );
$$;
