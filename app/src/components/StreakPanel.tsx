import { Check, ChevronDown, Flame } from "lucide-react";

export type StreakView = {
  days: number;
  today_done: boolean;
  subjects: { id: string; name: string; done: boolean }[];
  shared: boolean;
  friends: { name: string; days: number; today_done: boolean }[];
};

const dayWord = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;

// The reward at the end of the bar. Colours come from globals.css: grey until the day is done, then the site's yellow and ink.
function CashPile({ won }: { won: boolean }) {
  const note = (x: number, y: number) => (
    <g key={`${x}-${y}`}>
      <rect className="cash-note" x={x} y={y} width="27" height="7" rx="1" />
      <rect className="cash-band" x={x + 11} y={y} width="5" height="7" />
    </g>
  );
  return (
    <svg className={`cash${won ? " cash-won" : ""}`} width="44" height="34" viewBox="0 0 44 34" role="img" aria-label={won ? "Reward earned today" : "Reward for finishing every subject"}>
      {[note(15, 3), note(13, 11), note(15, 19)]}
      <circle className="cash-coin" cx="11" cy="22" r="9" />
      <text className="cash-sign" x="11" y="26.5" textAnchor="middle">
        $
      </text>
    </svg>
  );
}

// Home side column, above the invites. A day burns when every subject has a finished set. Friends show only when the admin
// has switched shared streaks on, and the database leaves them out otherwise.
export function StreakPanel({ streak }: { streak: StreakView }) {
  const { days, today_done: burning, subjects, shared, friends } = streak;
  const done = subjects.filter((s) => s.done).length;
  const pct = subjects.length ? Math.round((done / subjects.length) * 100) : 0;

  return (
    <section className="card-shadow stack-sm" aria-label="Daily streak">
      <div className="between">
        <p className="label section-label">
          <Flame className={`ico${burning ? "" : " ico-off"}`} aria-hidden="true" />
          Daily streak
        </p>
        <span className={`streak-days${burning ? " streak-days-on" : ""}`}>{dayWord(days)}</span>
      </div>
      <p className="small muted">{burning ? "Today is done. Come back tomorrow." : "Finish one set from each subject today. Answer at least half of it."}</p>

      <div className="streak-goal">
        <div className="streak-bar" role="progressbar" aria-label="Subjects done today" aria-valuemin={0} aria-valuemax={subjects.length} aria-valuenow={done}>
          <div className="streak-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <CashPile won={burning} />
      </div>

      <ul className="streak-list">
        {subjects.map((s) => (
          <li key={s.id} className={`streak-row${s.done ? " streak-row-done" : ""}`}>
            <span className="streak-box">{s.done ? <Check aria-hidden="true" /> : null}</span>
            <span className="streak-name">{s.name}</span>
            {s.done ? <span className="sr-only">done today</span> : null}
          </li>
        ))}
      </ul>

      {shared ? (
        <details className="streak-friends-fold">
          <summary>
            <span className="label">Friends</span>
            <span className="wrap">
              <span className="small muted">
                {friends.filter((f) => f.today_done).length} of {friends.length} done today
              </span>
              <ChevronDown className="ico fold-chevron" aria-hidden="true" />
            </span>
          </summary>
          {friends.length ? (
            <ul className="streak-friends">
              {friends.map((f, i) => (
                <li key={`${i}-${f.name}`} className="streak-friend">
                  <span className="small">{f.name}</span>
                  <span className="small streak-friend-days">
                    {f.today_done ? <Flame className="ico" aria-label="Done today" /> : null}
                    {dayWord(f.days)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="small muted">No friends here yet.</p>
          )}
        </details>
      ) : null}
    </section>
  );
}
