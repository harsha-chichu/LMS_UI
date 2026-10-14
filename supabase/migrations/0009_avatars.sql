-- LMS: profile pictures.
--
-- Users upload a photo from /settings. It's resized in the browser and stored in
-- the public "avatars" bucket at avatars/<user id>/<random>.webp; the random file
-- name keeps links unguessable. Only the owner can add, replace or delete files
-- in their folder. lms_profiles.avatar_url holds the public URL, and the friend
-- functions from 0003 now return it so friends see the photo too.

-- ---------------------------------------------------------------------------
-- lms_profiles.avatar_url (own-row RLS from 0001 already covers read/update)
-- ---------------------------------------------------------------------------
alter table public.lms_profiles add column if not exists avatar_url text;

-- ---------------------------------------------------------------------------
-- Storage bucket + policies
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars: insert own" on storage.objects;
create policy "avatars: insert own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars: update own" on storage.objects;
create policy "avatars: update own" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars: delete own" on storage.objects;
create policy "avatars: delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- Friend functions (0003) with avatar_url. Return types change, so drop first.
-- ---------------------------------------------------------------------------
drop function if exists public.lms_search_users(text);
drop function if exists public.lms_friend_requests();
drop function if exists public.lms_friends_overview();

-- Name prefix or exact email; at most 10 people, never yourself, never emails.
create function public.lms_search_users(q text)
returns table (id uuid, name text, avatar_url text, relation text)
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
      p.avatar_url,
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

-- Pending requests, both directions.
create function public.lms_friend_requests()
returns table (id uuid, name text, avatar_url text, direction text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    case when f.requester = auth.uid() then f.addressee else f.requester end,
    coalesce(p.name, ''),
    p.avatar_url,
    case when f.requester = auth.uid() then 'outgoing' else 'incoming' end
  from public.lms_friendships f
  left join public.lms_profiles p
    on p.id = case when f.requester = auth.uid() then f.addressee else f.requester end
  where f.status = 'pending' and auth.uid() in (f.requester, f.addressee)
  order by f.created_at desc;
$$;

-- You plus every accepted friend, with each person's completed session scores.
create function public.lms_friends_overview()
returns table (id uuid, name text, avatar_url text, is_me boolean, sessions jsonb)
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
    p.avatar_url,
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
-- answers (lms_sessions.results) are never read. Same return type as before
-- (jsonb), so this replaces it in place.
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

-- Signed-in users only (same as 0003).
revoke all on function public.lms_search_users(text) from public, anon;
revoke all on function public.lms_friend_requests() from public, anon;
revoke all on function public.lms_friends_overview() from public, anon;
revoke all on function public.lms_friend_profile(uuid) from public, anon;

grant execute on function public.lms_search_users(text) to authenticated;
grant execute on function public.lms_friend_requests() to authenticated;
grant execute on function public.lms_friends_overview() to authenticated;
grant execute on function public.lms_friend_profile(uuid) to authenticated;
