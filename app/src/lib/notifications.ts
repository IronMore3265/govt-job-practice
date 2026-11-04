import "server-only";
import { createClient } from "@/lib/supabase/server";

export type NotificationView = {
  id: string;
  kind: "new_signup" | "question_report";
  unread: boolean;
  title: string; // "New signup" or "Question reported"
  detail: string; // "Rafi Ahmed, invited by Tania"
  when: string; // formatted on the server in Dhaka time
  href: string;
};

const dhakaTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Dhaka",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function clip(text: string, max: number) {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 3)}...` : flat;
}

// The signed-in user's notifications for the bell, newest first, plus the unread count.
// Row level security returns only the caller's own rows. Today only admins receive any (triggers on profile and
// question_report write them), and an admin can read the profiles and reports they point to.
export async function loadNotifications(limit = 20): Promise<{ items: NotificationView[]; unread: number }> {
  const supabase = await createClient();
  const [{ data: rows }, { count }] = await Promise.all([
    supabase.from("notification").select("*").order("created_at", { ascending: false }).limit(limit),
    supabase.from("notification").select("id", { count: "exact", head: true }).is("read_at", null),
  ]);
  if (!rows?.length) return { items: [], unread: count ?? 0 };

  const reportIds = rows.flatMap((r) => (r.ref_report_id ? [r.ref_report_id] : []));
  const { data: reports } = reportIds.length
    ? await supabase.from("question_report").select("id, note, user_id, question(text)").in("id", reportIds)
    : { data: [] };

  const profileIds = new Set<string>();
  for (const r of rows) if (r.ref_profile_id) profileIds.add(r.ref_profile_id);
  for (const r of reports ?? []) profileIds.add(r.user_id);
  const { data: people } = profileIds.size
    ? await supabase.from("profile").select("id, name, invited_by").in("id", [...profileIds])
    : { data: [] };

  // Inviters may not be in the first lookup.
  const inviterIds = (people ?? []).flatMap((p) => (p.invited_by && !profileIds.has(p.invited_by) ? [p.invited_by] : []));
  const { data: inviters } = inviterIds.length
    ? await supabase.from("profile").select("id, name, invited_by").in("id", inviterIds)
    : { data: [] };

  const names = new Map([...(people ?? []), ...(inviters ?? [])].map((p) => [p.id, p]));
  const reportById = new Map((reports ?? []).map((r) => [r.id, r]));

  const items: NotificationView[] = rows.map((n) => {
    const base = { id: n.id, kind: n.kind, unread: n.read_at === null, when: dhakaTime.format(new Date(n.created_at)) };
    if (n.kind === "new_signup") {
      const person = n.ref_profile_id ? names.get(n.ref_profile_id) : undefined;
      const inviter = person?.invited_by ? names.get(person.invited_by)?.name : undefined;
      return {
        ...base,
        title: "New signup",
        detail: person ? `${person.name}${inviter ? `, invited by ${inviter}` : ""}` : "An account that was removed",
        href: "/admin/students#pending",
      };
    }
    const report = n.ref_report_id ? reportById.get(n.ref_report_id) : undefined;
    const by = report ? names.get(report.user_id)?.name ?? "a member" : "a member";
    return {
      ...base,
      title: "Question reported",
      detail: report ? `"${clip(report.question?.text ?? "", 60)}" by ${by}: ${clip(report.note, 80)}` : "A report that was removed",
      href: "/admin/questions#reports",
    };
  });

  return { items, unread: count ?? 0 };
}
