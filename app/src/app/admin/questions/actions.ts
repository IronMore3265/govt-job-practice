"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/action-state";

// Runs as the signed-in admin. A trigger marks the report's notification read.
export async function resolveReport(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { profile } = await requireAdmin();
  const id = String(form.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, message: "Bad request." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("question_report")
    .update({ status: "resolved", resolved_at: new Date().toISOString(), resolved_by: profile.id })
    .eq("id", id);
  if (error) return { ok: false, message: "Could not resolve the report." };

  revalidatePath("/admin", "layout");
  return { ok: true, message: "Resolved." };
}
