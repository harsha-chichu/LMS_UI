-- LMS: new sign-up alerts and the welcome note.
-- Run after 0015, BEFORE deploying the code that uses it.
--
-- Adds:
--   * lms_signups: one row per user, written the first time they open a
--     signed-in page. Tracks the admin alert, the welcome email and whether
--     the welcome popup was closed. Service role only, so users can't edit it.
--
-- The welcome message itself lives in lms_app_settings under the key
-- 'welcome' and is edited from /admin/welcome.

-- ---------------------------------------------------------------------------
-- Sign-ups
-- ---------------------------------------------------------------------------
create table if not exists public.lms_signups (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  welcome_emailed_at timestamptz,
  welcome_seen_at timestamptz
);

create index if not exists lms_signups_created_idx on public.lms_signups (created_at desc);

alter table public.lms_signups enable row level security;
revoke all on public.lms_signups from anon, authenticated;

-- Everyone who already has an account counts as done: no popup, no email,
-- no alert for them.
insert into public.lms_signups (user_id, created_at, notified_at, welcome_emailed_at, welcome_seen_at)
select p.id, p.created_at, now(), now(), now()
from public.lms_profiles p
on conflict (user_id) do nothing;
