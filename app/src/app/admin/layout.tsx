import Link from "@/components/NavLink";
import { AdminBell } from "@/components/AdminBell";
import { AdminTabs } from "@/components/AdminTabs";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Admin portal shell (mockup frame 6): title, bell, back to site, pill tabs with counts.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const supabase = await createClient();
  const [{ count: pending }, { count: reports }] = await Promise.all([
    supabase.from("profile").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("question_report").select("id", { count: "exact", head: true }).eq("status", "open"),
  ]);

  return (
    <main className="shell shell-wide">
      <div className="between topbar">
        <h1 className="heading">
          Admin <span className="accent">Portal</span>
        </h1>
        <div className="topbar-actions">
          <AdminBell />
          <Link href="/" className="btn btn-small">
            Back to site
          </Link>
        </div>
      </div>
      <AdminTabs pending={pending ?? 0} reports={reports ?? 0} />
      {children}
    </main>
  );
}
