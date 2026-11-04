"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/action-state";
import { fetchAll } from "@/lib/paging";
import { dbMessage, isUuid } from "@/lib/questions";
import { nextSetNumber, planSets, type PoolQuestion } from "@/lib/sets";

// Set builder actions. They run as the signed-in admin, so row level security is a second gate behind requireAdmin().
// The database enforces the set rules: a live set has exactly the exam's question count, all approved and all from the
// exam's topics, and a set goes back to draft by itself when a question changes (see supabase/migrations).

const done = (message: string): ActionState => ({ ok: true, message });
const bad = (message: string): ActionState => ({ ok: false, message });

function refresh() {
  revalidatePath("/admin/sets", "layout");
  revalidatePath("/admin/questions", "layout");
  revalidatePath("/", "layout");
}

type Db = Awaited<ReturnType<typeof createClient>>;

// The exam's size, its topics, its sets, and the approved questions its topics hold.
async function loadExam(supabase: Db, examId: string) {
  const { data: exam } = await supabase.from("exam").select("id, name, question_count, exam_topic(topic_id)").eq("id", examId).maybeSingle();
  if (!exam) return null;
  const topicIds = exam.exam_topic.map((t) => t.topic_id);
  const { data: sets } = await supabase
    .from("question_set")
    .select("id, name, origin, status, question_ids, created_at")
    .eq("exam_id", examId)
    .order("created_at", { ascending: true });
  const pool: PoolQuestion[] = topicIds.length
    ? await fetchAll<PoolQuestion>((from, to) =>
        supabase.from("question").select("id, topic_id").eq("status", "approved").in("topic_id", topicIds).order("id").range(from, to),
      )
    : [];
  return { exam, topicIds, sets: sets ?? [], pool };
}

// Writes a set's question list and status. A set that is meant to go live but is refused (for example a question in it
// is no longer approved) is saved as a draft instead, and the reason is returned.
async function saveSet(supabase: Db, id: string, ids: string[], wantLive: boolean): Promise<{ live: boolean; why?: string }> {
  if (wantLive) {
    const { error } = await supabase.from("question_set").update({ question_ids: ids, status: "live" }).eq("id", id);
    if (!error) return { live: true };
    const { error: e2 } = await supabase.from("question_set").update({ question_ids: ids, status: "draft" }).eq("id", id);
    if (e2) throw new Error(dbMessage(e2, "Could not save the set."));
    return { live: false, why: dbMessage(error, "") };
  }
  const { error } = await supabase.from("question_set").update({ question_ids: ids, status: "draft" }).eq("id", id);
  if (error) throw new Error(dbMessage(error, "Could not save the set."));
  return { live: false };
}

// Build or update an exam's sets from the approved questions that no set of the exam uses yet. Short draft sets are
// topped up first, then new sets of the exam's size are cut, with every topic spread through each one. A full set goes
// live, the last short one stays a draft until its missing questions are imported.
export async function buildSets(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { profile } = await requireAdmin();
  const examId = String(form.get("exam_id") ?? "");
  if (!isUuid(examId)) return bad("Bad request.");

  const supabase = await createClient();
  const data = await loadExam(supabase, examId);
  if (!data) return bad("Exam not found.");
  const { exam, topicIds, sets, pool } = data;
  const size = exam.question_count;
  if (!topicIds.length) return bad("This exam has no topics yet. Add some on the Exams tab first.");

  const used = new Set(sets.flatMap((s) => s.question_ids));
  const unused = pool.filter((q) => !used.has(q.id));
  if (!unused.length) return done("Nothing to do: every approved question is already in a set.");

  const shortSets = sets.filter((s) => s.status === "draft" && s.origin === "auto" && s.question_ids.length < size);
  const plan = planSets({ size, pool: unused, shortSets: shortSets.map((s) => ({ id: s.id, question_ids: s.question_ids })) });

  let live = 0;
  let toppedUp = 0;
  const notes: string[] = [];
  try {
    for (const t of plan.topUps) {
      const set = shortSets.find((s) => s.id === t.setId)!;
      const r = await saveSet(supabase, t.setId, [...set.question_ids, ...t.add], t.full);
      toppedUp++;
      if (r.live) live++;
      else if (t.full && r.why) notes.push(`${set.name} is full but stayed a draft: ${r.why}`);
    }
    let n = nextSetNumber(sets.map((s) => s.name));
    for (const s of plan.newSets) {
      const name = `Set ${n++}`;
      const { data: created, error } = await supabase
        .from("question_set")
        .insert({ exam_id: examId, name, origin: "auto", status: "draft", question_ids: s.question_ids, created_by: profile.id })
        .select("id")
        .single();
      if (error || !created) throw new Error(dbMessage(error, `Could not create ${name}.`));
      if (s.full) {
        const r = await saveSet(supabase, created.id, s.question_ids, true);
        if (r.live) live++;
        else if (r.why) notes.push(`${name} stayed a draft: ${r.why}`);
      }
    }
  } catch (e) {
    refresh();
    return bad(e instanceof Error ? e.message : "Could not build the sets.");
  }

  refresh();
  const last = plan.newSets.at(-1);
  const parts = [`${plan.newSets.length} new set${plan.newSets.length === 1 ? "" : "s"}`, `${toppedUp} topped up`, `${live} now live`];
  if (last && !last.full) parts.push(`the last set has ${last.question_ids.length} of ${size}, so it stays a draft`);
  return notes.length ? bad(`${parts.join(", ")}. ${notes.join(" ")}`) : done(`${parts.join(", ")}.`);
}

// Top up one set from the unused approved questions of its exam, spread across topics.
export async function fillSet(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const setId = String(form.get("id") ?? "");
  if (!isUuid(setId)) return bad("Bad request.");

  const supabase = await createClient();
  const { data: set } = await supabase.from("question_set").select("id, exam_id, name, question_ids").eq("id", setId).maybeSingle();
  if (!set) return bad("Set not found.");
  const data = await loadExam(supabase, set.exam_id);
  if (!data) return bad("Exam not found.");
  const size = data.exam.question_count;
  if (set.question_ids.length >= size) return done("The set already has all its questions.");

  const used = new Set(data.sets.flatMap((s) => s.question_ids));
  const plan = planSets({ size, pool: data.pool.filter((q) => !used.has(q.id)), shortSets: [{ id: set.id, question_ids: set.question_ids }] });
  const t = plan.topUps[0];
  if (!t) return bad("There are no unused approved questions left for this exam.");

  try {
    await saveSet(supabase, set.id, [...set.question_ids, ...t.add], false);
  } catch (e) {
    return bad(e instanceof Error ? e.message : "Could not fill the set.");
  }
  refresh();
  const total = set.question_ids.length + t.add.length;
  return done(total >= size ? `Added ${t.add.length}. The set is full. Press Go live when you are ready.` : `Added ${t.add.length}. ${size - total} more needed.`);
}

export async function addCuratedSet(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { profile } = await requireAdmin();
  const examId = String(form.get("exam_id") ?? "");
  const name = String(form.get("name") ?? "").trim().slice(0, 60);
  if (!isUuid(examId)) return bad("Bad request.");
  if (!name) return bad("Give the set a name.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("question_set")
    .insert({ exam_id: examId, name, origin: "curated", status: "draft", question_ids: [], created_by: profile.id })
    .select("id")
    .single();
  if (error || !data) return bad(error?.code === "23505" ? "This exam already has a set with that name." : dbMessage(error, "Could not add the set."));
  refresh();
  redirect(`/admin/sets/${data.id}`);
}

export async function renameSet(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = String(form.get("id") ?? "");
  const name = String(form.get("name") ?? "").trim().slice(0, 60);
  if (!isUuid(id)) return bad("Bad request.");
  if (!name) return bad("Give the set a name.");
  const supabase = await createClient();
  const { error } = await supabase.from("question_set").update({ name }).eq("id", id);
  if (error) return bad(error.code === "23505" ? "Another set of this exam has that name." : dbMessage(error, "Could not rename the set."));
  refresh();
  return done("Renamed.");
}

// Go live or back to draft. The database refuses a live set that is not exactly full of approved questions from the
// exam's topics, and its message says what is wrong.
export async function setSetStatus(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = String(form.get("id") ?? "");
  const status = form.get("status") === "live" ? "live" : "draft";
  if (!isUuid(id)) return bad("Bad request.");
  const supabase = await createClient();
  const { error } = await supabase.from("question_set").update({ status }).eq("id", id);
  if (error) return bad(dbMessage(error, "Could not change the set."));
  refresh();
  return done(status === "live" ? "The set is live." : "The set is a draft.");
}

export async function deleteSet(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = String(form.get("id") ?? "");
  if (!isUuid(id)) return bad("Bad request.");
  const supabase = await createClient();
  const { data: set } = await supabase.from("question_set").select("exam_id").eq("id", id).maybeSingle();
  const { error } = await supabase.from("question_set").delete().eq("id", id);
  if (error) return bad(dbMessage(error, "Could not delete the set."));
  refresh();
  if (form.get("then") === "list") redirect(set ? `/admin/sets?exam=${set.exam_id}` : "/admin/sets");
  return done("Set deleted. Its questions are free to use again.");
}

// Removing a question from a live set sends it back to draft, since it no longer has all its questions.
export async function removeFromSet(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = String(form.get("id") ?? "");
  const questionId = String(form.get("question_id") ?? "");
  if (!isUuid(id) || !isUuid(questionId)) return bad("Bad request.");
  const supabase = await createClient();
  const { data: set } = await supabase.from("question_set").select("question_ids").eq("id", id).maybeSingle();
  if (!set) return bad("Set not found.");
  const { error } = await supabase
    .from("question_set")
    .update({ question_ids: set.question_ids.filter((q) => q !== questionId), status: "draft" })
    .eq("id", id);
  if (error) return bad(dbMessage(error, "Could not remove the question."));
  refresh();
  return done("Removed. The set is a draft until it is full again.");
}

// Add the ticked questions to a set, up to the exam's size. Only approved questions from the exam's topics are accepted.
export async function addToSet(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = String(form.get("id") ?? "");
  const wanted = [...new Set(form.getAll("q").map(String).filter(isUuid))];
  if (!isUuid(id)) return bad("Bad request.");
  if (!wanted.length) return bad("Tick the questions to add.");

  const supabase = await createClient();
  const { data: set } = await supabase.from("question_set").select("id, exam_id, question_ids").eq("id", id).maybeSingle();
  if (!set) return bad("Set not found.");
  const data = await loadExam(supabase, set.exam_id);
  if (!data) return bad("Exam not found.");

  const allowed = new Set(data.pool.map((q) => q.id));
  const inSet = new Set(set.question_ids);
  const fresh = wanted.filter((q) => allowed.has(q) && !inSet.has(q));
  if (!fresh.length) return bad("Those questions are not approved questions of this exam's topics, or are already in the set.");
  const room = data.exam.question_count - set.question_ids.length;
  if (room <= 0) return bad(`The set already has ${data.exam.question_count} questions.`);
  const add = fresh.slice(0, room);

  const { error } = await supabase.from("question_set").update({ question_ids: [...set.question_ids, ...add], status: "draft" }).eq("id", id);
  if (error) return bad(dbMessage(error, "Could not add the questions."));
  refresh();
  const skipped = fresh.length - add.length;
  return done(`Added ${add.length}.${skipped ? ` ${skipped} left out because the set is full.` : ""}`);
}
