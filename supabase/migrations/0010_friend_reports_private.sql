-- LMS: keep answers private in friends' view of a report.
--
-- 0003 already blanked each question's feedback and next-time tip for friends.
-- Reports have since gained the candidate's answer, follow-up Q&A, a suggested
-- answer and strengths / weaknesses per question; strip those too, so friends
-- see each question and its score only. Same function as 0009 otherwise.

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
                    (q.value - 'answer' - 'followUps' - 'suggestedAnswer' - 'strengths' - 'weaknesses')
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
