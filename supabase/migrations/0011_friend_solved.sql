-- LMS: friends' solved ring, and keep the new key points private.
--
-- lms_friend_profile now also returns 'solved': how many questions the friend
-- has solved per difficulty (counts only), for the ring on their profile. It
-- also strips each question's suggestedPoints, like the rest of the coaching
-- (see 0010). Otherwise the same as 0010.

create or replace function public.lms_friend_profile(friend uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not signed in';
  end if;
  if not public.lms_are_friends(me, friend) then
    raise exception 'not friends' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'name', (select p.name from public.lms_profiles p where p.id = friend),
    'avatar_url', (select p.avatar_url from public.lms_profiles p where p.id = friend),
    -- Questions solved per difficulty: best non-skipped score >= 7 (SOLVED_SCORE in
    -- src/lib/mastery.ts). Counts only; which questions stays private.
    'solved', (
      select jsonb_build_object(
        'easy', count(*) filter (where b.difficulty = 'easy'),
        'medium', count(*) filter (where b.difficulty = 'medium'),
        'hard', count(*) filter (where b.difficulty = 'hard')
      )
      from (
        select a.question_id, a.difficulty, max(a.score) as best
        from public.lms_question_attempts a
        where a.user_id = friend and not a.skipped and a.score is not null
        group by a.question_id, a.difficulty
      ) b
      where b.best >= 7
    ),
    'sessions', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', s.id,
            'config', s.config,
            'total', s.total,
            'completed_at', s.completed_at,
            'report', jsonb_set(
              s.report,
              '{questions}',
              coalesce(
                (
                  select jsonb_agg(
                    (q.value - 'answer' - 'followUps' - 'suggestedAnswer' - 'suggestedPoints' - 'strengths' - 'weaknesses')
                      || '{"feedback": "", "nextTime": ""}'::jsonb
                    order by q.ordinality
                  )
                  from jsonb_array_elements(s.report -> 'questions') with ordinality as q
                ),
                '[]'::jsonb
              )
            )
          )
          order by s.completed_at desc
        )
        from (
          select s0.id, s0.config, s0.total, s0.completed_at, s0.report
          from public.lms_sessions s0
          where s0.user_id = friend and s0.status = 'completed' and s0.report is not null
          order by s0.completed_at desc
          limit 500
        ) s
      ),
      '[]'::jsonb
    )
  );
end;
$$;

revoke all on function public.lms_friend_profile(uuid) from public, anon;
grant execute on function public.lms_friend_profile(uuid) to authenticated;
