"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionState } from "@/lib/action-state";
import { parseNumber } from "@/lib/exam";

// Student management (copied from the MSc site). Profile rows cannot be edited from the browser at all
// (no update grant), so these actions use the service role, and only after requireAdmin() has passed.

const done = (message: string): ActionState => ({ ok: true, message });
const bad = (message: string): ActionState => ({ ok: false, message });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function targetId(form: FormData) {
  const id = String(form.get("id") ?? "");
  return UUID.test(id) ? id : null;
}

function refresh() {
  revalidatePath("/admin", "layout");
}

// Approve a pending account, switch an account off, or back on.
export async function setStudentStatus(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { profile: admin } = await requireAdmin();
  const id = targetId(form);
  const to = String(form.get("to") ?? "");
  if (!id || (to !== "active" && to !== "disabled")) return bad("Bad request.");
  if (id === admin.id) return bad("You cannot change your own account.");

  const db = createAdminClient();
  const { data: current } = await db.from("profile").select("approved_at").eq("id", id).maybeSingle();
  if (!current) return bad("That account no longer exists.");
  const update =
    to === "active"
      ? { status: "active" as const, approved_by: admin.id, approved_at: current.approved_at ?? new Date().toISOString() }
      : { status: "disabled" as const };
  const { data, error } = await db.from("profile").update(update).eq("id", id).select("name").maybeSingle();
  if (error || !data) return bad("Could not update that account.");

  refresh();
  return done(to === "active" ? `${data.name} is active.` : `${data.name} is switched off.`);
}

export async function setInviteLimit(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = targetId(form);
  const limit = parseNumber(form.get("invite_limit"), 0, 100, { integer: true });
  if (!id) return bad("Bad request.");
  if (limit === null) return bad("The invite limit must be a whole number from 0 to 100.");

  const db = createAdminClient();
  const { error } = await db.from("profile").update({ invite_limit: limit }).eq("id", id);
  if (error) return bad("Could not save the limit.");

  refresh();
  return done("Limit saved.");
}

// No email service in v1, so the admin sets a new password and passes it on.
export async function resetStudentPassword(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { profile: admin } = await requireAdmin();
  const id = targetId(form);
  const password = String(form.get("password") ?? "");
  if (!id) return bad("Bad request.");
  if (id === admin.id) return bad("Change your own password in the Supabase dashboard.");
  if (password.length < 8 || password.length > 72) return bad("The password must be 8 to 72 characters.");

  const db = createAdminClient();
  const { error } = await db.auth.admin.updateUserById(id, { password });
  if (error) return bad(error.code === "weak_password" ? error.message : "Could not reset the password.");
  return done("Password changed. Tell the student the new password.");
}
