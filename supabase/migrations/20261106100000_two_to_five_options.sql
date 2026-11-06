-- Questions may have 2 to 5 options (A to E). The first Mathematics book has questions with five options and one with three.
--
-- Changes:
--   * mcq_option.label accepts A to E (it was A to D);
--   * the approval trigger asks for 2 to 5 options, exactly one correct, and an explanation on the correct one;
--   * admin_save_question takes 2 to 5 options (labels A to E, no gaps), removes options that are no longer sent,
--     and checks that the correct label is one of them.
-- Everything that reads options (exam, review, revision) already orders by label and takes whatever rows exist.

alter table public.mcq_option drop constraint mcq_option_label_check;
alter table public.mcq_option add constraint mcq_option_label_check check (label in ('A', 'B', 'C', 'D', 'E'));

create or replace function private.check_question_ready() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  n integer;
  c integer;
  e integer;
  top text;
begin
  if new.status = 'approved' then
    select count(*),
           count(*) filter (where is_correct),
           count(*) filter (where is_correct and coalesce(btrim(explanation), '') <> ''),
           max(label)
      into n, c, e, top
    from public.mcq_option where question_id = new.id;
    -- labels must run A, B, C ... without a gap, so the highest label is the n-th letter
    if n < 2 or n > 5 or c <> 1 or e <> 1 or top <> chr(64 + n) then
      raise exception 'An approved question needs two to five options (A, B, C ... with no gap), exactly one correct, and an explanation on the correct option'
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.admin_save_question(
  p_id uuid,
  p_topic_id uuid,
  p_lang public.question_lang,
  p_text text,
  p_figure_id uuid,
  p_source_page integer,
  p_options jsonb,
  p_correct text,
  p_explanation text,
  p_status public.question_status
) returns uuid
language plpgsql
set search_path = ''
as $$
declare
  qid uuid;
  subj uuid;
  opt jsonb;
  lbl text;
  labels text[] := '{}';
  n integer;
begin
  if not (select private.is_admin()) then
    raise exception 'Only the admin can save questions' using errcode = '42501';
  end if;

  select subject_id into subj from public.topic where id = p_topic_id;
  if subj is null then
    raise exception 'Pick a topic for the question' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_options) <> 'array' then
    raise exception 'A question needs two to five options' using errcode = 'P0001';
  end if;
  n := jsonb_array_length(p_options);
  if n < 2 or n > 5 then
    raise exception 'A question needs two to five options' using errcode = 'P0001';
  end if;
  for opt in select * from jsonb_array_elements(p_options) loop
    lbl := opt ->> 'label';
    if lbl is null or lbl not in ('A', 'B', 'C', 'D', 'E') or lbl = any (labels) then
      raise exception 'Options are labelled A, B, C, D and E, each once' using errcode = 'P0001';
    end if;
    labels := labels || lbl;
  end loop;
  if exists (select 1 from unnest(labels) l where l > chr(64 + n)) then
    raise exception 'Options must run A, B, C ... with no gap' using errcode = 'P0001';
  end if;
  if p_correct is null or not (p_correct = any (labels)) then
    raise exception 'Mark one option as the correct answer' using errcode = 'P0001';
  end if;
  if p_figure_id is not null and not exists (select 1 from public.figure f where f.id = p_figure_id and f.topic_id = p_topic_id) then
    raise exception 'That figure belongs to another topic' using errcode = 'P0001';
  end if;

  if p_id is null then
    insert into public.question (subject_id, topic_id, lang, text, figure_id, source_page, origin, status, created_by)
    values (subj, p_topic_id, p_lang, p_text, p_figure_id, p_source_page, 'manual', 'draft', (select auth.uid()))
    returning id into qid;
  else
    qid := p_id;
    update public.question
    set subject_id = subj, topic_id = p_topic_id, lang = p_lang, text = p_text, figure_id = p_figure_id, source_page = p_source_page
    where id = qid;
    if not found then
      raise exception 'Question not found' using errcode = 'P0001';
    end if;
    update public.mcq_option set is_correct = false where question_id = qid and is_correct;
    delete from public.mcq_option where question_id = qid and not (label = any (labels));
  end if;

  for opt in select * from jsonb_array_elements(p_options) loop
    lbl := opt ->> 'label';
    insert into public.mcq_option (question_id, label, text, is_correct, explanation)
    values (qid, lbl, opt ->> 'text', lbl = p_correct, case when lbl = p_correct then nullif(btrim(p_explanation), '') end)
    on conflict (question_id, label) do update
    set text = excluded.text, is_correct = excluded.is_correct, explanation = excluded.explanation;
  end loop;

  -- Naming the column makes the approval trigger run, so an approved question is always complete.
  update public.question set status = p_status where id = qid;
  return qid;
end;
$$;
