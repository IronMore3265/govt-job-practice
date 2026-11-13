"use client";

import { useState, type ReactNode } from "react";

export type NotesTab = { id: string; label: string; count: number; panel: ReactNode };

// Notes library tabs: one subject (or the student's own marks) on screen at a time, so the list stays short.
// The open tab is kept in the address (?s=), so coming back from a note lands on the same subject.
export function NotesTabs({ tabs, initial }: { tabs: NotesTab[]; initial?: string }) {
  const [active, setActive] = useState(tabs.some((t) => t.id === initial) ? initial : tabs[0]?.id);
  const current = tabs.find((t) => t.id === active) ?? tabs[0];
  if (!current) return null;

  return (
    <>
      <div className="notes-tabs" role="tablist" aria-label="Subjects">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={t.id === current.id}
            className={`pill${t.id === current.id ? " pill-active" : ""}`}
            onClick={() => {
              setActive(t.id);
              window.history.replaceState(null, "", `?s=${encodeURIComponent(t.id)}`);
            }}
          >
            {t.label}
            <span className="tab-count">{t.count}</span>
          </button>
        ))}
      </div>
      <div role="tabpanel" aria-label={current.label}>
        {current.panel}
      </div>
    </>
  );
}
