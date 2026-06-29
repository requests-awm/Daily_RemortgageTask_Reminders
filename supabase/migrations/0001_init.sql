-- ============================================================================
-- Remortgage Reminder — initial schema
-- ============================================================================
-- Target: AWM shared Supabase instance.
-- Schema name: remortgage_reminders   <-- PROPOSED. Colin provisions the schema
--   and the name is PERMANENT; confirm it before applying. If different, do a
--   find/replace of `remortgage_reminders` across this file.
--
-- Standards enforced (see ~/.claude/shared-db/STANDARDS_AND_RULES.md):
--   * Own schema only — never writes to public; client display data is read
--     from public.insightly_contacts and merged in app code (no cross-schema FK).
--   * TIMESTAMPTZ everywhere; FKs ON DELETE RESTRICT; soft-delete on client data.
--   * Enums for every controlled value (named <schema>.<column>_type).
--   * insightly_id TEXT NOT NULL on every client-linked table.
--   * RLS enabled + service_role policy on every table (backend-only access).
--
-- What this models:
--   runs           one row per pipeline run (scheduled / manual / on-demand)
--   reminders      one row per matched (task, stage, day) — the review queue +
--                  the durable record of what was auto-sent vs held
--   audit_events   append-only log of every send/skip/hold/notify (FCA 7-yr)
--   test_recipients DB-managed allowlist (replaces hardcoded testContacts.js)
-- ============================================================================

create schema if not exists remortgage_reminders;
set search_path = remortgage_reminders;

-- ---------------------------------------------------------------------------
-- updated_at trigger helper (lives in our schema)
-- ---------------------------------------------------------------------------
create or replace function remortgage_reminders.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Enums  (lowercase snake_case; values are permanent once data exists)
-- ---------------------------------------------------------------------------

-- How a run was triggered.
create type remortgage_reminders.run_source_type as enum (
  'scheduled',   -- the 08:30 cron
  'manual',      -- "Run now" button / POST /api/run/now
  'on_demand'    -- computed to serve a page load (never sends)
);

-- Whether the run actually dispatched email (mirrors SEND_MODE).
create type remortgage_reminders.send_mode_type as enum (
  'dry',         -- resolved + recorded, nothing sent
  'live'         -- emails actually sent
);

-- Auto-send policy in force for the run (mirrors AUTO_SEND).
create type remortgage_reminders.auto_send_mode_type as enum (
  'clean',       -- auto-send candidates with no blockers, hold the rest
  'off'          -- send nothing automatically; everything waits for review
);

-- The six reminder stages (offset relative to the confirmed remortgage date).
create type remortgage_reminders.reminder_stage_type as enum (
  'six_months_before',
  'three_months_before',
  'one_month_before',
  'one_month_after',
  'three_months_after',
  'six_months_after'
);

-- Lifecycle status of a single reminder (drives the Review Queue tabs).
create type remortgage_reminders.reminder_status_type as enum (
  'pending',     -- clean but not yet dispatched (e.g. label-only / off mode)
  'held',        -- blocked — needs human review before it can send
  'sent',        -- emailed (auto or manual)
  'skipped',     -- a human chose not to send
  'stopped'      -- stop-automation flag set on the task
);

-- How a sent reminder got sent.
create type remortgage_reminders.dispatch_method_type as enum (
  'auto',        -- sent unattended by the daily run
  'manual'       -- approved by a human in the Review Queue
);

-- Why a reminder was held (mirrors the engine's `blockers`). Stored as an array.
create type remortgage_reminders.block_reason_type as enum (
  'no_client_email',
  'no_broker_appointed',
  'stop_flag_set'
);

-- Audit log action.
create type remortgage_reminders.audit_action_type as enum (
  'auto_sent',
  'manually_sent',
  'skipped',
  'held',
  'send_failed',
  'comment_posted',
  'notified'      -- ops notification about held items
);

-- Who/what performed the audited action.
create type remortgage_reminders.audit_actor_type as enum (
  'system',
  'user'
);

-- ---------------------------------------------------------------------------
-- runs — one row per pipeline execution
-- ---------------------------------------------------------------------------
create table remortgage_reminders.runs (
  id              uuid primary key default gen_random_uuid(),
  run_date        date not null,                               -- business date of the run
  source          remortgage_reminders.run_source_type not null,
  send_mode       remortgage_reminders.send_mode_type not null,
  auto_send_mode  remortgage_reminders.auto_send_mode_type not null,
  dry             boolean not null,                            -- true = nothing emailed
  total_tasks     integer,
  matched         integer,
  auto_sent       integer not null default 0,
  held            integer not null default 0,
  notified        boolean not null default false,
  error           text,                                        -- set if the run failed
  ran_at          timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index idx_runs_run_date on remortgage_reminders.runs (run_date);
create trigger trg_runs_updated_at before update on remortgage_reminders.runs
  for each row execute function remortgage_reminders.set_updated_at();

-- ---------------------------------------------------------------------------
-- reminders — one row per matched (task, stage, day); the queue + send record
-- Client-linked: carries insightly_id + soft-delete columns.
-- ---------------------------------------------------------------------------
create table remortgage_reminders.reminders (
  id              uuid primary key default gen_random_uuid(),
  run_id          uuid not null references remortgage_reminders.runs(id) on delete restrict,

  -- Client + task identity (display name/adviser come from public.insightly_contacts).
  insightly_id    text not null,                               -- links public.insightly_contacts.client_id
  asana_task_gid  text not null,
  asana_link      text,
  run_date        date not null,                               -- denormalised for the idempotency key

  -- What fired.
  stage           remortgage_reminders.reminder_stage_type not null,
  confirmed_date  date,                                        -- aU_Confirmed_Remortgage_Date
  deal_end_label  text,                                        -- pre-formatted for the email body

  -- Point-in-time content of THIS reminder (immutable record of what we sent).
  client_email    text,                                        -- resolved recipient (null => held)
  broker_email    text,                                        -- broker Cc (null => held)
  subject         text,
  body_html       text,
  asana_comment   text,

  -- Outcome.
  status          remortgage_reminders.reminder_status_type not null default 'pending',
  block_reasons   remortgage_reminders.block_reason_type[] not null default '{}',
  dispatch_method remortgage_reminders.dispatch_method_type,   -- null until sent
  dry_run         boolean,                                     -- was the send simulated
  sent_at         timestamptz,
  skip_reason     text,
  hold_reason     text,
  stop_value      text,                                        -- raw stop-flag value if stopped
  gmail_message_id text,                                       -- provider id when actually sent
  comment_posted  boolean not null default false,
  send_error      text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  is_deleted      boolean not null default false,
  deleted_at      timestamptz,
  deletion_reason text,

  -- Durable idempotency: one reminder per task+stage+day, however many times
  -- the run fires (cron + manual + restart). Upsert on this key.
  constraint uq_reminders_task_stage_day unique (asana_task_gid, stage, run_date)
);
create index idx_reminders_run on remortgage_reminders.reminders (run_id);
create index idx_reminders_status on remortgage_reminders.reminders (status);
create index idx_reminders_insightly on remortgage_reminders.reminders (insightly_id);
create index idx_reminders_run_date on remortgage_reminders.reminders (run_date);
create trigger trg_reminders_updated_at before update on remortgage_reminders.reminders
  for each row execute function remortgage_reminders.set_updated_at();

-- ---------------------------------------------------------------------------
-- audit_events — append-only history (FCA 7-year retention; soft-delete only)
-- ---------------------------------------------------------------------------
create table remortgage_reminders.audit_events (
  id              uuid primary key default gen_random_uuid(),
  run_id          uuid references remortgage_reminders.runs(id) on delete restrict,
  reminder_id     uuid references remortgage_reminders.reminders(id) on delete restrict,

  insightly_id    text not null,                               -- client link
  action          remortgage_reminders.audit_action_type not null,
  actor           remortgage_reminders.audit_actor_type not null default 'system',
  actor_detail    text,                                        -- e.g. approver's email

  stage           remortgage_reminders.reminder_stage_type,
  sent_to_email   text,                                        -- exact recipient used (point-in-time)
  broker_email    text,
  dry_run         boolean,
  note            text,
  occurred_at     timestamptz not null default now(),

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  is_deleted      boolean not null default false,
  deleted_at      timestamptz,
  deletion_reason text
);
create index idx_audit_events_reminder on remortgage_reminders.audit_events (reminder_id);
create index idx_audit_events_insightly on remortgage_reminders.audit_events (insightly_id);
create index idx_audit_events_occurred on remortgage_reminders.audit_events (occurred_at);
create trigger trg_audit_events_updated_at before update on remortgage_reminders.audit_events
  for each row execute function remortgage_reminders.set_updated_at();

-- ---------------------------------------------------------------------------
-- test_recipients — DB-managed allowlist (replaces hardcoded testContacts.js).
-- While TEST_RECIPIENTS_ONLY is on, only active rows here may be emailed.
-- ---------------------------------------------------------------------------
create table remortgage_reminders.test_recipients (
  id              uuid primary key default gen_random_uuid(),
  insightly_id    text not null,
  label           text,                                        -- e.g. "Petyr Baelish (QA)"
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  is_deleted      boolean not null default false,
  deleted_at      timestamptz,
  deletion_reason text,
  constraint uq_test_recipients_insightly unique (insightly_id)
);
create trigger trg_test_recipients_updated_at before update on remortgage_reminders.test_recipients
  for each row execute function remortgage_reminders.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security — backend-only (service role). The frontend talks to the
-- Node API, not Supabase directly, so no anon policies are granted here. Add a
-- read-only `authenticated` SELECT policy later if the SPA reads the DB itself.
-- ---------------------------------------------------------------------------
alter table remortgage_reminders.runs            enable row level security;
alter table remortgage_reminders.reminders       enable row level security;
alter table remortgage_reminders.audit_events    enable row level security;
alter table remortgage_reminders.test_recipients enable row level security;

create policy "service_role_full_access" on remortgage_reminders.runs
  for all to service_role using (true) with check (true);
create policy "service_role_full_access" on remortgage_reminders.reminders
  for all to service_role using (true) with check (true);
create policy "service_role_full_access" on remortgage_reminders.audit_events
  for all to service_role using (true) with check (true);
create policy "service_role_full_access" on remortgage_reminders.test_recipients
  for all to service_role using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Verify enums exist (run after applying; should return 9 rows):
--   select typname from pg_type t
--   join pg_namespace n on n.oid = t.typnamespace
--   where t.typtype = 'e' and nspname = 'remortgage_reminders';
-- ---------------------------------------------------------------------------
