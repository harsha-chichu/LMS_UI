-- LMS: profiles + practice sessions, scoped to the signed-in user by RLS.
-- Run once in the Supabase SQL editor (or `supabase db push`).
--
-- Everything is prefixed `lms_` because this Supabase project already has
-- other tables (e.g. `profiles`, `questions`); nothing here touches them.

-- ---------------------------------------------------------------------------
-- lms_profiles: one row per auth user
-- ---------------------------------------------------------------------------
create table if not exists public.lms_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.lms_profiles enable row level security;

drop policy if exists "lms_profiles: read own" on public.lms_profiles;
create policy "lms_profiles: read own" on public.lms_profiles
  for select using (id = auth.uid());

drop policy if exists "lms_profiles: insert own" on public.lms_profiles;
create policy "lms_profiles: insert own" on public.lms_profiles
  for insert with check (id = auth.uid());

drop policy if exists "lms_profiles: update own" on public.lms_profiles;
create policy "lms_profiles: update own" on public.lms_profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Create the profile automatically on sign-up. Email sign-up passes `name` in
-- user metadata; Google provides `full_name` / `name`.
create or replace function public.lms_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.lms_profiles (id, name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists lms_on_auth_user_created on auth.users;
create trigger lms_on_auth_user_created
  after insert on auth.users
  for each row execute function public.lms_handle_new_user();

-- Accounts that existed before this migration get a profile too.
insert into public.lms_profiles (id, name)
select
  u.id,
  coalesce(
    nullif(u.raw_user_meta_data ->> 'name', ''),
    nullif(u.raw_user_meta_data ->> 'full_name', ''),
    split_part(u.email, '@', 1)
  )
from auth.users u
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- lms_sessions: a practice session, from first question to saved report
-- ---------------------------------------------------------------------------
create table if not exists public.lms_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  config jsonb not null,
  questions jsonb not null,
  results jsonb not null default '[]'::jsonb,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'completed', 'abandoned')),
  report jsonb,
  total integer check (total between 0 and 100),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists lms_sessions_user_created_idx
  on public.lms_sessions (user_id, created_at desc);

alter table public.lms_sessions enable row level security;

drop policy if exists "lms_sessions: read own" on public.lms_sessions;
create policy "lms_sessions: read own" on public.lms_sessions
  for select using (user_id = auth.uid());

drop policy if exists "lms_sessions: insert own" on public.lms_sessions;
create policy "lms_sessions: insert own" on public.lms_sessions
  for insert with check (user_id = auth.uid());

drop policy if exists "lms_sessions: update own" on public.lms_sessions;
create policy "lms_sessions: update own" on public.lms_sessions
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
