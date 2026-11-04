"use client";

import Link from "@/components/NavLink";
import { usePathname } from "next/navigation";

// Small pill tabs, the active one black (PLAN.md section 10). Counts: open reports on Questions, pending
// accounts on Students. Note PDFs, storage and export arrive in later phases.
export function AdminTabs({ pending, reports }: { pending: number; reports: number }) {
  const pathname = usePathname();
  const tabs = [
    { href: "/admin", label: "Exams", count: 0 },
    { href: "/admin/topics", label: "Topics", count: 0 },
    { href: "/admin/questions", label: "Questions", count: reports },
    { href: "/admin/sets", label: "Sets", count: 0 },
    { href: "/admin/students", label: "Students", count: pending },
    { href: "/admin/settings", label: "Settings", count: 0 },
  ];
  return (
    <nav className="wrap" aria-label="Admin sections">
      {tabs.map((t) => {
        const active = t.href === "/admin" ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} className="pill" aria-current={active ? "page" : undefined}>
            {t.label}
            {t.count ? (
              <span className="tab-count" aria-label={`${t.count} waiting`}>
                {t.count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
