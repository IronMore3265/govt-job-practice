import type { Invite } from "@/lib/database.types";

export type InviteView = { id: string; code: string; status: "unused" | "used" | "expired"; expires: string };

// Plain data for the invite list, computed on the server so the client never needs the clock.
export function toInviteViews(invites: Invite[], now = Date.now()): InviteView[] {
  return invites.map((i) => ({
    id: i.id,
    code: i.code,
    status: i.used_at ? "used" : new Date(i.expires_at).getTime() <= now ? "expired" : "unused",
    expires: i.expires_at.slice(0, 10),
  }));
}

// Unused, unexpired codes per member, for the admin's student list.
export function unusedCounts(invites: Pick<Invite, "created_by" | "used_at" | "expires_at">[], now = Date.now()) {
  const counts = new Map<string, number>();
  for (const i of invites) {
    if (!i.used_at && new Date(i.expires_at).getTime() > now) counts.set(i.created_by, (counts.get(i.created_by) ?? 0) + 1);
  }
  return counts;
}
