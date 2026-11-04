-- Phase 3: save a question and its four options in one transaction, from the admin portal.
--
-- Why a function: switching which option is correct needs the old key cleared before the new one is set (only one
-- correct option per question is allowed), and a question with approved status must keep four options, one key and an
-- explanation. Doing it as separate browser calls could leave a half-saved question. This function runs as the caller
-- (security invoker), so the admin-only RLS policies still apply, and it checks the role again up front.
--
-- Rules:
--   * a new question is inserted as a draft, its options are written, and only then is the final status applied, so
--     the approval trigger (check_question_ready) always sees complete options;
--   * the explanation is stored on the correct option only, as the importer does;
--   * a figure must belong to the same topic as the question;
--   * moving a question to another topic, or to draft, sends the live sets that use it back to draft (existing triggers).

create function public.admin_save_question(
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
begin
  if not (select private.is_admin()) then
    raise exception 'Only the admin can save questions' using errcode = '42501';
  end if;

  select subject_id into subj from public.topic where id = p_topic_id;
  if subj is null then
    raise exception 'Pick a topic for the question' using errcode = 'P0001';
  end if;
  if p_correct is null or p_correct not in ('A', 'B', 'C', 'D') then
    raise exception 'Mark one option as the correct answer' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_options) <> 'array' or jsonb_array_length(p_options) <> 4 then
    raise exception 'A question needs exactly four options' using errcode = 'P0001';
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
  end if;

  for opt in select * from jsonb_array_elements(p_options) loop
    lbl := opt ->> 'label';
    if lbl is null or lbl not in ('A', 'B', 'C', 'D') then
      raise exception 'Options are labelled A, B, C and D' using errcode = 'P0001';
    end if;
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

revoke execute on function public.admin_save_question(uuid, uuid, public.question_lang, text, uuid, integer, jsonb, text, text, public.question_status) from public, anon;
grant execute on function public.admin_save_question(uuid, uuid, public.question_lang, text, uuid, integer, jsonb, text, text, public.question_status) to authenticated;
