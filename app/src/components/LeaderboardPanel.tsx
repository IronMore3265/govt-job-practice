"use client";

import { useEffect, useState, useTransition } from "react";
import { Trophy } from "lucide-react";
import { getLeaderboard, setLeaderboardMembership, type LeaderRow, type LeaderState } from "@/app/exam/actions";

// The leaderboard in the Home side column (PLAN.md section 3, item 11). Hidden until the admin switches it on. Opt-in:
// you join yourself, and only sessions started after joining count. Shows the top 10 and your own row, with just a
// name, a number of sessions and an average. Answers stay private.
export function LeaderboardPanel({ examId, examName }: { examId: string | undefined; examName: string | undefined }) {
  const [data, setData] = useState<LeaderState | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    let alive = true;
    if (!examId) return;
    getLeaderboard(examId).then((d) => alive && setData(d));
    return () => {
      alive = false;
    };
  }, [examId]);

  if (!examId || !data?.on) return null;

  const rows = data.top;
  const mineShown = rows.some((r) => r.me);
  const toggle = () =>
    start(async () => {
      await setLeaderboardMembership(!data.joined);
      setData(await getLeaderboard(examId));
    });

  const row = (r: LeaderRow) => (
    <li key={`${r.rank}-${r.name}`} className={`lb-row${r.me ? " lb-me" : ""}`}>
      <span className="lb-rank">{r.rank}</span>
      <span className="lb-name">{r.me ? `${r.name} (you)` : r.name}</span>
      <span className="lb-sets small">{r.sessions} {r.sessions === 1 ? "set" : "sets"}</span>
      <span className="lb-pct">{Math.round(Number(r.avg))}%</span>
    </li>
  );

  return (
    <section className="card stack-sm" aria-label="Leaderboard">
      <p className="label section-label">
        <Trophy className="ico" aria-hidden="true" />
        Leaderboard
      </p>
      <p className="small muted">
        {examName}. Average score over finished sets, since you joined. Only your name, sets and average are shown.
      </p>
      {data.joined ? (
        rows.length ? (
          <ol className="lb">
            {rows.map(row)}
            {!mineShown && data.me ? row(data.me) : null}
          </ol>
        ) : (
          <p className="small muted">No finished sets yet. Finish one to appear here.</p>
        )
      ) : (
        <p className="small">Join to see the top 10 and your rank. Sets you finish after joining count.</p>
      )}
      <button type="button" className="btn btn-small" onClick={toggle} disabled={pending}>
        {pending ? "Working..." : data.joined ? "Leave leaderboard" : "Join leaderboard"}
      </button>
    </section>
  );
}
