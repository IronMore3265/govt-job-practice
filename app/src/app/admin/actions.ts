"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/action-state";
import { EXAM_DEFAULTS, parseNumber, totalSeconds } from "@/lib/exam";

// Subjects, topics and exams. These run as the signed-in admin (anon key plus session), so the row level
// security policies are a second gate behind requireAdmin().

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(form: FormData, key: string, max = 120) {
  return String(form.get(key) ?? "").trim().slice(0, max);
}

function id(form: FormData, key = "id") {
  const v = String(form.get(key) ?? "");
  return UUID.test(v) ? v : null;
}

const done = (message: string): ActionState => ({ ok: true, message });
const bad = (message: string): ActionState => ({ ok: false, message });

function refresh() {
  revalidatePath("/admin", "layout");
  revalidatePath("/");
}

// ---------------------------------------------------------------- subjects

export async function addSubject(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const name = text(form, "name", 80);
  if (!name) return bad("Enter a subject name.");

  const supabase = await createClient();
  const { data: last } = await supabase.from("subject").select("sort_order").order("sort_order", { ascending: false }).limit(1);
  const { error } = await supabase.from("subject").insert({ name, sort_order: (last?.[0]?.sort_order ?? 0) + 1 });
  if (error) return bad(error.code === "23505" ? "A subject with that name already exists." : "Could not add the subject.");
  refresh();
  return done("Subject added.");
}

export async function renameSubject(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const subjectId = id(form);
  const name = text(form, "name", 80);
  if (!subjectId || !name) return bad("Enter a subject name.");

  const supabase = await createClient();
  const { error } = await supabase.from("subject").update({ name }).eq("id", subjectId);
  if (error) return bad(error.code === "23505" ? "A subject with that name already exists." : "Could not rename the subject.");
  refresh();
  return done("Renamed.");
}

export async function deleteSubject(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const subjectId = id(form);
  if (!subjectId) return bad("Bad request.");
  const supabase = await createClient();
  const { error } = await supabase.from("subject").delete().eq("id", subjectId);
  if (error) return bad("Could not delete the subject.");
  refresh();
  return done("Subject deleted.");
}

// ---------------------------------------------------------------- topics

export async function addTopic(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const subjectId = id(form, "subject_id");
  const number = parseNumber(form.get("number"), 1, 999, { integer: true });
  const title = text(form, "title", 200);
  if (!subjectId) return bad("Pick a subject first.");
  if (number === null) return bad("Enter a topic number from 1 to 999.");
  if (!title) return bad("Enter a topic title.");

  const supabase = await createClient();
  const { error } = await supabase.from("topic").insert({ subject_id: subjectId, number, title });
  if (error) return bad(error.code === "23505" ? `Topic ${number} already exists in this subject.` : "Could not add the topic.");
  refresh();
  return done("Topic added.");
}

export async function updateTopic(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const topicId = id(form);
  const number = parseNumber(form.get("number"), 1, 999, { integer: true });
  const title = text(form, "title", 200);
  if (!topicId) return bad("Bad request.");
  if (number === null) return bad("Enter a topic number from 1 to 999.");
  if (!title) return bad("Enter a topic title.");

  const supabase = await createClient();
  const { error } = await supabase.from("topic").update({ number, title }).eq("id", topicId);
  if (error) return bad(error.code === "23505" ? `Topic ${number} already exists in this subject.` : "Could not save the topic.");
  refresh();
  return done("Saved.");
}

export async function deleteTopic(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const topicId = id(form);
  if (!topicId) return bad("Bad request.");
  const supabase = await createClient();
  const { error } = await supabase.from("topic").delete().eq("id", topicId);
  if (error) return bad("Could not delete the topic.");
  refresh();
  return done("Topic deleted.");
}

// ---------------------------------------------------------------- exams

export async function addExam(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const name = text(form, "name", 120);
  const subjectRaw = String(form.get("subject_id") ?? "");
  const subjectId = subjectRaw === "mixed" ? null : UUID.test(subjectRaw) ? subjectRaw : undefined;
  if (!name) return bad("Enter an exam name.");
  if (subjectId === undefined) return bad("Pick a subject, or Mixed.");

  const supabase = await createClient();
  const { data: last } = await supabase.from("exam").select("sort_order").order("sort_order", { ascending: false }).limit(1);
  const { data, error } = await supabase
    .from("exam")
    .insert({
      name,
      subject_id: subjectId,
      question_count: EXAM_DEFAULTS.questionCount,
      marks_per_question: EXAM_DEFAULTS.marksPerQuestion,
      negative_mark: EXAM_DEFAULTS.negativeMark,
      time_seconds: totalSeconds(EXAM_DEFAULTS.questionCount, EXAM_DEFAULTS.secondsPerQuestion),
      sort_order: (last?.[0]?.sort_order ?? 0) + 1,
    })
    .select("id")
    .single();
  if (error || !data) return bad(error?.code === "23505" ? "An exam with that name already exists." : "Could not add the exam.");
  refresh();
  return done("Exam added with the default recipe. Pick it in the list to add topics.");
}

// Saves the recipe and the exam's topics together.
export async function updateExam(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const examId = id(form);
  const name = text(form, "name", 120);
  const subjectRaw = String(form.get("subject_id") ?? "");
  const subjectId = subjectRaw === "mixed" ? null : UUID.test(subjectRaw) ? subjectRaw : undefined;
  const questionCount = parseNumber(form.get("question_count"), 1, 200, { integer: true });
  const marks = parseNumber(form.get("marks_per_question"), 0.01, 100);
  const negative = parseNumber(form.get("negative_mark"), 0, 100);
  const perQuestion = parseNumber(form.get("seconds_per_question"), 1, 3600);

  if (!examId || !name) return bad("Enter an exam name.");
  if (subjectId === undefined) return bad("Pick a subject, or Mixed.");
  if (questionCount === null) return bad("Questions per set must be a whole number from 1 to 200.");
  if (marks === null) return bad("Marks per question must be a number above 0.");
  if (negative === null) return bad("Negative mark must be 0 or more.");
  if (perQuestion === null) return bad("Seconds per question must be from 1 to 3600.");

  const supabase = await createClient();
  const { error: examError } = await supabase
    .from("exam")
    .update({
      name,
      subject_id: subjectId,
      question_count: questionCount,
      marks_per_question: marks,
      negative_mark: negative,
      time_seconds: totalSeconds(questionCount, perQuestion),
    })
    .eq("id", examId);
  if (examError) return bad(examError.code === "23505" ? "Another exam has that name." : "Could not save the exam.");

  // A subject exam may only use that subject's topics. A mixed exam may use any.
  let topicQuery = supabase.from("topic").select("id");
  if (subjectId) topicQuery = topicQuery.eq("subject_id", subjectId);
  const { data: allowedRows } = await topicQuery;
  const allowed = new Set((allowedRows ?? []).map((t) => t.id));
  const wanted = new Set(form.getAll("topics").map(String).filter((t) => allowed.has(t)));

  const { data: current } = await supabase.from("exam_topic").select("topic_id").eq("exam_id", examId);
  const have = new Set((current ?? []).map((c) => c.topic_id));
  const remove = [...have].filter((t) => !wanted.has(t));
  const add = [...wanted].filter((t) => !have.has(t));

  if (remove.length) {
    const { error } = await supabase.from("exam_topic").delete().eq("exam_id", examId).in("topic_id", remove);
    if (error) return bad("Saved, but could not unlink some topics.");
  }
  if (add.length) {
    const { error } = await supabase.from("exam_topic").insert(add.map((topic_id) => ({ exam_id: examId, topic_id })));
    if (error) return bad("Saved, but could not link some topics.");
  }

  refresh();
  return done("Saved.");
}

export async function deleteExam(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const examId = id(form);
  if (!examId) return bad("Bad request.");
  const supabase = await createClient();
  const { error } = await supabase.from("exam").delete().eq("id", examId);
  if (error) return bad("Could not delete the exam.");
  refresh();
  return done("Exam deleted.");
}
