-- Tests for public.admin_save_question (Phase 3): the atomic save used by the admin question bank.
-- Run in the Supabase SQL editor after the migrations. Everything runs in one transaction and rolls back.
-- Success: the last statement returns "ALL QUESTION TESTS PASSED".

begin;

do $$
declare
  admin_id uuid := '00000000-0000-0000-0000-0000000000e1';
  stud_id  uuid := '00000000-0000-0000-0000-0000000000e2';
  subj uuid;
  t1 uuid;
  t2 uuid;
  f1 uuid;
  f2 uuid;
  ex uuid;
  q uuid;
  q2 uuid;
  set_id uuid;
  n integer;
  s text;
  denied boolean;
  opts jsonb := '[{"label":"A","text":"one"},{"label":"B","text":"two"},{"label":"C","text":"three"},{"label":"D","text":"four"}]';
begin
  insert into auth.users (id, email) values (admin_id, 'qadmin@test.local'), (stud_id, 'qstud@test.local');
  insert into public.profile (id, name, email, role, status) values
    (admin_id, 'QAdmin', 'qadmin@test.local', 'admin', 'active'),
    (stud_id, 'QStud', 'qstud@test.local', 'student', 'active');
  select id into subj from public.subject where name = 'English';
  insert into public.topic (subject_id, number, title) values (subj, 961, 'Q topic one') returning id into t1;
  insert into public.topic (subject_id, number, title) values (subj, 962, 'Q topic two') returning id into t2;
  insert into public.figure (topic_id, page, label, blob_path) values (t1, 3, 'f1', 'english/961/qtest-f1.png') returning id into f1;
  insert into public.figure (topic_id, page, label, blob_path) values (t2, 4, 'f2', 'english/962/qtest-f2.png') returning id into f2;
  insert into public.exam (subject_id, name, question_count, time_seconds) values (subj, 'Q Test Exam', 2, 72) returning id into ex;
  insert into public.exam_topic (exam_id, topic_id) values (ex, t1);

  -- ------------------------------------------------------------ the admin
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- A new question starts as the draft that was asked for, with the key and the explanation on the correct option only.
  q := public.admin_save_question(null, t1, 'en', 'First question', f1, 5, opts, 'B', 'Because two.', 'draft');
  select count(*) into n from public.question where id = q and status = 'draft' and origin = 'manual' and created_by = admin_id and figure_id = f1 and source_page = 5 and subject_id = subj;
  assert n = 1, 'a new question is saved as a manual draft by the admin';
  select count(*) into n from public.mcq_option where question_id = q;
  assert n = 4, 'four options are written';
  select count(*) into n from public.mcq_option where question_id = q and is_correct and label = 'B' and explanation = 'Because two.';
  assert n = 1, 'B is the key and carries the explanation';
  select count(*) into n from public.mcq_option where question_id = q and not is_correct and explanation is not null;
  assert n = 0, 'wrong options carry no explanation';

  -- Approve through an edit, then move the key to C. Only one option is correct afterwards.
  perform public.admin_save_question(q, t1, 'en', 'First question', f1, 5, opts, 'B', 'Because two.', 'approved');
  select status into s from public.question where id = q;
  assert s = 'approved', 'approval through the save function works';
  perform public.admin_save_question(q, t1, 'en', 'First question (edited)', null, 6, opts, 'C', 'Because three.', 'approved');
  select count(*) into n from public.mcq_option where question_id = q and is_correct;
  assert n = 1, 'only one correct option after switching the key';
  select count(*) into n from public.mcq_option where question_id = q and label = 'C' and is_correct and explanation = 'Because three.';
  assert n = 1, 'the key moved to C with its explanation';
  select count(*) into n from public.mcq_option where question_id = q and label = 'B' and explanation is null;
  assert n = 1, 'the old key lost its explanation';
  select count(*) into n from public.question where id = q and text = 'First question (edited)' and figure_id is null and source_page = 6;
  assert n = 1, 'text, figure and page were updated';

  -- An approved question cannot lose its explanation, and the failed save leaves the old state untouched.
  denied := false;
  begin perform public.admin_save_question(q, t1, 'en', 'Changed', null, 6, opts, 'C', '   ', 'approved'); exception when sqlstate 'P0001' then denied := true; end;
  assert denied, 'approving without an explanation is refused';
  select count(*) into n from public.question where id = q and text = 'First question (edited)' and status = 'approved';
  assert n = 1, 'a refused save changes nothing';

  -- Validation.
  denied := false;
  begin perform public.admin_save_question(null, t1, 'en', 'x', f2, 1, opts, 'A', 'e', 'draft'); exception when sqlstate 'P0001' then denied := true; end;
  assert denied, 'a figure from another topic is refused';
  denied := false;
  begin perform public.admin_save_question(null, t1, 'en', 'x', null, 1, opts, 'E', 'e', 'draft'); exception when sqlstate 'P0001' then denied := true; end;
  assert denied, 'a key outside A to D is refused';
  denied := false;
  begin perform public.admin_save_question(null, t1, 'en', 'x', null, 1, '[{"label":"A","text":"a"}]', 'A', 'e', 'draft'); exception when sqlstate 'P0001' then denied := true; end;
  assert denied, 'fewer than four options is refused';
  denied := false;
  begin perform public.admin_save_question(null, gen_random_uuid(), 'en', 'x', null, 1, opts, 'A', 'e', 'draft'); exception when sqlstate 'P0001' then denied := true; end;
  assert denied, 'an unknown topic is refused';
  denied := false;
  begin perform public.admin_save_question(gen_random_uuid(), t1, 'en', 'x', null, 1, opts, 'A', 'e', 'draft'); exception when sqlstate 'P0001' then denied := true; end;
  assert denied, 'an unknown question id is refused';

  -- A question can be created directly as approved, because the options are written before the status is applied.
  q2 := public.admin_save_question(null, t1, 'bn', 'Second question', null, 7, opts, 'A', 'Because one.', 'approved');
  select count(*) into n from public.question where id = q2 and status = 'approved' and lang = 'bn';
  assert n = 1, 'a new question can be approved at once';

  -- Moving a question to draft, or to another topic, sends the live sets that use it back to draft.
  insert into public.question_set (exam_id, name, status, question_ids) values (ex, 'S1', 'live', array[q, q2]) returning id into set_id;
  perform public.admin_save_question(q2, t1, 'bn', 'Second question', null, 7, opts, 'A', 'Because one.', 'draft');
  select count(*) into n from public.question_set where id = set_id and status = 'draft';
  assert n = 1, 'saving a question as draft demotes its live set';
  perform public.admin_save_question(q2, t1, 'bn', 'Second question', null, 7, opts, 'A', 'Because one.', 'approved');
  update public.question_set set status = 'live' where id = set_id;
  perform public.admin_save_question(q2, t2, 'bn', 'Second question', null, 7, opts, 'A', 'Because one.', 'approved');
  select count(*) into n from public.question_set where id = set_id and status = 'draft';
  assert n = 1, 'moving a question to another topic demotes its live set';
  select count(*) into n from public.question where id = q2 and topic_id = t2 and subject_id = subj;
  assert n = 1, 'the question moved with its subject kept in step';

  -- Deleting a question also works for the admin and removes it from sets.
  delete from public.question where id = q;
  select count(*) into n from public.question_set where id = set_id and not (question_ids @> array[q]);
  assert n = 1, 'a deleted question leaves its set';
  reset role;

  -- ------------------------------------------------------------ a student cannot use it
  perform set_config('request.jwt.claims', json_build_object('sub', stud_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  denied := false;
  begin perform public.admin_save_question(null, t1, 'en', 'Hacked', null, 1, opts, 'A', 'e', 'draft'); exception when insufficient_privilege then denied := true; end;
  assert denied, 'a student must not save questions';
  reset role;

  -- ------------------------------------------------------------ anon has no access to the function
  set local role anon;
  denied := false;
  begin perform public.admin_save_question(null, t1, 'en', 'Hacked', null, 1, opts, 'A', 'e', 'draft'); exception when insufficient_privilege then denied := true; end;
  assert denied, 'anon must not call admin_save_question';
  reset role;

  select count(*) into n from public.question where text in ('Hacked', 'x');
  assert n = 0, 'no rejected question was kept';
end;
$$;

select 'ALL QUESTION TESTS PASSED' as result;

rollback;
