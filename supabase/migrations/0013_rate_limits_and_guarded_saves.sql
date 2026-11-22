-- LMS: per-user rate limits, and answer saves that can't overwrite each other.
-- Run after 0012, BEFORE deploying the code that calls these functions.
--
-- 1. lms_rate_limit: fixed-window counters, taken atomically, so parallel requests
--    can't all slip under a limit (the old check counted rows, then inserted).
--    Used for starting sessions, Deepgram tokens, answers and feedback
--    (limits live in src/lib/rate-limit.ts).
-- 2. lms_save_result_guarded: lms_save_result (0004) plus a compare-and-set on
--    the question's current entry, so two submissions racing on the same
--    question can't both land; the second gets a conflict.
--
-- Both are server-only (service role), like lms_save_result.

-- ---------------------------------------------------------------------------
-- Rate limits
-- ---------------------------------------------------------------------------
create table if not exists public.lms_rate_limits (
  user_id uuid not null references auth.users (id) on delete cascade,
  bucket text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (user_id, bucket, window_start)
);

alter table public.lms_rate_limits enable row level security;
revoke all on public.lms_rate_limits from anon, authenticated;

-- Takes one unit from the user's bucket for the current window.
-- Returns true if allowed, false once the window's limit is used up.
create or replace function public.lms_rate_limit(p_user uuid, p_bucket text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  win timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  used integer;
begin
  -- Old windows for this bucket are no longer needed.
  delete from public.lms_rate_limits r
  where r.user_id = p_user and r.bucket = p_bucket and r.window_start < win;

  insert into public.lms_rate_limits as r (user_id, bucket, window_start, count)
  values (p_user, p_bucket, win, 1)
  on conflict (user_id, bucket, window_start)
    do update set count = r.count + 1
    where r.count < p_limit
  returning r.count into used;

  -- No row returned: the conflict update was skipped because the limit is reached.
  return used is not null;
end;
$$;

revoke all on function public.lms_rate_limit(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.lms_rate_limit(uuid, text, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- Guarded result saves
-- ---------------------------------------------------------------------------
-- Same as lms_save_result, but only writes when the question's entry still
-- equals p_expected (the entry the caller read before doing its work; a missing
-- entry compares as the padded blank). Returns null on a conflict, or if the
-- session isn't the user's or isn't in progress.
create or replace function public.lms_save_result_guarded(
  p_session uuid,
  p_user uuid,
  p_index integer,
  p_expected jsonb,
  p_result jsonb
)
returns jsonb
language sql
set search_path = ''
as $$
  update public.lms_sessions s
  set results = jsonb_set(
    (
      select coalesce(
        jsonb_agg(
          coalesce(s.results -> (q.i - 1)::integer, jsonb_build_object('question', q.value, 'skipped', false, 'followUps', '[]'::jsonb))
          order by q.i
        ),
        '[]'::jsonb
      )
      from jsonb_array_elements(s.questions) with ordinality as q(value, i)
    ),
    array[p_index::text],
    p_result
  )
  where s.id = p_session
    and s.user_id = p_user
    and s.status = 'in_progress'
    and p_index >= 0
    and p_index < jsonb_array_length(s.questions)
    and coalesce(
      s.results -> p_index,
      jsonb_build_object('question', s.questions -> p_index, 'skipped', false, 'followUps', '[]'::jsonb)
    ) = p_expected
  returning s.results;
$$;

revoke all on function public.lms_save_result_guarded(uuid, uuid, integer, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.lms_save_result_guarded(uuid, uuid, integer, jsonb, jsonb) to service_role;

-- lms_save_result (0004) is left in place so the previous deploy keeps working
-- during rollout; drop it once this version is live:
--   drop function if exists public.lms_save_result(uuid, uuid, integer, jsonb);
