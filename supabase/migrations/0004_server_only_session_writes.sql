-- LMS: only the server writes sessions.
-- Run once in the Supabase SQL editor (or `supabase db push`), after 0003.
--
-- Until now users could insert and update their own lms_sessions rows. The
-- anon key is public, so anyone could set their own `total` / `report` from the
-- browser and show a fake score on the friends leaderboard. The browser and the
-- route handlers send the same user token, so no policy or function can tell
-- them apart. Writes now go through the service role, which only the Next.js
-- server holds (SUPABASE_SERVICE_ROLE_KEY). Users keep read access to their own rows.

drop policy if exists "lms_sessions: insert own" on public.lms_sessions;
drop policy if exists "lms_sessions: update own" on public.lms_sessions;

revoke insert, update, delete on public.lms_sessions from anon, authenticated;

-- Writes one question's result in a single statement, so concurrent answers to
-- different questions can't overwrite each other. Pads `results` to one entry
-- per question first (same shape as emptyResult in src/lib/sessions/progress.ts).
-- Returns the new results, or null if the session isn't the user's or isn't in progress.
create or replace function public.lms_save_result(p_session uuid, p_user uuid, p_index integer, p_result jsonb)
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
  returning s.results;
$$;

revoke all on function public.lms_save_result(uuid, uuid, integer, jsonb) from public, anon, authenticated;
grant execute on function public.lms_save_result(uuid, uuid, integer, jsonb) to service_role;
