-- Topic practice in order, and a revision list of wrong answers.
--   1. session_run.chunk: the set number (1, 2, 3 ...) of a sequential topic set. start_session takes it as a fifth argument.
--   2. topic_sets(exam): every set of every topic of an exam with the student's best score, for Home.
--   3. revision_done + my_revision / mark_revised: wrong answers to revise, removed once the student marks them done.

alter table public.session_run add column if not exists chunk integer check (chunk >= 1);

drop function public.start_session(uuid, uuid, uuid[], uuid);

create function public.start_session(p_exam_id uuid, p_set_id uuid, p_topic_ids uuid[], p_retry_of uuid, p_chunk integer default null) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  ex public.exam;
  prev public.session_run;
  qids uuid[];
  topics uuid[] := '{}';
  sid uuid;
  have integer;
begin
  if not (select private.is_active()) then
    raise exception 'Your account is not approved' using errcode = '42501';
  end if;
  select * into ex from public.exam where id = p_exam_id;
  if not found then
    raise exception 'Exam not found' using errcode = 'P0001';
  end if;

  if p_retry_of is not null then
    select * into prev from public.session_run where id = p_retry_of and user_id = me and finished_at is not null;
    if not found or prev.exam_id <> ex.id then
      raise exception 'You can only retry the missed questions of an exam you have finished' using errcode = 'P0001';
    end if;
    select array_agg(a.question_id order by a.position) into qids
    from public.attempt a join public.question q on q.id = a.question_id and q.status = 'approved'
    where a.session_run_id = prev.id and a.is_correct is not true;
    if qids is null then
      raise exception 'There are no missed questions to retry' using errcode = 'P0001';
    end if;
    topics := prev.topic_ids;
  elsif p_set_id is not null then
    select question_ids into qids from public.question_set where id = p_set_id and exam_id = ex.id and status = 'live';
    if qids is null then
      raise exception 'That set is not available' using errcode = 'P0001';
    end if;
  elsif p_chunk is not null then
    -- Sequential set: the topic's approved questions in the order they were written, cut into sets of question_count.
    -- Set n is questions (n-1)*count+1 to n*count, so finishing every set means every question of the topic was asked.
    if p_chunk < 1 or cardinality(coalesce(p_topic_ids, '{}')) <> 1 then
      raise exception 'Pick one topic and a set number' using errcode = 'P0001';
    end if;
    topics := p_topic_ids;
    if not exists (select 1 from public.exam_topic et where et.exam_id = ex.id and et.topic_id = topics[1]) then
      raise exception 'That topic is not part of this exam' using errcode = 'P0001';
    end if;
    select array_agg(id order by created_at, id) into qids
    from (
      select q.id, q.created_at from public.question q
      where q.topic_id = topics[1] and q.status = 'approved'
      order by q.created_at, q.id
      offset (p_chunk - 1) * ex.question_count limit ex.question_count
    ) cut;
    if qids is null then
      raise exception 'That set does not exist' using errcode = 'P0001';
    end if;
  else
    topics := coalesce(p_topic_ids, '{}');
    select array_agg(id order by k, rnd) into qids
    from (
      select q.id,
             (row_number() over (partition by q.topic_id order by random()) - 0.5) / count(*) over (partition by q.topic_id) as k,
             random() as rnd
      from public.question q
      where q.status = 'approved'
        and q.topic_id in (
          select et.topic_id from public.exam_topic et
          where et.exam_id = ex.id and (cardinality(topics) = 0 or et.topic_id = any (topics))
        )
      order by k, rnd
      limit ex.question_count
    ) picked;
    have := coalesce(cardinality(qids), 0);
    if have < ex.question_count then
      raise exception 'This exam does not have enough approved questions yet (it needs %, there are %)', ex.question_count, have using errcode = 'P0001';
    end if;
  end if;

  insert into public.session_run (user_id, exam_id, set_id, retry_of, topic_ids, chunk)
  values (me, ex.id, case when p_retry_of is null and p_chunk is null then p_set_id end, p_retry_of, topics, case when p_retry_of is null then p_chunk end)
  returning id into sid;
  insert into public.attempt (session_run_id, user_id, question_id, position)
  select sid, me, t.q, t.ord - 1 from unnest(qids) with ordinality as t (q, ord);
  return sid;
end;
$$;

create or replace function public.get_review(p_session_id uuid) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.session_run;
  ex public.exam;
  qs jsonb;
  c integer;
  w integer;
  sk integer;
begin
  s := private.own_session(p_session_id);
  if s.finished_at is null and s.deadline_at is not null and now() > s.deadline_at + interval '3 seconds' then
    perform private.finalize_session(s.id, true);
    select * into s from public.session_run where id = s.id;
  end if;
  if s.finished_at is null then
    raise exception 'The review opens after you submit' using errcode = 'P0001';
  end if;
  select * into ex from public.exam where id = s.exam_id;

  select count(*) filter (where is_correct), count(*) filter (where selected_option is not null and not is_correct), count(*) filter (where selected_option is null)
    into c, w, sk
  from public.attempt where session_run_id = s.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'position', a.position,
    'question_id', q.id,
    'text', q.text,
    'lang', q.lang,
    'figure_id', q.figure_id,
    'source_page', q.source_page,
    'topic_id', t.id,
    'topic', t.title,
    'topic_number', t.number,
    'subject', sj.name,
    'has_note', t.note_path is not null,
    'selected_option', a.selected_option,
    'is_correct', a.is_correct,
    'marked', a.marked_for_review,
    'seconds_spent', a.seconds_spent,
    'explanation', (select o.explanation from public.mcq_option o where o.question_id = q.id and o.is_correct),
    'options', (select jsonb_agg(jsonb_build_object('id', o.id, 'label', o.label, 'text', o.text, 'is_correct', o.is_correct) order by o.label)
                from public.mcq_option o where o.question_id = q.id)
  ) order by a.position), '[]')
  into qs
  from public.attempt a
  join public.question q on q.id = a.question_id
  join public.topic t on t.id = q.topic_id
  join public.subject sj on sj.id = q.subject_id
  where a.session_run_id = s.id;

  return jsonb_build_object(
    'session', jsonb_build_object(
      'id', s.id,
      'exam_id', ex.id,
      'exam_name', ex.name,
      'set_name', coalesce((select qs2.name from public.question_set qs2 where qs2.id = s.set_id), case when s.chunk is not null then 'Set ' || s.chunk end),
      'is_retry', s.retry_of is not null,
      'started_at', s.started_at,
      'finished_at', s.finished_at,
      'timed_out', s.timed_out,
      'seconds_used', greatest(0, least(extract(epoch from (s.finished_at - s.started_at))::integer, ceil(ex.time_seconds::numeric * (c + w + sk) / ex.question_count)::integer)),
      'score', s.score,
      'max_score', s.max_score,
      'negative_applied', s.negative_applied,
      'marks_per_question', ex.marks_per_question,
      'negative_mark', ex.negative_mark,
      'correct', c, 'wrong', w, 'skipped', sk, 'total', c + w + sk,
      'topic_ids', s.topic_ids
    ),
    'questions', qs
  );
end;
$$;

create or replace function public.session_state(p_session_id uuid) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.session_run;
  ex public.exam;
  n integer;
  status text;
  qs jsonb := '[]';
begin
  s := private.own_session(p_session_id);
  if s.finished_at is null and s.deadline_at is not null and now() > s.deadline_at + interval '3 seconds' then
    perform private.finalize_session(s.id, true);
    select * into s from public.session_run where id = s.id;
  end if;
  select * into ex from public.exam where id = s.exam_id;
  select count(*) into n from public.attempt where session_run_id = s.id;
  status := case when s.finished_at is not null then 'finished' when s.started_at is null then 'ready' else 'running' end;

  if status = 'running' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'position', a.position,
      'question_id', q.id,
      'text', q.text,
      'lang', q.lang,
      'figure_id', q.figure_id,
      'subject', sj.name,
      'topic', t.title,
      'selected_option', a.selected_option,
      'marked', a.marked_for_review,
      'seconds_spent', a.seconds_spent,
      'options', (select jsonb_agg(jsonb_build_object('id', o.id, 'label', o.label, 'text', o.text) order by o.label)
                  from public.mcq_option o where o.question_id = q.id)
    ) order by a.position), '[]')
    into qs
    from public.attempt a
    join public.question q on q.id = a.question_id
    join public.topic t on t.id = q.topic_id
    join public.subject sj on sj.id = q.subject_id
    where a.session_run_id = s.id;
  end if;

  return jsonb_build_object(
    'status', status,
    'session_id', s.id,
    'exam', jsonb_build_object('id', ex.id, 'name', ex.name, 'marks_per_question', ex.marks_per_question, 'negative_mark', ex.negative_mark),
    'is_retry', s.retry_of is not null,
    'set_name', coalesce((select qs2.name from public.question_set qs2 where qs2.id = s.set_id), case when s.chunk is not null then 'Set ' || s.chunk end),
    'total', n,
    'seconds', greatest(1, ceil(ex.time_seconds::numeric * n / ex.question_count)::integer),
    'deadline', s.deadline_at,
    'now', now(),
    'questions', qs
  );
end;
$$;

create or replace function public.my_history() returns table (
  session_id uuid, exam_id uuid, exam_name text, set_name text, is_retry boolean, finished_at timestamptz, timed_out boolean,
  score numeric, max_score numeric, negative_applied numeric, correct integer, wrong integer, skipped integer, total integer, seconds_used integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if not (select private.is_active()) then
    raise exception 'Your account is not approved' using errcode = '42501';
  end if;
  perform private.sweep_sessions(me);
  return query
  select s.id, s.exam_id, e.name, coalesce((select q.name from public.question_set q where q.id = s.set_id), case when s.chunk is not null then 'Set ' || s.chunk end), s.retry_of is not null,
         s.finished_at, s.timed_out, s.score, s.max_score, s.negative_applied,
         (select count(*) filter (where a.is_correct)::integer from public.attempt a where a.session_run_id = s.id),
         (select count(*) filter (where a.selected_option is not null and not a.is_correct)::integer from public.attempt a where a.session_run_id = s.id),
         (select count(*) filter (where a.selected_option is null)::integer from public.attempt a where a.session_run_id = s.id),
         (select count(*)::integer from public.attempt a where a.session_run_id = s.id),
         greatest(0, extract(epoch from (s.finished_at - s.started_at))::integer)
  from public.session_run s join public.exam e on e.id = s.exam_id
  where s.user_id = me and s.finished_at is not null
  order by s.finished_at desc
  limit 200;
end;
$$;

-- Sets of a topic for Home: for each topic of the exam, set 1..n (the topic's approved questions in written order, question_count
-- each) with how many questions it has and the caller's best, last and number of finished tries.
create function public.topic_sets(p_exam_id uuid) returns table (topic_id uuid, chunk integer, size integer, best_score numeric, last_score numeric, max_score numeric, tries integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if not (select private.is_active()) then
    raise exception 'Your account is not approved' using errcode = '42501';
  end if;
  return query
  with ex as (select e.id, e.question_count from public.exam e where e.id = p_exam_id),
  counts as (
    select q.topic_id as tid, count(*)::integer as n
    from public.question q
    join public.exam_topic et on et.topic_id = q.topic_id and et.exam_id = p_exam_id
    where q.status = 'approved'
    group by q.topic_id
  ),
  chunks as (
    select c.tid, g as ch, least(ex.question_count, c.n - (g - 1) * ex.question_count) as sz
    from counts c cross join ex
    cross join lateral generate_series(1, ((c.n + ex.question_count - 1) / ex.question_count)) g
  )
  select ch.tid, ch.ch, ch.sz,
         max(s.score), (array_agg(s.score order by s.finished_at desc) filter (where s.id is not null))[1], max(s.max_score), count(s.id)::integer
  from chunks ch
  left join public.session_run s
    on s.user_id = me and s.exam_id = p_exam_id and s.chunk = ch.ch and s.topic_ids[1] = ch.tid and s.finished_at is not null
  group by ch.tid, ch.ch, ch.sz
  order by ch.tid, ch.ch;
end;
$$;

-- Revision list. A wrong answer is one the student picked and got wrong in a finished exam. It stays until the student marks the
-- question done, and comes back if they get it wrong again afterwards.
create table public.revision_done (
  user_id uuid not null references public.profile (id) on delete cascade,
  question_id uuid not null references public.question (id) on delete cascade,
  done_at timestamptz not null default now(),
  primary key (user_id, question_id)
);
create index revision_done_question_idx on public.revision_done (question_id);
alter table public.revision_done enable row level security;
revoke all on table public.revision_done from anon, authenticated;
grant select on table public.revision_done to authenticated;
create policy revision_done_select_own on public.revision_done for select to authenticated using (user_id = (select auth.uid()));

create function public.my_revision() returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  res jsonb;
begin
  if not (select private.is_active()) then
    raise exception 'Your account is not approved' using errcode = '42501';
  end if;
  perform private.sweep_sessions(me);

  select coalesce(jsonb_agg(item order by sort_subject, sort_topic, last_wrong desc), '[]') into res
  from (
    select
      sj.sort_order as sort_subject, t.number as sort_topic, w.last_wrong,
      jsonb_build_object(
        'question_id', q.id,
        'text', q.text,
        'lang', q.lang,
        'figure_id', q.figure_id,
        'source_page', q.source_page,
        'subject_id', sj.id,
        'subject', sj.name,
        'topic_id', t.id,
        'topic', t.title,
        'topic_number', t.number,
        'has_note', t.note_path is not null,
        'times_wrong', w.times_wrong,
        'last_wrong', w.last_wrong,
        'selected_option', w.picked,
        'explanation', (select o.explanation from public.mcq_option o where o.question_id = q.id and o.is_correct),
        'options', (select jsonb_agg(jsonb_build_object('id', o.id, 'label', o.label, 'text', o.text, 'is_correct', o.is_correct) order by o.label)
                    from public.mcq_option o where o.question_id = q.id)
      ) as item
    from (
      select a.question_id,
             count(*)::integer as times_wrong,
             max(s.finished_at) as last_wrong,
             (array_agg(a.selected_option order by s.finished_at desc))[1] as picked
      from public.attempt a
      join public.session_run s on s.id = a.session_run_id and s.finished_at is not null
      where a.user_id = me and a.selected_option is not null and a.is_correct is false
      group by a.question_id
    ) w
    join public.question q on q.id = w.question_id
    join public.topic t on t.id = q.topic_id
    join public.subject sj on sj.id = q.subject_id
    left join public.revision_done d on d.user_id = me and d.question_id = q.id
    where d.done_at is null or w.last_wrong > d.done_at
  ) x;
  return res;
end;
$$;

-- Marks questions as revised. Only questions the caller got wrong are recorded.
create function public.mark_revised(p_question_ids uuid[]) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  n integer;
begin
  if not (select private.is_active()) then
    raise exception 'Your account is not approved' using errcode = '42501';
  end if;
  insert into public.revision_done (user_id, question_id, done_at)
  select me, a.question_id, now()
  from public.attempt a
  where a.user_id = me and a.is_correct is false and a.question_id = any (coalesce(p_question_ids, '{}'))
  group by a.question_id
  on conflict (user_id, question_id) do update set done_at = excluded.done_at;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.start_session(uuid, uuid, uuid[], uuid, integer) from public, anon;
revoke execute on function public.topic_sets(uuid) from public, anon;
revoke execute on function public.my_revision() from public, anon;
revoke execute on function public.mark_revised(uuid[]) from public, anon;
grant execute on function public.start_session(uuid, uuid, uuid[], uuid, integer) to authenticated;
grant execute on function public.topic_sets(uuid) to authenticated;
grant execute on function public.my_revision() to authenticated;
grant execute on function public.mark_revised(uuid[]) to authenticated;
