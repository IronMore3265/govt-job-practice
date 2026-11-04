// Free plan limits (PLAN.md section 8): 1 GB of file storage and a 500 MB database. Pure helpers, tested with `npm test`.

export const LIMITS_BYTES = { storage: 1024 * 1024 * 1024, database: 500 * 1024 * 1024 } as const;

export function formatBytes(bytes: number): string {
  const n = Math.max(0, Number(bytes) || 0);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

// Share of a limit in use, 0 to 100 (a bar never overflows its box).
export function usagePercent(used: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((used / limit) * 100)));
}

// Plain advice for the bar: calm under 70 percent, a warning above, urgent above 90.
export function usageNote(pct: number): string {
  if (pct >= 90) return "Almost full. Remove files or upgrade the plan.";
  if (pct >= 70) return "Getting full. Compress the largest note PDFs.";
  return "Plenty of room.";
}
