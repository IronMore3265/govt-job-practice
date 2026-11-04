import { notFound, redirect } from "next/navigation";
import { ReviewView } from "@/components/ReviewView";
import { requireActive } from "@/lib/auth";
import { isUuid } from "@/lib/questions";
import type { Review } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ sessionId: string }>; searchParams: Promise<{ show?: string }> };

// Result and review. get_review is the only place the answer key is ever sent, and only for a finished session.
export default async function ReviewPage({ params, searchParams }: Props) {
  const { sessionId } = await params;
  const { show } = await searchParams;
  if (!isUuid(sessionId)) notFound();
  const { profile } = await requireActive();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_review", { p_session_id: sessionId });
  if (error?.code === "P0001" && /opens after/.test(error.message)) redirect(`/exam/${sessionId}`);
  if (error || !data) notFound();

  return <ReviewView review={data as unknown as Review} sessionId={sessionId} show={show} profileName={profile.name} />;
}
