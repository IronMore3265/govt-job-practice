import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { fetchAll } from "@/lib/paging";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/database.types";

type TableName = keyof Database["public"]["Tables"];

// The tables in each download. Content is what the site is made of, People holds accounts, Activity holds what students did.
const GROUPS: Record<string, TableName[]> = {
  content: ["subject", "topic", "figure", "exam", "exam_topic", "question", "mcq_option", "question_set", "app_setting"],
  people: ["profile", "invite", "note_progress"],
  activity: ["session_run", "attempt", "question_report", "notification"],
};

// Primary key columns for paging. Every other table has a single `id`.
const KEYS: Partial<Record<TableName, string[]>> = { exam_topic: ["exam_id", "topic_id"], note_progress: ["user_id", "topic_id"] };

// Admin only. Streams one JSON file with every row of the group's tables, so a large export is not limited by the size of
// a single response. The service role reads the rows, after the caller has been checked as the admin.
export async function GET(_request: Request, ctx: RouteContext<"/api/admin/export/[group]">) {
  const { group } = await ctx.params;
  const tables = GROUPS[group];
  if (!tables) return NextResponse.json({ error: "Unknown export." }, { status: 404 });

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (session.profile?.role !== "admin" || session.profile.status !== "active") return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const db = createAdminClient();
  const encoder = new TextEncoder();
  const stamp = new Date().toISOString().slice(0, 10);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (text: string) => controller.enqueue(encoder.encode(text));
      try {
        write(`{"exported_at":${JSON.stringify(new Date().toISOString())},"group":${JSON.stringify(group)},"tables":{`);
        for (const [i, table] of tables.entries()) {
          write(`${i ? "," : ""}${JSON.stringify(table)}:[`);
          let first = true;
          // Paged by the primary key, so pages never overlap or skip rows.
          const keys = KEYS[table] ?? ["id"];
          const rows = await fetchAll<Record<string, unknown>>((from, to) => {
            let q = db.from(table).select("*");
            for (const k of keys) q = q.order(k as never, { ascending: true });
            return q.range(from, to) as unknown as PromiseLike<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>;
          });
          for (const row of rows) {
            write(`${first ? "" : ","}${JSON.stringify(row)}`);
            first = false;
          }
          write("]");
        }
        write("}}");
        controller.close();
      } catch (e) {
        controller.error(e);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="practice-studio-${group}-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
