import { ActionForm } from "@/components/ActionForm";
import { requireAdmin } from "@/lib/auth";
import type { Profile } from "@/lib/database.types";
import { unusedCounts } from "@/lib/invites";
import { createClient } from "@/lib/supabase/server";
import { resetStudentPassword, setInviteLimit, setStudentStatus } from "./actions";

const ORDER = { pending: 0, active: 1, disabled: 2 } as const;

const dhakaTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Dhaka",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function StatusChip({ profile }: { profile: Profile }) {
  if (profile.status === "pending") return <span className="chip chip-now">Pending</span>;
  if (profile.status === "active") return <span className="chip chip-done">Active</span>;
  return <span className="chip chip-muted">Disabled</span>;
}

// Students and invites: approve, disable, reset password, invite limits. Shows who invited whom.
export default async function StudentsPage() {
  const { profile: me } = await requireAdmin();
  const supabase = await createClient();
  const [{ data }, { data: invites }] = await Promise.all([
    supabase.from("profile").select("*").order("created_at"),
    supabase.from("invite").select("created_by, used_at, expires_at"),
  ]);

  const people = [...(data ?? [])].sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  const names = new Map(people.map((p) => [p.id, p.name]));
  const pending = people.filter((p) => p.status === "pending");
  const others = people.filter((p) => p.status !== "pending");
  const unusedBy = unusedCounts(invites ?? []);
  const invitedBy = (p: Profile) =>
    p.invited_by ? `invited by ${names.get(p.invited_by) ?? "a removed member"}` : p.role === "admin" ? "admin" : "no inviter";

  return (
    <section className="stack" style={{ gap: 22 }}>
      <div className="stack-sm">
        <h2 className="heading">
          Students <span className="accent">{people.length}</span>
        </h2>
        <p className="small muted">New accounts wait here until you approve them. Rejecting an account switches it off, and you can switch it back on later.</p>
      </div>

      <div className="stack-sm" id="pending">
        <p className="label">Pending approval{pending.length ? ` · ${pending.length}` : ""}</p>
        <div className="card rows">
          {pending.length === 0 ? <p className="small muted">Nobody is waiting.</p> : null}
          {pending.map((p) => (
            <div key={p.id} className="row" style={{ flexWrap: "wrap" }}>
              <div>
                <p className="row-name">{p.name}</p>
                <p className="small muted">
                  {p.email} · {invitedBy(p)} · {dhakaTime.format(new Date(p.created_at))}
                </p>
              </div>
              <div className="wrap">
                <ActionForm action={setStudentStatus} submitLabel="Approve" buttonClass="btn btn-small btn-primary" className="wrap">
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="to" value="active" />
                </ActionForm>
                <ActionForm action={setStudentStatus} submitLabel="Reject" buttonClass="btn btn-small" className="wrap" confirmText={`Reject ${p.name}? The account is switched off.`}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="to" value="disabled" />
                </ActionForm>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="stack-sm">
        <p className="label">Everyone else</p>
        <div className="card rows">
          {others.map((p) => {
            const self = p.id === me.id;
            return (
              <div key={p.id} className="student">
                <div className="between">
                  <div>
                    <p className="row-name">
                      {p.name} {p.role === "admin" ? <span className="chip">Admin</span> : null}
                    </p>
                    <p className="small muted">
                      {p.email} · {invitedBy(p)} · {unusedBy.get(p.id) ?? 0} unused code{(unusedBy.get(p.id) ?? 0) === 1 ? "" : "s"}
                    </p>
                  </div>
                  <StatusChip profile={p} />
                </div>

                {self ? null : (
                  <div className="wrap" style={{ alignItems: "flex-end", gap: 20 }}>
                    {p.status === "active" ? (
                      <ActionForm action={setStudentStatus} submitLabel="Disable" buttonClass="btn btn-small" className="wrap" confirmText={`Disable ${p.name}?`}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="to" value="disabled" />
                      </ActionForm>
                    ) : (
                      <ActionForm action={setStudentStatus} submitLabel="Enable" buttonClass="btn btn-small" className="wrap">
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="to" value="active" />
                      </ActionForm>
                    )}
                    <ActionForm action={setInviteLimit} submitLabel="Save limit" buttonClass="btn btn-small" className="inline-form">
                      <input type="hidden" name="id" value={p.id} />
                      <div className="field">
                        <label className="label" htmlFor={`inv-${p.id}`}>Invite limit</label>
                        <input id={`inv-${p.id}`} name="invite_limit" inputMode="numeric" className="input input-sm" defaultValue={p.invite_limit} />
                      </div>
                    </ActionForm>
                    <ActionForm action={resetStudentPassword} submitLabel="Set password" buttonClass="btn btn-small" className="inline-form">
                      <input type="hidden" name="id" value={p.id} />
                      <div className="field" style={{ width: 180 }}>
                        <label className="label" htmlFor={`pw-${p.id}`}>New password</label>
                        <input id={`pw-${p.id}`} name="password" type="text" autoComplete="off" className="input input-sm" minLength={8} maxLength={72} />
                      </div>
                    </ActionForm>
                  </div>
                )}
              </div>
            );
          })}
          {others.length === 0 ? <p className="small muted">No other accounts yet.</p> : null}
        </div>
      </div>
    </section>
  );
}
