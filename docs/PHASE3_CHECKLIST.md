# Phase 3 checklist

Phase 3 adds the **Questions** tab (bank, add, edit, approve, delete, reports) and the **Sets** tab (set builder and curated
sets) to the admin portal, plus a private route that shows a figure to approved members. Students see nothing new yet:
exam mode arrives in Phase 5.

The new database function is already applied to the project (`supabase/migrations/20261105100000_admin_save_question.sql`).
Deploy the app first (push to `main`, Vercel builds it), then work through the parts below on the live site or on
`npm run dev`. You need an exam with topics and a few questions. Use throwaway topics (or the samples from Phase 2) and
delete them at the end.

## Part A: database check

- [ ] Paste `supabase/tests/questions.sql` into the SQL Editor and run it. The result must be `ALL QUESTION TESTS PASSED`. (It rolls back.)
- [ ] Re-run `rls.sql` and `integrity.sql`. Both must still pass.

## Part B: question bank

1. Add topics (Topics tab): English topic 1 and topic 2. Import `import-tool/samples/english_sample.md` with the import tool (topic 1) so you have 4 draft questions, or add them by hand in step 3.

- [ ] **List and filters.** Questions tab shows the questions with status, topic (T1), language, page and an "imported" chip. Subject pills, topic pills, Draft/Approved and language pills, and the search box all narrow the list, and the URL changes so a filtered list can be bookmarked.
- [ ] **Counts.** The line under the title (`N approved, N draft`) and the pill counts match the Table Editor.
- [ ] **Approve one.** Press Approve on a draft. It becomes approved, and the counts move. Press To draft and it goes back.
- [ ] **Approve all drafts.** With a topic filter on, press "Approve all N drafts". It asks first, then approves them all. Delete one option's explanation in the Table Editor on one draft first: that draft must be skipped with a message saying how many could not be approved.
- [ ] **Add by hand.** Add question: pick a topic, write a question, four options, mark the correct one, add an explanation and a page. "Save draft" saves it as a draft. "Save and approve" approves it. Without an explanation or page, Save and approve refuses with a clear message, and Save draft still works.
- [ ] **Math.** Add a question with `$\frac{1}{2}$` and a literal `\$5`. The Preview shows a fraction and a dollar sign. A question with an unclosed `$` cannot be approved.
- [ ] **Bangla.** Add a Bangla question (language Bangla). The text and Preview show the conjunct letters correctly in Noto Sans Bengali.
- [ ] **Edit.** Open a question. Change the correct option, the text and the page, then Save changes. Reopen it: only one option is correct, and the explanation moved with the key. Nothing is half-saved if a save is refused.
- [ ] **Edit an approved question.** The buttons read "Save changes" and "Move to draft". Moving it to draft shows in the list.
- [ ] **Delete.** Delete from the list and from the edit page. The question disappears, and it is gone from any set.
- [ ] **Figure.** If you uploaded a figure with the import tool, choose it on a question of that topic. It shows below the select (served through `/api/figures/<id>`). A figure from another topic is not in the list. Opening `/api/figures/<id>` while signed out gives `Sign in first.`
- [ ] **Reports.** There is still no Report button for students (Phase 5), so insert one by hand in the Table Editor (`question_report`: question_id, your user_id, a note). The bell shows it, Questions > Open reports lists it with **Open question** and **Mark resolved**, and the edit page lists it under Reports.

## Part C: sets

Needs an exam linked to topics (Exams tab) and approved questions in those topics. For a real test, import or add 45 approved
questions across two topics (the sample files are too short: set the exam's questions per set to 5 on the Exams tab, which is
allowed, to try the builder with few questions).

- [ ] **Sets tab.** Pick the exam. The summary shows approved, in sets and unused counts, and how many more the last set needs.
- [ ] **Build.** Press "Build sets from unused questions". With 45 questions and 20 per set you get Set 1 and Set 2 (live) and Set 3 with 5 of 20 (draft). The message says so.
- [ ] **Spread.** Each set row shows the topic spread (for example `T1 x10 · T2 x10`). Both topics appear in every full set in roughly the same proportion as in the pool.
- [ ] **Run again, nothing new.** Press Build again. It says every approved question is already in a set.
- [ ] **Top up.** Approve 15 more questions in those topics, press Build again. Set 3 is topped up to 20 and goes live. No duplicate questions across sets.
- [ ] **Short set cannot go live.** Open a draft set that is short and press Go live. The message names the problem (needs exactly 20 approved questions).
- [ ] **Open a set.** The editor lists the questions in order, with Remove buttons. Removing one from a live set sends it to draft.
- [ ] **Add by hand.** In a short set, filter by topic, search, tick questions and press "Add ticked questions". Questions already in another set show "also in Set N". You cannot add past the exam's size.
- [ ] **Fill.** "Fill from unused questions" tops a short set up automatically.
- [ ] **Curated set.** Add a curated set (name it "Mock 1"), fill it by hand to 20, press Go live.
- [ ] **Demotion.** Send a question of a live set back to draft (list: To draft). That set returns to draft by itself. Approve the question again, then Go live works again.
- [ ] **Delete a set.** Its questions become unused again, and Build can use them.
- [ ] **Rename.** A set can be renamed. A name already used in the same exam is refused.
- [ ] **Students.** As a student, `/admin/questions` and `/admin/sets` send you back to Home.

## Choices to review

- **Atomic save.** The edit form saves through one database function, so the correct option can change without a half-saved question, and an approved question always keeps four options, one key and an explanation.
- **Approval needs more than the database does.** The form also asks for the source page and closed `$` pairs before "Save and approve", the same rules as the importer. A draft can be unfinished.
- **Explanation lives on the correct option only**, as the importer writes it.
- **Builder is additive.** It never rewrites existing sets. It tops up short draft auto sets, then cuts new sets from unused approved questions. To start over, delete sets and build again. There is no "rebuild all" because deleting a set unlinks the scores students already earned on it from that set.
- **Spreading.** Questions are shuffled inside each topic, then interleaved in proportion to each topic's size, so every full set mirrors the pool.
- **Short last set** stays a draft and the Sets tab says how many are missing. The import tool's `report` command shows the same numbers.
- **Figures** are shown through a server route that checks the caller is an approved member and redirects to a 10 minute signed link. Students will use the same route in Phase 5.
- **Not in this phase.** Uploading figures and notes from the browser (the import tool does it), reordering questions inside a set, storage usage and export.
