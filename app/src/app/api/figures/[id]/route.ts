import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isUuid } from "@/lib/questions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// A question's figure. The `figures` bucket is private, so the browser never gets a permanent link: this route checks
// that the caller is an approved member, then redirects to a signed link that stops working after 10 minutes.
// An <img src="/api/figures/<id>"> follows the redirect. The service role key is used only to sign the link.
export async function GET(_request: Request, ctx: RouteContext<"/api/figures/[id]">) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return NextResponse.json({ error: "Bad request." }, { status: 400 });

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (session.profile?.status !== "active") return NextResponse.json({ error: "Your account is not approved yet." }, { status: 403 });

  // Read with the caller's own session, so row level security decides whether they may see this figure.
  const supabase = await createClient();
  const { data: figure } = await supabase.from("figure").select("blob_path").eq("id", id).maybeSingle();
  if (!figure) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const { data, error } = await createAdminClient().storage.from("figures").createSignedUrl(figure.blob_path, 600);
  if (error || !data) return NextResponse.json({ error: "The figure could not be loaded." }, { status: 502 });

  return NextResponse.redirect(data.signedUrl, { status: 302, headers: { "Cache-Control": "private, no-store" } });
}
