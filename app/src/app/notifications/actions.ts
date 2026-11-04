"use server";

import { revalidatePath } from "next/cache";
import { requireActive } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// The bell panel. Row level security limits both to the caller's own rows, and only read_at may change.

export async function markNotificationRead(id: string) {
  await requireActive();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  const supabase = await createClient();
  await supabase.from("notification").update({ read_at: new Date().toISOString() }).eq("id", id).is("read_at", null);
  revalidatePath("/", "layout");
}

export async function markAllNotificationsRead() {
  const { profile } = await requireActive();
  const supabase = await createClient();
  await supabase.from("notification").update({ read_at: new Date().toISOString() }).eq("user_id", profile.id).is("read_at", null);
  revalidatePath("/", "layout");
}
