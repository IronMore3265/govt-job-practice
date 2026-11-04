-- Integrity tests: the rules the triggers enforce (approved questions, live sets of exactly question_count,
-- sets going back to draft when their questions change), plus the seeded subjects and exams.
-- Run in the Supabase SQL editor (or psql) after the migrations. Everything rolls back.
-- Success: the last statement returns "ALL INTEGRITY TESTS PASSED".

begin;

do $$
declare
  subj uuid;
  other_subj uuid;
  t1 uuid;
  t2 uuid;
  other_topic uuid;
  ex uuid;
  qs uuid[] := '{}';
  q uuid;
  extra uuid;
  set_id uuid;
  n integer;
  denied boolean;
begin
  -- Seeds: four subjects, one exam each with the default recipe, no topics.
  select count(*) into n from public.subject where name in ('Bangla', 'English', 'Mathematics', 'General Knowledge');
  assert n = 4, 'four launch subjects are seeded';
  select count(*) into n from public.exam e join public.subject s on s.id = e.subject_id
  where e.name = s.name || ' Model Test'
    and e.question_count = 20 and e.marks_per_question = 1 and e.negative_mark = 0.25 and e.time_seconds = 720;
  assert n = 4, 'one default exam per subject (20 questions, 1 mark, -0.25, 12 minutes)';
  select count(*) into n from public.app_setting where id = 1 and leaderboard_on = false;
  assert n = 1, 'app_setting has one row, leaderboard off';

  select id into subj from public.subject where name = 'English';
  select id into other_subj from public.subject where name = 'Bangla';
  insert into public.topic (subject_id, number, title) values (subj, 801, 'Grammar') returning id into t1;
  insert into public.topic (subject_id, number, title) values (subj, 802, 'Vocabulary') returning id into t2;
  insert into public.topic (subject_id, number, title) values (other_subj, 801, 'Bangla topic') returning id into other_topic;
  insert into public.exam (subject_id, name) values (subj, 'Integrity Exam') returning id into ex;
  insert into public.exam_topic (exam_id, topic_id) values (ex, t1), (ex, t2);
  select count(*) into n from public.exam where id = ex and question_count = 20 and time_seconds = 720 and negative_mark = 0.25;
  assert n = 1, 'a new exam gets the default recipe';

  -- A topic must belong to the question's subject.
  denied := false;
  begin insert into public.question (subject_id, topic_id, text) values (other_subj, t1, 'Mismatch'); exception when foreign_key_violation then denied := true; end;
  assert denied, 'question topic must belong to its subject';

  -- Approval needs four options, one correct, and an explanation on the correct one.
  insert into public.question (subject_id, topic_id, text) values (subj, t1, 'Needs options') returning id into q;
  denied := false;
  begin update public.question set status = 'approved' where id = q; exception when sqlstate 'P0001' then denied := true; end;
  assert denied, 'a question without options cannot be approved';
  insert into public.mcq_option (question_id, label, text, is_correct) values
    (q, 'A', 'a', false), (q, 'B', 'b', true), (q, 'C', 'c', false), (q, 'D', 'd', false);
  denied := false;
  begin update public.question set status = 'approved' where id = q; exception when sqlstate 'P0001' then denied := true; end;
  assert denied, 'the correct option needs an explanation';
  denied := false;
  begin update public.mcq_option set is_correct = true where question_id = q and label = 'A'; exception when unique_violation then denied := true; end;
  assert denied, 'only one option can be correct';
  update public.mcq_option set explanation = 'Because b.' where question_id = q and label = 'B';
  update public.question set status = 'approved' where id = q;
  qs := qs || q;

  -- 20 approved questions across the two topics.
  for i in 2..21 loop
    insert into public.question (subject_id, topic_id, text, source_page)
    values (subj, case when i % 2 = 0 then t1 else t2 end, 'Question ' || i, i) returning id into q;
    insert into public.mcq_option (question_id, label, text, is_correct, explanation)
    select q, l, 'Option ' || l, l = 'C', case when l = 'C' then 'Why C.' end from unnest(array['A', 'B', 'C', 'D']) as l;
    update public.question set status = 'approved' where id = q;
    qs := qs || q;
  end loop;
  extra := qs[21];
  qs := qs[1:20];

  -- Live sets need exactly 20 approved questions from the exam's topics, no duplicates.
  denied := false;
  begin insert into public.question_set (exam_id, name, status, question_ids) values (ex, 'Short', 'live', qs[1:19]); exception when sqlstate 'P0001' then denied := true; end;
  assert denied, 'a live set with 19 questions is refused';
  denied := false;
  begin insert into public.question_set (exam_id, name, status, question_ids) values (ex, 'Dup', 'draft', qs[1:19] || qs[1]); exception when sqlstate 'P0001' then denied := true; end;
  assert denied, 'a set cannot repeat a question';
  denied := false;
  begin insert into public.question_set (exam_id, name, question_ids) values (ex, 'Ghost', array[gen_random_uuid()]); exception when sqlstate 'P0001' then denied := true; end;
  assert denied, 'a set cannot list a question that does not exist';
  insert into public.question_set (exam_id, name, status, question_ids) values (ex, 'Short draft', 'draft', qs[1:14]);
  insert into public.question_set (exam_id, name, status, question_ids) values (ex, 'Set 1', 'live', qs) returning id into set_id;

  -- A question going back to draft sends the set back to draft.
  update public.question set status = 'draft' where id = qs[5];
  select count(*) into n from public.question_set where id = set_id and status = 'draft';
  assert n = 1, 'a question back to draft demotes its live set';
  denied := false;
  begin update public.question_set set status = 'live' where id = set_id; exception when sqlstate 'P0001' then denied := true; end;
  assert denied, 'a set with a draft question cannot go live';
  update public.question set status = 'approved' where id = qs[5];
  update public.question_set set status = 'live' where id = set_id;

  -- Deleting a question removes it from the set and demotes the set.
  delete from public.question where id = qs[7];
  select count(*) into n from public.question_set where id = set_id and status = 'draft' and cardinality(question_ids) = 19 and not (question_ids @> array[qs[7]]);
  assert n = 1, 'a deleted question leaves its set as a 19 question draft';
  update public.question_set set question_ids = question_ids || extra, status = 'live' where id = set_id;

  -- Changing the exam's question count demotes its live sets.
  update public.exam set question_count = 25, time_seconds = 900 where id = ex;
  select count(*) into n from public.question_set where id = set_id and status = 'draft';
  assert n = 1, 'a new question count demotes live sets';
  update public.exam set question_count = 20, time_seconds = 720 where id = ex;
  update public.question_set set status = 'live' where id = set_id;

  -- Unlinking a topic from the exam demotes sets that use it, and the set can still be saved as a draft.
  delete from public.exam_topic where exam_id = ex and topic_id = t2;
  select count(*) into n from public.question_set where id = set_id and status = 'draft';
  assert n = 1, 'unlinking a topic demotes live sets that use it';
  denied := false;
  begin update public.question_set set status = 'live' where id = set_id; exception when sqlstate 'P0001' then denied := true; end;
  assert denied, 'a set with questions outside the exam topics cannot go live';
end;
$$;

select 'ALL INTEGRITY TESTS PASSED' as result;

rollback;
