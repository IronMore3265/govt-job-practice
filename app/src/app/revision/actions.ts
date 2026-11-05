"use server";

import { revalidatePath } from "next/cache";
import { requireActive } from "@/lib/auth";
import { isUuid } from "@/lib/questions";
import { createClient } from "@/lib/supabase/server";

// "Mark done" on the revision list: the question leaves the list (until it is answered wrong again in a later exam).
// The database function only records questions the caller got wrong, so a forged id does nothing.
export async function markRevised(questionIds: string[]): Promise<boolean> {
  await requireActive();
  const ids = (Array.isArray(questionIds) ? questionIds : []).filter(isUuid).slice(0, 500);
  if (ids.length === 0) return false;
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_revised", { p_question_ids: ids });
  if (error) return false;
  revalidatePath("/revision");
  return true;
}
