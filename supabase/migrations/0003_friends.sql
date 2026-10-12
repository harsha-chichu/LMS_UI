-- LMS: friends. Users find each other by name or exact email, send a request,
-- and once accepted can see each other's progress.
-- Run once in the Supabase SQL editor (or `supabase db push`), after 0002.
--
-- Privacy: friends never get table access to each other's lms_sessions rows
-- (those hold answer transcripts). Every cross-user read goes through the
-- security definer functions below, which check the friendship and return
-- only scores and report summaries. Emails are only ever matched, never returned.

-- ---------------------------------------------------------------------------
-- lms_friendships: one row per pair, pending until the addressee accepts
-- ---------------------------------------------------------------------------
create table if not exists public.lms_friendships (
  id uuid primary key default gen_random_uuid(),
  requester uuid not null references auth.users (id) on delete cascade,
  addressee uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  check (requester <> addressee)
);

create unique index if not exists lms_friendships_pair_idx
  on public.lms_friendships (least(requester, addressee), greatest(requester, addressee));
create index if not exists lms_friendships_addressee_idx on public.lms_friendships (addressee);

alter table public.lms_friendships enable row level security;

-- Read-only for the two people involved; all writes go through the functions.
drop policy if exists "lms_friendships: read own" on public.lms_friendships;
create policy "lms_friendships: read own" on public.lms_friendships
  for select using (auth.uid() in (requester, addressee));

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------
create or replace function public.lms_are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.lms_friendships f
    where f.status = 'accepted'
      and ((f.requester = a and f.addressee = b) or (f.requester = b and f.addressee = a))
  );
$$;

-- Name prefix or exact email; at most 10 people, never yourself, never emails.
create or replace function public.lms_search_users(q text)
returns table (id uuid, name text, relation text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  term text := btrim(coalesce(q, ''));
  pattern text;
begin
  if me is null then
    raise exception 'not signed in';
  end if;
  if length(term) < 3 then
    return;
  end if;
  pattern := replace(replace(replace(term, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  return query
    select
      p.id,
      p.name,
      case
        when f.status = 'accepted' then 'friends'
        when f.requester = me then 'outgoing'
        when f.addressee = me then 'incoming'
        else 'none'
      end
    from public.lms_profiles p
    join auth.users u on u.id = p.id
    left join public.lms_friendships f
      on (f.requester = me and f.addressee = p.id) or (f.requester = p.id and f.addressee = me)
    where p.id <> me
      and (lower(u.email) = lower(term) or p.name ilike pattern)
    order by (lower(u.email) = lower(term)) desc, p.name
    limit 10;
end;
$$;

-- Returns the relation afterwards: 'outgoing', or 'friends' if they had already asked you.
create or replace function public.lms_send_friend_request(target uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  existing public.lms_friendships;
begin
  if me is null then
    raise exception 'not signed in';
  end if;
  if target is null or target = me then
    raise exception 'invalid user';
  end if;
  if not exists (select 1 from public.lms_profiles p where p.id = target) then
    raise exception 'user not found';
  end if;

  select * into existing from public.lms_friendships f
  where (f.requester = me and f.addressee = target) or (f.requester = target and f.addressee = me);

  if found then
    if existing.status = 'pending' and existing.addressee = me then
      update public.lms_friendships f set status = 'accepted', accepted_at = now() where f.id = existing.id;
      return 'friends';
    end if;
    return case when existing.status = 'accepted' then 'friends' else 'outgoing' end;
  end if;

  insert into public.lms_friendships (requester, addressee) values (me, target) on conflict do nothing;
  return 'outgoing';
end;
$$;

create or replace function public.lms_respond_friend_request(from_user uuid, accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not signed in';
  end if;
  if accept then
    update public.lms_friendships f set status = 'accepted', accepted_at = now()
    where f.requester = from_user and f.addressee = me and f.status = 'pending';
  else
    delete from public.lms_friendships f
    where f.requester = from_user and f.addressee = me and f.status = 'pending';
  end if;
end;
$$;

-- Unfriend, or cancel a request you sent.
create or replace function public.lms_remove_friend(other uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not signed in';
  end if;
  delete from public.lms_friendships f
  where (f.requester = me and f.addressee = other) or (f.requester = other and f.addressee = me);
end;
$$;

-- Pending requests, both directions.
create or replace function public.lms_friend_requests()
returns table (id uuid, name text, direction text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    case when f.requester = auth.uid() then f.addressee else f.requester end,
    coalesce(p.name, ''),
    case when f.requester = auth.uid() then 'outgoing' else 'incoming' end
  from public.lms_friendships f
  left join public.lms_profiles p
    on p.id = case when f.requester = auth.uid() then f.addressee else f.requester end
  where f.status = 'pending' and auth.uid() in (f.requester, f.addressee)
  order by f.created_at desc;
$$;

-- You plus every accepted friend, with each person's completed session scores.
create or replace function public.lms_friends_overview()
returns table (id uuid, name text, is_me boolean, sessions jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  with people as (
    select auth.uid() as uid, true as me
    union all
    select case when f.requester = auth.uid() then f.addressee else f.requester end, false
    from public.lms_friendships f
    where f.status = 'accepted' and auth.uid() in (f.requester, f.addressee)
  )
  select
    pe.uid,
    coalesce(p.name, ''),
    pe.me,
    coalesce(
      (
        select jsonb_agg(jsonb_build_object('total', s.total, 'completed_at', s.completed_at) order by s.completed_at desc)
        from (
          select s2.total, s2.completed_at
          from public.lms_sessions s2
          where s2.user_id = pe.uid and s2.status = 'completed'
          order by s2.completed_at desc
          limit 500
        ) s
      ),
      '[]'::jsonb
    )
  from people pe
  left join public.lms_profiles p on p.id = pe.uid
  where pe.uid is not null;
$$;

-- A friend's completed sessions. Reports lose their per-question feedback;
-- answers (lms_sessions.results) are never read.
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
                  select jsonb_agg(q.value || '{"feedback": "", "nextTime": ""}'::jsonb order by q.ordinality)
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

-- Signed-in users only.
revoke all on function public.lms_are_friends(uuid, uuid) from public, anon, authenticated;
revoke all on function public.lms_search_users(text) from public, anon;
revoke all on function public.lms_send_friend_request(uuid) from public, anon;
revoke all on function public.lms_respond_friend_request(uuid, boolean) from public, anon;
revoke all on function public.lms_remove_friend(uuid) from public, anon;
revoke all on function public.lms_friend_requests() from public, anon;
revoke all on function public.lms_friends_overview() from public, anon;
revoke all on function public.lms_friend_profile(uuid) from public, anon;

grant execute on function public.lms_search_users(text) to authenticated;
grant execute on function public.lms_send_friend_request(uuid) to authenticated;
grant execute on function public.lms_respond_friend_request(uuid, boolean) to authenticated;
grant execute on function public.lms_remove_friend(uuid) to authenticated;
grant execute on function public.lms_friend_requests() to authenticated;
grant execute on function public.lms_friends_overview() to authenticated;
grant execute on function public.lms_friend_profile(uuid) to authenticated;
