-- LMS: how many active questions the bank holds per domain + difficulty.
--
-- Feeds the "solved" ring on the profile (solved / total per difficulty). The
-- bank itself stays server-only (no user policies on lms_questions); this only
-- exposes the counts, never the question text.

create or replace function public.lms_bank_counts()
returns table (domain text, difficulty text, count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select q.domain, q.difficulty, count(*)::bigint
  from public.lms_questions q
  where q.status = 'active'
  group by q.domain, q.difficulty;
$$;

revoke all on function public.lms_bank_counts() from public, anon;
grant execute on function public.lms_bank_counts() to authenticated;
