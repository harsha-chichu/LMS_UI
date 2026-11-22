-- LMS: admin dashboard (/admin).
-- Run after 0013, BEFORE deploying the code that uses it.
--
-- Adds:
--   * lms_profiles.role / suspended_at / suspended_reason. Users can't change
--     these themselves (trigger below); only the server (service role) can.
--   * lms_admin_audit: every admin action.
--   * lms_announcements: banners shown in the app.
--   * lms_app_settings: maintenance mode, pausing new sessions.
--   * lms_feedback.status / admin_note / resolved_at for triage.
--   * lms_usage_events: one row per Claude / eval agent / Deepgram call, for
--     cost and health charts.
--   * lms_admin_* aggregate functions, callable by the service role only.
--
-- Who is an admin: anyone whose email is in the ADMIN_EMAILS env var, or whose
-- profile has role = 'admin' (set from the dashboard). No emails live here.

-- ---------------------------------------------------------------------------
-- Profiles: role + suspension
-- ---------------------------------------------------------------------------
alter table public.lms_profiles
  add column if not exists role text not null default 'user',
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_reason text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'lms_profiles_role_check') then
    alter table public.lms_profiles
      add constraint lms_profiles_role_check check (role in ('user', 'admin'));
  end if;
end;
$$;

-- The "update own" / "insert own" policies let users write their own row, so
-- stop them touching the admin-managed columns.
create or replace function public.lms_guard_profile_admin_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      if new.role <> 'user' or new.suspended_at is not null or new.suspended_reason is not null then
        raise exception 'not allowed';
      end if;
    elsif new.role is distinct from old.role
       or new.suspended_at is distinct from old.suspended_at
       or new.suspended_reason is distinct from old.suspended_reason then
      raise exception 'not allowed';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists lms_profiles_guard_admin_columns on public.lms_profiles;
create trigger lms_profiles_guard_admin_columns
  before insert or update on public.lms_profiles
  for each row execute function public.lms_guard_profile_admin_columns();

-- ---------------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------------
create table if not exists public.lms_admin_audit (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references auth.users (id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists lms_admin_audit_created_idx on public.lms_admin_audit (created_at desc);

alter table public.lms_admin_audit enable row level security;
revoke all on public.lms_admin_audit from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Announcements
-- ---------------------------------------------------------------------------
create table if not exists public.lms_announcements (
  id uuid primary key default gen_random_uuid(),
  message text not null check (length(btrim(message)) between 1 and 500),
  level text not null default 'info' check (level in ('info', 'warning')),
  active boolean not null default true,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.lms_announcements enable row level security;
revoke insert, update, delete on public.lms_announcements from anon, authenticated;

drop policy if exists "lms_announcements: read live" on public.lms_announcements;
create policy "lms_announcements: read live" on public.lms_announcements
  for select to authenticated
  using (active and starts_at <= now() and (ends_at is null or ends_at > now()));

-- ---------------------------------------------------------------------------
-- App settings (maintenance mode, sessions paused)
-- ---------------------------------------------------------------------------
create table if not exists public.lms_app_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.lms_app_settings enable row level security;
revoke insert, update, delete on public.lms_app_settings from anon, authenticated;

drop policy if exists "lms_app_settings: read" on public.lms_app_settings;
create policy "lms_app_settings: read" on public.lms_app_settings
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Feedback triage
-- ---------------------------------------------------------------------------
alter table public.lms_feedback
  add column if not exists status text not null default 'new',
  add column if not exists admin_note text,
  add column if not exists resolved_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'lms_feedback_status_check') then
    alter table public.lms_feedback
      add constraint lms_feedback_status_check check (status in ('new', 'triaged', 'resolved'));
  end if;
end;
$$;

create index if not exists lms_feedback_status_idx on public.lms_feedback (status, created_at desc);

-- ---------------------------------------------------------------------------
-- Usage events (Claude, eval agent, Deepgram)
-- ---------------------------------------------------------------------------
create table if not exists public.lms_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  kind text not null check (kind in ('claude', 'agent', 'deepgram')),
  operation text not null,
  model text,
  input_tokens integer,
  output_tokens integer,
  ok boolean not null,
  latency_ms integer,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists lms_usage_events_created_idx on public.lms_usage_events (created_at desc);
create index if not exists lms_usage_events_user_idx on public.lms_usage_events (user_id, created_at desc);

alter table public.lms_usage_events enable row level security;
revoke all on public.lms_usage_events from anon, authenticated;

-- Helps the admin lists that filter sessions by status and date.
create index if not exists lms_sessions_status_created_idx on public.lms_sessions (status, created_at desc);

-- ---------------------------------------------------------------------------
-- Aggregates for the dashboard (service role only)
-- ---------------------------------------------------------------------------

-- Headline numbers for a date range.
create or replace function public.lms_admin_overview(p_from timestamptz, p_to timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'users_total', (select count(*) from public.lms_profiles),
    'users_new', (select count(*) from public.lms_profiles p where p.created_at >= p_from and p.created_at < p_to),
    'users_suspended', (select count(*) from public.lms_profiles p where p.suspended_at is not null),
    'active_users', (select count(distinct s.user_id) from public.lms_sessions s where s.created_at >= p_from and s.created_at < p_to),
    'dau', (select count(distinct s.user_id) from public.lms_sessions s where s.created_at >= now() - interval '1 day'),
    'mau', (select count(distinct s.user_id) from public.lms_sessions s where s.created_at >= now() - interval '30 days'),
    'sessions_started', (select count(*) from public.lms_sessions s where s.created_at >= p_from and s.created_at < p_to),
    'sessions_completed', (select count(*) from public.lms_sessions s where s.created_at >= p_from and s.created_at < p_to and s.status = 'completed'),
    'sessions_abandoned', (select count(*) from public.lms_sessions s where s.created_at >= p_from and s.created_at < p_to and s.status = 'abandoned'),
    'sessions_in_progress', (select count(*) from public.lms_sessions s where s.created_at >= p_from and s.created_at < p_to and s.status = 'in_progress'),
    'stuck_sessions', (select count(*) from public.lms_sessions s where s.status = 'in_progress' and s.created_at < now() - interval '2 hours'),
    'avg_total', (select round(avg(s.total)::numeric, 1) from public.lms_sessions s where s.completed_at >= p_from and s.completed_at < p_to and s.status = 'completed'),
    'feedback_new', (select count(*) from public.lms_feedback f where f.status = 'new'),
    'questions_active', (select count(*) from public.lms_questions q where q.status = 'active')
  );
$$;

-- One row per day in the range.
create or replace function public.lms_admin_daily(p_from timestamptz, p_to timestamptz)
returns table (day date, signups bigint, sessions_started bigint, sessions_completed bigint, active_users bigint, avg_total numeric)
language sql
stable
security definer
set search_path = ''
as $$
  with days as (
    select generate_series(date_trunc('day', p_from), date_trunc('day', p_to - interval '1 second'), interval '1 day')::date as day
  )
  select
    d.day,
    (select count(*) from public.lms_profiles p where p.created_at::date = d.day),
    (select count(*) from public.lms_sessions s where s.created_at::date = d.day),
    (select count(*) from public.lms_sessions s where s.completed_at::date = d.day and s.status = 'completed'),
    (select count(distinct s.user_id) from public.lms_sessions s where s.created_at::date = d.day),
    (select round(avg(s.total)::numeric, 1) from public.lms_sessions s where s.completed_at::date = d.day and s.status = 'completed')
  from days d
  order by d.day;
$$;

create or replace function public.lms_admin_domain_breakdown(p_from timestamptz, p_to timestamptz)
returns table (domain text, difficulty text, sessions bigint, completed bigint, avg_total numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.config ->> 'domain',
    s.config ->> 'difficulty',
    count(*),
    count(*) filter (where s.status = 'completed'),
    round(avg(s.total) filter (where s.status = 'completed')::numeric, 1)
  from public.lms_sessions s
  where s.created_at >= p_from and s.created_at < p_to
  group by 1, 2
  order by 3 desc;
$$;

-- Weekly sign-up groups: how many came back for a session 1, 7 and 30+ days after joining.
create or replace function public.lms_admin_retention(p_weeks integer default 8)
returns table (week date, signups bigint, d1 bigint, d7 bigint, d30 bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    date_trunc('week', p.created_at)::date,
    count(*),
    count(*) filter (where exists (
      select 1 from public.lms_sessions s where s.user_id = p.id and s.created_at >= p.created_at + interval '1 day')),
    count(*) filter (where exists (
      select 1 from public.lms_sessions s where s.user_id = p.id and s.created_at >= p.created_at + interval '7 days')),
    count(*) filter (where exists (
      select 1 from public.lms_sessions s where s.user_id = p.id and s.created_at >= p.created_at + interval '30 days'))
  from public.lms_profiles p
  where p.created_at >= date_trunc('week', now()) - make_interval(weeks => greatest(p_weeks, 1) - 1)
  group by 1
  order by 1 desc;
$$;

-- User list with search, sort and paging. `total_count` repeats on every row.
create or replace function public.lms_admin_users(
  p_q text default null,
  p_sort text default 'joined',
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  email text,
  name text,
  role text,
  suspended_at timestamptz,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  last_active timestamptz,
  sessions bigint,
  completed bigint,
  avg_total numeric,
  total_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with base as (
    select
      p.id,
      u.email::text as email,
      p.name,
      p.role,
      p.suspended_at,
      p.created_at,
      u.last_sign_in_at,
      st.last_active,
      coalesce(st.sessions, 0) as sessions,
      coalesce(st.completed, 0) as completed,
      st.avg_total
    from public.lms_profiles p
    join auth.users u on u.id = p.id
    left join lateral (
      select
        max(s.created_at) as last_active,
        count(*) as sessions,
        count(*) filter (where s.status = 'completed') as completed,
        round(avg(s.total) filter (where s.status = 'completed')::numeric, 1) as avg_total
      from public.lms_sessions s
      where s.user_id = p.id
    ) st on true
    where coalesce(btrim(p_q), '') = ''
       or u.email ilike '%' || btrim(p_q) || '%'
       or p.name ilike '%' || btrim(p_q) || '%'
       or p.id::text = btrim(p_q)
  )
  select b.*, count(*) over () as total_count
  from base b
  order by
    case when p_sort = 'active' then b.last_active end desc nulls last,
    case when p_sort = 'sessions' then b.sessions end desc,
    case when p_sort = 'score' then b.avg_total end desc nulls last,
    case when p_sort = 'name' then lower(b.name) end asc,
    b.created_at desc
  limit least(greatest(p_limit, 1), 200)
  offset greatest(p_offset, 0);
$$;

-- Email lookups for a handful of users (feedback inbox, sessions list).
create or replace function public.lms_admin_emails(p_ids uuid[])
returns table (id uuid, email text, name text)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.email::text, coalesce(p.name, '')
  from auth.users u
  left join public.lms_profiles p on p.id = u.id
  where u.id = any (p_ids);
$$;

create or replace function public.lms_admin_user_email(p_id uuid)
returns table (email text, last_sign_in_at timestamptz, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select u.email::text, u.last_sign_in_at, u.created_at from auth.users u where u.id = p_id;
$$;

-- Calls, errors, tokens and latency per day and kind.
create or replace function public.lms_admin_usage(p_from timestamptz, p_to timestamptz)
returns table (
  day date,
  kind text,
  model text,
  calls bigint,
  errors bigint,
  input_tokens bigint,
  output_tokens bigint,
  p50_ms integer,
  p95_ms integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    e.created_at::date,
    e.kind,
    e.model,
    count(*),
    count(*) filter (where not e.ok),
    coalesce(sum(e.input_tokens), 0)::bigint,
    coalesce(sum(e.output_tokens), 0)::bigint,
    (percentile_cont(0.5) within group (order by e.latency_ms))::integer,
    (percentile_cont(0.95) within group (order by e.latency_ms))::integer
  from public.lms_usage_events e
  where e.created_at >= p_from and e.created_at < p_to
  group by 1, 2, 3
  order by 1, 2, 3;
$$;

-- Per-operation breakdown, plus the most recent error message for each.
create or replace function public.lms_admin_usage_ops(p_from timestamptz, p_to timestamptz)
returns table (kind text, operation text, calls bigint, errors bigint, p50_ms integer, p95_ms integer, last_error text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    e.kind,
    e.operation,
    count(*),
    count(*) filter (where not e.ok),
    (percentile_cont(0.5) within group (order by e.latency_ms))::integer,
    (percentile_cont(0.95) within group (order by e.latency_ms))::integer,
    (array_agg(e.error order by e.created_at desc) filter (where e.error is not null))[1]
  from public.lms_usage_events e
  where e.created_at >= p_from and e.created_at < p_to
  group by 1, 2
  order by 3 desc;
$$;

-- Who scored each answer (eval agent vs Claude fallback) and how it ended,
-- read from the scoring info stored on session results.
create or replace function public.lms_admin_scoring_health(p_from timestamptz, p_to timestamptz)
returns table (engine text, status text, answers bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(r.value -> 'scoring' ->> 'engine', 'unknown'),
    coalesce(r.value -> 'scoring' ->> 'status', case when r.value ? 'evaluation' then 'done' else 'none' end),
    count(*)
  from public.lms_sessions s
  cross join lateral jsonb_array_elements(s.results) as r(value)
  where s.created_at >= p_from and s.created_at < p_to
    and not coalesce((r.value ->> 'skipped')::boolean, false)
    and r.value ? 'answer'
  group by 1, 2
  order by 3 desc;
$$;

-- Distribution of completed session totals in 10-point buckets.
create or replace function public.lms_admin_score_histogram(p_from timestamptz, p_to timestamptz)
returns table (bucket integer, sessions bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select least(s.total / 10, 9) * 10, count(*)
  from public.lms_sessions s
  where s.status = 'completed' and s.total is not null
    and s.completed_at >= p_from and s.completed_at < p_to
  group by 1
  order by 1;
$$;

-- Per-question stats for the bank browser.
create or replace function public.lms_admin_questions(
  p_domain text default null,
  p_difficulty text default null,
  p_status text default null,
  p_source text default null,
  p_q text default null,
  p_sort text default 'recent',
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  domain text,
  difficulty text,
  text text,
  topics text[],
  source text,
  status text,
  times_asked integer,
  times_skipped integer,
  avg_score numeric,
  created_at timestamptz,
  total_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with base as (
    select
      q.id, q.domain, q.difficulty, q.text, q.topics, q.source, q.status,
      q.times_asked, q.times_skipped,
      (select round(avg(a.score), 1) from public.lms_question_attempts a where a.question_id = q.id and not a.skipped) as avg_score,
      q.created_at
    from public.lms_questions q
    where (p_domain is null or q.domain = p_domain)
      and (p_difficulty is null or q.difficulty = p_difficulty)
      and (p_status is null or q.status = p_status)
      and (p_source is null or q.source = p_source)
      and (coalesce(btrim(p_q), '') = '' or q.text ilike '%' || btrim(p_q) || '%' or btrim(lower(p_q)) = any (q.topics))
  )
  select b.*, count(*) over () as total_count
  from base b
  order by
    case when p_sort = 'asked' then b.times_asked end desc,
    case when p_sort = 'skip' then b.times_skipped::numeric / nullif(b.times_asked, 0) end desc nulls last,
    case when p_sort = 'score_low' then b.avg_score end asc nulls last,
    b.created_at desc
  limit least(greatest(p_limit, 1), 200)
  offset greatest(p_offset, 0);
$$;

-- Active questions per domain + difficulty, including domains with none.
create or replace function public.lms_admin_bank_coverage()
returns table (domain text, difficulty text, active bigint, retired bigint, generated bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    d.domain, f.difficulty,
    count(q.id) filter (where q.status = 'active'),
    count(q.id) filter (where q.status = 'retired'),
    count(q.id) filter (where q.source = 'generated')
  from unnest(array['ai-ml', 'data-science', 'backend', 'frontend', 'system-design', 'behavioral']) as d(domain)
  cross join unnest(array['easy', 'medium', 'hard']) as f(difficulty)
  left join public.lms_questions q on q.domain = d.domain and q.difficulty = f.difficulty
  group by 1, 2
  order by 1, 2;
$$;

-- Database size and row counts for the system page.
create or replace function public.lms_admin_db_stats()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'db_bytes', pg_catalog.pg_database_size(pg_catalog.current_database()),
    'tables', jsonb_build_object(
      'lms_profiles', (select count(*) from public.lms_profiles),
      'lms_sessions', (select count(*) from public.lms_sessions),
      'lms_questions', (select count(*) from public.lms_questions),
      'lms_question_attempts', (select count(*) from public.lms_question_attempts),
      'lms_saved_questions', (select count(*) from public.lms_saved_questions),
      'lms_friendships', (select count(*) from public.lms_friendships),
      'lms_feedback', (select count(*) from public.lms_feedback),
      'lms_usage_events', (select count(*) from public.lms_usage_events),
      'lms_admin_audit', (select count(*) from public.lms_admin_audit),
      'lms_rate_limits', (select count(*) from public.lms_rate_limits)
    )
  );
$$;

-- Users currently at a rate limit (their window's count reached the limit is
-- decided in code; this returns the busiest buckets).
create or replace function public.lms_admin_rate_limit_top(p_limit integer default 20)
returns table (user_id uuid, email text, bucket text, window_start timestamptz, count integer)
language sql
stable
security definer
set search_path = ''
as $$
  select r.user_id, u.email::text, r.bucket, r.window_start, r.count
  from public.lms_rate_limits r
  left join auth.users u on u.id = r.user_id
  where r.window_start >= now() - interval '1 day'
  order by r.count desc
  limit least(greatest(p_limit, 1), 100);
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'lms_admin_overview(timestamptz, timestamptz)',
    'lms_admin_daily(timestamptz, timestamptz)',
    'lms_admin_domain_breakdown(timestamptz, timestamptz)',
    'lms_admin_retention(integer)',
    'lms_admin_users(text, text, integer, integer)',
    'lms_admin_emails(uuid[])',
    'lms_admin_user_email(uuid)',
    'lms_admin_usage(timestamptz, timestamptz)',
    'lms_admin_usage_ops(timestamptz, timestamptz)',
    'lms_admin_scoring_health(timestamptz, timestamptz)',
    'lms_admin_score_histogram(timestamptz, timestamptz)',
    'lms_admin_questions(text, text, text, text, text, text, integer, integer)',
    'lms_admin_bank_coverage()',
    'lms_admin_db_stats()',
    'lms_admin_rate_limit_top(integer)'
  ]
  loop
    execute format('revoke all on function public.%s from public, anon, authenticated', fn);
    execute format('grant execute on function public.%s to service_role', fn);
  end loop;
end;
$$;
