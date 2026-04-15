-- ─────────────────────────────────────────────────────────────────
-- INKWELL STUDIO — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ─────────────────────────────────────────────────────────────────

create table bookings (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),

  -- Client info
  first_name       text not null,
  last_name        text not null,
  email            text not null,
  phone            text,
  first_tattoo     boolean default false,

  -- Design
  placement        text[],           -- array of body zones
  placement_note   text,
  description      text not null,
  size             text,
  file_names       text[],           -- reference image filenames

  -- Budget & scheduling
  budget           integer,          -- in dollars
  preferred_date1  date,
  preferred_date2  date,
  time_of_day      text,

  -- Admin
  status           text not null default 'new'
                   check (status in ('new', 'reviewed', 'confirmed', 'declined', 'completed'))
);

-- Index for sorting by newest first in your dashboard
create index bookings_created_at_idx on bookings (created_at desc);

-- Optional: Row Level Security
-- Disable public reads (only your service key can read/write)
alter table bookings enable row level security;

-- Allow inserts from anyone (the public booking form)
create policy "Allow public inserts" on bookings
  for insert with check (true);

-- Only the service role (your API) can read rows
create policy "Service role reads all" on bookings
  for select using (auth.role() = 'service_role');
