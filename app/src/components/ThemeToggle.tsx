"use client";

import { Moon, Sun } from "lucide-react";

// Light and dark switch in the top bar. The choice is kept in this browser; without one the device setting decides
// (the script in layout.tsx sets data-theme on <html> before the first paint). Both icons render and CSS shows one,
// so the server and the browser always agree on the markup.
export function ThemeToggle() {
  const toggle = () => {
    const root = document.documentElement;
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Private mode: the switch still works until the page is closed.
    }
  };

  return (
    <button type="button" className="bell theme-toggle" aria-label="Switch between light and dark mode" onClick={toggle}>
      <Moon className="ico theme-moon" aria-hidden="true" />
      <Sun className="ico theme-sun" aria-hidden="true" />
    </button>
  );
}
