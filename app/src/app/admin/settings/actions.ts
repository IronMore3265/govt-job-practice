"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/action-state";

// Switches the leaderboard on or off for everyone. Runs as the signed-in admin, so the row level security policy
// (admin update on app_setting) is a second gate behind requireAdmin().
export async function setLeaderboard(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const on = form.get("on") === "true";
  const supabase = await createClient();
  const { error } = await supabase.from("app_setting").update({ leaderboard_on: on, updated_at: new Date().toISOString() }).eq("id", 1);
  if (error) return { ok: false, message: "Could not change the setting." };
  revalidatePath("/", "layout");
  return { ok: true, message: on ? "The leaderboard is on. Students can join it." : "The leaderboard is off for everyone." };
}

// Lets students see each other's streaks on Home, or hides them. Their own streak always shows.
export async function setStreaksPublic(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const on = form.get("on") === "true";
  const supabase = await createClient();
  const { error } = await supabase.from("app_setting").update({ streaks_public: on, updated_at: new Date().toISOString() }).eq("id", 1);
  if (error) return { ok: false, message: "Could not change the setting." };
  revalidatePath("/", "layout");
  return { ok: true, message: on ? "Students can now see each other's streaks." : "Streaks are private again." };
}
