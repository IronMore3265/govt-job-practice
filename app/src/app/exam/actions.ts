"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActive } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/action-state";
import { dbMessage, isUuid } from "@/lib/questions";

// Exam actions. Every rule lives in the database functions (supabase/migrations/20261105110000_exam_mode.sql): which
// questions a session holds, when the clock runs out, that the answer key stays hidden until submit. These actions only
// carry the caller's own session to them, so a forged request can do no more than the functions allow.

const done = (message: string): ActionState => ({ ok: true, message });
const bad = (message: string): ActionState => ({ ok: false, message });

// Creates a session (a live set, a new random set, or a retry of missed questions) and opens its briefing.
export async function startExam(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireActive();
  const examId = String(form.get("exam_id") ?? "");
  const setRaw = String(form.get("set_id") ?? "");
  const retryRaw = String(form.get("retry_of") ?? "");
  const topics = String(form.get("topic_ids") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(isUuid);
  if (!isUuid(examId)) return bad("Pick an exam first.");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_session", {
    p_exam_id: examId,
    p_set_id: isUuid(setRaw) ? setRaw : null,
    p_topic_ids: topics,
    p_retry_of: isUuid(retryRaw) ? retryRaw : null,
  });
  if (error || !data) return bad(dbMessage(error, "Could not start the exam."));
  redirect(`/exam/${data}`);
}

// Starts the clock (the Begin button on the briefing).
export async function beginExam(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireActive();
  const id = String(form.get("session_id") ?? "");
  if (!isUuid(id)) return bad("Bad request.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("begin_session", { p_session_id: id });
  if (error) return bad(dbMessage(error, "Could not begin the exam."));
  redirect(`/exam/${id}`);
}

export type SaveResult = "ok" | "finished" | "expired" | "error";

// Saves one answer. Called as the student taps an option, so it stays small. "expired" means time ran out and the
// session was submitted by the server.
export async function saveAnswer(sessionId: string, questionId: string, optionId: string | null, marked: boolean, seconds: number): Promise<SaveResult> {
  if (!isUuid(sessionId) || !isUuid(questionId) || (optionId !== null && !isUuid(optionId))) return "error";
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_answer", {
    p_session_id: sessionId,
    p_question_id: questionId,
    p_option_id: optionId,
    p_marked: Boolean(marked),
    p_seconds: Math.max(0, Math.min(86400, Math.round(Number(seconds) || 0))),
  });
  if (error) return "error";
  return data === "finished" || data === "expired" ? data : "ok";
}

// Submit, or the timer ran out. Returns false only when the database refused (for example a session that is not yours).
export async function finishExam(sessionId: string, timedOut: boolean): Promise<boolean> {
  if (!isUuid(sessionId)) return false;
  const supabase = await createClient();
  const { error } = await supabase.rpc("finish_session", { p_session_id: sessionId, p_timed_out: Boolean(timedOut) });
  revalidatePath("/", "layout");
  return !error;
}

// "Report question": a short note on a question the student thinks is wrong. A trigger puts it in the admin's bell.
export async function reportQuestion(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { profile } = await requireActive();
  const questionId = String(form.get("question_id") ?? "");
  const note = String(form.get("note") ?? "").trim().slice(0, 500);
  if (!isUuid(questionId)) return bad("Bad request.");
  if (!note) return bad("Say what looks wrong.");

  const supabase = await createClient();
  const { error } = await supabase.from("question_report").insert({ question_id: questionId, user_id: profile.id, note });
  if (error) {
    if (error.code === "23505") return done("You already reported this question. The admin will look at it.");
    return bad("Could not send the report.");
  }
  return done("Thank you. The admin has been told.");
}

// ---------------------------------------------------------------- leaderboard (Home side column)

export type LeaderRow = { rank: number; name: string; sessions: number; avg: number; me: boolean };
export type LeaderState = { on: boolean; joined: boolean; top: LeaderRow[]; me: LeaderRow | null };

export async function getLeaderboard(examId: string): Promise<LeaderState | null> {
  if (!isUuid(examId)) return null;
  await requireActive();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("leaderboard", { p_exam_id: examId });
  if (error || !data) return null;
  return data as unknown as LeaderState;
}

export async function setLeaderboardMembership(join: boolean): Promise<boolean> {
  await requireActive();
  const supabase = await createClient();
  const { error } = join ? await supabase.rpc("join_leaderboard") : await supabase.rpc("leave_leaderboard");
  return !error;
}
