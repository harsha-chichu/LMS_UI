-- LMS: alerts for admin sign-ins and new admin authenticators.
-- Run after 0016, BEFORE deploying the code that uses it.
--
-- Adds:
--   * lms_admin_seen: admin sessions (signed in with two-factor) and
--     authenticators the app has already alerted about, so each alert goes
--     out once. Service role only.

create table if not exists public.lms_admin_seen (
  kind text not null check (kind in ('session', 'factor')),
  ref text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (kind, ref)
);

alter table public.lms_admin_seen enable row level security;
revoke all on public.lms_admin_seen from anon, authenticated;
