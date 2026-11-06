-- Daily streak: a day burns when the student finishes at least one set from every subject (Bangladesh time).
-- Nothing is stored per day. Streaks are worked out from session_run, so grading stays untouched.
-- A set counts when it is finished, is not a retry and has at least one answered question. answered_at is used rather
-- than selected_option because selected_option goes null when an admin later removes that option.
-- Known limit: the required subjects are today's, so adding a subject makes older days look incomplete.

alter table public.app_setting add column streaks_public boolean not null default false;
grant update (streaks_public) on table public.app_setting to authenticated;

-- The subjects a student can practise: those with an approved question in a topic of one of their exams.
create function private.streak_subjects() returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select distinct e.subject_id
  from public.exam e
  join public.exam_topic et on et.exam_id = e.id
  join public.question q on q.topic_id = et.topic_id and q.status = 'approved'
  where e.subject_id is not null;
$$;

-- The subjects a student practised, per Bangladesh day.
create function private.streak_practice(p_user uuid) returns table (day date, subject_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct (s.finished_at at time zone 'Asia/Dhaka')::date, e.subject_id
  from public.session_run s
  join public.exam e on e.id = s.exam_id
  where s.user_id = p_user
    and s.finished_at is not null
    and s.retry_of is null
    and e.subject_id in (select private.streak_subjects())
    and exists (select 1 from public.attempt a where a.session_run_id = s.id and a.answered_at is not null);
$$;

-- The days on which every subject was practised.
create function private.streak_days(p_user uuid) returns setof date
language sql
stable
security definer
set search_path = ''
as $$
  select p.day
  from private.streak_practice(p_user) p
  group by p.day
  having count(*) = (select count(*) from private.streak_subjects());
$$;

-- Consecutive complete days ending today, or yesterday while today is still open.
create function private.streak_count(p_user uuid) returns integer
language sql
stable
security definer
set search_path = ''
as $$
  with days as (
    select d, d - (row_number() over (order by d))::integer as run
    from private.streak_days(p_user) d
  ),
  latest as (select * from days order by d desc limit 1)
  select coalesce((
    select count(*)::integer
    from days
    where days.run = (select l.run from latest l where l.d >= (now() at time zone 'Asia/Dhaka')::date - 1)
  ), 0);
$$;

-- The caller's streak and today's subjects. Other students' names and days leave the database only when the admin has
-- switched shared streaks on.
create function public.my_streak() returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  today date := (now() at time zone 'Asia/Dhaka')::date;
  shared boolean;
  subjects jsonb;
  friends jsonb := '[]'::jsonb;
begin
  if not (select private.is_active()) then
    raise exception 'Your account is not approved' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', s.id,
           'name', s.name,
           'done', exists (select 1 from private.streak_practice(me) p where p.day = today and p.subject_id = s.id)
         ) order by s.sort_order, s.name), '[]'::jsonb)
    into subjects
  from public.subject s
  where s.id in (select private.streak_subjects());

  select coalesce(streaks_public, false) into shared from public.app_setting where id = 1;
  if shared then
    select coalesce(jsonb_agg(jsonb_build_object('name', f.name, 'days', f.days, 'today_done', f.today_done) order by f.days desc, f.name), '[]'::jsonb)
      into friends
    from (
      select p.name, private.streak_count(p.id) as days, today in (select private.streak_days(p.id)) as today_done
      from public.profile p
      where p.status = 'active' and p.id <> me
    ) f;
  end if;

  return jsonb_build_object(
    'days', private.streak_count(me),
    'today_done', today in (select private.streak_days(me)),
    'subjects', subjects,
    'shared', coalesce(shared, false),
    'friends', friends
  );
end;
$$;

revoke execute on function private.streak_subjects() from public, anon, authenticated;
revoke execute on function private.streak_practice(uuid) from public, anon, authenticated;
revoke execute on function private.streak_days(uuid) from public, anon, authenticated;
revoke execute on function private.streak_count(uuid) from public, anon, authenticated;
revoke execute on function public.my_streak() from public, anon;
grant execute on function public.my_streak() to authenticated;
