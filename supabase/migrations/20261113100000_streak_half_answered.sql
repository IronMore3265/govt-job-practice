-- Daily streak: a set now counts only when at least half of its questions were answered.
-- Before, one answered question was enough, so a set with 1 answer and 19 skips ticked the subject off.
-- Skipping stays allowed (negative marking makes it a fair choice), just not for most of the set.

create or replace function private.streak_practice(p_user uuid) returns table (day date, subject_id uuid)
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
    and (
      select count(*) filter (where a.answered_at is not null) * 2 >= count(*) and count(*) > 0
      from public.attempt a
      where a.session_run_id = s.id
    );
$$;
