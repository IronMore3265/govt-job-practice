"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/action-state";
import { dbMessage, escapeLike, isUuid, parseFilters, parseQuestionForm } from "@/lib/questions";

// Question bank actions. They run as the signed-in admin (anon key plus session), so row level security is a second gate
// behind requireAdmin(). Rule checks (four options, one key, an explanation before approval, live sets going back to
// draft) live in the database, and its plain messages are shown as they are.

const done = (message: string): ActionState => ({ ok: true, message });
const bad = (message: string): ActionState => ({ ok: false, message });

function refresh() {
  revalidatePath("/admin", "layout");
  revalidatePath("/admin/questions", "layout");
  revalidatePath("/admin/sets", "layout");
}

// The save button decides the status: "approve" publishes, "draft" keeps it (or moves it back) as a draft.
export async function saveQuestion(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = parseQuestionForm(form, form.get("intent") === "approve" ? "approve" : "draft");
  if (!parsed.ok) return bad(parsed.message);
  const v = parsed.value;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_save_question", {
    p_id: v.id,
    p_topic_id: v.topic_id,
    p_lang: v.lang,
    p_text: v.text,
    p_figure_id: v.figure_id,
    p_source_page: v.source_page,
    p_options: v.options,
    p_correct: v.correct,
    p_explanation: v.explanation,
    p_status: v.status,
  });
  if (error || !data) return bad(dbMessage(error, "Could not save the question."));

  refresh();
  if (!v.id) redirect(`/admin/questions/${data}?created=1`);
  return done(v.status === "approved" ? "Saved. The question is approved." : "Saved as a draft.");
}

// Approve a draft, or send an approved question back to draft (its live sets go back to draft too).
export async function setQuestionStatus(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = String(form.get("id") ?? "");
  const status = form.get("status") === "approved" ? "approved" : "draft";
  if (!isUuid(id)) return bad("Bad request.");

  const supabase = await createClient();
  const { error } = await supabase.from("question").update({ status }).eq("id", id);
  if (error) return bad(dbMessage(error, "Could not change the status."));
  refresh();
  return done(status === "approved" ? "Approved." : "Moved to draft.");
}

export async function deleteQuestion(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = String(form.get("id") ?? "");
  if (!isUuid(id)) return bad("Bad request.");

  const supabase = await createClient();
  const { error } = await supabase.from("question").delete().eq("id", id);
  if (error) return bad(dbMessage(error, "Could not delete the question."));
  refresh();
  if (form.get("then") === "list") redirect("/admin/questions");
  return done("Deleted.");
}

// Approve every draft that matches the list filters. Each question is checked on its own by the database, so one
// incomplete draft does not stop the others.
export async function approveDrafts(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const f = parseFilters({ subject: String(form.get("subject") ?? ""), topic: String(form.get("topic") ?? ""), lang: String(form.get("lang") ?? ""), q: String(form.get("q") ?? "") });

  const supabase = await createClient();
  let query = supabase.from("question").select("id").eq("status", "draft").limit(500);
  if (f.subject) query = query.eq("subject_id", f.subject);
  if (f.topic) query = query.eq("topic_id", f.topic);
  if (f.lang !== "all") query = query.eq("lang", f.lang);
  if (f.q) query = query.ilike("text", `%${escapeLike(f.q)}%`);
  const { data: drafts, error } = await query;
  if (error) return bad("Could not read the drafts.");
  if (!drafts?.length) return done("No drafts to approve.");

  let approved = 0;
  for (const { id } of drafts) {
    const { error: e } = await supabase.from("question").update({ status: "approved" }).eq("id", id);
    if (!e) approved++;
  }
  refresh();
  const left = drafts.length - approved;
  return left === 0
    ? done(`Approved ${approved}.`)
    : bad(`Approved ${approved}. ${left} could not be approved because they are missing options or an explanation. Open the drafts to fix them.`);
}

// Runs as the signed-in admin. A trigger marks the report's notification read.
export async function resolveReport(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { profile } = await requireAdmin();
  const id = String(form.get("id") ?? "");
  if (!isUuid(id)) return bad("Bad request.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("question_report")
    .update({ status: "resolved", resolved_at: new Date().toISOString(), resolved_by: profile.id })
    .eq("id", id);
  if (error) return bad("Could not resolve the report.");

  revalidatePath("/admin", "layout");
  return done("Resolved.");
}
