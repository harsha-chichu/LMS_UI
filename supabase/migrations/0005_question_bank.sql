-- LMS: question bank + per-user attempts, for adaptive sessions.
-- Run once in the Supabase SQL editor (or `supabase db push`), after 0004.
-- Then run 0006 to seed the bank.
--
-- Sessions pick questions from lms_questions instead of generating them, and
-- steer towards topics the user is weak at (src/lib/questions/pick.ts). The
-- LLM only writes new questions when the bank has nothing suitable; those are
-- saved here too and go live straight away.
--
-- Privacy: the bank is server-only (no policies), so nobody can download it.
-- Users read their own attempts, which carry a copy of the topics.

-- ---------------------------------------------------------------------------
-- lms_questions: the bank
-- ---------------------------------------------------------------------------
create table if not exists public.lms_questions (
  id uuid primary key default gen_random_uuid(),
  domain text not null
    check (domain in ('ai-ml', 'data-science', 'backend', 'frontend', 'system-design', 'behavioral')),
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  text text not null check (length(btrim(text)) > 0),
  -- Lowercase topic names (the curated TOPICS in src/lib/constants.ts, or a user's custom topic).
  topics text[] not null default '{}',
  source text not null default 'generated' check (source in ('seed', 'generated')),
  status text not null default 'active' check (status in ('active', 'retired')),
  created_by uuid references auth.users (id) on delete set null,
  times_asked integer not null default 0,
  times_skipped integer not null default 0,
  created_at timestamptz not null default now(),
  -- Catches the same question with different punctuation or case.
  text_key text generated always as (btrim(regexp_replace(lower(text), '[^a-z0-9]+', ' ', 'g'))) stored,
  unique (domain, text_key)
);

create index if not exists lms_questions_pick_idx on public.lms_questions (domain, difficulty, status);
create index if not exists lms_questions_topics_idx on public.lms_questions using gin (topics);

alter table public.lms_questions enable row level security;
revoke all on public.lms_questions from anon, authenticated;

-- ---------------------------------------------------------------------------
-- lms_question_attempts: one row per bank question in a completed session
-- ---------------------------------------------------------------------------
create table if not exists public.lms_question_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid not null references public.lms_sessions (id) on delete cascade,
  question_id uuid not null references public.lms_questions (id) on delete cascade,
  domain text not null,
  difficulty text not null,
  topics text[] not null default '{}',
  -- 0–10; null when skipped.
  score numeric(3, 1) check (score between 0 and 10),
  skipped boolean not null default false,
  created_at timestamptz not null default now(),
  unique (session_id, question_id)
);

create index if not exists lms_question_attempts_user_idx
  on public.lms_question_attempts (user_id, domain, difficulty, created_at desc);

alter table public.lms_question_attempts enable row level security;
revoke insert, update, delete on public.lms_question_attempts from anon, authenticated;

drop policy if exists "lms_question_attempts: read own" on public.lms_question_attempts;
create policy "lms_question_attempts: read own" on public.lms_question_attempts
  for select using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Record attempts when a session completes
-- ---------------------------------------------------------------------------
-- Runs in the same transaction as the completing update. Unanswered and skipped
-- questions count as skipped. Generated questions that most people skip are
-- retired automatically, since nobody reviews them.
create or replace function public.lms_record_attempts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  with picked as (
    select bq.id, bq.domain, bq.difficulty, bq.topics, new.results -> (q.i - 1)::integer as r
    from jsonb_array_elements(new.questions) with ordinality as q(value, i)
    join public.lms_questions bq on bq.id::text = q.value ->> 'bankId'
  ),
  scored as (
    select
      p.*,
      coalesce((p.r ->> 'skipped')::boolean, false) or (p.r -> 'evaluation' ->> 'score') is null as was_skipped
    from picked p
  ),
  ins as (
    insert into public.lms_question_attempts
      (user_id, session_id, question_id, domain, difficulty, topics, score, skipped, created_at)
    select
      new.user_id, new.id, s.id, s.domain, s.difficulty, s.topics,
      case when s.was_skipped then null
           else least(10, greatest(0, round((s.r -> 'evaluation' ->> 'score')::numeric, 1))) end,
      s.was_skipped,
      coalesce(new.completed_at, now())
    from scored s
    on conflict (session_id, question_id) do nothing
    returning question_id, skipped
  )
  update public.lms_questions bq
  set
    times_asked = bq.times_asked + 1,
    times_skipped = bq.times_skipped + ins.skipped::integer,
    status = case
      when bq.source = 'generated'
        and bq.times_asked + 1 >= 10
        and (bq.times_skipped + ins.skipped::integer)::numeric / (bq.times_asked + 1) > 0.6
      then 'retired'
      else bq.status
    end
  from ins
  where bq.id = ins.question_id;

  return null;
end;
$$;

revoke all on function public.lms_record_attempts() from public, anon, authenticated;

drop trigger if exists lms_on_session_completed on public.lms_sessions;
create trigger lms_on_session_completed
  after update of status on public.lms_sessions
  for each row
  when (new.status = 'completed' and old.status is distinct from 'completed')
  execute function public.lms_record_attempts();
