-- LMS: private product feedback from signed-in users.
-- Run after 0011. Feedback is written only by the server-side API route and
-- reviewed in the Supabase dashboard; users cannot read or alter any rows.

create table if not exists public.lms_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid references public.lms_sessions (id) on delete set null,
  category text not null check (category in ('idea', 'problem', 'praise', 'other')),
  rating smallint not null check (rating between 1 and 5),
  message text not null check (length(btrim(message)) between 1 and 5000),
  follow_up_consent boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists lms_feedback_created_idx on public.lms_feedback (created_at desc);
create index if not exists lms_feedback_user_created_idx on public.lms_feedback (user_id, created_at desc);

alter table public.lms_feedback enable row level security;
revoke all on public.lms_feedback from anon, authenticated;
