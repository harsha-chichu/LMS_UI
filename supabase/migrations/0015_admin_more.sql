-- LMS: admin dashboard, part 2.
-- Run after 0014, BEFORE deploying the code that uses it.
--
-- Adds:
--   * 'support' role (read-only admin access)
--   * lms_error_events: server errors, grouped by fingerprint on /admin/errors
--   * lms_alerts: alerts raised by the scheduled health check (/api/cron/tick)
--   * lms_email_log + lms_profiles.email_opt_out: emails sent from /admin/email
--   * lms_rate_limit_overrides: per-user limits with an expiry
--   * lms_score_reviews: admins' spot-checks of scores on /admin/quality
--   * lms_admin_* functions for the new pages (service role only)
--
-- Scheduled health checks (alerts, budget) need the app to be called every
-- 10 minutes. Supabase can do that itself; run this ONCE in the SQL editor,
-- with your app URL and the CRON_SECRET you set in Vercel (don't commit them):
--
--   create extension if not exists pg_cron;
--   create extension if not exists pg_net;
--   select cron.schedule(
--     'lms-admin-tick',
--     '*/10 * * * *',
--     $$ select net.http_post(
--          url := 'https://YOUR-APP.vercel.app/api/cron/tick',
--          headers := jsonb_build_object('authorization', 'Bearer YOUR_CRON_SECRET')
--        ) $$
--   );
--
-- To stop it: select cron.unschedule('lms-admin-tick');

-- ---------------------------------------------------------------------------
-- Support role
-- ---------------------------------------------------------------------------
alter table public.lms_profiles drop constraint if exists lms_profiles_role_check;
alter table public.lms_profiles
  add constraint lms_profiles_role_check check (role in ('user', 'support', 'admin'));

-- Users may turn product emails off themselves (the 0014 guard only protects
-- role and suspension).
alter table public.lms_profiles add column if not exists email_opt_out boolean not null default false;

-- ---------------------------------------------------------------------------
-- Error log
-- ---------------------------------------------------------------------------
create table if not exists public.lms_error_events (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null,
  source text not null,
  route text,
  message text not null,
  digest text,
  user_id uuid references auth.users (id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists lms_error_events_fp_idx on public.lms_error_events (fingerprint, created_at desc);
create index if not exists lms_error_events_created_idx on public.lms_error_events (created_at desc);

alter table public.lms_error_events enable row level security;
revoke all on public.lms_error_events from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Alerts (one open alert per kind)
-- ---------------------------------------------------------------------------
create table if not exists public.lms_alerts (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  severity text not null default 'warning' check (severity in ('warning', 'critical')),
  message text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create unique index if not exists lms_alerts_open_kind_idx on public.lms_alerts (kind) where resolved_at is null;
create index if not exists lms_alerts_created_idx on public.lms_alerts (created_at desc);

alter table public.lms_alerts enable row level security;
revoke all on public.lms_alerts from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Emails sent to users
-- ---------------------------------------------------------------------------
create table if not exists public.lms_email_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references auth.users (id) on delete set null,
  audience text not null,
  subject text not null,
  recipients integer not null default 0,
  sent integer not null default 0,
  failed integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.lms_email_log enable row level security;
revoke all on public.lms_email_log from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Per-user rate-limit overrides
-- ---------------------------------------------------------------------------
create table if not exists public.lms_rate_limit_overrides (
  user_id uuid not null references auth.users (id) on delete cascade,
  bucket text not null,
  max_count integer not null check (max_count between 0 and 100000),
  expires_at timestamptz not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, bucket)
);

alter table public.lms_rate_limit_overrides enable row level security;
revoke all on public.lms_rate_limit_overrides from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Score spot-checks
-- ---------------------------------------------------------------------------
create table if not exists public.lms_score_reviews (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.lms_sessions (id) on delete cascade,
  question_index integer not null check (question_index >= 0),
  verdict text not null check (verdict in ('fair', 'too_high', 'too_low')),
  note text,
  domain text,
  engine text,
  score numeric(3, 1),
  admin_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (session_id, question_index)
);

create index if not exists lms_score_reviews_created_idx on public.lms_score_reviews (created_at desc);

alter table public.lms_score_reviews enable row level security;
revoke all on public.lms_score_reviews from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Functions (service role only)
-- ---------------------------------------------------------------------------

-- Errors grouped by fingerprint.
create or replace function public.lms_admin_errors(p_from timestamptz, p_to timestamptz)
returns table (
  fingerprint text,
  source text,
  route text,
  message text,
  occurrences bigint,
  users bigint,
  first_seen timestamptz,
  last_seen timestamptz,
  first_seen_ever timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    e.fingerprint,
    (array_agg(e.source order by e.created_at desc))[1],
    (array_agg(e.route order by e.created_at desc))[1],
    (array_agg(e.message order by e.created_at desc))[1],
    count(*),
    count(distinct e.user_id),
    min(e.created_at),
    max(e.created_at),
    (select min(x.created_at) from public.lms_error_events x where x.fingerprint = e.fingerprint)
  from public.lms_error_events e
  where e.created_at >= p_from and e.created_at < p_to
  group by e.fingerprint
  order by max(e.created_at) desc
  limit 200;
$$;

-- Error groups seen for the first time since p_since (for alerts).
create or replace function public.lms_admin_new_error_groups(p_since timestamptz)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select count(*) from (
    select e.fingerprint
    from public.lms_error_events e
    group by e.fingerprint
    having min(e.created_at) >= p_since
  ) g;
$$;

-- Signed up in range → started a session → completed one → came back on another day.
create or replace function public.lms_admin_funnel(p_from timestamptz, p_to timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with cohort as (
    select p.id from public.lms_profiles p where p.created_at >= p_from and p.created_at < p_to
  ),
  per_user as (
    select
      c.id,
      count(s.id) as sessions,
      count(s.id) filter (where s.status = 'completed') as completed,
      count(distinct s.created_at::date) as days
    from cohort c
    left join public.lms_sessions s on s.user_id = c.id
    group by c.id
  )
  select jsonb_build_object(
    'signed_up', count(*),
    'started', count(*) filter (where sessions > 0),
    'completed', count(*) filter (where completed > 0),
    'returned', count(*) filter (where days > 1)
  )
  from per_user;
$$;

-- Average score per topic across all users (topics with at least p_min attempts).
create or replace function public.lms_admin_topic_weakness(p_from timestamptz, p_to timestamptz, p_min integer default 5)
returns table (topic text, domain text, attempts bigint, avg_score numeric, skip_rate numeric, active_questions bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with t as (
    select unnest(a.topics) as topic, a.domain, a.score, a.skipped
    from public.lms_question_attempts a
    where a.created_at >= p_from and a.created_at < p_to
  )
  select
    t.topic,
    t.domain,
    count(*),
    round(avg(t.score) filter (where not t.skipped), 1),
    round(avg(t.skipped::integer)::numeric, 2),
    (select count(*) from public.lms_questions q where q.status = 'active' and q.domain = t.domain and t.topic = any (q.topics))
  from t
  group by t.topic, t.domain
  having count(*) >= greatest(p_min, 1)
  order by 4 asc nulls last;
$$;

-- Random scored answers from the last 90 days that nobody has reviewed yet.
create or replace function public.lms_admin_score_sample(p_n integer default 10)
returns table (
  session_id uuid,
  question_index integer,
  domain text,
  difficulty text,
  engine text,
  question text,
  answer text,
  score numeric,
  feedback text,
  created_at timestamptz
)
language sql
volatile
security definer
set search_path = ''
as $$
  select
    s.id,
    (r.i - 1)::integer,
    s.config ->> 'domain',
    s.config ->> 'difficulty',
    coalesce(r.value -> 'scoring' ->> 'engine', 'unknown'),
    coalesce(s.questions -> (r.i - 1)::integer ->> 'text', r.value -> 'question' ->> 'text'),
    r.value -> 'answer' ->> 'text',
    (r.value -> 'evaluation' ->> 'score')::numeric,
    r.value -> 'evaluation' ->> 'feedback',
    s.created_at
  from public.lms_sessions s
  cross join lateral jsonb_array_elements(s.results) with ordinality as r(value, i)
  where s.status = 'completed'
    and s.completed_at >= now() - interval '90 days'
    and r.value -> 'evaluation' ? 'score'
    and coalesce(r.value -> 'answer' ->> 'text', '') <> ''
    and not exists (
      select 1 from public.lms_score_reviews v where v.session_id = s.id and v.question_index = (r.i - 1)::integer
    )
  order by random()
  limit least(greatest(p_n, 1), 50);
$$;

-- Verdicts by domain and scoring engine.
create or replace function public.lms_admin_review_summary(p_from timestamptz, p_to timestamptz)
returns table (domain text, engine text, fair bigint, too_high bigint, too_low bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(v.domain, 'unknown'),
    coalesce(v.engine, 'unknown'),
    count(*) filter (where v.verdict = 'fair'),
    count(*) filter (where v.verdict = 'too_high'),
    count(*) filter (where v.verdict = 'too_low')
  from public.lms_score_reviews v
  where v.created_at >= p_from and v.created_at < p_to
  group by 1, 2
  order by 1, 2;
$$;

-- Recipients for an email. Opted-out users are left out, except for a single
-- direct message ('one').
create or replace function public.lms_admin_email_audience(
  p_audience text,
  p_days integer default 14,
  p_user uuid default null
)
returns table (id uuid, email text, name text)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.email::text, coalesce(p.name, '')
  from auth.users u
  join public.lms_profiles p on p.id = u.id
  where u.email is not null
    and p.suspended_at is null
    and (p_audience = 'one' or not p.email_opt_out)
    and case p_audience
      when 'one' then u.id = p_user
      when 'all' then true
      when 'contact_ok' then exists (
        select 1 from public.lms_feedback f where f.user_id = u.id and f.follow_up_consent)
      when 'inactive' then
        p.created_at < now() - make_interval(days => greatest(p_days, 1))
        and not exists (
          select 1 from public.lms_sessions s
          where s.user_id = u.id and s.created_at >= now() - make_interval(days => greatest(p_days, 1)))
      else false
    end
  order by u.email
  limit 5000;
$$;

-- Claude tokens per model since UTC midnight (the app turns them into dollars).
create or replace function public.lms_admin_spend_today()
returns table (model text, input_tokens bigint, output_tokens bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select e.model, coalesce(sum(e.input_tokens), 0)::bigint, coalesce(sum(e.output_tokens), 0)::bigint
  from public.lms_usage_events e
  where e.kind = 'claude' and e.created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc'
  group by e.model;
$$;

-- One search box for users, sessions and questions.
create or replace function public.lms_admin_global_search(p_q text)
returns table (kind text, id text, label text, sub text)
language sql
stable
security definer
set search_path = ''
as $$
  with q as (select btrim(coalesce(p_q, '')) as term)
  (
    select 'user', u.id::text, coalesce(nullif(p.name, ''), u.email::text), u.email::text
    from auth.users u
    join public.lms_profiles p on p.id = u.id, q
    where length(q.term) >= 2
      and (u.email ilike '%' || q.term || '%' or p.name ilike '%' || q.term || '%' or u.id::text = q.term)
    order by u.email
    limit 10
  )
  union all
  (
    select 'session', s.id::text, (s.config ->> 'domain') || ' · ' || (s.config ->> 'difficulty'), s.status || ' · ' || s.created_at::date::text
    from public.lms_sessions s, q
    where s.id::text = q.term or s.user_id::text = q.term
    order by s.created_at desc
    limit 10
  )
  union all
  (
    select 'question', b.id::text, left(b.text, 140), b.domain || ' · ' || b.difficulty || ' · ' || b.status
    from public.lms_questions b, q
    where length(q.term) >= 3 and (b.id::text = q.term or b.text ilike '%' || q.term || '%')
    order by b.times_asked desc
    limit 10
  );
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'lms_admin_errors(timestamptz, timestamptz)',
    'lms_admin_new_error_groups(timestamptz)',
    'lms_admin_funnel(timestamptz, timestamptz)',
    'lms_admin_topic_weakness(timestamptz, timestamptz, integer)',
    'lms_admin_score_sample(integer)',
    'lms_admin_review_summary(timestamptz, timestamptz)',
    'lms_admin_email_audience(text, integer, uuid)',
    'lms_admin_spend_today()',
    'lms_admin_global_search(text)'
  ]
  loop
    execute format('revoke all on function public.%s from public, anon, authenticated', fn);
    execute format('grant execute on function public.%s to service_role', fn);
  end loop;
end;
$$;
