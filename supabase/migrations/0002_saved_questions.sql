-- LMS: questions a user bookmarked during a session or from its report.
-- Run once in the Supabase SQL editor (or `supabase db push`), after 0001.
--
-- Questions are generated per session and live inside lms_sessions.questions,
-- so each save keeps its own copy of the text and the session's settings.

create table if not exists public.lms_saved_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_id uuid not null references public.lms_sessions (id) on delete cascade,
  question_index integer not null check (question_index >= 0),
  text text not null,
  domain text not null,
  difficulty text not null,
  created_at timestamptz not null default now(),
  unique (user_id, session_id, question_index)
);

create index if not exists lms_saved_questions_user_created_idx
  on public.lms_saved_questions (user_id, created_at desc);

alter table public.lms_saved_questions enable row level security;

drop policy if exists "lms_saved_questions: read own" on public.lms_saved_questions;
create policy "lms_saved_questions: read own" on public.lms_saved_questions
  for select using (user_id = auth.uid());

drop policy if exists "lms_saved_questions: insert own" on public.lms_saved_questions;
create policy "lms_saved_questions: insert own" on public.lms_saved_questions
  for insert with check (
    user_id = auth.uid()
    and exists (select 1 from public.lms_sessions s where s.id = session_id and s.user_id = auth.uid())
  );

drop policy if exists "lms_saved_questions: delete own" on public.lms_saved_questions;
create policy "lms_saved_questions: delete own" on public.lms_saved_questions
  for delete using (user_id = auth.uid());
